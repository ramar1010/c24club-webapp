import { X, Snowflake, Crown, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import genderSelectIcon from "@/assets/vip/gender-select.png";
import customTopicsIcon from "@/assets/vip/custom-topics.png";
import starEyesIcon from "@/assets/vip/star-eyes.png";
import frozenFaceIcon from "@/assets/vip/frozen-face.png";

interface MinutesFrozenPopupProps {
  onDismiss: () => void;
  onSnooze?: () => void;
  onGoToChallenges: () => void;
  isVip?: boolean;
  onPurchaseVip?: (priceId: string) => Promise<void>;
}

const MinutesFrozenPopup = ({ onDismiss, onSnooze, onGoToChallenges, isVip, onPurchaseVip }: MinutesFrozenPopupProps) => {
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

  const handleVipPurchase = async () => {
    if (onPurchaseVip) {
      setLoading(true);
      try {
        await onPurchaseVip("price_1T9ygOA5n8uAZoY1tzoTfeMH");
      } catch (e: any) {
        toast.error("Failed", { description: e.message });
      }
      setLoading(false);
    }
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

  const vipFeatures = [
    { label: "Gender Filter", icon: genderSelectIcon },
    { label: "Pin Custom Topics", icon: customTopicsIcon },
    { label: "50 Ad Points A Week", icon: starEyesIcon },
    { label: "Auto-Unfreeze", icon: frozenFaceIcon },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="bg-neutral-900 rounded-2xl p-5 max-w-sm w-full text-center relative overflow-y-auto max-h-[90vh]">
        <button onClick={onDismiss} className="absolute top-3 right-3 z-10">
          <X className="w-6 h-6 text-red-500 hover:text-red-400" />
        </button>

        {/* Header */}
        <h2 className="text-2xl font-black text-white mb-1 tracking-wide">
          ❄️ Minutes Frozen!
        </h2>

        <p className="text-neutral-300 text-sm mb-1">
          Your earning rate is reduced to{" "}
          <span className="text-red-400 font-black line-through">2 minutes</span>{" "}
          per user instead of 10 or 30 minutes.
        </p>

        <p className="text-white font-black text-sm uppercase tracking-wide mb-3">
          Save Your Rewards Now!
        </p>

        <h3 className="text-white font-black text-lg mb-3">How To Unfreeze?</h3>

        {/* VIP Upsell Card */}
        {!isVip && (
          <button
            onClick={handleVipPurchase}
            disabled={loading}
            className="w-full bg-gradient-to-b from-red-600 to-red-700 border-2 border-red-400 rounded-2xl p-4 mb-3 text-center hover:opacity-90 transition-opacity"
          >
            <p className="text-white font-black text-base tracking-wide mb-0.5">
              VIP Auto-Protect
            </p>
            <p className="text-red-200 text-xs mb-2.5">
              Never freeze again + Get 3+ VIP Perks for just $0.50 more!
            </p>

            <div className="flex flex-col gap-1.5 mb-2.5">
              {vipFeatures.map((f, i) => (
                <div key={i} className="flex items-center gap-2 justify-center">
                  <img src={f.icon} alt="" className="w-5 h-5 object-contain" />
                  <span className="text-white text-sm font-bold">{f.label}</span>
                </div>
              ))}
            </div>

            <p className="text-white font-black text-lg">
              $2.49 A Week
            </p>
          </button>
        )}

        {/* VIP Auto-Unfreeze for existing VIPs */}
        {isVip && (
          <button
            onClick={handleVipUnfreeze}
            disabled={loading}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black text-sm py-3 rounded-full hover:opacity-90 transition-opacity shadow-lg tracking-wide mb-3 flex items-center justify-center gap-2"
          >
            <Crown className="w-4 h-4" /> VIP AUTO-UNFREEZE
          </button>
        )}

        {/* One-time unfreeze - deliberately less attractive */}
        <button
          onClick={handlePurchaseUnfreeze}
          disabled={loading}
          className="w-full bg-green-800/60 border border-green-600/40 rounded-xl py-3 px-4 hover:bg-green-800/80 transition-colors mb-3"
        >
          <p className="text-green-300 text-xs font-bold">One Time Save</p>
          <p className="text-green-400/70 text-[11px]">Unfreeze for 7 Days Only</p>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <Snowflake className="w-4 h-4 text-blue-300/60" />
            <span className="text-green-300 font-bold text-sm">$1.99</span>
          </div>
        </button>

        {/* Bottom links */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={onDismiss}
            className="text-neutral-600 text-xs font-bold hover:text-neutral-400 transition-colors"
          >
            Dismiss
          </button>
          {onSnooze && (
            <button
              onClick={onSnooze}
              className="text-neutral-600 text-xs font-bold hover:text-yellow-400 transition-colors"
            >
              Don't show for 24h
            </button>
          )}
        </button>
      </div>
    </div>
  );
};

export default MinutesFrozenPopup;
