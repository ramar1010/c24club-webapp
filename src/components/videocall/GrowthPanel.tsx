import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Copy, Check, UserPlus, Trophy, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface GrowthPanelProps {
  onOpenReferral: () => void;
  onOpenChallenges: () => void;
}

const GrowthPanel = ({ onOpenReferral, onOpenChallenges }: GrowthPanelProps) => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const { data: referralData } = useQuery({
    queryKey: ["growth_referral", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("referral", {
        body: { action: "my_referrals" },
      });
      return data;
    },
  });

  const { data: challenges = [] } = useQuery({
    queryKey: ["growth_challenges"],
    queryFn: async () => {
      const { data } = await supabase
        .from("weekly_challenges")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(3);
      return data || [];
    },
  });

  const referralLink = referralData?.code
    ? `${window.location.origin}/?ref=${referralData.code}`
    : null;

  const copyLink = async () => {
    if (!referralLink) {
      // Generate code first
      try {
        await supabase.functions.invoke("referral", { body: { action: "generate_code" } });
        toast.success("Referral link generated! Tap again to copy.");
      } catch {
        toast.error("Failed to generate link");
      }
      return;
    }
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const totalEarned = referralData?.totalEarned ?? 0;
  const successCount = referralData?.referrals?.filter((r: any) => r.status === "engaged")?.length ?? 0;

  const formatReward = (c: any) => {
    const rt = c.reward_type || "freeze_free";
    const amt = c.reward_amount || 0;
    if (rt === "cash") return `$${amt}`;
    if (rt === "minutes") return `${amt} min`;
    return `${amt || 7}d unfreeze`;
  };

  return (
    <div className="mx-3 mb-2">
      <div className="grid grid-cols-2 gap-2">
        {/* Referral Card — neon pink */}
        <div className="relative overflow-hidden bg-gradient-to-br from-pink-600/30 via-fuchsia-700/25 to-purple-900/40 border border-pink-400/40 rounded-xl p-3 flex flex-col gap-2 shadow-[0_0_18px_rgba(236,72,153,0.25)]">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_30%,rgba(236,72,153,0.08)_50%,transparent_70%)] bg-[length:200%_100%] animate-[shimmer-bg_3s_ease-in-out_infinite]" />
          <div className="relative flex items-center gap-1.5">
            <UserPlus className="w-4 h-4 text-pink-300 drop-shadow-[0_0_6px_rgba(236,72,153,0.6)]" />
            <span className="text-pink-300 font-black text-xs tracking-wide drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]">INVITE & EARN</span>
          </div>

          {totalEarned > 0 && (
            <p className="relative text-pink-200 text-[10px] font-bold">
              ${totalEarned.toFixed(2)} earned · {successCount} invited
            </p>
          )}

          <button
            onClick={copyLink}
            className="relative flex items-center justify-center gap-1.5 bg-pink-500/25 hover:bg-pink-500/40 border border-pink-400/40 rounded-lg px-2 py-1.5 transition-colors active:scale-[0.97] shadow-[0_0_10px_rgba(236,72,153,0.2)]"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-pink-200" /> : <Copy className="w-3.5 h-3.5 text-pink-200" />}
            <span className="text-pink-100 text-[11px] font-bold">
              {copied ? "Copied!" : referralLink ? "Copy Link" : "Get Link"}
            </span>
          </button>

          <button
            onClick={onOpenReferral}
            className="relative flex items-center justify-center gap-1 text-pink-300/80 text-[10px] font-bold hover:text-pink-200 transition-colors"
          >
            View details <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* Challenges Card — neon orange */}
        <div className="relative overflow-hidden bg-gradient-to-br from-orange-500/30 via-amber-600/25 to-rose-900/40 border border-orange-400/40 rounded-xl p-3 flex flex-col gap-2 shadow-[0_0_18px_rgba(251,146,60,0.25)]">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_30%,rgba(251,146,60,0.08)_50%,transparent_70%)] bg-[length:200%_100%] animate-[shimmer-bg_3s_ease-in-out_infinite_0.5s]" />
          <div className="relative flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-orange-300 drop-shadow-[0_0_6px_rgba(251,146,60,0.6)]" />
            <span className="text-orange-300 font-black text-xs tracking-wide drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]">CHALLENGES</span>
          </div>

          {challenges.length > 0 ? (
            <div className="relative flex flex-col gap-1">
              {challenges.slice(0, 2).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between">
                  <span className="text-white/70 text-[10px] font-medium truncate max-w-[70%]">{c.title}</span>
                  <span className="text-orange-200 text-[10px] font-black drop-shadow-[0_0_4px_rgba(251,146,60,0.4)]">{formatReward(c)}</span>
                </div>
              ))}
              {challenges.length > 2 && (
                <span className="text-orange-300/50 text-[9px] font-bold">+{challenges.length - 2} more</span>
              )}
            </div>
          ) : (
            <p className="relative text-orange-200/50 text-[10px]">No active challenges</p>
          )}

          <button
            onClick={onOpenChallenges}
            className="relative flex items-center justify-center gap-1 text-orange-300/80 text-[10px] font-bold hover:text-orange-200 transition-colors mt-auto"
          >
            View all <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default GrowthPanel;
