import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Gift } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useDirectCall } from "@/hooks/useDirectCall";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SendGiftOverlay from "@/components/videocall/SendGiftOverlay";
import { useNavigate } from "react-router-dom";

interface DirectCallModalProps {
  myUserId: string;
  partnerId: string;
  partnerName: string;
  inviteId: string;
  isInitiator: boolean;
  onClose: () => void;
}

const DirectCallModal = ({
  myUserId,
  partnerId,
  partnerName,
  inviteId,
  isInitiator,
  onClose,
}: DirectCallModalProps) => {
  const [showGift, setShowGift] = useState(false);
  const navigate = useNavigate();

  const {
    callState,
    localVideoRef,
    remoteVideoRef,
    isMuted,
    isCameraOff,
    toggleMute,
    toggleCamera,
    endCall,
  } = useDirectCall({ myUserId, partnerId, inviteId, isInitiator });

  // Track direct call connection for anchor bonus challenges
  const trackedRef = useRef(false);
  useEffect(() => {
    if (callState === "connected" && !trackedRef.current) {
      trackedRef.current = true;
      supabase.functions.invoke("anchor-earning", {
        body: { type: "track_direct_call", userId: myUserId, partnerId },
      }).then(({ data }) => {
        if (data?.results) {
          for (const r of data.results) {
            if (r.status === "completed_and_rewarded") {
              toast.success(`🏆 Challenge complete: ${r.title}! +$${r.reward} bonus!`, { duration: 6000 });
            }
          }
        }
      }).catch(() => {});
    }
  }, [callState, myUserId, partnerId]);

  // Realtime listener for incoming gift notifications
  useEffect(() => {
    const channel = supabase
      .channel("direct-call-gift-" + myUserId)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "gift_transactions",
          filter: `recipient_id=eq.${myUserId}`,
        },
        (payload) => {
          const gift = payload.new as any;
          if (gift.status === "completed") {
            const minutes = gift.minutes_amount || 0;
            const cashValue = (minutes * 0.01).toFixed(2);
            toast.success(
              `🎁 Someone gifted you ${minutes} minutes = $${cashValue}!`,
              {
                description: "Cash out via PayPal now!",
                action: {
                  label: "Cash Out",
                  onClick: () => navigate("/my-rewards"),
                },
                duration: 10000,
              }
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myUserId, navigate]);

  const handleEnd = () => {
    if (isInitiator && callState !== "connected") {
      supabase.functions.invoke("missed-call-email", {
        body: { inviteId, inviterId: myUserId, inviteeId: partnerId },
      }).catch(() => {});
      toast(`We'll notify ${partnerName} that you tried calling. They can text you back or call you!`, {
        duration: 5000,
      });
    }
    endCall();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      {/* Status bar */}
      <div className="absolute top-4 left-0 right-0 text-center z-10">
        <p className="text-white/80 text-sm font-medium">
          {callState === "connecting" && "Connecting..."}
          {callState === "ringing" && `Calling ${partnerName}...`}
          {callState === "connected" && `Connected with ${partnerName}`}
          {callState === "ended" && "Call ended"}
        </p>
        {callState === "connected" && (
          <p className="text-emerald-400 text-xs font-bold mt-1 animate-pulse">
            💸 Tap the gift button to send cash!
          </p>
        )}
      </div>

      {/* Videos */}
      <div className="flex-1 w-full flex items-center justify-center gap-4 p-4">
        {/* Remote video (big) */}
        <div className="relative w-full max-w-[560px] aspect-[3/4] rounded-2xl overflow-hidden bg-white/5">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          {callState !== "connected" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3 text-3xl font-bold text-white/40">
                  {partnerName.charAt(0).toUpperCase()}
                </div>
                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
              </div>
            </div>
          )}
        </div>

        {/* Local video (small, picture-in-picture) */}
        <div className="absolute bottom-24 right-4 w-28 md:w-36 aspect-[3/4] rounded-xl overflow-hidden border-2 border-white/20 shadow-xl z-20">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover mirror"
            style={{ transform: "scaleX(-1)" }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-4 z-10">
        <button
          onClick={toggleMute}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            isMuted ? "bg-red-500 text-white" : "bg-white/15 text-white hover:bg-white/25"
          }`}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Gift button - only show when connected */}
        {callState === "connected" && (
          <button
            onClick={() => setShowGift(true)}
            className="w-12 h-12 rounded-full flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-white transition-all"
          >
            <Gift className="w-5 h-5" />
          </button>
        )}

        <button
          onClick={handleEnd}
          className="w-14 h-14 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 text-white transition-all"
        >
          <PhoneOff className="w-6 h-6" />
        </button>

        <button
          onClick={toggleCamera}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
            isCameraOff ? "bg-red-500 text-white" : "bg-white/15 text-white hover:bg-white/25"
          }`}
        >
          {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>
      </div>

      {/* Gift overlay */}
      {showGift && (
        <SendGiftOverlay
          recipientId={partnerId}
          isDirectCall={true}
          onClose={() => setShowGift(false)}
        />
      )}
    </div>
  );
};

export default DirectCallModal;
