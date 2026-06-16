import { Gem, Flame, Trophy } from "lucide-react";
import { useBounty } from "@/hooks/useBounty";

interface BountyEarningsPanelProps {
  userId: string | null;
}

const BountyEarningsPanel = ({ userId }: BountyEarningsPanelProps) => {
  const { summary, loading } = useBounty(userId);

  if (loading || !summary) return null;

  const lifetimeMinutes = summary.lifetime_minutes;
  const lifetimeCash = (lifetimeMinutes * 0.01).toFixed(2);

  return (
    <div className="bg-gradient-to-br from-emerald-900/40 to-neutral-900 border border-emerald-500/30 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Gem className="w-5 h-5 text-emerald-400" />
        <h3 className="text-white font-black text-lg tracking-wide">BOUNTY EARNINGS</h3>
      </div>
      <p className="text-white/60 text-xs">
        Earn <span className="text-emerald-400 font-bold">gifted minutes</span> when guys you chat with subscribe to VIP within 7 days. Minutes drop straight into your balance — cash out or redeem rewards.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-black/40 rounded-xl p-3">
          <div className="text-white/50 text-[10px] uppercase tracking-wider">Lifetime Minutes</div>
          <div className="text-emerald-400 text-2xl font-black">{lifetimeMinutes}</div>
        </div>
        <div className="bg-black/40 rounded-xl p-3">
          <div className="text-white/50 text-[10px] uppercase tracking-wider">Cash Value</div>
          <div className="text-white text-2xl font-black">${lifetimeCash}</div>
        </div>
      </div>

      {summary.streak_needed > 0 ? (
        <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-xl px-3 py-2">
          <Flame className="w-4 h-4 text-orange-400" />
          <span className="text-orange-200 text-xs">
            {summary.streak_count}/3 converts this week — {summary.streak_needed} more for <strong>+500 minute bonus</strong> 🔥
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/40 rounded-xl px-3 py-2">
          <Trophy className="w-4 h-4 text-emerald-300" />
          <span className="text-emerald-100 text-xs font-bold">+500 minute streak bonus unlocked! 🔥</span>
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
                +{c.amount_minutes} min
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="pt-2 border-t border-white/10 text-center">
        <p className="text-white/50 text-xs">
          Bounty minutes are added to your <span className="text-emerald-400 font-bold">Gifted Minutes</span> balance — cash out via the Reward Store or redeem for prizes.
        </p>
      </div>
    </div>
  );
};

export default BountyEarningsPanel;
