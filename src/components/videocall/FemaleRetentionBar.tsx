import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFemaleRetentionBar, type RetentionState } from "@/hooks/useFemaleRetentionBar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";
import FemaleAfkCheckModal from "./FemaleAfkCheckModal";

const AFK_CHECK_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

const MILESTONES_CENTS = [500, 1000, 2000, 3000, 4000, 5000, 10000];
const formatUsd = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

interface CashoutHistoryRow {
  id: string;
  cash_amount: number;
  paypal_email: string;
  status: string;
  created_at: string;
}

export default function FemaleRetentionBar({
  userId,
  state,
}: {
  userId: string;
  state: RetentionState;
}) {
  const [afkOpen, setAfkOpen] = useState(false);
  const [afkPaused, setAfkPaused] = useState(false);
  const { progress, cashout } = useFemaleRetentionBar({
    enabled: true,
    userId,
    state,
    paused: afkPaused || afkOpen,
  });

  // Show the "type the word" check every 5 minutes while actively earning.
  // Does NOT count down while idle, paused, or while the modal is open.
  useEffect(() => {
    if (state === "idle" || afkPaused || afkOpen) return;
    const id = setTimeout(() => setAfkOpen(true), AFK_CHECK_INTERVAL_MS);
    return () => clearTimeout(id);
  }, [state, afkPaused, afkOpen]);
  const [promptCents, setPromptCents] = useState<number | null>(null);
  const [seenMilestones, setSeenMilestones] = useState<Set<number>>(new Set());
  const [paypalEmail, setPaypalEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<CashoutHistoryRow[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  const cents = progress?.current_cents ?? 0;
  const nextMilestone = useMemo(() => MILESTONES_CENTS.find((m) => m > cents) ?? 10000, [cents]);
  const prevMilestone = useMemo(
    () => [...MILESTONES_CENTS].reverse().find((m) => m <= cents) ?? 0,
    [cents],
  );
  const segPct = Math.min(
    100,
    ((cents - prevMilestone) / Math.max(1, nextMilestone - prevMilestone)) * 100,
  );
  const overallPct = Math.min(100, (cents / 10000) * 100);

  // Auto-prompt cashout when a new milestone is reached
  useEffect(() => {
    const reached = MILESTONES_CENTS.find((m) => cents >= m && !seenMilestones.has(m));
    if (reached && promptCents === null) {
      setPromptCents(reached);
      setSeenMilestones((s) => new Set(s).add(reached));
    }
  }, [cents, seenMilestones, promptCents]);

  const loadHistory = async () => {
    const { data } = await supabase
      .from("cashout_requests")
      .select("id, cash_amount, paypal_email, status, created_at")
      .eq("user_id", userId)
      .eq("source", "female_retention")
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((data as any) ?? []);
  };

  useEffect(() => {
    if (showHistory) loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHistory]);

  const handleCashout = async () => {
    if (!promptCents) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paypalEmail)) {
      toast.error("Enter a valid PayPal email");
      return;
    }
    setSubmitting(true);
    const result = await cashout(promptCents, paypalEmail);
    setSubmitting(false);
    if (result?.success) {
      toast.success(`Payout of ${formatUsd(promptCents)} requested! Check status in your earn history.`);
      setPromptCents(null);
      setPaypalEmail("");
      // Reset seen milestones so future increases re-trigger prompts
      setSeenMilestones(new Set());
    } else {
      toast.error(result?.error || "Cashout failed");
    }
  };

  return (
    <div className="rounded-2xl bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-pink-500/20 border-2 border-pink-400/50 p-4 shadow-lg relative">
      {/* Hide/Unhide toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute top-2 right-2 z-10 flex items-center gap-1 text-[10px] font-bold text-pink-100 bg-black/40 hover:bg-black/60 rounded-full px-2 py-1 border border-white/20"
      >
        {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        {collapsed ? "UNHIDE" : "HIDE"}
      </button>

      {/* Headline (hidden when collapsed) */}
      {!collapsed && (
        <div className="text-center mb-1 pr-16">
          <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
            💖 Female users are important so we pay you!
          </h3>
          <p className="text-[11px] sm:text-xs text-pink-100/90 mt-1 leading-snug">
            Watch your bar increase while you're waiting for a partner or connected to a guy user.
            <br />
            <span className="text-yellow-200 font-semibold">Your bar resets if you miss a day.</span>
          </p>
        </div>
      )}

      {/* Big cash + next milestone */}
      <div className={`flex items-end justify-between mb-2 px-1 ${collapsed ? "mt-1 pr-20" : "mt-3"}`}>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-pink-200/80 font-bold">Earned</div>
          <div className="text-3xl font-black text-white drop-shadow">
            {formatUsd(cents)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-pink-200/80 font-bold">Next</div>
          <div className="text-lg font-bold text-yellow-300">{formatUsd(nextMilestone)}</div>
        </div>
      </div>

      {/* Progress bar with milestone ticks */}
      <div className="relative h-5 bg-black/40 rounded-full overflow-hidden border border-white/20">
        <div
          className="h-full bg-gradient-to-r from-pink-400 via-yellow-300 to-green-400 transition-all duration-500"
          style={{ width: `${overallPct}%` }}
        />
        {/* Milestone ticks */}
        {MILESTONES_CENTS.map((m) => {
          const left = (m / 10000) * 100;
          const reached = cents >= m;
          return (
            <div
              key={m}
              className="absolute top-0 bottom-0 flex items-center justify-center"
              style={{ left: `${left}%`, transform: "translateX(-50%)" }}
            >
              <div
                className={`w-1 h-full ${reached ? "bg-white/90" : "bg-white/30"}`}
              />
            </div>
          );
        })}
      </div>

      {/* Milestone labels */}
      {!collapsed && (
      <div className="relative mt-1 h-4 text-[9px] sm:text-[10px] font-bold text-white/80">
        {[0, ...MILESTONES_CENTS].map((m) => {
          const left = (m / 10000) * 100;
          const reached = cents >= m;
          return (
            <span
              key={m}
              className={`absolute ${reached ? "text-yellow-300" : "text-white/60"}`}
              style={{ left: `${left}%`, transform: "translateX(-50%)" }}
            >
              {m === 0 ? "$0" : formatUsd(m)}
            </span>
          );
        })}
      </div>
      )}

      {/* Status row */}
      {!collapsed && (
      <div className="flex items-center justify-between mt-4 text-[11px]">
        <div className="flex items-center gap-1.5 text-white/90">
          {state === "connected_male" ? (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Earning $0.15/min — connected!
            </span>
          ) : state === "waiting" ? (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-300 animate-pulse" />
              Earning $0.05/min — waiting
            </span>
          ) : (
            <span className="text-white/50">Tap START to earn</span>
          )}
        </div>
        <button
          onClick={() => setShowHistory(true)}
          className="text-pink-200 underline font-semibold hover:text-white"
        >
          Earn history
        </button>
      </div>
      )}

      {/* Cashout prompt */}
      <Dialog open={promptCents !== null} onOpenChange={(open) => !open && setPromptCents(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              🎉 You hit {promptCents ? formatUsd(promptCents) : ""}!
            </DialogTitle>
            <DialogDescription>
              Want to cash out now? Your bar will reset to $0 and you can start earning toward the next milestone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label htmlFor="paypal-email">PayPal email</Label>
              <Input
                id="paypal-email"
                type="email"
                placeholder="you@paypal.com"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                maxLength={255}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPromptCents(null)}
                disabled={submitting}
              >
                Keep earning
              </Button>
              <Button className="flex-1 bg-pink-500 hover:bg-pink-600" onClick={handleCashout} disabled={submitting}>
                {submitting ? "Submitting…" : `Cash out ${promptCents ? formatUsd(promptCents) : ""}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History modal */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Earn history</DialogTitle>
            <DialogDescription>Your retention payout requests.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No payouts yet. Hit a milestone to cash out!
              </p>
            ) : (
              history.map((row) => (
                <div key={row.id} className="flex items-center justify-between border rounded-lg p-2.5 text-sm">
                  <div>
                    <div className="font-bold">${Number(row.cash_amount).toFixed(2)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(row.created_at).toLocaleDateString()} • {row.paypal_email}
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-bold uppercase px-2 py-1 rounded ${
                      row.status === "paid"
                        ? "bg-green-500/20 text-green-400"
                        : row.status === "rejected"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-yellow-500/20 text-yellow-400"
                    }`}
                  >
                    {row.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
