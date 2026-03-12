import { X } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import giftBoxIcon from "@/assets/videocall/gift-box.png";

interface SendGiftOverlayProps {
  onClose: () => void;
  recipientId: string;
}

const GIFT_TIERS = [
  { tier: "100", minutes: 100, price: "$1.99", label: "100 Minutes $1.99" },
  { tier: "400", minutes: 400, price: "$4.99", label: "400 Minutes $4.99", bonus: "Send 400 Minutes & Get +100 Minutes Back!" },
];

const SendGiftOverlay = ({ onClose, recipientId }: SendGiftOverlayProps) => {
  const [loading, setLoading] = useState<string | null>(null);

  const handleGift = async (tier: string) => {
    setLoading(tier);
    try {
      const { data, error } = await supabase.functions.invoke("gift-minutes", {
        body: { action: "create-checkout", tier, recipient_id: recipientId },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to start gift checkout");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center px-6">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-xs relative">
        {/* Close */}
        <button onClick={onClose} className="absolute top-3 left-3">
          <X className="w-6 h-6 text-red-500" />
        </button>

        {/* Balloon emoji */}
        <div className="absolute top-3 right-4 text-2xl">🎈</div>

        {/* Header */}
        <div className="text-center mb-4">
          <h2 className="text-white text-xl font-black tracking-wider leading-tight">
            SEND A GIFT
          </h2>
          <p className="text-white text-lg font-black tracking-wider">TO THIS USER!</p>
        </div>

        {/* Gift Box */}
        <div className="flex justify-center mb-5 relative">
          <span className="absolute -left-2 top-0 text-2xl">🎉</span>
          <img src={giftBoxIcon} alt="Gift" className="w-20 h-20 object-contain" />
        </div>

        {/* Star icon */}
        <div className="flex justify-center mb-3">
          <span className="text-yellow-400 text-2xl">⭐</span>
        </div>

        {/* Gift Tiers */}
        <div className="space-y-3">
          {GIFT_TIERS.map((gift) => (
            <div key={gift.tier}>
              <button
                onClick={() => handleGift(gift.tier)}
                disabled={loading !== null}
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black text-sm tracking-wider py-3 rounded-full transition-colors disabled:opacity-50 shadow-lg"
              >
                {loading === gift.tier ? "Loading..." : gift.label}
              </button>
              {gift.bonus && (
                <p className="text-yellow-400 text-[10px] font-bold text-center mt-1">
                  {gift.bonus}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* No refund */}
        <p className="text-red-500 text-[10px] font-bold text-center mt-4 tracking-wider">
          NO REFUND POLICY
        </p>
      </div>
    </div>
  );
};

export default SendGiftOverlay;
