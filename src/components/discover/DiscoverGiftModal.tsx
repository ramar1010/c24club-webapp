import { useState } from "react";
import { X, Gift, Minus, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DiscoverGiftModalProps {
  recipientId: string;
  recipientName: string;
  onClose: () => void;
}

const QUICK_AMOUNTS = [10, 25, 50, 100];

const DiscoverGiftModal = ({ recipientId, recipientName, onClose }: DiscoverGiftModalProps) => {
  const [amount, setAmount] = useState(25);
  const [loading, setLoading] = useState(false);

  const handleGift = async () => {
    if (amount < 10) {
      toast.error("Minimum gift is 10 minutes");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gift-minutes", {
        body: { action: "gift-from-balance", recipient_id: recipientId, minutes_amount: amount },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`🎁 Gifted ${amount} minutes to ${recipientName}!`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to send gift");
    } finally {
      setLoading(false);
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
        <div className="text-center mb-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-2">
            <Gift className="w-6 h-6 text-amber-400" />
          </div>
          <h2 className="text-white font-bold text-lg">Gift Minutes</h2>
          <p className="text-white/50 text-xs mt-0.5">
            Send minutes to <span className="text-white font-semibold">{recipientName}</span>
          </p>
        </div>

        {/* Quick amounts */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {QUICK_AMOUNTS.map((q) => (
            <button
              key={q}
              onClick={() => setAmount(q)}
              className={`py-2 rounded-lg text-sm font-bold transition-colors ${
                amount === q
                  ? "bg-amber-500 text-black"
                  : "bg-white/10 text-white/70 hover:bg-white/15"
              }`}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Custom amount */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <button
            onClick={() => setAmount(Math.max(10, amount - 5))}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20"
          >
            <Minus className="w-4 h-4" />
          </button>
          <div className="text-center">
            <span className="text-3xl font-black text-white">{amount}</span>
            <p className="text-white/40 text-[10px]">minutes</p>
          </div>
          <button
            onClick={() => setAmount(Math.min(500, amount + 5))}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Send button */}
        <button
          onClick={handleGift}
          disabled={loading}
          className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? "Sending..." : `Gift ${amount} Minutes 🎁`}
        </button>

        <p className="text-white/30 text-[10px] text-center mt-2">
          Deducted from your minute balance • Min 10 • Max 500
        </p>
      </div>
    </div>
  );
};

export default DiscoverGiftModal;
