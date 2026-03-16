import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const DmNotificationListener = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const conversationCacheRef = useRef<Map<string, string>>(new Map());
  const senderCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("dm-toast-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dm_messages",
        },
        async (payload) => {
          const msg = payload.new as {
            id: string;
            conversation_id: string;
            sender_id: string;
            content: string;
            created_at: string;
          };

          // Don't notify for own messages
          if (msg.sender_id === user.id) return;

          // Check if this conversation belongs to the current user
          let isMyConvo = conversationCacheRef.current.has(msg.conversation_id);

          if (!isMyConvo) {
            const { data: convo } = await supabase
              .from("conversations")
              .select("participant_1, participant_2")
              .eq("id", msg.conversation_id)
              .single();

            if (convo && (convo.participant_1 === user.id || convo.participant_2 === user.id)) {
              conversationCacheRef.current.set(msg.conversation_id, "yes");
              isMyConvo = true;
            }
          }

          if (!isMyConvo) return;

          // Get sender name
          let senderName = senderCacheRef.current.get(msg.sender_id);
          if (!senderName) {
            const { data: member } = await supabase
              .from("members")
              .select("name")
              .eq("id", msg.sender_id)
              .single();
            senderName = member?.name || "Someone";
            senderCacheRef.current.set(msg.sender_id, senderName);
          }

          const preview = msg.content.length > 60 ? msg.content.slice(0, 60) + "…" : msg.content;

          toast(`💬 ${senderName}`, {
            description: preview,
            duration: 6000,
            action: {
              label: "View",
              onClick: () => navigate("/messages"),
            },
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  return null;
};

export default DmNotificationListener;
