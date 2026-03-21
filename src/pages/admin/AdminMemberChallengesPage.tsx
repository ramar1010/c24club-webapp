import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, DollarSign, Timer } from "lucide-react";

const AdminMemberChallengesPage = () => {
  const queryClient = useQueryClient();

  const { data: submissions = [] } = useQuery({
    queryKey: ["admin_challenge_submissions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("challenge_submissions")
        .select("*, weekly_challenges(title, reward_type, reward_amount, slug)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch member names for display
  const userIds = [...new Set(submissions.map((s: any) => s.user_id))];
  const { data: members = [] } = useQuery({
    queryKey: ["admin_challenge_members", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("members")
        .select("id, name, email")
        .in("id", userIds);
      return data || [];
    },
  });

  const getMemberName = (userId: string) => {
    const m = members.find((m: any) => m.id === userId);
    return m ? m.name || m.email || userId.slice(0, 8) : userId.slice(0, 8);
  };

  const creditReward = async (submission: any) => {
    const challenge = submission.weekly_challenges;
    if (!challenge) return false;

    const { reward_type, reward_amount } = challenge;
    const userId = submission.user_id;

    if (reward_type === "minutes") {
      // Add to total_minutes
      const { error } = await supabase.rpc("atomic_increment_minutes", {
        p_user_id: userId,
        p_amount: Math.round(reward_amount),
      });
      if (error) {
        console.error("Failed to credit minutes:", error);
        return false;
      }
    } else if (reward_type === "cash") {
      // Cash rewards: add equivalent gifted_minutes at $0.35/min rate
      const cashableMinutes = Math.round(reward_amount / 0.35);
      
      // First add to total_minutes
      const { error: totalErr } = await supabase.rpc("atomic_increment_minutes", {
        p_user_id: userId,
        p_amount: cashableMinutes,
      });
      if (totalErr) {
        console.error("Failed to credit total:", totalErr);
        return false;
      }

      // Then add to gifted_minutes
      const { data: current } = await supabase
        .from("member_minutes")
        .select("gifted_minutes, total_minutes")
        .eq("user_id", userId)
        .maybeSingle();

      if (current) {
        const newGifted = Math.min(
          (current.gifted_minutes || 0) + cashableMinutes,
          current.total_minutes
        );
        await supabase
          .from("member_minutes")
          .update({ gifted_minutes: newGifted })
          .eq("user_id", userId);
      }
    } else if (reward_type === "freeze_free") {
      // Grant freeze-free days
      const days = reward_amount || 7;
      const until = new Date();
      until.setDate(until.getDate() + days);
      await supabase
        .from("member_minutes")
        .update({ freeze_free_until: until.toISOString(), is_frozen: false })
        .eq("user_id", userId);
    }

    return true;
  };

  const updateStatus = async (submission: any, status: string) => {
    // If approving, credit the reward first
    if (status === "approved") {
      const credited = await creditReward(submission);
      if (!credited) {
        toast.error("Failed to credit reward — submission not updated");
        return;
      }
    }

    await supabase
      .from("challenge_submissions")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", submission.id);

    // Send approval email
    if (status === "approved") {
      supabase.functions.invoke("challenge-approved-email", {
        body: {
          submissionId: submission.id,
          challengeTitle: submission.weekly_challenges?.title,
          rewardText: formatReward(submission.weekly_challenges),
        },
      }).catch((err: any) => console.error("Failed to send approval email:", err));
    }

    toast.success(
      status === "approved"
        ? `Approved! Reward credited to ${getMemberName(submission.user_id)}`
        : "Submission rejected"
    );
    queryClient.invalidateQueries({ queryKey: ["admin_challenge_submissions"] });
  };

  const formatReward = (challenge: any) => {
    if (!challenge) return "Unknown";
    const { reward_type, reward_amount } = challenge;
    if (reward_type === "cash") return `$${reward_amount}`;
    if (reward_type === "minutes") return `${reward_amount} min`;
    return `${reward_amount || 7} days freeze-free`;
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-700",
      approved: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700",
    };
    const icons: Record<string, any> = { pending: Clock, approved: CheckCircle, rejected: XCircle };
    const Icon = icons[status] || Clock;
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${colors[status] || ""}`}>
        <Icon className="w-3 h-3" /> {status.toUpperCase()}
      </span>
    );
  };

  const pendingCount = submissions.filter((s: any) => s.status === "pending").length;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Member Challenge Submissions</h1>
      {pendingCount > 0 && (
        <p className="text-sm text-amber-600 font-bold mb-4">
          ⚠️ {pendingCount} pending submission{pendingCount > 1 ? "s" : ""} awaiting review
        </p>
      )}

      {submissions.length === 0 ? (
        <p className="text-muted-foreground">No submissions yet.</p>
      ) : (
        <div className="space-y-3 max-w-2xl">
          {submissions.map((s: any) => (
            <div key={s.id} className="bg-card border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-bold">{s.weekly_challenges?.title || "Unknown Challenge"}</h3>
                  <p className="text-xs text-muted-foreground">
                    👤 {getMemberName(s.user_id)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    📅 {new Date(s.created_at).toLocaleDateString()} · 🎁 {formatReward(s.weekly_challenges)}
                  </p>
                </div>
                {statusBadge(s.status)}
              </div>

              {s.proof_text && (
                <div className="bg-muted rounded-lg p-3 mb-3">
                  <p className="text-sm">{s.proof_text}</p>
                </div>
              )}

              {s.proof_image_url && (
                <img src={s.proof_image_url} alt="Proof" className="rounded-lg mb-3 max-h-40 object-cover" />
              )}

              {s.status === "pending" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => updateStatus(s, "approved")}
                    className="flex items-center gap-1 bg-green-600 text-white font-bold text-xs px-4 py-2 rounded-lg hover:opacity-90"
                  >
                    <CheckCircle className="w-3 h-3" /> APPROVE & CREDIT
                  </button>
                  <button
                    onClick={() => updateStatus(s, "rejected")}
                    className="flex items-center gap-1 bg-red-600 text-white font-bold text-xs px-4 py-2 rounded-lg hover:opacity-90"
                  >
                    <XCircle className="w-3 h-3" /> REJECT
                  </button>
                </div>
              )}

              {s.status === "approved" && (
                <p className="text-xs text-green-600 font-bold mt-1">
                  ✅ Reward credited: {formatReward(s.weekly_challenges)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminMemberChallengesPage;
