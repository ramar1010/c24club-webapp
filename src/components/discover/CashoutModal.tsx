import { useState, useEffect } from "react";
import { X, DollarSign, Clock, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface CashoutModalProps {
  onClose: () => void;
  currentMinutes: number;
  giftedMinutes: number;
  onSuccess: () => void;
}

interface CashoutRequest {
  id: string;
  minutes_amount: number;
  cash_amount: number;
  paypal_email: string;
  status: string;
  created_at: string;
}

const CashoutModal = ({ onClose, currentMinutes, giftedMinutes, onSuccess }: CashoutModalProps) => {
  const { user } = useAuth();
  const [minutes, setMinutes] = useState(100);
  const [paypalEmail, setPaypalEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<CashoutRequest[]>([]);
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

  const fetchHistory = () => {
    if (!user) return;
    supabase
      .from("cashout_requests")
      .select("id, minutes_amount, cash_amount, paypal_email, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setHistory(data);
      });
  };

  useEffect(() => {
    fetchHistory();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("cashout-status")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "cashout_requests",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchHistory()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const cashValue = settings ? (minutes * settings.rate_per_minute).toFixed(2) : "—";
  const maxAllowed = settings
    ? Math.min(giftedMinutes, settings.max_cashout_minutes)
    : giftedMinutes;

  const hasPending = history.some((h) => h.status === "pending");

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

  const statusIcon = (status: string) => {
    if (status === "pending") return <Clock className="w-3.5 h-3.5 text-amber-400" />;
    if (status === "approved" || status === "paid") return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
    return <XCircle className="w-3.5 h-3.5 text-red-400" />;
  };

  const statusColor = (status: string) => {
    if (status === "pending") return "text-amber-400";
    if (status === "approved" || status === "paid") return "text-emerald-400";
    return "text-red-400";
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
        className="bg-neutral-900 border border-white/10 rounded-2xl p-5 w-full max-w-xs relative max-h-[85vh] overflow-y-auto"
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
            Convert your gifted minutes into real cash via PayPal
          </p>
        </div>

        {/* Balance overview */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-4 space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-white/50 text-xs">🎁 Your Gifted Minutes</span>
            <span className="text-emerald-400 font-bold text-sm">{giftedMinutes} min</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/50 text-xs">💵 Each Minute is Worth</span>
            <span className="text-white font-bold text-sm">${settings.rate_per_minute}</span>
          </div>
          <div className="border-t border-white/10 pt-1.5 flex justify-between items-center">
            <span className="text-white/50 text-xs">💰 Full Balance Value</span>
            <span className="text-emerald-400 font-bold text-sm">${(giftedMinutes * settings.rate_per_minute).toFixed(2)}</span>
          </div>
        </div>

        {/* Minutes slider */}
        <div className="mb-4">
          <p className="text-white/60 text-[11px] text-center mb-2">
            Choose how many minutes to cash out (min {settings.min_cashout_minutes} · max {maxAllowed} per request)
          </p>
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
          <p className="text-emerald-400 text-center text-lg font-bold mt-1">
            = ${cashValue}
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

        {giftedMinutes < settings.min_cashout_minutes && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4">
            <p className="text-amber-400 text-xs font-bold mb-1">⚠️ Not enough cashable minutes</p>
            <p className="text-white/50 text-[11px] leading-relaxed">
              You need at least <span className="text-white font-bold">{settings.min_cashout_minutes} gifted minutes</span> to cash out. 
              You currently have <span className="text-white font-bold">{giftedMinutes}</span>.
            </p>
            {currentMinutes > giftedMinutes && (
              <p className="text-white/40 text-[10px] mt-1.5 leading-relaxed">
                💡 Your other {currentMinutes - giftedMinutes} minutes (from spins, rewards, or chatting) can be used in the Reward Store but <span className="text-white/60 font-bold">cannot be cashed out</span> — only gifted minutes are cashable.
              </p>
            )}
          </div>
        )}

        <button
          onClick={handleCashout}
          disabled={loading || hasPending || minutes < settings.min_cashout_minutes || giftedMinutes < settings.min_cashout_minutes}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? "Submitting..." : hasPending ? "Pending Request..." : `Cash Out $${cashValue}`}
        </button>

        <p className="text-white/30 text-[10px] text-center mt-2">
          Paid via PayPal • Admin approval required
        </p>
        <p className="text-white/20 text-[9px] text-center mt-1">
          Only gifted minutes can be cashed out — spin wins, chat earnings & rewards are store-only
        </p>

        {/* Cashout History */}
        {history.length > 0 && (
          <div className="mt-5 border-t border-white/10 pt-4">
            <h3 className="text-white/70 text-xs font-bold uppercase tracking-wider mb-3">Cashout History</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {history.map((req) => (
                <div key={req.id} className="bg-white/5 rounded-lg px-3 py-2 flex items-center justify-between">
                  <div>
                    <p className="text-white text-xs font-bold">${Number(req.cash_amount).toFixed(2)}</p>
                    <p className="text-white/30 text-[10px]">
                      {req.minutes_amount} min • {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {statusIcon(req.status)}
                    <span className={`text-[10px] font-bold uppercase ${statusColor(req.status)}`}>
                      {req.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CashoutModal;