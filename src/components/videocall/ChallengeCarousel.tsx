import { useState, useCallback, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronRight, Copy, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBestieChallenge } from "@/hooks/useBestieChallenge";
import { toast } from "sonner";

/* ─── Theme Presets ─── */
const THEME_MAP: Record<string, { gradient: string; border: string; glow: string }> = {
  fuchsia: {
    gradient: "from-fuchsia-600/40 via-purple-700/30 to-pink-900/50",
    border: "border-fuchsia-400/50",
    glow: "shadow-[0_0_18px_rgba(217,70,239,0.3)]",
  },
  cyan: {
    gradient: "from-cyan-600/40 via-blue-700/30 to-indigo-900/50",
    border: "border-cyan-400/50",
    glow: "shadow-[0_0_18px_rgba(34,211,238,0.3)]",
  },
  emerald: {
    gradient: "from-emerald-600/40 via-green-700/30 to-teal-900/50",
    border: "border-emerald-400/50",
    glow: "shadow-[0_0_18px_rgba(52,211,153,0.3)]",
  },
  rose: {
    gradient: "from-rose-600/40 via-pink-700/30 to-red-900/50",
    border: "border-rose-400/50",
    glow: "shadow-[0_0_18px_rgba(251,113,133,0.3)]",
  },
  amber: {
    gradient: "from-amber-600/40 via-yellow-700/30 to-orange-900/50",
    border: "border-amber-400/50",
    glow: "shadow-[0_0_18px_rgba(245,158,11,0.3)]",
  },
  violet: {
    gradient: "from-violet-600/40 via-purple-700/30 to-indigo-900/50",
    border: "border-violet-400/50",
    glow: "shadow-[0_0_18px_rgba(139,92,246,0.3)]",
  },
};

const EMOJI_MAP: Record<string, string> = {
  fuchsia: "👯‍♀️",
  cyan: "👀",
  emerald: "🏃‍♀️",
  rose: "👩‍💻",
  amber: "🏆",
  violet: "✨",
};

const formatReward = (c: any): { reward: string; rewardSub: string } => {
  if (c.reward_type === "cash") return { reward: `$${c.reward_amount}`, rewardSub: "CASH" };
  if (c.reward_type === "minutes") return { reward: `${c.reward_amount} MIN`, rewardSub: "BONUS" };
  return { reward: `${c.reward_amount}d`, rewardSub: "FREE" };
};

interface ChallengeCarouselProps {
  onOpenChallenges: () => void;
  onOpenReferral: () => void;
  isFemale?: boolean;
}

