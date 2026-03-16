import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * Global listener for incoming direct video chat invites.
 * Shows a toast with "Join Now" when someone invites the current user.
 */
export function useDirectCallInviteListener() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("direct-call-invites")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_call_invites",
          filter: `invitee_id=eq.${user.id}`,
        },
        async (payload) => {
          const invite = payload.new as any;
          if (invite.status !== "pending") return;

          // Fetch inviter name
          const { data: inviter } = await supabase
            .from("members")
            .select("name")
            .eq("id", invite.inviter_id)
            .maybeSingle();

          const name = inviter?.name || "Someone";

          toast(`📹 ${name} wants to video chat!`, {
            description: "They're waiting for you on the video call page.",
            duration: 15000,
            action: {
              label: "Join Now",
              onClick: () => navigate("/videocall"),
            },
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);
}
