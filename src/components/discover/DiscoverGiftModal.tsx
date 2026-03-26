import { useState } from "react";
import { X, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DiscoverGiftModalProps {
  recipientId: string;
  recipientName: string;
  onClose: () => void;
}

const GIFT_TIERS = [
  { tier: "100", minutes: 100, price: "$1.99", label: "🎁 Gift 100 Minutes — $1.99" },
  {
    tier: "400",
    minutes: 400,
    price: "$4.99",
    label: "🎁 Gift 400 Minutes — $4.99",
    bonus: "You get +100 Minutes back!",
  },
  {
    tier: "600",
    minutes: 600,
    price: "$7.99",
    label: "🎁 Gift 600 Minutes — $7.99",
    bonus: "You get +150 Minutes back!",
  },
  {
    tier: "1000",
    minutes: 1000,
    price: "$12.99",
    label: "🎁 Gift 1000 Minutes — $12.99",
    bonus: "You get +250 Minutes back!",
  },
];

const DiscoverGiftModal = ({ recipientId, recipientName, onClose }: DiscoverGiftModalProps) => {
  const [loading, setLoading] = useState<string | null>(null);

  const handleGift = async (tier: string) => {
    setLoading(tier);
    try {
      const { data, error } = await supabase.functions.invoke("gift-minutes", {
        body: { action: "create-checkout", tier, recipient_id: recipientId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to start gift checkout");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center px-4" onClick={onClose}>
      <div
        className="bg-neutral-900 border border-white/10 rounded-2xl p-5 w-full max-w-xs relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-3 text-white/40 hover:text-white">
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-2">
            <Gift className="w-6 h-6 text-amber-400" />
          </div>
          <h2 className="text-white font-bold text-lg">Gift Minutes</h2>
          <p className="text-white/50 text-xs mt-0.5">
            Send minutes to <span className="text-white font-semibold">{recipientName}</span>
          </p>
        </div>

        {/* Tiers */}
        <div className="space-y-3">
          {GIFT_TIERS.map((gift) => (
            <div key={gift.tier}>
              <button
                onClick={() => handleGift(gift.tier)}
                disabled={loading !== null}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm py-3 rounded-xl transition-colors disabled:opacity-50"
              >
                {loading === gift.tier ? "Loading..." : gift.label}
              </button>
              {gift.bonus && (
                <p className="text-emerald-400 text-[10px] font-bold text-center mt-1">
                  {gift.bonus}
                </p>
              )}
            </div>
          ))}
        </div>

        <p className="text-white/30 text-[10px] text-center mt-4">
          Paid via Stripe • Recipient can cash out earned minutes
        </p>
        <p className="text-red-500/70 text-[10px] font-bold text-center mt-1 tracking-wider">
          NO REFUND POLICY
        </p>
      </div>
    </div>
  );
};

export default DiscoverGiftModal;
