import { useState } from "react";
import bestieCutout from "@/assets/challenges/bestie-cutout.png";
import { ChevronLeft, Users, Eye, Clock, Upload, CheckCircle, XCircle, Clock as ClockStatus, Trophy, Camera, DollarSign, Copy, Check, Link2, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useBestieChallenge } from "@/hooks/useBestieChallenge";

/* ─── Challenge Registry ─── */

interface ChallengeConfig {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  reward: string;
  rewardSub: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  icon: React.ElementType;
  mechanic: "manual" | "auto" | "bestie";
  maxParticipants?: number;
  gradient: string;
  border: string;
  glow: string;
  shimmer: string;
  accentText: string;
  badgeColor: string;
  floatingEmojis: string[];
  progressRenderer?: (submission: any) => React.ReactNode;
}

const CHALLENGE_CONFIGS: ChallengeConfig[] = [
  {
    slug: "bestie-challenge",
    title: "BESTIE CHALLENGE 👯‍♀️",
    subtitle: "Bring Your Friend! 💕",
    description: "Share your invite link → your bestie signs up → call each other 30 mins/day for 3 days. Auto-screenshots verify you're both there. You both earn $25! 🎉",
    reward: "$25",
    rewardSub: "EACH",
    difficulty: "EASY",
    icon: Users,
    mechanic: "bestie",
    gradient: "from-fuchsia-600/30 via-purple-700/25 to-pink-900/40",
    border: "border-fuchsia-400/50",
    glow: "shadow-[0_0_24px_rgba(217,70,239,0.35)]",
    shimmer: "rgba(217,70,239,0.1)",
    accentText: "text-fuchsia-300",
    badgeColor: "bg-green-500/20 text-green-400",
    floatingEmojis: ["💕", "👯‍♀️", "✨"],
  },
  {
    slug: "blue-eyes-hunt",
    title: "BLUE EYES HUNT 👀",
    subtitle: "Spot & Snap! 📸",
    description: "Spot a blue-eyed guy on video chat and tap the 👁️ SNAP button to capture proof. Find 2 and earn 100 bonus minutes! 💎",
    reward: "100 MIN",
    rewardSub: "BONUS",
    difficulty: "MEDIUM",
    icon: Eye,
    mechanic: "manual",
    gradient: "from-cyan-600/30 via-blue-700/25 to-indigo-900/40",
    border: "border-cyan-400/50",
    glow: "shadow-[0_0_24px_rgba(34,211,238,0.35)]",
    shimmer: "rgba(34,211,238,0.1)",
    accentText: "text-cyan-300",
    badgeColor: "bg-amber-500/20 text-amber-400",
    floatingEmojis: ["👀", "💎", "📸"],
  },
  {
    slug: "marathon-talk",
    title: "MARATHON TALK 🏃‍♀️",
    subtitle: "Go the Distance! ⏱️",
    description: "Stay on a single video call for 60 minutes straight. First person to complete it wins $35! 🔥",
    reward: "$35",
    rewardSub: "WINNER",
    difficulty: "MEDIUM",
    icon: Clock,
    mechanic: "auto",
    maxParticipants: 1,
    gradient: "from-emerald-600/30 via-green-700/25 to-teal-900/40",
    border: "border-emerald-400/50",
    glow: "shadow-[0_0_24px_rgba(52,211,153,0.35)]",
    shimmer: "rgba(52,211,153,0.1)",
    accentText: "text-emerald-300",
    badgeColor: "bg-amber-500/20 text-amber-400",
    floatingEmojis: ["🔥", "⏱️", "🏃‍♀️"],
  },
];

/* ─── Status Helpers ─── */

const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  pending: { icon: ClockStatus, color: "text-yellow-400", label: "PENDING REVIEW" },
  approved: { icon: CheckCircle, color: "text-green-400", label: "APPROVED" },
  rejected: { icon: XCircle, color: "text-red-400", label: "NOT APPROVED" },
};

/* ─── Bestie Progress Component ─── */

