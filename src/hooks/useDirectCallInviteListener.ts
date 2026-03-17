import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface IncomingDirectCall {
  inviteId: string;
  inviterId: string;
  inviterName: string;
}

/**
 * Global listener for incoming direct video chat invites.
 * Returns pending incoming call data so a modal can be rendered.
 */
export function useDirectCallInviteListener() {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<IncomingDirectCall | null>(null);

  const acceptCall = () => {
    // Keep incomingCall data — consumer will render the DirectCallModal
  };

  const declineCall = () => {
    if (incomingCall) {
      supabase.from("direct_call_invites").update({ status: "declined" } as any).eq("id", incomingCall.inviteId).then();
      // Send missed call email to the invitee (this user declined)
      sendMissedCallEmail(incomingCall.inviterId, user?.id);
    }
    setIncomingCall(null);
  };

  const clearCall = () => setIncomingCall(null);

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

          setIncomingCall({
            inviteId: invite.id,
            inviterId: invite.inviter_id,
            inviterName: name,
          });

          toast(`📹 ${name} wants to video chat!`, {
            description: "Accept or decline the call.",
            duration: 30000,
          });

          // Auto-expire: if not answered in 60s, send missed call email
          setTimeout(async () => {
            const { data: currentInvite } = await supabase
              .from("direct_call_invites")
              .select("status")
              .eq("id", invite.id)
              .maybeSingle();

            if (currentInvite && currentInvite.status === "pending") {
              sendMissedCallEmail(invite.inviter_id, user.id);
            }
          }, 60000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { incomingCall, acceptCall, declineCall, clearCall };
}

/** Fire-and-forget missed call email */
function sendMissedCallEmail(inviterId?: string, inviteeId?: string) {
  if (!inviterId || !inviteeId) return;
  supabase.functions
    .invoke("missed-call-email", {
      body: { inviterId, inviteeId },
    })
    .catch((err) => console.error("Failed to send missed call email:", err));
}
