import { useState } from "react";
import { ChevronLeft, Upload, CheckCircle, Clock, XCircle, Trophy, DollarSign } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  pending: "text-yellow-400",
  approved: "text-green-400",
  rejected: "text-red-400",
};

const statusIcons: Record<string, any> = {
  pending: Clock,
  approved: CheckCircle,
  rejected: XCircle,
};

const formatReward = (c: any) => {
  const rt = c.reward_type || "freeze_free";
  const amt = c.reward_amount || 0;
  if (rt === "cash") return `$${amt} cash`;
  if (rt === "minutes") return `${amt} bonus minutes`;
  return `${amt || 7} days freeze-free`;
};

const WeeklyChallengesPage = ({ onClose }: { onClose?: () => void }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [proofText, setProofText] = useState("");

  const { data: challenges = [] } = useQuery({
    queryKey: ["weekly_challenges"],
    queryFn: async () => {
      const { data } = await supabase
        .from("weekly_challenges")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
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

  const getSubmissionForChallenge = (challengeId: string) => {
    return submissions.find((s: any) => s.challenge_id === challengeId);
  };

  const handleSubmit = async (challengeId: string) => {
    if (!user || !proofText.trim()) {
      toast.error("Please provide proof text");
      return;
    }

    const { error } = await supabase.from("challenge_submissions").insert({
      user_id: user.id,
      challenge_id: challengeId,
      proof_text: proofText.trim(),
      status: "pending",
    });

    if (error) {
      toast.error("Failed to submit", { description: error.message });
      return;
    }

    toast.success("Challenge submitted for review!");
    setSubmittingId(null);
    setProofText("");
    queryClient.invalidateQueries({ queryKey: ["my_challenge_submissions"] });
  };

  const isAutoTracked = (c: any) => c.challenge_type === "auto";

  return (
    <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] flex flex-col items-center px-4 pb-8">
      <div className="w-full flex items-center pt-3 pb-2">
        <button onClick={onClose} className="flex items-center gap-1 hover:opacity-80 transition-opacity">
          <ChevronLeft className="w-7 h-7" />
          <span className="font-black text-sm tracking-wider">BACK</span>
        </button>
      </div>

      <h1 className="text-3xl font-black tracking-wide mt-2 mb-2">WEEKLY CHALLENGES</h1>
      <p className="text-neutral-400 text-sm mb-6 text-center">
        Complete challenges to earn rewards! Cash, minutes, or freeze protection.
      </p>

      {challenges.length === 0 ? (
        <p className="text-neutral-500 text-sm">No active challenges right now. Check back soon!</p>
      ) : (
        <div className="w-full max-w-md space-y-4">
          {challenges.map((challenge: any) => {
            const submission = getSubmissionForChallenge(challenge.id);
            const StatusIcon = submission ? statusIcons[submission.status] : null;
            const auto = isAutoTracked(challenge);

            return (
              <div key={challenge.id} className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-black text-lg">{challenge.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">
                        <Trophy className="w-3 h-3" /> {formatReward(challenge)}
                      </span>
                      {auto && (
                        <span className="text-xs font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">
                          ⚡ Auto-tracked
                        </span>
                      )}
                    </div>
                  </div>
                  {submission && StatusIcon && (
                    <div className={`flex items-center gap-1 text-xs font-bold ${statusColors[submission.status]}`}>
                      <StatusIcon className="w-4 h-4" />
                      {submission.status.toUpperCase()}
                    </div>
                  )}
                </div>

                {challenge.description && (
                  <p className="text-neutral-400 text-sm mb-3">{challenge.description}</p>
                )}

                {/* Manual submit button */}
                {!auto && !submission && submittingId !== challenge.id && (
                  <button
                    onClick={() => setSubmittingId(challenge.id)}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-black text-sm py-2.5 rounded-full hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" /> SUBMIT PROOF
                  </button>
                )}

                {/* Auto-tracked: show progress placeholder */}
                {auto && !submission && (
                  <div className="w-full bg-neutral-800 rounded-full h-3 mt-2 overflow-hidden">
                    <div className="bg-blue-500 h-full rounded-full transition-all" style={{ width: "0%" }} />
                  </div>
                )}

                {submittingId === challenge.id && (
                  <div className="space-y-3 mt-2">
                    <textarea
                      value={proofText}
                      onChange={(e) => setProofText(e.target.value)}
                      placeholder="Describe your proof or paste a link..."
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-500 resize-none"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSubmit(challenge.id)}
                        className="flex-1 bg-green-600 text-white font-bold text-sm py-2 rounded-full hover:opacity-90"
                      >
                        SUBMIT
                      </button>
                      <button
                        onClick={() => { setSubmittingId(null); setProofText(""); }}
                        className="px-4 bg-neutral-800 text-neutral-400 font-bold text-sm py-2 rounded-full hover:opacity-90"
                      >
                        CANCEL
                      </button>
                    </div>
                  </div>
                )}

                {submission?.status === "approved" && (
                  <p className="text-green-400 text-xs font-bold mt-2">
                    ✅ Reward earned: {formatReward(challenge)}
                  </p>
                )}

                {submission?.status === "rejected" && (
                  <p className="text-red-400 text-xs font-bold mt-2">
                    Submission was not approved. You can try again next week.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WeeklyChallengesPage;
