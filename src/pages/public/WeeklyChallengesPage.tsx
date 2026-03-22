import { useState, useEffect, useRef } from "react";
import { getCurrentWeekStart, resetIfStaleWeek, stampWeek } from "@/lib/weekUtils";
import bestieCutout from "@/assets/challenges/bestie-cutout.png";
import boyfriendCutout from "@/assets/quickstart/boyfriend-cutout.png";
import blueEyeImg from "@/assets/challenges/blue-eye.jpg";
import { ChevronLeft, Users, Eye, Clock, Upload, CheckCircle, XCircle, Clock as ClockStatus, Trophy, Camera, DollarSign, Copy, Check, Link2, Loader2, Heart, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useBestieChallenge } from "@/hooks/useBestieChallenge";
import { useBoyfriendChallenge } from "@/hooks/useBoyfriendChallenge";
import ChallengeEarningsModal from "@/components/videocall/ChallengeEarningsModal";
import ChallengeSuggestionForm from "@/components/videocall/ChallengeSuggestionForm";
import ChallengeMinutesOverlay from "@/components/videocall/ChallengeMinutesOverlay";

/* ─── Theme Presets ─── */
const THEME_MAP: Record<string, {
  gradient: string; border: string; glow: string; shimmer: string;
  accentText: string; badgeColor: string; icon: React.ElementType;
}> = {
  fuchsia: {
    gradient: "from-fuchsia-600/30 via-purple-700/25 to-pink-900/40",
    border: "border-fuchsia-400/50",
    glow: "shadow-[0_0_24px_rgba(217,70,239,0.35)]",
    shimmer: "rgba(217,70,239,0.1)",
    accentText: "text-fuchsia-300",
    badgeColor: "bg-green-500/20 text-green-400",
    icon: Users,
  },
  cyan: {
    gradient: "from-cyan-600/30 via-blue-700/25 to-indigo-900/40",
    border: "border-cyan-400/50",
    glow: "shadow-[0_0_24px_rgba(34,211,238,0.35)]",
    shimmer: "rgba(34,211,238,0.1)",
    accentText: "text-cyan-300",
    badgeColor: "bg-amber-500/20 text-amber-400",
    icon: Eye,
  },
  emerald: {
    gradient: "from-emerald-600/30 via-green-700/25 to-teal-900/40",
    border: "border-emerald-400/50",
    glow: "shadow-[0_0_24px_rgba(52,211,153,0.35)]",
    shimmer: "rgba(52,211,153,0.1)",
    accentText: "text-emerald-300",
    badgeColor: "bg-amber-500/20 text-amber-400",
    icon: Clock,
  },
  rose: {
    gradient: "from-rose-600/30 via-pink-700/25 to-red-900/40",
    border: "border-rose-400/50",
    glow: "shadow-[0_0_24px_rgba(251,113,133,0.35)]",
    shimmer: "rgba(251,113,133,0.1)",
    accentText: "text-rose-300",
    badgeColor: "bg-green-500/20 text-green-400",
    icon: Heart,
  },
  amber: {
    gradient: "from-amber-600/30 via-yellow-700/25 to-orange-900/40",
    border: "border-amber-400/50",
    glow: "shadow-[0_0_24px_rgba(245,158,11,0.35)]",
    shimmer: "rgba(245,158,11,0.1)",
    accentText: "text-amber-300",
    badgeColor: "bg-amber-500/20 text-amber-400",
    icon: Trophy,
  },
  violet: {
    gradient: "from-violet-600/30 via-purple-700/25 to-indigo-900/40",
    border: "border-violet-400/50",
    glow: "shadow-[0_0_24px_rgba(139,92,246,0.35)]",
    shimmer: "rgba(139,92,246,0.1)",
    accentText: "text-violet-300",
    badgeColor: "bg-violet-500/20 text-violet-400",
    icon: Trophy,
  },
};