const BestieProgress = () => {
  const {
    bestiePair, dailyLogs, generating, copied, bestieLink,
    hasPair, pairActive, pairCompleted, waitingForBestie,
    generateInviteCode, copyLink,
  } = useBestieChallenge();

  // No pair yet — show generate button
  if (!hasPair) {
    return (
      <div className="relative mt-3 space-y-2">
        <button
          onClick={generateInviteCode}
          disabled={generating}
          className="w-full bg-fuchsia-500/20 hover:bg-fuchsia-500/30 border border-fuchsia-400/40 text-fuchsia-200 font-black text-sm py-2.5 rounded-full transition-colors active:scale-[0.97] flex items-center justify-center gap-2"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          {generating ? "CREATING..." : "CREATE BESTIE INVITE LINK"}
        </button>
      </div>
    );
  }

  // Pair exists but waiting for bestie to sign up
  if (waitingForBestie) {
    return (
      <div className="relative mt-3 space-y-3">
        <div className="bg-black/30 border border-fuchsia-500/30 rounded-xl p-3">
          <p className="text-[11px] text-fuchsia-300 font-bold mb-2">📩 SHARE THIS LINK WITH YOUR BESTIE:</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-black/40 rounded-lg px-3 py-2 text-xs text-neutral-300 truncate font-mono border border-white/10">
              {bestieLink}
            </div>
            <button
              onClick={copyLink}
              className="shrink-0 bg-fuchsia-500/25 hover:bg-fuchsia-500/35 border border-fuchsia-400/40 p-2 rounded-lg transition-colors active:scale-[0.95]"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-fuchsia-300" />}
            </button>
          </div>
          <p className="text-[10px] text-neutral-500 mt-2">
            ⏳ Waiting for your bestie to sign up with this link...
          </p>
        </div>
      </div>
    );
  }

  // Pair is active — show daily progress
  if (pairActive || pairCompleted) {
    return (
      <div className="relative mt-3 space-y-2">
        <p className="text-[11px] text-fuchsia-300 font-bold">
          {pairCompleted ? "🎉 CHALLENGE COMPLETE!" : "🔥 CHALLENGE ACTIVE — Call your bestie daily!"}
        </p>
        <div className="flex gap-2">
          {[1, 2, 3].map((day) => {
            const log = dailyLogs.find((l: any) => l.day_number === day);
            const completed = log?.verified;
            const inProgress = log && !log.verified;
            const mins = log ? Math.floor((log.total_seconds || 0) / 60) : 0;

            return (
              <div key={day} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-full h-2.5 rounded-full overflow-hidden ${completed ? "bg-fuchsia-500" : "bg-neutral-800"}`}>
                  {inProgress && (
                    <div
                      className="h-full bg-fuchsia-500/60 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (mins / 30) * 100)}%` }}
                    />
                  )}
                  {completed && <div className="h-full bg-fuchsia-500 rounded-full w-full" />}
                </div>
                <span className="text-[10px] text-neutral-500 font-bold">
                  {completed ? "✅" : inProgress ? `${mins}m` : ""} DAY {day}
                </span>
                {log?.inviter_screenshot_url && (
                  <span className="text-[8px] text-fuchsia-400/60">📸 verified</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
};

/* ─── Blue Eyes Progress Component ─── */

const BlueEyesProgress = ({ submissions }: { submissions: any[] }) => {
  const approved = submissions.filter((s: any) => s.status === "approved");
  const pending = submissions.filter((s: any) => s.status === "pending");
  const rejected = submissions.filter((s: any) => s.status === "rejected");
  const totalApproved = approved.length;
  const allDone = totalApproved >= 2;

  return (
    <div className="relative mt-3 space-y-2">
      {allDone && (
        <p className="text-green-400 text-xs font-black">🎉 CHALLENGE COMPLETE! 100 bonus minutes earned!</p>
      )}
      <div className="flex items-center gap-3">
        {[1, 2].map((slot) => {
          const snap = submissions[slot - 1];
          const isApproved = snap?.status === "approved";
          const isPending = snap?.status === "pending";
          const isRejected = snap?.status === "rejected";

          return (
            <div key={slot} className="flex-1">
              {snap?.proof_image_url ? (
                <div className={`relative rounded-lg overflow-hidden border-2 ${isApproved ? "border-green-500" : isPending ? "border-yellow-500" : "border-red-500"}`}>
                  <img src={snap.proof_image_url} alt={`Snap #${slot}`} className="w-full h-16 object-cover" />
                  <div className="absolute bottom-0 inset-x-0 bg-black/70 text-center py-0.5">
                    <span className={`text-[9px] font-black ${isApproved ? "text-green-400" : isPending ? "text-yellow-400" : "text-red-400"}`}>
                      {isApproved ? "✅ APPROVED" : isPending ? "⏳ PENDING" : "❌ REJECTED"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1.5 bg-neutral-800/60 rounded-lg px-3 py-3 border border-cyan-500/20">
                  <Camera className="w-3.5 h-3.5 text-cyan-400/50" />
                  <span className="text-[11px] text-neutral-500 font-bold">#{slot}</span>
                </div>
              )}
            </div>
          );
        })}
        <span className="text-[10px] text-cyan-400/60 font-bold">{totalApproved}/2</span>
      </div>
      {submissions.length < 2 && !allDone && (
        <p className="text-[11px] text-cyan-300/70 font-bold">
          📸 Use the 👁️ SNAP button during a call to capture blue-eyed guys!
        </p>
      )}
    </div>
  );
};

/* ─── Page Component ─── */

const WeeklyChallengesPage = ({ onClose }: { onClose?: () => void }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [submittingSlug, setSubmittingSlug] = useState<string | null>(null);
  const [proofText, setProofText] = useState("");

  // Fetch DB challenges to get IDs for submission tracking
  const { data: dbChallenges = [] } = useQuery({
    queryKey: ["weekly_challenges_slugged"],
    queryFn: async () => {
      const { data } = await supabase
        .from("weekly_challenges")
        .select("*")
        .eq("is_active", true);
      return data || [];
    },
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ["my_challenge_submissions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("challenge_submissions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const getDbChallenge = (slug: string) => dbChallenges.find((c: any) => c.slug === slug);
  const getSubmission = (slug: string) => {
    const db = getDbChallenge(slug);
    if (!db) return null;
    return submissions.find((s: any) => s.challenge_id === db.id);
  };

  const handleSubmit = async (slug: string) => {
    const db = getDbChallenge(slug);
    if (!user || !db || !proofText.trim()) {
      toast.error("Please provide proof text");
      return;
    }
    const { error } = await supabase.from("challenge_submissions").insert({
      user_id: user.id,
      challenge_id: db.id,
      proof_text: proofText.trim(),
      status: "pending",
    });
    if (error) {
      toast.error("Failed to submit", { description: error.message });
      return;
    }
    toast.success("Challenge submitted for review!");
    setSubmittingSlug(null);
    setProofText("");
    queryClient.invalidateQueries({ queryKey: ["my_challenge_submissions"] });
  };

  return (
    <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] flex flex-col items-center px-4 pb-8">
      {/* Header */}
      <div className="w-full flex items-center pt-3 pb-2">
        <button onClick={onClose} className="flex items-center gap-1 hover:opacity-80 transition-opacity active:scale-[0.97]">
          <ChevronLeft className="w-7 h-7" />
          <span className="font-black text-sm tracking-wider">BACK</span>
        </button>
      </div>

      <h1 className="text-3xl font-black tracking-wide mt-2 mb-1">WEEKLY CHALLENGES</h1>
      <p className="text-neutral-400 text-sm mb-6 text-center max-w-sm">
        Quality over quantity — complete challenges, earn real cash & rewards.
      </p>

      {/* Challenge Cards */}
      <div className="w-full max-w-md space-y-5">
        {CHALLENGE_CONFIGS.map((config) => {
          const submission = getSubmission(config.slug);
          const status = submission ? statusConfig[submission.status] : null;
          const Icon = config.icon;

          return (
            <div
              key={config.slug}
              className={`relative overflow-visible bg-gradient-to-br ${config.gradient} ${config.border} border rounded-2xl p-5 ${config.glow}`}
            >
              {/* Bestie cutout sticker */}
              {config.slug === "bestie-challenge" && (
                <img
                  src={bestieCutout}
                  alt="Besties taking a selfie"
                  className="absolute -right-4 -top-10 w-20 sm:w-32 h-auto z-10 drop-shadow-[0_4px_12px_rgba(217,70,239,0.5)] rotate-[4deg] pointer-events-none select-none"
                />
              )}
              {/* Floating emojis */}
              {config.floatingEmojis.map((emoji, i) => (
                <span
                  key={i}
                  className="absolute text-xl pointer-events-none select-none z-10 animate-[emoji-float_3s_ease-in-out_infinite]"
                  style={{
                    right: `${12 + i * 28}px`,
                    bottom: `${10 + i * 14}px`,
                    animationDelay: `${i * 0.7}s`,
                  }}
                >
                  {emoji}
                </span>
              ))}

              {/* Shimmer */}
              <div
                className="absolute inset-0 bg-[linear-gradient(120deg,transparent_30%,var(--shimmer)_50%,transparent_70%)] bg-[length:200%_100%] animate-[shimmer-bg_3s_ease-in-out_infinite]"
                style={{ "--shimmer": config.shimmer } as React.CSSProperties}
              />

              {/* Top row: icon + title + difficulty badge */}
              <div className="relative flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-white/5 rounded-xl border border-white/10">
                    <Icon className={`w-5 h-5 ${config.accentText} drop-shadow-[0_0_8px_currentColor]`} />
                  </div>
                  <div>
                    <h3 className="font-black text-lg leading-tight tracking-wide">{config.title}</h3>
                    <p className={`text-xs font-bold ${config.accentText} opacity-80`}>{config.subtitle}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${config.badgeColor}`}>
                  {config.difficulty}
                </span>
              </div>

              {/* Description */}
              <p className="relative text-neutral-300 text-sm leading-relaxed mb-3">{config.description}</p>

              {/* Reward Display */}
              <div className="relative flex items-center gap-3 mb-1">
                <div className="flex items-baseline gap-1">
                  <Trophy className={`w-4 h-4 ${config.accentText}`} />
                  <span className={`text-2xl font-black ${config.accentText} drop-shadow-[0_0_12px_currentColor]`}>
                    {config.reward}
                  </span>
                  <span className="text-xs font-bold text-neutral-400">{config.rewardSub}</span>
                </div>
                {config.maxParticipants && (
                  <span className="ml-auto text-[10px] font-bold text-neutral-500 bg-neutral-800/60 px-2 py-0.5 rounded-full">
                    Max {config.maxParticipants} participants
                  </span>
                )}
              </div>

              {/* Bestie-specific: invite link + daily progress */}
              {config.mechanic === "bestie" && (
                <BestieProgress />
              )}

              {/* Blue Eyes Hunt: start button + captured snaps */}
              {config.slug === "blue-eyes-hunt" && (() => {
                const huntStarted = localStorage.getItem("blue_eyes_hunt_started") === "true";
                const blueSubmissions = submissions.filter((s: any) => {
                  const db = getDbChallenge("blue-eyes-hunt");
                  return db && s.challenge_id === db.id;
                });
                return huntStarted || blueSubmissions.length > 0 ? (
                  <>
                    <BlueEyesProgress submissions={blueSubmissions} />
                    <div className="relative mt-2 flex items-center gap-1.5 text-[11px] font-bold text-cyan-400/70">
                      <span className="text-base">📸</span> Snap button is active during calls!
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      localStorage.setItem("blue_eyes_hunt_started", "true");
                      toast.success("👁️ Blue Eyes Hunt activated!", { description: "The snap button will appear during your next call." });
                      // Force re-render
                      setSubmittingSlug((prev) => prev === "__force" ? "" : "__force");
                      setTimeout(() => setSubmittingSlug(""), 50);
                    }}
                    className="relative w-full mt-4 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 font-black text-sm py-2.5 rounded-full transition-colors active:scale-[0.97] flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                  >
                    👁️ START HUNT
                  </button>
                );
              })()}

              {/* Progress (custom per challenge, non-bestie, non-blue-eyes) */}
              {config.mechanic !== "bestie" && config.slug !== "blue-eyes-hunt" && !submission && config.progressRenderer && (
                <div className="relative">{config.progressRenderer(submission)}</div>
              )}

              {/* Submission Status (non-blue-eyes) */}
              {config.slug !== "blue-eyes-hunt" && config.slug !== "marathon-talk" && submission && status && (
                <div className={`relative flex items-center gap-2 mt-3 ${status.color}`}>
                  <status.icon className="w-4 h-4" />
                  <span className="text-xs font-black">{status.label}</span>
                </div>
              )}

              {config.slug !== "blue-eyes-hunt" && config.slug !== "marathon-talk" && submission?.status === "approved" && (
                <p className="relative text-green-400 text-xs font-bold mt-2">
                  ✅ Reward earned: {config.reward} {config.rewardSub.toLowerCase()}
                </p>
              )}

              {config.slug !== "blue-eyes-hunt" && config.slug !== "marathon-talk" && submission?.status === "rejected" && (
                <p className="relative text-red-400/80 text-xs font-bold mt-1">
                  You can try again next week.
                </p>
              )}

              {/* Action: Submit Proof (manual, non-blue-eyes) */}
              {config.mechanic === "manual" && config.slug !== "blue-eyes-hunt" && !submission && submittingSlug !== config.slug && (
                <button
                  onClick={() => setSubmittingSlug(config.slug)}
                  className="relative w-full mt-4 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-black text-sm py-2.5 rounded-full transition-colors active:scale-[0.97] flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" /> SUBMIT PROOF
                </button>
              )}

              {/* Marathon Talk: start button + progress */}
              {config.slug === "marathon-talk" && (() => {
                const marathonStarted = localStorage.getItem("marathon_talk_started") === "true";
                const marathonSubmission = submissions.find((s: any) => {
                  const db = getDbChallenge("marathon-talk");
                  return db && s.challenge_id === db.id;
                });
                
                if (marathonSubmission) {
                  const mStatus = statusConfig[marathonSubmission.status];
                  return (
                    <div className="relative mt-3">
                      <div className="mt-1">
                        <div className="flex justify-between text-[10px] text-neutral-500 font-bold mb-1">
                          <span>0 min</span>
                          <span>60 min</span>
                        </div>
                        <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full" style={{ width: "100%" }} />
                        </div>
                      </div>
                      {mStatus && (
                        <div className={`flex items-center gap-2 mt-3 ${mStatus.color}`}>
                          <mStatus.icon className="w-4 h-4" />
                          <span className="text-xs font-black">{mStatus.label}</span>
                        </div>
                      )}
                      {marathonSubmission.status === "approved" && (
                        <p className="text-green-400 text-xs font-bold mt-2">✅ Reward earned: $35</p>
                      )}
                    </div>
                  );
                }
                
                if (!marathonStarted) {
                  return (
                    <button
                      onClick={() => {
                        localStorage.setItem("marathon_talk_started", "true");
                        toast.success("🏃‍♀️ Marathon Talk activated!", { description: "Your call timer will track automatically." });
                        setSubmittingSlug((prev) => prev === "__force2" ? "" : "__force2");
                        setTimeout(() => setSubmittingSlug(""), 50);
                      }}
                      className="relative w-full mt-4 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 font-black text-sm py-2.5 rounded-full transition-colors active:scale-[0.97] flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(52,211,153,0.2)]"
                    >
                      🏃‍♀️ START MARATHON
                    </button>
                  );
                }
                
                // Started but not yet completed
                const savedMins = parseInt(localStorage.getItem("marathon_talk_minutes") || "0", 10);
                const pct = Math.min(100, (savedMins / 60) * 100);
                return (
                  <div className="relative mt-3">
                    <div className="flex justify-between text-[10px] text-neutral-500 font-bold mb-1">
                      <span>{savedMins} min</span>
                      <span>60 min</span>
                    </div>
                    <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-emerald-400/70">
                      <span className="text-base">⚡</span> Auto-tracking — stay on a call for 60 min!
                    </div>
                  </div>
                );
              })()}

              {/* Auto-tracked label (non-marathon) */}
              {config.mechanic === "auto" && config.slug !== "marathon-talk" && !submission && (
                <div className="relative mt-3 flex items-center gap-1.5 text-[11px] font-bold text-neutral-500">
                  <span className="text-base">⚡</span> Auto-tracked — just start a call!
                </div>
              )}

              {/* Proof form */}
              {submittingSlug === config.slug && (
                <div className="relative space-y-3 mt-4">
                  <textarea
                    value={proofText}
                    onChange={(e) => setProofText(e.target.value)}
                    placeholder="Describe your proof or paste a link..."
                    className="w-full bg-black/30 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 resize-none focus:outline-none focus:border-white/30"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSubmit(config.slug)}
                      className="flex-1 bg-white/15 hover:bg-white/20 border border-white/20 text-white font-black text-sm py-2 rounded-full transition-colors active:scale-[0.97]"
                    >
                      SUBMIT
                    </button>
                    <button
                      onClick={() => { setSubmittingSlug(null); setProofText(""); }}
                      className="px-4 bg-neutral-800/60 text-neutral-400 font-bold text-sm py-2 rounded-full hover:opacity-90 active:scale-[0.97]"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Cashout CTA */}
      <button
        onClick={() => navigate("/rewards")}
        className="w-full max-w-md mt-8 relative overflow-hidden bg-gradient-to-r from-amber-500/25 via-yellow-500/20 to-orange-500/25 border border-amber-400/40 rounded-2xl py-4 px-6 shadow-[0_0_20px_rgba(245,158,11,0.25)] active:scale-[0.97] transition-transform"
      >
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_30%,rgba(245,158,11,0.08)_50%,transparent_70%)] bg-[length:200%_100%] animate-[shimmer-bg_3s_ease-in-out_infinite]" />
        <div className="relative flex items-center justify-center gap-2">
          <DollarSign className="w-5 h-5 text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
          <span className="font-black text-amber-200 tracking-wider text-sm drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]">
            CASH OUT MINUTES FOR CASH / REWARDS!
          </span>
        </div>
      </button>
    </div>
  );
};

export default WeeklyChallengesPage;
