import { useState } from "react";
import { X, DollarSign, CheckCircle, Clock, XCircle, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

interface ChallengeEarningsModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface CashEarning {
  id: string;
  challenge_title: string;
  cash_amount: number;
  status: string;
  created_at: string;
}

const ChallengeEarningsModal = ({ onClose, onSuccess }: ChallengeEarningsModalProps) => {
  const { user } = useAuth();
  const [paypalEmail, setPaypalEmail] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch approved cash challenge submissions
  const { data: cashEarnings = [] } = useQuery({
    queryKey: ["challenge_cash_earnings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("challenge_submissions")
        .select("id, status, created_at, weekly_challenges(title, reward_type, reward_amount)")
        .eq("user_id", user!.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (!data) return [];

      return data
        .filter((s: any) => s.weekly_challenges?.reward_type === "cash")
        .map((s: any) => ({
          id: s.id,
          challenge_title: s.weekly_challenges?.title || "Challenge",
          cash_amount: s.weekly_challenges?.reward_amount || 0,
          status: s.status,
          created_at: s.created_at,
        }));
    },
  });

  // Fetch cashout history for challenge-related cashouts
  const { data: cashoutHistory = [], refetch: refetchHistory } = useQuery({
    queryKey: ["challenge_cashout_history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("cashout_requests")
        .select("id, cash_amount, status, created_at, paypal_email")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });




  const totalEarned = cashEarnings.reduce((sum: number, e: CashEarning) => sum + e.cash_amount, 0);
  const totalCashedOut = cashoutHistory
    .filter((h: any) => h.status === "approved" || h.status === "paid")
    .reduce((sum: number, h: any) => sum + Number(h.cash_amount), 0);

  const availableCash = Number((totalEarned - totalCashedOut).toFixed(2));

  const hasPending = cashoutHistory.some((h: any) => h.status === "pending");
  const canCashout = !hasPending && availableCash > 0;

  const handleCashout = async () => {
    if (!paypalEmail.includes("@")) {
      toast.error("Enter a valid PayPal email");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cashout-minutes", {
        body: {
          action: "request-cashout",
          cash_amount: availableCash,
          paypal_email: paypalEmail,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`💰 Cashout request submitted for $${data.cash_amount}!`);
      onSuccess();
      refetchHistory();
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

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center px-4" onClick={onClose}>
      <div
        className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-md relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white">
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
            <Trophy className="w-7 h-7 text-emerald-400" />
          </div>
          <h2 className="text-white font-bold text-xl">Challenge Earnings</h2>
          <p className="text-white/50 text-sm mt-1">
            Cash earned from completing weekly challenges
          </p>
        </div>

        {/* Earnings Summary */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-5 space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-white/60 text-sm">🏆 Total Challenge Cash Earned</span>
            <span className="text-emerald-400 font-bold text-base">${totalEarned.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/60 text-sm">💸 Already Cashed Out</span>
            <span className="text-white/60 font-bold text-base">${totalCashedOut.toFixed(2)}</span>
          </div>
          <div className="border-t border-white/10 pt-2 flex justify-between items-center">
            <span className="text-white/60 text-sm">💰 Available to Cash Out</span>
            <span className="text-emerald-400 font-bold text-xl">${availableCash}</span>
          </div>
        </div>

        {/* Approved Challenge Rewards */}
        {cashEarnings.length > 0 && (
          <div className="mb-5">
            <h3 className="text-white/60 text-xs font-bold uppercase tracking-wider mb-2.5">Earned Rewards</h3>
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {cashEarnings.map((e: CashEarning) => (
                <div key={e.id} className="flex items-center justify-between bg-white/5 rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-white text-sm font-bold truncate max-w-[180px]">{e.challenge_title}</span>
                  </div>
                  <span className="text-emerald-400 text-sm font-black">${e.cash_amount}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {cashEarnings.length === 0 && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-5 text-center">
            <p className="text-white/40 text-base font-bold">No cash rewards yet</p>
            <p className="text-white/25 text-sm mt-1">
              Complete challenges with cash rewards to see your earnings here
            </p>
          </div>
        )}

        {/* PayPal Email */}
        {availableCash > 0 && (
          <>
            <div className="mb-4">
              <label className="text-white/60 text-sm block mb-1.5">PayPal Email</label>
              <input
                type="email"
                placeholder="your@paypal.com"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-base placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            {!canCashout && availableCash <= 0 && !hasPending && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4">
                <p className="text-amber-400 text-sm font-bold">⚠️ No cash available</p>
                <p className="text-white/50 text-sm mt-1">
                  Complete challenges with cash rewards to earn money you can cash out.
                </p>
              </div>
            )}

            {hasPending && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4">
                <p className="text-amber-400 text-sm font-bold">⏳ Pending cashout</p>
                <p className="text-white/50 text-sm mt-1">
                  You already have a pending cashout request. Please wait for it to be processed.
                </p>
              </div>
            )}

            <button
              onClick={handleCashout}
              disabled={loading || !canCashout || !paypalEmail.includes("@")}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50 text-base"
            >
              {loading ? "Submitting..." : hasPending ? "Pending Request..." : `💰 Cash Out $${availableCash}`}
            </button>

            <p className="text-white/30 text-xs text-center mt-2.5">
              Paid via PayPal • Admin approval required
            </p>
          </>
        )}

        {/* Cashout History */}
        {cashoutHistory.length > 0 && (
          <div className="mt-5 border-t border-white/10 pt-4">
            <h3 className="text-white/70 text-sm font-bold uppercase tracking-wider mb-3">Cashout History</h3>
            <div className="space-y-2.5 max-h-40 overflow-y-auto">
              {cashoutHistory.map((req: any) => (
                <div key={req.id} className="bg-white/5 rounded-lg px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-bold">${Number(req.cash_amount).toFixed(2)}</p>
                    <p className="text-white/30 text-xs">
                      {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {statusIcon(req.status)}
                    <span className={`text-xs font-bold uppercase ${statusColor(req.status)}`}>
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

export default ChallengeEarningsModal;
