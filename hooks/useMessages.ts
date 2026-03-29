import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── useConversations ─────────────────────────────────────────────────────────

export function useConversations() {
  const { user } = useAuth();

  return useQuery<Conversation[]>({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    refetchInterval: 5000,
    queryFn: async () => {
      if (!user) return [];

      // Fetch conversations where user is participant
      const { data: convos, error } = await supabase
        .from("conversations")
        .select("*")
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .order("last_message_at", { ascending: false });

      if (error) throw error;
      if (!convos || convos.length === 0) return [];

      // Get other user ids
      const otherUserIds = convos.map((c) =>
        c.participant_1 === user.id ? c.participant_2 : c.participant_1
      );

      // Fetch member profiles for other users
      const { data: members } = await supabase
        .from("members")
        .select("id, name, image_url, gender, last_active_at")
        .in("id", otherUserIds);

      const memberMap = new Map<string, {
        id: string;
        name: string;
        image_url: string | null;
        gender: string | null;
        last_active_at: string | null;
      }>();
      (members ?? []).forEach((m) => memberMap.set(m.id, m));

      // For each conversation, get last message and unread count
      const enriched: Conversation[] = await Promise.all(
        convos.map(async (convo) => {
          const otherId =
            convo.participant_1 === user.id
              ? convo.participant_2
              : convo.participant_1;

          // Last message
          const { data: lastMsgData } = await supabase
            .from("dm_messages")
            .select("content")
            .eq("conversation_id", convo.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Unread count
          const { count } = await supabase
            .from("dm_messages")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", convo.id)
            .eq("sender_id", otherId)
            .is("read_at", null);

          return {
            ...convo,
            other_user: memberMap.get(otherId),
            last_message: lastMsgData?.content ?? "",
            unread_count: count ?? 0,
          };
        })
      );

      return enriched;
    },
  });
}

// ─── useConversationMessages ──────────────────────────────────────────────────

export function useConversationMessages(conversationId: string | null) {
  const { user } = useAuth();

  return useQuery<DmMessage[]>({
    queryKey: ["dm_messages", conversationId],
    enabled: !!conversationId && conversationId !== "new" && !!user,
    refetchInterval: 3000,
    queryFn: async () => {
      if (!conversationId || conversationId === "new") return [];

      const { data, error } = await supabase
        .from("dm_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Mark unread messages from other user as read
      if (user && data && data.length > 0) {
        const unreadIds = data
          .filter((m) => m.sender_id !== user.id && !m.read_at)
          .map((m) => m.id);

        if (unreadIds.length > 0) {
          await supabase
            .from("dm_messages")
            .update({ read_at: new Date().toISOString() })
            .in("id", unreadIds);
        }
      }

      return (data ?? []) as DmMessage[];
    },
  });
}

// ─── useSendMessage ───────────────────────────────────────────────────────────

interface SendMessageParams {
  conversationId: string | null;
  partnerId: string;
  content: string;
}

interface SendMessageResult {
  conversationId: string;
  message: DmMessage;
}

export function useSendMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<SendMessageResult, Error, SendMessageParams>({
    mutationFn: async ({ conversationId, partnerId, content }) => {
      if (!user) throw new Error("Not authenticated");

      let actualConversationId = conversationId;

      // If no conversation exists, find or create one
      if (!actualConversationId || actualConversationId === "new") {
        // Check if conversation already exists between these two users
        const { data: existing } = await supabase
          .from("conversations")
          .select("id")
          .or(
            `and(participant_1.eq.${user.id},participant_2.eq.${partnerId}),and(participant_1.eq.${partnerId},participant_2.eq.${user.id})`
          )
          .maybeSingle();

        if (existing) {
          actualConversationId = existing.id;
        } else {
          // Create new conversation
          const { data: newConvo, error: convoError } = await supabase
            .from("conversations")
            .insert({
              participant_1: user.id,
              participant_2: partnerId,
              last_message_at: new Date().toISOString(),
            })
            .select("id")
            .single();

          if (convoError) throw convoError;
          actualConversationId = newConvo.id;
        }
      }

      // Send the message
      const { data: msg, error: msgError } = await supabase
        .from("dm_messages")
        .insert({
          conversation_id: actualConversationId,
          sender_id: user.id,
          content,
        })
        .select("*")
        .single();

      if (msgError) throw msgError;

      // Update conversation last_message_at
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", actualConversationId);

      return {
        conversationId: actualConversationId as string,
        message: msg as DmMessage,
      };
    },
    onSuccess: ({ conversationId: cid }) => {
      queryClient.invalidateQueries({ queryKey: ["dm_messages", cid] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

// ─── useUnreadCount ───────────────────────────────────────────────────────────

export function useUnreadCount() {
  const { user } = useAuth();

  return useQuery<number>({
    queryKey: ["unread_count", user?.id],
    enabled: !!user,
    refetchInterval: 60000,
    queryFn: async () => {
      if (!user) return 0;

      // Get all conversations user is in
      const { data: convos } = await supabase
        .from("conversations")
        .select("id, participant_1, participant_2")
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`);

      if (!convos || convos.length === 0) return 0;

      let total = 0;
      for (const convo of convos) {
        const otherId =
          convo.participant_1 === user.id
            ? convo.participant_2
            : convo.participant_1;

        const { count } = await supabase
          .from("dm_messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", convo.id)
          .eq("sender_id", otherId)
          .is("read_at", null);

        total += count ?? 0;
      }

      return total;
    },
  });
}