const EMOJI_MAP: Record<string, string[]> = {
  fuchsia: ["💕", "👯‍♀️", "✨"],
  cyan: ["👀", "💎", "📸"],
  emerald: ["🔥", "⏱️", "🏃‍♀️"],
  rose: ["💪", "👩‍💻", "💰"],
  amber: ["🏆", "⭐", "🔥"],
  violet: ["✨", "💜", "🎯"],
};

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
                    <div className="h-full bg-fuchsia-500/60 rounded-full transition-all" style={{ width: `${Math.min(100, (mins / 30) * 100)}%` }} />
                  )}
                  {completed && <div className="h-full bg-fuchsia-500 rounded-full w-full" />}
                </div>
                <span className="text-[10px] text-neutral-500 font-bold">
                  {completed ? "✅" : inProgress ? `${mins}m` : ""} DAY {day}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

/* ─── Boyfriend Challenge Progress Component ─── */
const BoyfriendProgress = () => {
  const {
    boyfriendPair, dailyLogs, generating, copied, boyfriendLink,
    hasPair, pairActive, pairCompleted, waitingForBoyfriend, hasProofSelfie,
    generateInviteCode, copyLink, uploadProofSelfie,
  } = useBoyfriendChallenge();

  const handleSelfieUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadProofSelfie(file);
  };

  if (!hasPair) {
    return (
      <div className="relative mt-3 space-y-2">
        <button
          onClick={generateInviteCode}
          disabled={generating}
          className="w-full bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 font-black text-sm py-2.5 rounded-full transition-colors active:scale-[0.97] flex items-center justify-center gap-2"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          {generating ? "CREATING..." : "CREATE BOYFRIEND INVITE LINK"}
        </button>
      </div>
    );
  }

  if (waitingForBoyfriend) {
    return (
      <div className="relative mt-3 space-y-3">
        <div className="bg-black/30 border border-rose-500/30 rounded-xl p-3">
          <p className="text-[11px] text-rose-300 font-bold mb-2">💕 SHARE THIS LINK WITH YOUR BOYFRIEND:</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-black/40 rounded-lg px-3 py-2 text-xs text-neutral-300 truncate font-mono border border-white/10">
              {boyfriendLink}
            </div>
            <button
              onClick={copyLink}
              className="shrink-0 bg-rose-500/25 hover:bg-rose-500/35 border border-rose-400/40 p-2 rounded-lg transition-colors active:scale-[0.95]"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-rose-300" />}
            </button>
          </div>
          <p className="text-[10px] text-neutral-500 mt-2">
            ⏳ Waiting for your boyfriend to sign up with this link...
          </p>
        </div>
      </div>
    );
  }

  if (pairActive || pairCompleted) {
    return (
      <div className="relative mt-3 space-y-3">
        {/* Proof selfie upload */}
        {!hasProofSelfie && !pairCompleted && (
          <div className="bg-black/30 border border-rose-500/30 rounded-xl p-3">
            <p className="text-[11px] text-rose-300 font-bold mb-2">📸 UPLOAD DATING PROOF SELFIE:</p>
            <label className="w-full flex items-center justify-center gap-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 font-bold text-xs py-2 rounded-lg cursor-pointer transition-colors">
              <Camera className="w-3.5 h-3.5" />
              UPLOAD SELFIE
              <input type="file" accept="image/*" className="hidden" onChange={handleSelfieUpload} />
            </label>
            <p className="text-[10px] text-neutral-500 mt-1.5">Upload a photo of you and your boyfriend together</p>
          </div>
        )}
        {hasProofSelfie && (
          <div className="flex items-center gap-2 text-[11px] text-green-400 font-bold">
            <CheckCircle className="w-3.5 h-3.5" /> Dating selfie uploaded!
          </div>
        )}

        <p className="text-[11px] text-rose-300 font-bold">
          {pairCompleted ? "🎉 CHALLENGE COMPLETE! $35 dinner date gift card earned!" : "💕 CHALLENGE ACTIVE — Video chat with your boyfriend daily!"}
        </p>
        <div className="flex gap-2">
          {[1, 2].map((day) => {
            const log = dailyLogs.find((l: any) => l.day_number === day);
            const completed = log?.verified;
            const inProgress = log && !log.verified;
            const mins = log ? Math.floor((log.total_seconds || 0) / 60) : 0;
            return (
              <div key={day} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-full h-2.5 rounded-full overflow-hidden ${completed ? "bg-rose-500" : "bg-neutral-800"}`}>
                  {inProgress && (
                    <div className="h-full bg-rose-500/60 rounded-full transition-all" style={{ width: `${Math.min(100, (mins / 30) * 100)}%` }} />
                  )}
                  {completed && <div className="h-full bg-rose-500 rounded-full w-full" />}
                </div>
                <span className="text-[10px] text-neutral-500 font-bold">
                  {completed ? "✅" : inProgress ? `${mins}m` : ""} DAY {day}
                </span>
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
  const totalApproved = approved.length;
  const allDone = totalApproved >= 2;
  return (
    <div className="relative mt-3 space-y-2">
      {allDone && <p className="text-green-400 text-xs font-black">🎉 CHALLENGE COMPLETE! $25 earned!</p>}
      <div className="flex items-center gap-3">
        {[1, 2].map((slot) => {
          const snap = submissions[slot - 1];
          const isApproved = snap?.status === "approved";
          const isPending = snap?.status === "pending";
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
    </div>
  );
};

/* ─── Auto-Tracked Progress ─── */
const AutoTrackProgress = ({ challenge, submission }: { challenge: any; submission: any }) => {
  const themeKey = challenge.theme || "cyan";
  const theme = THEME_MAP[themeKey] || THEME_MAP.cyan;
  const targetMins = challenge.target_minutes || 60;
  const storageKey = `${challenge.slug}_minutes`;
  const startedKey = `${challenge.slug}_started`;

  // Reset localStorage progress if we're in a new week
  useEffect(() => {
    resetIfStaleWeek(storageKey);
    resetIfStaleWeek(startedKey);
  }, [storageKey, startedKey]);

  // Poll localStorage every 3s so the timer updates live
  const [savedMins, setSavedMins] = useState(() => parseInt(localStorage.getItem(storageKey) || "0", 10));
  const [started, setStarted] = useState(() => localStorage.getItem(startedKey) === "true");

  useEffect(() => {
    const interval = setInterval(() => {
      setSavedMins(parseInt(localStorage.getItem(storageKey) || "0", 10));
      setStarted(localStorage.getItem(startedKey) === "true");
    }, 3000);
    return () => clearInterval(interval);
  }, [storageKey, startedKey]);

  if (submission) {
    const mStatus = statusConfig[submission.status];
    return (
      <div className="relative mt-3">
        <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden">
          <div className={`h-full bg-gradient-to-r ${themeKey === "emerald" ? "from-emerald-500 to-green-400" : themeKey === "rose" ? "from-rose-500 to-pink-400" : "from-cyan-500 to-blue-400"} rounded-full`} style={{ width: "100%" }} />
        </div>
        {mStatus && (
          <div className={`flex items-center gap-2 mt-3 ${mStatus.color}`}>
            <mStatus.icon className="w-4 h-4" />
            <span className="text-xs font-black">{mStatus.label}</span>
          </div>
        )}
        {submission.status === "approved" && (
          <p className="text-green-400 text-xs font-bold mt-2">
            ✅ Reward earned: {challenge.reward_type === "cash" ? `$${challenge.reward_amount}` : `${challenge.reward_amount} min`}
          </p>
        )}
      </div>
    );
  }

  if (!started) {
    return (
      <button
        onClick={() => {
          localStorage.setItem(startedKey, "true");
          stampWeek(startedKey);
          stampWeek(storageKey);
          setStarted(true);
          toast.success(`${challenge.title} activated!`, { description: "Your call timer will track automatically." });
        }}
        className={`relative w-full mt-4 bg-white/10 hover:bg-white/15 border border-white/20 ${theme.accentText} font-black text-sm py-2.5 rounded-full transition-colors active:scale-[0.97] flex items-center justify-center gap-2`}
      >
        ⚡ START CHALLENGE
      </button>
    );
  }

  const pct = Math.min(100, (savedMins / targetMins) * 100);
  return (
    <div className="relative mt-3">
      <div className="flex justify-between text-[10px] text-neutral-500 font-bold mb-1">
        <span>{savedMins} min</span>
        <span>{targetMins} min</span>
      </div>
      <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${themeKey === "emerald" ? "from-emerald-500 to-green-400" : themeKey === "rose" ? "from-rose-500 to-pink-400" : "from-cyan-500 to-blue-400"} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className={`mt-2 flex items-center gap-1.5 text-[11px] font-bold ${theme.accentText} opacity-70`}>
        <span className="text-base">⚡</span> Auto-tracking — stay on a call for {targetMins} min!
      </div>
    </div>
  );
};

/* ─── Speed Connect Progress ─── */
const SpeedConnectProgress = ({ challenge, submission }: { challenge: any; submission: any }) => {
  const themeKey = challenge.theme || "amber";
  const theme = THEME_MAP[themeKey] || THEME_MAP.amber;
  
  let targetPeople = 20;
  try {
    const action = JSON.parse(challenge.auto_track_action || "null");
    targetPeople = action?.target || 20;
  } catch { /* */ }
  const timeLimitMins = challenge.target_minutes || 30;

  if (submission) {
    const mStatus = statusConfig[submission.status];
    return (
      <div className="relative mt-3">
        <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden">
          <div className={`h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full`} style={{ width: "100%" }} />
        </div>
        {mStatus && (
          <div className={`flex items-center gap-2 mt-3 ${mStatus.color}`}>
            <mStatus.icon className="w-4 h-4" />
            <span className="text-xs font-black">{mStatus.label}</span>
          </div>
        )}
        {submission.status === "approved" && (
          <p className="text-green-400 text-xs font-bold mt-2">
            ✅ Reward earned: {challenge.reward_type === "cash" ? `$${challenge.reward_amount}` : `${challenge.reward_amount} min`}
          </p>
        )}
      </div>
    );
  }

  // Check localStorage for active session
  const key = `speed_connect_${challenge.slug}`;
  const saved = localStorage.getItem(key);
  let isActive = false;
  let uniqueCount = 0;
  let timeLeftStr = "";

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const elapsed = (Date.now() - parsed.startTime) / 1000 / 60;
      if (elapsed < timeLimitMins) {
        isActive = true;
        uniqueCount = parsed.partners?.length || 0;
        const remaining = Math.ceil((timeLimitMins * 60) - (elapsed * 60));
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        timeLeftStr = `${mins}:${String(secs).padStart(2, "0")}`;
      }
    } catch { /* */ }
  }

  const pct = Math.min(100, (uniqueCount / targetPeople) * 100);

  return (
    <div className="relative mt-3">
      {isActive ? (
        <>
          <div className="flex justify-between text-[10px] text-neutral-500 font-bold mb-1">
            <span>{uniqueCount}/{targetPeople} people</span>
            <span>⏱️ {timeLeftStr}</span>
          </div>
          <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className={`mt-2 flex items-center gap-1.5 text-[11px] font-bold ${theme.accentText} opacity-70`}>
            <span className="text-base">⚡</span> Auto-tracking — keep connecting!
          </div>
        </>
      ) : (
        <div className={`mt-2 flex items-center gap-1.5 text-[11px] font-bold ${theme.accentText} opacity-70`}>
          <span className="text-base">⚡</span> Go to video call and tap START to begin!
        </div>
      )}
      <p className="text-[10px] text-neutral-600 mt-1">
        Connect to {targetPeople} unique people within {timeLimitMins} min
      </p>
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
  const [showCashout, setShowCashout] = useState(false);
  const [showGamble, setShowGamble] = useState(false);
  const [reportingChallengeId, setReportingChallengeId] = useState<string | null>(null);
  const [issueText, setIssueText] = useState("");
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const { data: memberGender } = useQuery({
    queryKey: ["member_gender_challenges", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("members").select("gender").eq("id", user!.id).maybeSingle();
      return data?.gender ?? null;
    },
  });
  const isFemale = memberGender?.toLowerCase() === "female";

  // Fetch active challenges from DB
  const { data: dbChallenges = [] } = useQuery({
    queryKey: ["weekly_challenges_page"],
    queryFn: async () => {
      const { data } = await supabase
        .from("weekly_challenges")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  const visibleChallenges = dbChallenges.filter((c: any) => !c.female_only || isFemale);

  const weekStart = getCurrentWeekStart();

  const { data: submissions = [] } = useQuery({
    queryKey: ["my_challenge_submissions", user?.id, weekStart],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("challenge_submissions")
        .select("*")
        .eq("user_id", user!.id)
        .gte("created_at", `${weekStart}T00:00:00Z`)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });


  const getSubmission = (challengeId: string) => {
    return submissions.find((s: any) => s.challenge_id === challengeId);
  };

  const handleSubmit = async (challenge: any) => {
    if (!user || !proofText.trim()) {
      toast.error("Please provide proof text");
      return;
    }
    const { error } = await supabase.from("challenge_submissions").insert({
      user_id: user.id,
      challenge_id: challenge.id,
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

  const handleIssueSubmit = async (challengeId: string) => {
    if (!user || !issueText.trim()) {
      toast.error("Please describe your issue");
      return;
    }
    setSubmittingIssue(true);
    const { error } = await supabase.from("challenge_issues").insert({
      user_id: user.id,
      challenge_id: challengeId,
      message: issueText.trim(),
    });
    setSubmittingIssue(false);
    if (error) {
      toast.error("Failed to submit issue");
      return;
    }
    toast.success("Issue reported! We'll look into it.");
    setReportingChallengeId(null);
    setIssueText("");
  };
  const formatReward = (c: any) => {
    if (c.reward_type === "cash") return `$${c.reward_amount}`;
    if (c.reward_type === "minutes") return `${c.reward_amount} min`;
    return `${c.reward_amount || 7} days freeze-free`;
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
        {visibleChallenges.map((challenge: any) => {
          const submission = getSubmission(challenge.id);
          const status = submission ? statusConfig[submission.status] : null;
          const themeKey = challenge.theme || "cyan";
          const theme = THEME_MAP[themeKey] || THEME_MAP.cyan;
          const emojis = EMOJI_MAP[themeKey] || ["🎯", "⭐", "🔥"];
          const Icon = theme.icon;
          const isBestie = challenge.slug === "bestie-challenge";
          const isBoyfriend = challenge.slug === "boyfriend-challenge";
          const isBlueEyes = challenge.slug === "blue-eyes-hunt";
          const isMarathon = challenge.slug === "marathon-talk";
          const isSpeedConnect = (() => {
            try {
              const action = JSON.parse(challenge.auto_track_action || "null");
              return action?.type === "auto_speed_connect";
            } catch { return false; }
          })();
          const isAutoTracked = challenge.challenge_type === "auto" && challenge.target_minutes && !isSpeedConnect;
          const isManual = challenge.challenge_type === "manual" && !isBlueEyes && !isBoyfriend && !isBestie;

          return (
            <div
              key={challenge.id}
              className={`relative overflow-visible bg-gradient-to-br ${theme.gradient} ${theme.border} border rounded-2xl p-5 ${theme.glow}`}
            >
              {/* Bestie cutout sticker */}
              {isBestie && (
                <img
                  src={bestieCutout}
                  alt="Besties taking a selfie"
                  className="absolute -right-4 -top-10 w-20 sm:w-32 h-auto z-10 drop-shadow-[0_4px_12px_rgba(217,70,239,0.5)] rotate-[4deg] pointer-events-none select-none"
                />
              )}

              {/* Boyfriend cutout sticker */}
              {isBoyfriend && (
                <img
                  src={boyfriendCutout}
                  alt="Couple together"
                  className="absolute -right-4 -top-10 w-20 sm:w-32 h-auto z-10 drop-shadow-[0_4px_12px_rgba(251,113,133,0.5)] -rotate-[4deg] pointer-events-none select-none"
                />
              )}

              {/* Blue Eyes Hunt cutout */}
              {isBlueEyes && (
                <img
                  src={blueEyeImg}
                  alt="Blue eye close-up"
                  className="absolute -right-3 -top-8 w-16 sm:w-24 h-auto z-10 rounded-xl border-2 border-cyan-400/50 drop-shadow-[0_4px_16px_rgba(34,211,238,0.5)] rotate-[5deg] pointer-events-none select-none animate-[scale-pulse_3s_ease-in-out_infinite] object-cover"
                />
              )}

              {/* Marathon Talk "yap" fountain */}
              {isMarathon && (
                <div className="absolute -top-4 right-4 sm:right-8 pointer-events-none select-none z-10 w-20 h-16 overflow-visible">
                  {[
                    { x: 0, delay: 0, size: "text-[10px]" },
                    { x: 14, delay: 0.5, size: "text-xs" },
                    { x: -8, delay: 1.1, size: "text-[9px]" },
                    { x: 22, delay: 1.7, size: "text-[11px]" },
                    { x: 6, delay: 0.3, size: "text-[10px]" },
                    { x: -4, delay: 2.0, size: "text-xs" },
                    { x: 18, delay: 0.8, size: "text-[9px]" },
                    { x: 10, delay: 1.4, size: "text-[10px]" },
                  ].map((yap, i) => (
                    <span
                      key={i}
                      className={`absolute font-black ${yap.size} text-emerald-400/80 italic tracking-tight animate-[yap-rise_2.5s_ease-out_infinite]`}
                      style={{
                        left: `${yap.x + 10}px`,
                        bottom: 0,
                        animationDelay: `${yap.delay}s`,
                      }}
                    >
                      yap
                    </span>
                  ))}
                </div>
              )}
              {emojis.map((emoji: string, i: number) => (
                <span
                  key={i}
                  className="absolute text-xl pointer-events-none select-none z-10 animate-[emoji-float_3s_ease-in-out_infinite]"
                  style={{ right: `${12 + i * 28}px`, bottom: `${10 + i * 14}px`, animationDelay: `${i * 0.7}s` }}
                >
                  {emoji}
                </span>
              ))}

              {/* Shimmer */}
              <div
                className="absolute inset-0 bg-[linear-gradient(120deg,transparent_30%,var(--shimmer)_50%,transparent_70%)] bg-[length:200%_100%] animate-[shimmer-bg_3s_ease-in-out_infinite]"
                style={{ "--shimmer": theme.shimmer } as React.CSSProperties}
              />

              {/* Top row */}
              <div className="relative flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-white/5 rounded-xl border border-white/10">
                    <Icon className={`w-5 h-5 ${theme.accentText} drop-shadow-[0_0_8px_currentColor]`} />
                  </div>
                  <div>
                    <h3 className="font-black text-lg leading-tight tracking-wide">{challenge.title}</h3>
                    {challenge.description && (
                      <p className={`text-xs font-bold ${theme.accentText} opacity-80`}>
                        {challenge.description.slice(0, 40)}
                      </p>
                    )}
                  </div>
                </div>
                {challenge.female_only && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-400">♀ ONLY</span>
                )}
              </div>

              {/* Description */}
              {challenge.description && (
                <p className="relative text-neutral-300 text-sm leading-relaxed mb-3">{challenge.description}</p>
              )}

              {/* Reward */}
              <div className="relative flex items-center gap-3 mb-1">
                <div className="flex items-baseline gap-1">
                  <Trophy className={`w-4 h-4 ${theme.accentText}`} />
                  <span className={`text-2xl font-black ${theme.accentText} drop-shadow-[0_0_12px_currentColor]`}>
                    {formatReward(challenge)}
                  </span>
                </div>
              </div>

              {/* Bestie-specific */}
              {isBestie && <BestieProgress />}

              {/* Boyfriend-specific */}
              {challenge.slug === "boyfriend-challenge" && <BoyfriendProgress />}

              {/* Blue Eyes Hunt */}
              {isBlueEyes && (() => {
                resetIfStaleWeek("blue_eyes_hunt_started");
                const huntStarted = localStorage.getItem("blue_eyes_hunt_started") === "true";
                const blueSubmissions = submissions.filter((s: any) => s.challenge_id === challenge.id);
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
                      setSubmittingSlug((prev) => prev === "__force" ? "" : "__force");
                      setTimeout(() => setSubmittingSlug(""), 50);
                    }}
                    className="relative w-full mt-4 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 font-black text-sm py-2.5 rounded-full transition-colors active:scale-[0.97] flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                  >
                    👁️ START HUNT
                  </button>
                );
              })()}

              {/* Speed Connect challenges */}
              {isSpeedConnect && (
                <SpeedConnectProgress challenge={challenge} submission={submission} />
              )}

              {/* Auto-tracked challenges (marathon, girl power, etc.) */}
              {isAutoTracked && !isBestie && !isBlueEyes && (
                <AutoTrackProgress challenge={challenge} submission={submission} />
              )}

              {/* Manual submission status */}
              {isManual && submission && status && (
                <div className={`relative flex items-center gap-2 mt-3 ${status.color}`}>
                  <status.icon className="w-4 h-4" />
                  <span className="text-xs font-black">{status.label}</span>
                </div>
              )}

              {isManual && submission?.status === "approved" && (
                <p className="relative text-green-400 text-xs font-bold mt-2">
                  ✅ Reward earned: {formatReward(challenge)}
                </p>
              )}

              {isManual && submission?.status === "rejected" && (
                <p className="relative text-red-400/80 text-xs font-bold mt-1">
                  You can try again next week.
                </p>
              )}

              {/* Submit Proof (manual, non-blue-eyes) */}
              {isManual && !submission && submittingSlug !== challenge.slug && (
                <button
                  onClick={() => setSubmittingSlug(challenge.slug)}
                  className="relative w-full mt-4 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-black text-sm py-2.5 rounded-full transition-colors active:scale-[0.97] flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" /> SUBMIT PROOF
                </button>
              )}

              {/* Auto-tracked label for non-duration challenges */}
              {challenge.challenge_type === "auto" && !challenge.target_minutes && !isBestie && !isBlueEyes && !submission && (
                <div className="relative mt-3 flex items-center gap-1.5 text-[11px] font-bold text-neutral-500">
                  <span className="text-base">⚡</span> Auto-tracked — just start a call!
                </div>
              )}

              {/* Proof form */}
              {submittingSlug === challenge.slug && (
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
                      onClick={() => handleSubmit(challenge)}
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

              {/* Report Issue Button */}
              <div className="relative mt-3 border-t border-white/10 pt-3">
                {reportingChallengeId === challenge.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={issueText}
                      onChange={(e) => setIssueText(e.target.value)}
                      placeholder="Describe the issue you're having..."
                      className="w-full bg-black/30 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-600 resize-none focus:outline-none focus:border-white/30"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleIssueSubmit(challenge.id)}
                        disabled={submittingIssue}
                        className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 font-bold text-xs py-2 rounded-full transition-colors active:scale-[0.97]"
                      >
                        {submittingIssue ? "SENDING..." : "SEND REPORT"}
                      </button>
                      <button
                        onClick={() => { setReportingChallengeId(null); setIssueText(""); }}
                        className="px-4 bg-neutral-800/60 text-neutral-400 font-bold text-xs py-2 rounded-full hover:opacity-90 active:scale-[0.97]"
                      >
                        CANCEL
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setReportingChallengeId(challenge.id)}
                    className="flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-amber-400 font-bold transition-colors"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Run into an issue?
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Challenge Minutes Card */}
      <div className="w-full max-w-md mt-5">
        <button
          onClick={() => setShowGamble(true)}
          className="w-full relative overflow-hidden bg-gradient-to-br from-yellow-600/25 via-amber-700/20 to-orange-900/30 border border-yellow-500/40 rounded-2xl p-5 shadow-[0_0_24px_rgba(234,179,8,0.25)] active:scale-[0.97] transition-transform text-left"
        >
          <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_30%,rgba(234,179,8,0.08)_50%,transparent_70%)] bg-[length:200%_100%] animate-[shimmer-bg_3s_ease-in-out_infinite] pointer-events-none" />
          <div className="relative flex items-center gap-4">
            <div className="text-4xl">🎰</div>
            <div className="flex-1">
              <h3 className="font-black text-lg tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500">
                CHALLENGE MINUTES
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">Wager earned minutes for a chance to win up to $200 cash!</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-[10px] font-bold bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">🔥 2x MINUTES</span>
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">💵 CASH</span>
                <span className="text-[10px] font-bold bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">💀 RISK</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-2xl font-black text-yellow-300 drop-shadow-[0_0_12px_rgba(234,179,8,0.5)]">$200</span>
              <span className="block text-[9px] font-bold text-yellow-500/60 tracking-widest">JACKPOT</span>
            </div>
          </div>
        </button>
      </div>

      {/* Redeem Actions */}
      <div className="w-full max-w-md mt-8 space-y-3">
        <p className="text-center text-neutral-500 text-[10px] font-bold uppercase tracking-widest">Redeem Your Earnings</p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCashout(true)}
            className="flex-1 relative overflow-hidden bg-gradient-to-br from-emerald-500/25 via-green-600/20 to-teal-500/25 border border-emerald-400/40 rounded-2xl py-4 px-4 shadow-[0_0_20px_rgba(52,211,153,0.2)] active:scale-[0.97] transition-transform"
          >
            <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_30%,rgba(52,211,153,0.08)_50%,transparent_70%)] bg-[length:200%_100%] animate-[shimmer-bg_3s_ease-in-out_infinite]" />
            <div className="relative flex flex-col items-center gap-1.5">
              <DollarSign className="w-6 h-6 text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              <span className="font-black text-emerald-200 tracking-wider text-xs drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
                CASH OUT
              </span>
              <span className="text-[10px] text-emerald-400/60 font-bold">via PayPal</span>
            </div>
          </button>
          <button
            onClick={() => navigate("/store")}
            className="flex-1 relative overflow-hidden bg-gradient-to-br from-amber-500/25 via-yellow-600/20 to-orange-500/25 border border-amber-400/40 rounded-2xl py-4 px-4 shadow-[0_0_20px_rgba(245,158,11,0.2)] active:scale-[0.97] transition-transform"
          >
            <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_30%,rgba(245,158,11,0.08)_50%,transparent_70%)] bg-[length:200%_100%] animate-[shimmer-bg_3s_ease-in-out_infinite]" />
            <div className="relative flex flex-col items-center gap-1.5">
              <Trophy className="w-6 h-6 text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
              <span className="font-black text-amber-200 tracking-wider text-xs drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]">
                REWARDS
              </span>
              <span className="text-[10px] text-amber-400/60 font-bold">Browse Store</span>
            </div>
          </button>
        </div>
      </div>

      <ChallengeSuggestionForm />

      {/* Challenge Earnings Modal */}
      {showCashout && (
        <ChallengeEarningsModal
          onClose={() => setShowCashout(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["my_challenge_submissions"] });
          }}
        />
      )}

      {/* Challenge Minutes Overlay */}
      {showGamble && <ChallengeMinutesOverlay onClose={() => setShowGamble(false)} />}
    </div>
  );
};

export default WeeklyChallengesPage;
