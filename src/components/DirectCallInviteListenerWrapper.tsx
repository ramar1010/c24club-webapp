import { useState, useContext } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DirectCallModal from "@/components/discover/DirectCallModal";

// Inner component that safely uses hooks requiring AuthProvider
function DirectCallInviteListenerInner() {
  const { user } = useAuth();
  // Lazy-import to avoid circular issues during HMR
  const { useDirectCallInviteListener } = require("@/hooks/useDirectCallInviteListener");
  const { incomingCall, clearCall, declineCall } = useDirectCallInviteListener();

  if (!incomingCall || !user) return null;

  return (
    <>
      {/* Incoming call ringing UI */}
      <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center">
        <div className="bg-zinc-900 rounded-2xl p-6 text-center max-w-xs mx-4 border border-white/10">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-emerald-400">
            {incomingCall.inviterName.charAt(0).toUpperCase()}
          </div>
          <p className="text-white font-bold text-lg mb-1">{incomingCall.inviterName}</p>
          <p className="text-white/60 text-sm mb-6">wants to video chat with you</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={declineCall}
              className="px-6 py-2.5 rounded-full bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
            >
              Decline
            </button>
            <AcceptButton
              userId={user.id}
              incomingCall={incomingCall}
              onClose={clearCall}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function AcceptButton({
  userId,
  incomingCall,
  onClose,
}: {
  userId: string;
  incomingCall: { inviteId: string; inviterId: string; inviterName: string };
  onClose: () => void;
}) {
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const handleAccept = async () => {
    if (accepting) return;

    setAccepting(true);
    window.dispatchEvent(new CustomEvent("prepare-direct-call"));

    const { error } = await supabase
      .from("direct_call_invites")
      .update({ status: "accepted" } as any)
      .eq("id", incomingCall.inviteId);

    if (error) {
      toast.error("Failed to accept call", { description: error.message });
      setAccepting(false);
      return;
    }

    setAccepted(true);
    setAccepting(false);
  };

  if (accepted) {
    return (
      <DirectCallModal
        myUserId={userId}
        partnerId={incomingCall.inviterId}
        partnerName={incomingCall.inviterName}
        inviteId={incomingCall.inviteId}
        isInitiator={false}
        onClose={() => {
          setAccepted(false);
          onClose();
        }}
      />
    );
  }

  return (
    <button
      onClick={handleAccept}
      disabled={accepting}
      className="px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-70 disabled:cursor-not-allowed text-white font-medium transition-colors"
    >
      {accepting ? "Accepting..." : "Accept"}
    </button>
  );
}