const ChallengeCarousel = ({ onOpenChallenges, onOpenReferral, isFemale }: ChallengeCarouselProps) => {
  const { user } = useAuth();
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: "center", loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  // Fetch active challenges from DB
  const { data: dbChallenges = [] } = useQuery({
    queryKey: ["weekly_challenges_carousel_dynamic"],
    queryFn: async () => {
      const { data } = await supabase
        .from("weekly_challenges")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  // Filter by gender
  const visibleChallenges = dbChallenges.filter((c: any) => !c.female_only || isFemale);

  // Referral data
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

  const referralLink = referralData?.code
    ? `${window.location.origin}/?ref=${referralData.code}`
    : null;

  const copyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!referralLink) {
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

  // Submissions
  const challengeIds = visibleChallenges.map((c: any) => c.id);
  const { data: submissions = [] } = useQuery({
    queryKey: ["challenge_submissions_carousel", user?.id, challengeIds.join(",")],
    enabled: !!user && challengeIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("challenge_submissions")
        .select("challenge_id, status")
        .eq("user_id", user!.id)
        .in("challenge_id", challengeIds);
      return data || [];
    },
  });

  const { hasPair, pairActive, pairCompleted, dailyLogs } = useBestieChallenge();

  const getStatus = (challenge: any) => {
    if (challenge.slug === "bestie-challenge") {
      if (pairCompleted) return "approved";
      if (pairActive) return "active";
      if (hasPair) return "pending";
      return null;
    }
    const sub = submissions.find((s: any) => s.challenge_id === challenge.id);
    return sub?.status || null;
  };

  const getProgress = (challenge: any): string | null => {
    if (challenge.slug === "bestie-challenge") {
      if (!hasPair) return null;
      return `${dailyLogs.length}/3 days`;
    }
    // Speed connect progress from localStorage
    try {
      const action = JSON.parse(challenge.auto_track_action || "null");
      if (action?.type === "auto_speed_connect") {
        const key = `speed_connect_${challenge.slug}`;
        const saved = localStorage.getItem(key);
        if (saved) {
          const parsed = JSON.parse(saved);
          const elapsed = (Date.now() - parsed.startTime) / 1000 / 60;
          const timeLimitMins = challenge.target_minutes || 30;
          if (elapsed < timeLimitMins) {
            const count = parsed.partners?.length || 0;
            return `${count}/${action.target} people`;
          }
        }
        return `Connect ${action.target} in ${challenge.target_minutes || 30}m`;
      }
    } catch { /* */ }
    if (challenge.target_minutes) {
      const key = `${challenge.slug}_minutes`;
      const mins = parseInt(localStorage.getItem(key) || "0", 10);
      return mins > 0 ? `${mins}/${challenge.target_minutes} min` : `Chat for ${challenge.target_minutes} min!`;
    }
    return null;
  };

  // Build slides: bestie first, then other challenges, then referral last
  const sortedChallenges = [...visibleChallenges].sort((a: any, b: any) => {
    if (a.slug === "bestie-challenge") return -1;
    if (b.slug === "bestie-challenge") return 1;
    return 0;
  });

  const allSlides = [
    ...sortedChallenges.map((c: any) => ({ type: "challenge" as const, id: c.id, challenge: c })),
    { type: "referral" as const, id: "refer-earn" },
  ];

  // Calculate total cash value of all visible challenges
  const totalCashValue = visibleChallenges.reduce((sum: number, c: any) => {
    if (c.reward_type === "cash") return sum + (c.reward_amount || 0);
    return sum;
  }, 0);

  return (
    <div className="w-full max-w-[420px] mx-auto px-2 pb-1">
      <p className="text-xs text-neutral-400 text-center mb-1 tracking-wide flex items-center justify-center gap-1">
        <span className="inline-block text-base animate-[float_2s_ease-in-out_infinite]">💵</span>
        <span className="inline-block text-base animate-[float_2.4s_ease-in-out_0.4s_infinite]">💰</span>
        <span>Swipe left and right to earn doing challenges!</span>
        <span className="inline-block text-base animate-[float_2.2s_ease-in-out_0.2s_infinite]">🤑</span>
        <span className="inline-block text-base animate-[float_2.6s_ease-in-out_0.6s_infinite]">💸</span>
      </p>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-2">
          {allSlides.map((slide) => {
            if (slide.type === "referral") {
              const referralCount = referralData?.referrals?.filter((r: any) => r.status === "engaged")?.length ?? 0;
              return (
                <div key="refer-earn" className="flex-[0_0_85%] min-w-0 min-h-[68px]">
                  <button
                    onClick={onOpenReferral}
                    className="w-full h-full bg-gradient-to-r from-pink-600/40 via-fuchsia-700/30 to-purple-900/50 border-pink-400/50 border rounded-xl shadow-[0_0_18px_rgba(236,72,153,0.3)] p-3 flex items-center gap-3 transition-all active:scale-[0.97] relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse pointer-events-none" />
                    <div className="text-3xl shrink-0">💸</div>
                    <div className="flex-1 text-left min-w-0">
                      <span className="font-black text-xs tracking-wider text-white">REFER & EARN</span>
                      <p className="text-[10px] text-neutral-300 font-medium mt-0.5">
                        {referralCount > 0 ? `${referralCount} invited` : "Invite friends for cash!"}
                      </p>
                    </div>
                    <button
                      onClick={copyLink}
                      className="shrink-0 bg-pink-500/25 hover:bg-pink-500/40 border border-pink-400/40 px-2.5 py-1.5 rounded-lg transition-colors active:scale-[0.95] flex items-center gap-1"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-pink-200" /> : <Copy className="w-3.5 h-3.5 text-pink-200" />}
                      <span className="text-pink-100 text-[10px] font-bold">{copied ? "Copied!" : "Copy"}</span>
                    </button>
                    <ChevronRight className="w-4 h-4 text-neutral-500 shrink-0" />
                  </button>
                </div>
              );
            }

            const challenge = slide.challenge!;
            const themeKey = challenge.theme || "cyan";
            const themeStyle = THEME_MAP[themeKey] || THEME_MAP.cyan;
            const emoji = EMOJI_MAP[themeKey] || "🎯";
            const status = getStatus(challenge);
            const progress = getProgress(challenge);
            const { reward, rewardSub } = formatReward(challenge);

            return (
              <div key={challenge.id} className="flex-[0_0_85%] min-w-0 min-h-[68px]">
                <button
                  onClick={onOpenChallenges}
                  className={`w-full h-full bg-gradient-to-r ${themeStyle.gradient} ${themeStyle.border} border rounded-xl ${themeStyle.glow} p-3 flex items-center gap-3 transition-all active:scale-[0.97] relative overflow-hidden`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse pointer-events-none" />
                  <div className="text-3xl shrink-0">{emoji}</div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs tracking-wider text-white">{challenge.title}</span>
                      {status === "approved" && (
                        <span className="text-[9px] font-bold bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">✅ DONE</span>
                      )}
                      {status === "pending" && (
                        <span className="text-[9px] font-bold bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full">⏳</span>
                      )}
                    </div>
                    {progress && (
                      <p className="text-[10px] text-neutral-300 font-medium mt-0.5">{progress}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-lg font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">{reward}</span>
                    <span className="block text-[8px] font-bold text-neutral-400 tracking-widest">{rewardSub}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-500 shrink-0" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 pt-1.5">
        {allSlides.map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              i === selectedIndex ? "bg-white w-3" : "bg-neutral-600"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default ChallengeCarousel;
