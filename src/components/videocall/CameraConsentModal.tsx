import { Video, X, DollarSign } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CameraConsentModalProps {
  requestId: string;
  recipientCutCents: number;
  onAccept: () => void;
  onDecline: () => void;
}

const CameraConsentModal = ({
  requestId,
  recipientCutCents,
  onAccept,
  onDecline,
}: CameraConsentModalProps) => {
  const [responding, setResponding] = useState(false);
  const cutDisplay = (recipientCutCents / 100).toFixed(2);

  const handleAccept = async () => {
    setResponding(true);
    try {
      const { data, error } = await supabase.functions.invoke("camera-unlock", {
        body: { action: "accept", request_id: requestId },
      });
      if (error) throw error;

      const minutesEarned = data?.minutes_earned ?? 0;
      toast.success(`📹 Camera enabled! You earned ${minutesEarned} minutes ($${cutDisplay})`, {
        duration: 6000,
      });
      onAccept();
    } catch (err: any) {
      toast.error(err.message || "Failed to accept");
    } finally {
      setResponding(false);
    }
  };

  const handleDecline = async () => {
    setResponding(true);
    try {
      const { error } = await supabase.functions.invoke("camera-unlock", {
        body: { action: "decline", request_id: requestId },
      });
      if (error) throw error;

      toast("Camera request declined — partner will be refunded", { duration: 4000 });
      onDecline();
    } catch (err: any) {
      toast.error(err.message || "Failed to decline");
    } finally {
      setResponding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center px-6">
      <div className="bg-neutral-900 rounded-2xl p-6 max-w-sm w-full text-center border border-amber-500/30 shadow-2xl shadow-amber-500/10">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mx-auto mb-4">
          <Video className="w-8 h-8 text-white" />
        </div>

        <h2 className="text-white font-black text-xl mb-2">
          Camera Request
        </h2>

        <p className="text-neutral-300 text-sm mb-4">
          Your partner wants to enable video. Would you like to turn on your camera?
        </p>

        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 mb-5">
          <div className="flex items-center justify-center gap-1.5">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 font-bold text-sm">
              You'll earn ${cutDisplay} in minutes!
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleDecline}
            disabled={responding}
            className="flex-1 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold transition-colors disabled:opacity-50"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            disabled={responding}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white font-bold transition-colors disabled:opacity-50"
          >
            Accept ✓
          </button>
        </div>

        <p className="text-neutral-500 text-[11px] mt-3">
          Declining will automatically refund your partner
        </p>
      </div>
    </div>
  );
};

export default CameraConsentModal;
