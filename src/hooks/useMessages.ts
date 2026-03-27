import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message_at: string;
  created_at: string;
  other_user?: {
    id: string;
    name: string;
    image_url: string | null;
    gender: string | null;
    last_active_at: string | null;
  };
  last_message?: string;
  unread_count?: number;
}

export interface DmMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

const CONVO_PAGE_SIZE = 30;

export function useConversations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    staleTime: 15_000,
    queryFn: async () => {
      if (!user) return [];

      // Get conversations – only the most recent ones
      const { data: convos, error } = await supabase
        .from("conversations")
        .select("*")
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .order("last_message_at", { ascending: false })
        .limit(CONVO_PAGE_SIZE);

      if (error) throw error;
      if (!convos || convos.length === 0) return [];

      // Get other user details – single batch
      const otherIds = convos.map((c: any) =>
        c.participant_1 === user.id ? c.participant_2 : c.participant_1
      );

      const { data: members } = await supabase
        .from("members")
        .select("id, name, image_url, gender, last_active_at")
        .in("id", otherIds);

      const memberMap = new Map((members || []).map((m: any) => [m.id, m]));

      // Get last messages for ALL conversations in ONE query
      // Using a subquery approach: get the most recent message per conversation
      const convoIds = convos.map((c: any) => c.id);
      const { data: allMessages } = await supabase
        .from("dm_messages")
        .select("conversation_id, content, created_at")
        .in("conversation_id", convoIds)
        .order("created_at", { ascending: false });

      // Build a map of conversation_id -> last message content
      const lastMsgMap = new Map<string, string>();
      if (allMessages) {
        for (const msg of allMessages) {
          if (!lastMsgMap.has(msg.conversation_id)) {
            lastMsgMap.set(msg.conversation_id, msg.content);
          }
        }
      }

      // Get total unread count across all conversations in ONE query
      const { data: unreadMessages } = await supabase
        .from("dm_messages")
        .select("conversation_id")
        .in("conversation_id", convoIds)
        .neq("sender_id", user.id)
        .is("read_at", null);

      // Count unread per conversation
      const unreadMap = new Map<string, number>();
      if (unreadMessages) {
        for (const msg of unreadMessages) {
          unreadMap.set(msg.conversation_id, (unreadMap.get(msg.conversation_id) || 0) + 1);
        }
      }

      const enriched: Conversation[] = convos.map((c: any) => {
        const otherId = c.participant_1 === user.id ? c.participant_2 : c.participant_1;
        return {
          ...c,
          other_user: memberMap.get(otherId) || { id: otherId, name: "Unknown", image_url: null, gender: null },
          last_message: lastMsgMap.get(c.id) || "",
          unread_count: unreadMap.get(c.id) || 0,
        };
      });

      return enriched;
    },
  });

  // Realtime subscription for new messages – debounced invalidation
  useEffect(() => {
    if (!user) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedInvalidate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
      }, 2000);
    };

    const channel = supabase
      .channel("dm-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dm_messages" },
        debouncedInvalidate
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        debouncedInvalidate
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return query;
}

export function useConversationMessages(conversationId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["dm_messages", conversationId],
    enabled: !!conversationId && !!user,
    refetchInterval: false,
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from("dm_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as DmMessage[];
    },
  });

  // Mark messages as read
  useEffect(() => {
    if (!conversationId || !user || !query.data) return;

    const unread = query.data.filter(
      (m) => m.sender_id !== user.id && !m.read_at
    );

    if (unread.length > 0) {
      supabase
        .from("dm_messages")
        .update({ read_at: new Date().toISOString() })
        .in(
          "id",
          unread.map((m) => m.id)
        )
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
          queryClient.invalidateQueries({ queryKey: ["unread_dm_count"] });
        });
    }
  }, [conversationId, user, query.data, queryClient]);

  // Poll for new messages in this conversation
  useEffect(() => {
    if (!conversationId) return;
    const poll = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["dm_messages", conversationId] });
    }, 3000);
    return () => clearInterval(poll);
  }, [conversationId, queryClient]);

  return query;
}

export function useSendMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recipientId,
      content,
      conversationId,
    }: {
      recipientId: string;
      content: string;
      conversationId?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      let convoId = conversationId;

      if (!convoId) {
        // Try to find existing conversation
        const { data: existing } = await supabase
          .from("conversations")
          .select("id")
          .or(
            `and(participant_1.eq.${user.id},participant_2.eq.${recipientId}),and(participant_1.eq.${recipientId},participant_2.eq.${user.id})`
          )
          .maybeSingle();

        if (existing) {
          convoId = existing.id;
        } else {
          // Sort IDs to always have consistent ordering
          const [p1, p2] = [user.id, recipientId].sort();
          const { data: newConvo, error: convoError } = await supabase
            .from("conversations")
            .insert({ participant_1: p1, participant_2: p2 } as any)
            .select("id")
            .single();

          if (convoError) throw convoError;
          convoId = newConvo.id;
        }
      }

      // Insert message
      const { error: msgError } = await supabase
        .from("dm_messages")
        .insert({
          conversation_id: convoId,
          sender_id: user.id,
          content: content.trim(),
        } as any);

      if (msgError) throw msgError;

      // Update last_message_at
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() } as any)
        .eq("id", convoId);

      return convoId;
    },
    onSuccess: (convoId) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["dm_messages", convoId] });
    },
  });
}

export function useUnreadCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["unread_dm_count", user?.id],
    enabled: !!user,
    refetchInterval: 60000, // 60s instead of 30s
    staleTime: 30000,
    queryFn: async () => {
      if (!user) return 0;

      // Single query: get unread messages across all conversations
      // First get conversation IDs
      const { data: convos } = await supabase
        .from("conversations")
        .select("id")
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`);

      if (!convos || convos.length === 0) return 0;

      const { count } = await supabase
        .from("dm_messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", convos.map((c: any) => c.id))
        .neq("sender_id", user.id)
        .is("read_at", null);

      return count || 0;
    },
  });
}
