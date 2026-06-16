import { useState } from "react";
import { DollarSign, Flame, Trophy } from "lucide-react";
import { useBounty } from "@/hooks/useBounty";
import { toast } from "sonner";

interface BountyEarningsPanelProps {
  userId: string | null;
}

const BountyEarningsPanel = ({ userId }: BountyEarningsPanelProps) => {
  const { summary, loading, requestCashout } = useBounty(userId);
  const [paypal, setPaypal] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading || !summary) return null;

  const pending = summary.pending_cents / 100;
  const lifetime = summary.lifetime_cents / 100;

  const handleCashout = async () => {
    if (!paypal || paypal.length < 5) {
      toast.error("Enter your PayPal email");
      return;
    }
    setBusy(true);
    try {
      const res = await requestCashout(summary.pending_cents, paypal);
      if (res?.success) {
        toast.success(`Cashout requested: $${res.cash_amount?.toFixed(2)}`);
        setPaypal("");
      } else {
        toast.error(res?.error || "Cashout failed");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-emerald-900/40 to-neutral-900 border border-emerald-500/30 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-emerald-400" />
        <h3 className="text-white font-black text-lg tracking-wide">BOUNTY EARNINGS</h3>
      </div>
      <p className="text-white/60 text-xs">
        Earn when guys you chat with subscribe to VIP within 7 days.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-black/40 rounded-xl p-3">
          <div className="text-white/50 text-[10px] uppercase tracking-wider">Pending</div>
          <div className="text-emerald-400 text-2xl font-black">${pending.toFixed(2)}</div>
        </div>
        <div className="bg-black/40 rounded-xl p-3">
          <div className="text-white/50 text-[10px] uppercase tracking-wider">Lifetime</div>
          <div className="text-white text-2xl font-black">${lifetime.toFixed(2)}</div>
        </div>
      </div>

      {summary.streak_needed > 0 ? (
        <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-xl px-3 py-2">
          <Flame className="w-4 h-4 text-orange-400" />
          <span className="text-orange-200 text-xs">
            {summary.streak_count}/3 converts this week — {summary.streak_needed} more for <strong>+$5 bonus</strong>
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/40 rounded-xl px-3 py-2">
          <Trophy className="w-4 h-4 text-emerald-300" />
          <span className="text-emerald-100 text-xs font-bold">Streak bonus unlocked! 🔥</span>
        </div>
      )}

      {summary.recent_converts.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-white/40 text-[10px] uppercase tracking-wider">Recent Converts</div>
          {summary.recent_converts.slice(0, 5).map((c, i) => (
            <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                {c.male_avatar ? (
                  <img src={c.male_avatar} className="w-6 h-6 rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-white/10" />
                )}
                <span className="text-white/80 text-xs">{c.male_name || "Member"}</span>
                <span className="text-white/30 text-[10px] uppercase">{c.source}</span>
              </div>
              <span className="text-emerald-400 text-sm font-bold">
                +${(c.amount_cents / 100).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}

      {summary.pending_cents >= 500 && (
        <div className="space-y-2 pt-2 border-t border-white/10">
          <input
            type="email"
            value={paypal}
            onChange={(e) => setPaypal(e.target.value)}
            placeholder="PayPal email"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/30"
          />
          <button
            onClick={handleCashout}
            disabled={busy}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-3 rounded-xl tracking-wide disabled:opacity-50"
          >
            {busy ? "Processing..." : `CASH OUT $${pending.toFixed(2)} VIA PAYPAL`}
          </button>
        </div>
      )}
      {summary.pending_cents > 0 && summary.pending_cents < 500 && (
        <p className="text-white/40 text-xs text-center">
          Minimum cashout: $5.00 (you have ${pending.toFixed(2)})
        </p>
      )}
    </div>
  );
};

export default BountyEarningsPanel;
