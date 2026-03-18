import { useState, useEffect } from "react";
import { X, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CashoutModalProps {
  onClose: () => void;
  currentMinutes: number;
  giftedMinutes: number;
  onSuccess: () => void;
}

const CashoutModal = ({ onClose, currentMinutes, giftedMinutes, onSuccess }: CashoutModalProps) => {
  const [minutes, setMinutes] = useState(100);
  const [paypalEmail, setPaypalEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<{
    rate_per_minute: number;
    min_cashout_minutes: number;
    max_cashout_minutes: number;
  } | null>(null);

  useEffect(() => {
    supabase.functions
      .invoke("cashout-minutes", { body: { action: "get-settings" } })
      .then(({ data }) => {
        if (data?.settings) setSettings(data.settings);
      });
  }, []);

  const cashValue = settings ? (minutes * settings.rate_per_minute).toFixed(2) : "—";
  const maxAllowed = settings
    ? Math.min(currentMinutes, settings.max_cashout_minutes)
    : currentMinutes;

  const handleCashout = async () => {
    if (!paypalEmail.includes("@")) {
      toast.error("Enter a valid PayPal email");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cashout-minutes", {
        body: { action: "request-cashout", minutes_amount: minutes, paypal_email: paypalEmail },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`💰 Cashout request submitted for $${data.cash_amount}!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Cashout failed");
    } finally {
      setLoading(false);
    }
  };

  if (!settings) {
    return (
      <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center px-4" onClick={onClose}>
      <div
        className="bg-neutral-900 border border-white/10 rounded-2xl p-5 w-full max-w-xs relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-3 text-white/40 hover:text-white">
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-2">
            <DollarSign className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="text-white font-bold text-lg">Cash Out Minutes</h2>
          <p className="text-white/50 text-xs mt-0.5">
            Convert your minutes to real money
          </p>
        </div>

        {/* Minutes slider */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-white/50 mb-1">
            <span>{settings.min_cashout_minutes} min</span>
            <span>{maxAllowed} min</span>
          </div>
          <input
            type="range"
            min={settings.min_cashout_minutes}
            max={maxAllowed}
            step={10}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
          <div className="text-center mt-2">
            <span className="text-3xl font-black text-white">{minutes}</span>
            <span className="text-white/40 text-sm ml-1">minutes</span>
          </div>
          <p className="text-emerald-400 text-center text-sm font-bold mt-1">
            = ${cashValue}
          </p>
          <p className="text-white/30 text-[10px] text-center">
            Rate: ${settings.rate_per_minute}/min
          </p>
        </div>

        {/* PayPal email */}
        <div className="mb-4">
          <label className="text-white/50 text-xs block mb-1">PayPal Email</label>
          <input
            type="email"
            placeholder="your@paypal.com"
            value={paypalEmail}
            onChange={(e) => setPaypalEmail(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        <button
          onClick={handleCashout}
          disabled={loading || minutes < settings.min_cashout_minutes || currentMinutes < settings.min_cashout_minutes}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? "Submitting..." : `Cash Out $${cashValue}`}
        </button>

        <p className="text-white/30 text-[10px] text-center mt-2">
          Paid via PayPal • Admin approval required
        </p>
      </div>
    </div>
  );
};

export default CashoutModal;
