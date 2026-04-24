import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

interface GoalProgressTrackerProps {
  userId: string;
  totalMinutes: number;
  onClick?: () => void;
}

export default function GoalProgressTracker({ userId, totalMinutes, onClick }: GoalProgressTrackerProps) {
  const { data: goal } = useQuery({
    queryKey: ["goal_tracker_item", userId],
    enabled: !!userId && userId !== "anonymous",
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("wishlist_items")
        .select("id, title, image_url, minutes_cost")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  if (!goal) return null;

  const cost = (goal as any).minutes_cost || 0;
  const progress = cost > 0 ? Math.min(100, (totalMinutes / cost) * 100) : 0;
  const remaining = Math.max(0, cost - totalMinutes);
  const ready = remaining === 0;

  return (
    <button
      onClick={onClick}
      className="w-full mx-auto max-w-md bg-gradient-to-r from-pink-500/15 via-purple-500/15 to-pink-500/15 border border-pink-500/30 rounded-2xl px-3 py-2 flex items-center gap-2.5 hover:border-pink-400/60 transition-all active:scale-[0.99] text-left"
    >
      {(goal as any).image_url ? (
        <img
          src={(goal as any).image_url}
          alt={(goal as any).title}
          className="w-10 h-10 rounded-lg object-cover shrink-0 border border-pink-500/30"
        />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center text-lg shrink-0">
          💎
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className="text-white text-[11px] font-black uppercase tracking-wide flex items-center gap-1 truncate">
            <Sparkles className="w-3 h-3 text-yellow-400 shrink-0" />
            <span className="truncate">{(goal as any).title}</span>
          </p>
          <span className="text-pink-300 text-[10px] font-black shrink-0">
            {ready ? "READY!" : `${remaining} left`}
          </span>
        </div>
        <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-pink-400 via-yellow-300 to-pink-400 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </button>
  );
}