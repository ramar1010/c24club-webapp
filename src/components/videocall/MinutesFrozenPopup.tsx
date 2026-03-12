import { X, Snowflake, Crown, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

interface MinutesFrozenPopupProps {
  onDismiss: () => void;
  onSnooze?: () => void;
  onGoToChallenges: () => void;
  isVip?: boolean;
}

const MinutesFrozenPopup = ({ onDismiss, onSnooze, onGoToChallenges, isVip }: MinutesFrozenPopupProps) => {
  const [loading, setLoading] = useState(false);

  const handlePurchaseUnfreeze = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("unfreeze-purchase", {
        body: { action: "purchase" },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (e: any) {
      toast.error("Failed", { description: e.message });
    }
    setLoading(false);
  };

  const handleVipUnfreeze = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("unfreeze-purchase", {
        body: { action: "vip_unfreeze" },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success("🎉 Minutes unfrozen!", {
          description: `${data.remaining} VIP unfreezes remaining this month`,
        });
        onDismiss();
      } else if (data?.error) {
        toast.error(data.error);
      }
    } catch (e: any) {
      toast.error("Failed", { description: e.message });
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-neutral-900 border border-blue-500/30 rounded-2xl p-6 max-w-sm w-full text-center relative">
        <button onClick={onDismiss} className="absolute top-3 right-3">
          <X className="w-6 h-6 text-neutral-400 hover:text-white" />
        </button>

        <Snowflake className="w-16 h-16 text-blue-400 mx-auto mb-4" />

        <h2 className="text-2xl font-black text-blue-300 mb-2 tracking-wide">
          🥶 MINUTES FROZEN
        </h2>

        <p className="text-neutral-300 text-sm mb-2">
          Your earning rate has been reduced to <span className="text-blue-400 font-black">2 minutes per user</span>.
        </p>

        <p className="text-neutral-400 text-xs mb-5">
          Complete a Weekly Challenge to restore your full earning rate! Each challenge completed adds 7 days of freeze-free earning.
        </p>

        <button
          onClick={onGoToChallenges}
          className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-black text-base py-3 rounded-full hover:opacity-90 transition-opacity shadow-lg tracking-wide mb-3"
        >
          GO TO WEEKLY CHALLENGES
        </button>

        {isVip && (
          <button
            onClick={handleVipUnfreeze}
            disabled={loading}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black text-sm py-2.5 rounded-full hover:opacity-90 transition-opacity shadow-lg tracking-wide mb-3 flex items-center justify-center gap-2"
          >
            <Crown className="w-4 h-4" /> VIP AUTO-UNFREEZE
          </button>
        )}

        <button
          onClick={handlePurchaseUnfreeze}
          disabled={loading}
          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white font-black text-sm py-2.5 rounded-full hover:opacity-90 transition-opacity shadow-lg tracking-wide mb-3 flex items-center justify-center gap-2"
        >
          <CreditCard className="w-4 h-4" /> BUY UNFREEZE — $1.99
        </button>

        <button
          onClick={onDismiss}
          className="text-neutral-500 text-xs font-bold hover:text-white transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default MinutesFrozenPopup;
