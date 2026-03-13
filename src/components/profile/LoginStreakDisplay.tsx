import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MILESTONES = [
  { day: 3, label: "3 Days", reward: "+5 min", icon: "🔥" },
  { day: 7, label: "7 Days", reward: "+10 min, +1 spin", icon: "⚡" },
  { day: 14, label: "14 Days", reward: "+20 min, +2 spins", icon: "💎" },
  { day: 30, label: "30 Days", reward: "+50 min, +3 spins", icon: "👑" },
];

const LoginStreakDisplay = () => {
  const { user } = useAuth();
  const [streak, setStreak] = useState(0);
  const [claimedRewards, setClaimedRewards] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const checkStreak = async () => {
      try {
        const { data } = await supabase.functions.invoke("earn-minutes", {
          body: { type: "check_streak", userId: user.id },
        });

        if (data?.success) {
          setStreak(data.streak);
          setClaimedRewards(data.claimedRewards || []);

          if (data.newRewards?.length > 0) {
            for (const r of data.newRewards) {
              const parts = [];
              if (r.minutesBonus > 0) parts.push(`+${r.minutesBonus} minutes`);
              if (r.spinsBonus > 0) parts.push(`+${r.spinsBonus} spin${r.spinsBonus > 1 ? "s" : ""}`);
              toast.success(`🔥 ${r.day}-Day Streak Reward!`, {
                description: parts.join(" & "),
              });
            }
          }
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };

    checkStreak();
  }, [user]);

  if (loading || !user) return null;

  const nextMilestone = MILESTONES.find((m) => streak < m.day);
  const daysToNext = nextMilestone ? nextMilestone.day - streak : 0;

  return (
    <div className="w-full max-w-sm">
      {/* Streak Counter */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className="text-2xl">🔥</span>
        <span className="text-3xl font-black tabular-nums">{streak}</span>
        <span className="text-sm font-bold text-neutral-400 uppercase tracking-wider">
          Day Streak
        </span>
      </div>

      {nextMilestone && (
        <p className="text-center text-xs text-neutral-500 mb-4">
          {daysToNext} day{daysToNext !== 1 ? "s" : ""} until {nextMilestone.icon} {nextMilestone.reward}
        </p>
      )}

      {/* Milestone Progress */}
      <div className="flex justify-between items-center gap-1 px-2">
        {MILESTONES.map((m, i) => {
          const reached = streak >= m.day;
          const claimed = claimedRewards.includes(m.day);
          const isNext = !reached && (i === 0 || streak >= MILESTONES[i - 1].day);

          return (
            <div key={m.day} className="flex flex-col items-center gap-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 transition-all ${
                  claimed
                    ? "border-orange-500 bg-orange-500/20 scale-110"
                    : reached
                    ? "border-orange-400 bg-orange-500/10"
                    : isNext
                    ? "border-neutral-500 bg-neutral-800 animate-pulse"
                    : "border-neutral-700 bg-neutral-900 opacity-40"
                }`}
              >
                {claimed ? "✅" : m.icon}
              </div>
              <span
                className={`text-[9px] font-bold tracking-wide ${
                  reached ? "text-orange-400" : "text-neutral-600"
                }`}
              >
                {m.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar between milestones */}
      {nextMilestone && (
        <div className="mt-3 mx-2">
          <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (streak / nextMilestone.day) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginStreakDisplay;
