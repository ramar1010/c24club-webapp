import { useState, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Users, Eye, Clock, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBestieChallenge } from "@/hooks/useBestieChallenge";

interface MiniChallengeConfig {
  slug: string;
  title: string;
  reward: string;
  rewardSub: string;
  icon: React.ElementType;
  gradient: string;
  border: string;
  glow: string;
  emoji: string;
}

const MINI_CHALLENGES: MiniChallengeConfig[] = [
  {
    slug: "bestie-challenge",
    title: "BESTIE",
    reward: "$25",
    rewardSub: "EACH",
    icon: Users,
    gradient: "from-fuchsia-600/40 via-purple-700/30 to-pink-900/50",
    border: "border-fuchsia-400/50",
    glow: "shadow-[0_0_18px_rgba(217,70,239,0.3)]",
    emoji: "👯‍♀️",
  },
  {
    slug: "blue-eyes-hunt",
    title: "BLUE EYES",
    reward: "100 MIN",
    rewardSub: "BONUS",
    icon: Eye,
    gradient: "from-cyan-600/40 via-blue-700/30 to-indigo-900/50",
    border: "border-cyan-400/50",
    glow: "shadow-[0_0_18px_rgba(34,211,238,0.3)]",
    emoji: "👀",
  },
  {
    slug: "marathon-talk",
    title: "MARATHON",
    reward: "$35",
    rewardSub: "WINNER",
    icon: Clock,
    gradient: "from-emerald-600/40 via-green-700/30 to-teal-900/50",
    border: "border-emerald-400/50",
    glow: "shadow-[0_0_18px_rgba(52,211,153,0.3)]",
    emoji: "🏃‍♀️",
  },
];

interface ChallengeCarouselProps {
  onOpenChallenges: () => void;
}

const ChallengeCarousel = ({ onOpenChallenges }: ChallengeCarouselProps) => {
  const { user } = useAuth();
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    loop: true,
    dragFree: false,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);

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

  // Fetch challenge DB records for submission status
  const { data: dbChallenges = [] } = useQuery({
    queryKey: ["weekly_challenges_carousel"],
    queryFn: async () => {
      const { data } = await supabase
        .from("weekly_challenges")
        .select("id, slug, is_active")
        .in("slug", MINI_CHALLENGES.map(c => c.slug));
      return data || [];
    },
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ["challenge_submissions_carousel", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const challengeIds = dbChallenges.map(c => c.id);
      if (!challengeIds.length) return [];
      const { data } = await supabase
        .from("challenge_submissions")
        .select("challenge_id, status")
        .eq("user_id", user!.id)
        .in("challenge_id", challengeIds);
      return data || [];
    },
  });

  const { hasPair, pairActive, pairCompleted, dailyLogs } = useBestieChallenge();

  const getStatus = (slug: string) => {
    const dbChallenge = dbChallenges.find(c => c.slug === slug);
    if (!dbChallenge) return null;

    if (slug === "bestie-challenge") {
      if (pairCompleted) return "approved";
      if (pairActive) return "active";
      if (hasPair) return "pending";
      return null;
    }

    const sub = submissions.find(s => s.challenge_id === dbChallenge.id);
    return sub?.status || null;
  };

  const getProgress = (slug: string): string | null => {
    if (slug === "bestie-challenge") {
      if (!hasPair) return null;
      return `${dailyLogs.length}/3 days`;
    }
    if (slug === "blue-eyes-hunt") {
      const dbC = dbChallenges.find(c => c.slug === slug);
      if (!dbC) return null;
      const count = submissions.filter(s => s.challenge_id === dbC.id).length;
      return count > 0 ? `${count}/2 found` : null;
    }
    if (slug === "marathon-talk") {
      const started = localStorage.getItem("marathon_talk_started") === "true";
      if (!started) return null;
      const mins = parseInt(localStorage.getItem("marathon_talk_minutes") || "0", 10);
      return `${mins}/60 min`;
    }
    return null;
  };

  return (
    <div className="w-full max-w-[420px] mx-auto px-2 pb-1">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-2">
          {MINI_CHALLENGES.map((challenge) => {
            const status = getStatus(challenge.slug);
            const progress = getProgress(challenge.slug);
            const Icon = challenge.icon;

            return (
              <div
                key={challenge.slug}
                className="flex-[0_0_85%] min-w-0"
              >
                <button
                  onClick={onOpenChallenges}
                  className={`w-full bg-gradient-to-r ${challenge.gradient} ${challenge.border} border rounded-xl ${challenge.glow} p-3 flex items-center gap-3 transition-all active:scale-[0.97] relative overflow-hidden`}
                >
                  {/* Shimmer */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse pointer-events-none" />
                  
                  {/* Emoji icon */}
                  <div className="text-3xl shrink-0">{challenge.emoji}</div>

                  {/* Content */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs tracking-wider text-white">
                        {challenge.title}
                      </span>
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

                  {/* Reward */}
                  <div className="text-right shrink-0">
                    <span className="text-lg font-black text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
                      {challenge.reward}
                    </span>
                    <span className="block text-[8px] font-bold text-neutral-400 tracking-widest">
                      {challenge.rewardSub}
                    </span>
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
        {MINI_CHALLENGES.map((_, i) => (
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
