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

    const seenMessageIds = new Set<string>();

    const checkNewMessages = async () => {
      const { data: convos } = await supabase
        .from("conversations")
        .select("id, participant_1, participant_2")
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .order("last_message_at", { ascending: false })
        .limit(20);

      const conversationIds = (convos || []).map((c) => c.id);
      if (conversationIds.length === 0) return;

      const { data: messages } = await supabase
        .from("dm_messages")
        .select("id, conversation_id, sender_id, content, created_at")
        .in("conversation_id", conversationIds)
        .neq("sender_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      const msg = messages?.find((item) => !seenMessageIds.has(item.id));
      if (!msg) return;
      seenMessageIds.add(msg.id);

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
          onClick: () => {
            const notCancelled = window.dispatchEvent(
              new CustomEvent("open-dm-overlay", { cancelable: true })
            );
            if (notCancelled) {
              navigate("/messages");
            }
          },
        },
      });
    };

    checkNewMessages();
    const poll = setInterval(checkNewMessages, 5000);

    return () => {
      clearInterval(poll);
    };
  }, [user, navigate]);

  return null;
};

export default DmNotificationListener;
