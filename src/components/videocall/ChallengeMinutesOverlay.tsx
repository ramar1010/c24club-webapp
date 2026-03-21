import { useState } from "react";
import { X, DollarSign, Clock, Trophy, AlertTriangle, Loader2, History, ArrowLeft, Send, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const WAGER_TIERS = [10, 25, 50, 100];

const OUTCOME_CONFIG: Record<string, { emoji: string; label: string; color: string; description: string }> = {
  jackpot: { emoji: "🎰", label: "JACKPOT!", color: "text-yellow-300", description: "You won the $200 JACKPOT!" },
  double: { emoji: "🔥", label: "DOUBLED!", color: "text-green-400", description: "Your minutes were doubled!" },
  cash_win: { emoji: "💵", label: "CASH WIN!", color: "text-emerald-400", description: "Your wager converted to cashable earnings!" },
  lose: { emoji: "💀", label: "BUSTED", color: "text-red-400", description: "You lost your wagered minutes." },
};

/* ---------- Jackpot Cashout Modal ---------- */
const JackpotCashoutModal = ({ userId, onClose, onSuccess }: { userId?: string; onClose: () => void; onSuccess: () => void }) => {
  const [paypalEmail, setPaypalEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: payouts, isLoading } = useQuery({
    queryKey: ["my-jackpot-payouts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("jackpot_payouts" as any)
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const pendingPayouts = payouts?.filter((p: any) => p.status === "pending") ?? [];
  const paidPayouts = payouts?.filter((p: any) => p.status === "paid") ?? [];
  const totalWon = payouts?.reduce((s: number, p: any) => s + Number(p.jackpot_amount), 0) ?? 0;
  const totalPaid = paidPayouts.reduce((s: number, p: any) => s + Number(p.jackpot_amount), 0);

  const handleSubmitPaypal = async (payoutId: string) => {
    if (!paypalEmail.trim() || !paypalEmail.includes("@")) {
      toast.error("Enter a valid PayPal email");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("jackpot_payouts" as any)
        .update({ paypal_email: paypalEmail.trim() } as any)
        .eq("id", payoutId);
      if (error) throw error;
      toast.success("PayPal email submitted! Admin will process your payout.");
      onSuccess();
    } catch (e: any) {
      toast.error(e.message);
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gradient-to-b from-neutral-900 via-black to-neutral-900 border border-yellow-500/30 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <h2 className="text-lg font-black text-yellow-300">WAGER EARNINGS</h2>
          </div>
          <button onClick={onClose} className="p-1.5 bg-neutral-800 rounded-lg hover:bg-neutral-700">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-center">
              <p className="text-[10px] text-yellow-500/70 font-bold">TOTAL WON</p>
              <p className="text-xl font-black text-yellow-300">${totalWon.toFixed(2)}</p>
            </div>
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
              <p className="text-[10px] text-green-500/70 font-bold">PAID OUT</p>
              <p className="text-xl font-black text-green-400">${totalPaid.toFixed(2)}</p>
            </div>
          </div>

          {isLoading ? (
            <p className="text-center text-neutral-500 text-sm py-4">Loading...</p>
          ) : !payouts?.length ? (
            <div className="text-center py-6">
              <p className="text-neutral-500 text-sm">No jackpot wins yet</p>
              <p className="text-neutral-600 text-xs mt-1">Hit the jackpot to see your winnings here!</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {payouts.map((p: any) => (
                <div key={p.id} className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🎰</span>
                      <div>
                        <p className="text-sm font-black text-yellow-300">${Number(p.jackpot_amount).toFixed(2)}</p>
                        <p className="text-[10px] text-neutral-600">{new Date(p.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      p.status === "paid" ? "bg-green-500/20 text-green-400" :
                      p.status === "rejected" ? "bg-red-500/20 text-red-400" :
                      p.paypal_email ? "bg-blue-500/20 text-blue-400" :
                      "bg-yellow-500/20 text-yellow-400"
                    }`}>
                      {p.status === "paid" ? "✓ PAID" :
                       p.status === "rejected" ? "REJECTED" :
                       p.paypal_email ? "AWAITING REVIEW" :
                       "ENTER PAYPAL"}
                    </span>
                  </div>

                  {/* PayPal input for pending payouts without email */}
                  {p.status === "pending" && !p.paypal_email && (
                    <div className="flex gap-2">
                      <input
                        type="email"
                        placeholder="your@paypal.com"
                        value={paypalEmail}
                        onChange={(e) => setPaypalEmail(e.target.value)}
                        className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-yellow-500/50"
                      />
                      <button
                        onClick={() => handleSubmitPaypal(p.id)}
                        disabled={submitting}
                        className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <Send className="w-3 h-3" /> Submit
                      </button>
                    </div>
                  )}

                  {p.paypal_email && p.status === "pending" && (
                    <p className="text-[10px] text-blue-400">PayPal: {p.paypal_email}</p>
                  )}
                  {p.status === "paid" && (
                    <p className="text-[10px] text-green-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Paid to {p.paypal_email}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] text-neutral-600 text-center">
            Jackpot winnings are reviewed and paid out by admin via PayPal
          </p>
        </div>
      </div>
    </div>
  );
};

/* ---------- Main Component ---------- */
interface Props {
  onClose: () => void;
}

const ChallengeMinutesOverlay = ({ onClose }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTier, setSelectedTier] = useState<number>(25);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showCashout, setShowCashout] = useState(false);

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ["wager_status", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("gamble-minutes", {
        body: { type: "get_status", userId: user!.id },
      });
      return data;
    },
  });

  const { data: historyData } = useQuery({
    queryKey: ["wager_history", user?.id],
    enabled: !!user && showHistory,
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("gamble-minutes", {
        body: { type: "get_history", userId: user!.id },
      });
      return data?.history || [];
    },
  });

  const earnedMinutes = (status?.total_minutes ?? 0) - (status?.gifted_minutes ?? 0);
  const dailyLeft = (status?.max_daily ?? 3) - (status?.daily_count ?? 0);
  const weeklyLeft = (status?.max_weekly ?? 10) - (status?.weekly_count ?? 0);

  const handleWager = async () => {
    if (!user || spinning) return;

    if (earnedMinutes < selectedTier) {
      toast.error("Not enough earned minutes", { description: `You have ${earnedMinutes} earned minutes available.` });
      return;
    }

    setSpinning(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("gamble-minutes", {
        body: { type: "wager", userId: user.id, wagerAmount: selectedTier },
      });

      if (error || !data?.success) {
        const msg = data?.message || error?.message || "Wager failed";
        if (msg === "daily_cap") toast.error("Daily limit reached!", { description: "Come back tomorrow." });
        else if (msg === "weekly_cap") toast.error("Weekly limit reached!", { description: "Come back next week." });
        else if (msg === "insufficient_minutes") toast.error("Not enough earned minutes", { description: `You have ${data?.available ?? 0} earned minutes.` });
        else toast.error(msg);
        setSpinning(false);
        return;
      }

      // Dramatic delay
      await new Promise((r) => setTimeout(r, 2000));
      setResult(data);
      refetchStatus();
      queryClient.invalidateQueries({ queryKey: ["wager_history"] });
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSpinning(false);
    }
  };

  const outcomeInfo = result ? OUTCOME_CONFIG[result.outcome] : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-gradient-to-b from-neutral-900 via-black to-neutral-900 border border-yellow-500/30 rounded-2xl shadow-[0_0_40px_rgba(234,179,8,0.2)] overflow-hidden">
        {/* Shimmer */}
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_30%,rgba(234,179,8,0.05)_50%,transparent_70%)] bg-[length:200%_100%] animate-[shimmer-bg_3s_ease-in-out_infinite] pointer-events-none" />

        {/* Header */}
        <div className="relative p-5 pb-3 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500">
              CHALLENGE MINUTES
            </h2>
            <p className="text-xs text-neutral-400 mt-1">Wager your earned minutes for a chance to win big!</p>
          </div>
          <button onClick={onClose} className="p-1.5 bg-neutral-800 rounded-lg hover:bg-neutral-700 transition-colors">
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        {/* Jackpot Banner */}
        <div className="relative mx-5 mb-4 bg-gradient-to-r from-yellow-600/20 via-amber-500/15 to-yellow-600/20 border border-yellow-500/40 rounded-xl p-4 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.1),transparent_70%)] pointer-events-none" />
          <p className="text-[10px] font-bold text-yellow-500/80 tracking-widest mb-1">🎰 GRAND PRIZE 🎰</p>
          <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-300 drop-shadow-[0_0_20px_rgba(234,179,8,0.5)]">
            $200
          </p>
          <p className="text-[10px] text-yellow-500/60 font-bold mt-1">Cash added to your earnings</p>
        </div>

        {!showHistory ? (
          <div className="relative px-5 pb-5 space-y-4">
            {/* Balance Info */}
            <div className="flex items-center justify-between bg-neutral-900/80 border border-neutral-800 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-neutral-500" />
                <div>
                  <p className="text-xs text-neutral-500 font-bold">EARNED MINUTES</p>
                  <p className="text-lg font-black text-white">{earnedMinutes}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-neutral-600 font-bold">TODAY: {dailyLeft} left</p>
                <p className="text-[10px] text-neutral-600 font-bold">WEEK: {weeklyLeft} left</p>
              </div>
            </div>

            {/* Result Display */}
            {result && outcomeInfo && (
              <div className={`text-center py-4 rounded-xl border ${
                result.outcome === "lose" ? "bg-red-900/20 border-red-500/30" : "bg-green-900/20 border-green-500/30"
              }`}>
                <p className="text-4xl mb-2">{outcomeInfo.emoji}</p>
                <p className={`text-2xl font-black ${outcomeInfo.color}`}>{outcomeInfo.label}</p>
                <p className="text-sm text-neutral-300 mt-1">{outcomeInfo.description}</p>
                {result.outcome === "double" && (
                  <p className="text-lg font-black text-green-400 mt-1">+{result.wager_amount} minutes</p>
                )}
                {result.outcome === "cash_win" && (
                  <p className="text-lg font-black text-emerald-400 mt-1">${result.prize_amount} added to cashable balance</p>
                )}
                {result.outcome === "jackpot" && (
                  <p className="text-lg font-black text-yellow-300 mt-1">$200 CASH! 🎉</p>
                )}
                {result.outcome === "lose" && (
                  <p className="text-lg font-black text-red-400 mt-1">-{result.wager_amount} minutes</p>
                )}
              </div>
            )}

            {/* Wager Tiers */}
            {!spinning && (
              <>
                <div>
                  <p className="text-xs text-neutral-500 font-bold mb-2 tracking-wider">SELECT WAGER</p>
                  <div className="grid grid-cols-4 gap-2">
                    {WAGER_TIERS.map((tier) => {
                      const disabled = earnedMinutes < tier;
                      return (
                        <button
                          key={tier}
                          onClick={() => !disabled && setSelectedTier(tier)}
                          disabled={disabled}
                          className={`py-3 rounded-xl border-2 font-black text-sm transition-all ${
                            selectedTier === tier
                              ? "bg-yellow-500/20 border-yellow-400/60 text-yellow-300 shadow-[0_0_12px_rgba(234,179,8,0.2)]"
                              : disabled
                              ? "bg-neutral-900/50 border-neutral-800 text-neutral-700 cursor-not-allowed"
                              : "bg-neutral-900/50 border-neutral-700 text-neutral-300 hover:border-neutral-500"
                          }`}
                        >
                          {tier}m
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Odds Info */}
                <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-3 space-y-1.5">
                  <p className="text-[10px] text-neutral-500 font-bold tracking-wider mb-1">POSSIBLE OUTCOMES</p>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-yellow-400 font-bold">🎰 $200 Jackpot</span>
                    <span className="text-neutral-600">Rare</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-green-400 font-bold">🔥 2x Minutes Back</span>
                    <span className="text-neutral-600">30%</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-emerald-400 font-bold">💵 Cash Win</span>
                    <span className="text-neutral-600">~20%</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-red-400 font-bold">💀 Lose Wager</span>
                    <span className="text-neutral-600">~50%</span>
                  </div>
                </div>
              </>
            )}

            {/* Wager Button */}
            <button
              onClick={result ? () => setResult(null) : handleWager}
              disabled={spinning || dailyLeft <= 0 || weeklyLeft <= 0 || earnedMinutes < selectedTier}
              className={`w-full py-4 rounded-xl font-black text-lg tracking-wider transition-all active:scale-[0.97] flex items-center justify-center gap-3 ${
                spinning
                  ? "bg-neutral-800 text-neutral-500 cursor-wait"
                  : result
                  ? "bg-gradient-to-r from-yellow-500 to-amber-600 text-black hover:opacity-90"
                  : dailyLeft <= 0 || weeklyLeft <= 0
                  ? "bg-neutral-800 text-neutral-600 cursor-not-allowed"
                  : "bg-gradient-to-r from-yellow-500 to-amber-600 text-black hover:opacity-90 shadow-[0_0_20px_rgba(234,179,8,0.3)]"
              }`}
            >
              {spinning ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  CHALLENGING...
                </>
              ) : result ? (
                <>
                  <Trophy className="w-5 h-5" />
                  PLAY AGAIN
                </>
              ) : dailyLeft <= 0 ? (
                "DAILY LIMIT REACHED"
              ) : weeklyLeft <= 0 ? (
                "WEEKLY LIMIT REACHED"
              ) : (
                <>
                  <DollarSign className="w-5 h-5" />
                  WAGER {selectedTier} MINUTES
                </>
              )}
            </button>

            {/* Warning */}
            <div className="flex items-start gap-2 text-[10px] text-neutral-600">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Only earned minutes can be wagered. Gifted/cashable minutes are protected. Limits: {status?.max_daily ?? 3}/day, {status?.max_weekly ?? 10}/week.</span>
            </div>

            {/* Cash Out Button */}
            <button
              onClick={() => setShowCashout(true)}
              className="w-full bg-gradient-to-r from-emerald-500/20 to-green-600/20 border border-emerald-400/40 text-emerald-300 font-black text-sm py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity active:scale-[0.97] shadow-[0_0_12px_rgba(52,211,153,0.15)]"
            >
              <DollarSign className="w-4 h-4" />
              CASH OUT EARNINGS
            </button>

            {/* History Toggle */}
            <button
              onClick={() => setShowHistory(true)}
              className="w-full flex items-center justify-center gap-2 text-xs text-neutral-500 hover:text-neutral-300 font-bold transition-colors py-2"
            >
              <History className="w-3.5 h-3.5" />
              VIEW HISTORY
            </button>
          </div>
        ) : (
          <div className="relative px-5 pb-5 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-neutral-500 font-bold tracking-wider">WAGER HISTORY</p>
              <button
                onClick={() => setShowHistory(false)}
                className="text-xs text-yellow-500 font-bold hover:opacity-80"
              >
                ← BACK
              </button>
            </div>
            {(!historyData || historyData.length === 0) ? (
              <p className="text-center text-neutral-600 text-sm py-6">No wagers yet</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {historyData.map((w: any) => {
                  const info = OUTCOME_CONFIG[w.outcome];
                  return (
                    <div key={w.id} className="flex items-center justify-between bg-neutral-900/60 border border-neutral-800 rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{info?.emoji || "❓"}</span>
                        <div>
                          <p className={`text-xs font-black ${info?.color || "text-neutral-400"}`}>{info?.label || w.outcome}</p>
                          <p className="text-[10px] text-neutral-600">{new Date(w.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-neutral-400">Wagered: {w.wager_amount}m</p>
                        {w.outcome !== "lose" && (
                          <p className="text-[10px] font-bold text-green-400">
                            {w.prize_type === "cash" ? `$${w.prize_amount}` : `+${w.prize_amount}m`}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Jackpot Cashout Modal */}
      {showCashout && (
        <JackpotCashoutModal
          userId={user?.id}
          onClose={() => setShowCashout(false)}
          onSuccess={() => {
            setShowCashout(false);
            refetchStatus();
          }}
        />
      )}
    </div>
  );
};

export default ChallengeMinutesOverlay;
