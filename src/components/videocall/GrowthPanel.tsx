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
        {/* Referral Card */}
        <div className="bg-gradient-to-br from-emerald-900/60 to-emerald-950/80 border border-emerald-500/20 rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 font-black text-xs tracking-wide">INVITE & EARN</span>
          </div>

          {totalEarned > 0 && (
            <p className="text-emerald-300 text-[10px] font-bold">
              ${totalEarned.toFixed(2)} earned · {successCount} invited
            </p>
          )}

          <button
            onClick={copyLink}
            className="flex items-center justify-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg px-2 py-1.5 transition-colors active:scale-[0.97]"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5 text-emerald-300" />}
            <span className="text-emerald-200 text-[11px] font-bold">
              {copied ? "Copied!" : referralLink ? "Copy Link" : "Get Link"}
            </span>
          </button>

          <button
            onClick={onOpenReferral}
            className="flex items-center justify-center gap-1 text-emerald-400/70 text-[10px] font-bold hover:text-emerald-300 transition-colors"
          >
            View details <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* Challenges Card */}
        <div className="bg-gradient-to-br from-amber-900/60 to-amber-950/80 border border-amber-500/20 rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-amber-400 font-black text-xs tracking-wide">CHALLENGES</span>
          </div>

          {challenges.length > 0 ? (
            <div className="flex flex-col gap-1">
              {challenges.slice(0, 2).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between">
                  <span className="text-white/70 text-[10px] font-medium truncate max-w-[70%]">{c.title}</span>
                  <span className="text-amber-300 text-[10px] font-black">{formatReward(c)}</span>
                </div>
              ))}
              {challenges.length > 2 && (
                <span className="text-amber-400/50 text-[9px] font-bold">+{challenges.length - 2} more</span>
              )}
            </div>
          ) : (
            <p className="text-amber-300/50 text-[10px]">No active challenges</p>
          )}

          <button
            onClick={onOpenChallenges}
            className="flex items-center justify-center gap-1 text-amber-400/70 text-[10px] font-bold hover:text-amber-300 transition-colors mt-auto"
          >
            View all <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default GrowthPanel;
