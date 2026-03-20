import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus, DollarSign, Users, RotateCcw, CheckCircle, Trophy } from "lucide-react";

const CHALLENGE_TYPES = [
  { value: "videochat", label: "Video Chat (auto-tracked via direct calls)" },
  { value: "private_call", label: "Private Call (auto-tracked via direct calls)" },
  { value: "minutes_earned", label: "Minutes Earned" },
  { value: "custom", label: "Custom (manual)" },
];

const AdminAnchorChallengesPage = () => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [rewardAmount, setRewardAmount] = useState("");
  const [challengeType, setChallengeType] = useState("videochat");
  const [targetCount, setTargetCount] = useState("1");
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<"challenges" | "progress">("challenges");

  const { data: challenges = [] } = useQuery({
    queryKey: ["admin_anchor_challenges"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anchor_challenges")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch all progress for current week
  const { data: allProgress = [], isLoading: progressLoading } = useQuery({
    queryKey: ["admin_challenge_progress"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("anchor-earning", {
        body: { type: "admin_get_challenge_progress" },
      });
      return data?.progress ?? [];
    },
    enabled: tab === "progress",
  });

  // Fetch member names for progress display
  const userIds = [...new Set(allProgress.map((p: any) => p.user_id))];
  const { data: members = [] } = useQuery({
    queryKey: ["admin_progress_members", userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase
        .from("members")
        .select("id, name, email")
        .in("id", userIds);
      return data || [];
    },
    enabled: userIds.length > 0 && tab === "progress",
  });

  const getMemberName = (uid: string) => {
    const m = members.find((m: any) => m.id === uid);
    return m ? m.name : uid.slice(0, 8);
  };

  const getChallengeName = (cid: string) => {
    const c = challenges.find((c: any) => c.id === cid);
    return c?.title ?? "Unknown";
  };

  const getChallengeTarget = (cid: string) => {
    const c = challenges.find((c: any) => c.id === cid);
    return c?.target_count ?? 0;
  };

  const handleAdd = async () => {
    if (!title.trim()) { toast.error("Title required"); return; }
    if (!rewardAmount || Number(rewardAmount) <= 0) { toast.error("Reward amount required"); return; }
    setAdding(true);
    const { error } = await supabase.from("anchor_challenges").insert({
      title: title.trim(),
      description: description.trim() || null,
      reward_amount: Number(rewardAmount),
      challenge_type: challengeType,
      target_count: Number(targetCount) || 1,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Bonus challenge created!");
      setTitle(""); setDescription(""); setRewardAmount(""); setTargetCount("1");
    }
    setAdding(false);
    queryClient.invalidateQueries({ queryKey: ["admin_anchor_challenges"] });
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    await supabase.from("anchor_challenges").update({ is_active: !currentActive }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin_anchor_challenges"] });
  };

  const deleteChallenge = async (id: string) => {
    if (!confirm("Delete this challenge?")) return;
    await supabase.from("anchor_challenges").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin_anchor_challenges"] });
    toast.success("Deleted");
  };

  const resetProgress = async (progressId: string) => {
    if (!confirm("Reset this anchor's progress for this challenge?")) return;
    await supabase.functions.invoke("anchor-earning", {
      body: { type: "admin_reset_challenge_progress", progressId },
    });
    queryClient.invalidateQueries({ queryKey: ["admin_challenge_progress"] });
    toast.success("Progress reset");
  };

  const markComplete = async (progressId: string | null, challengeId: string, targetUserId: string) => {
    if (!confirm("Mark as completed and grant the cash reward?")) return;
    const { data } = await supabase.functions.invoke("anchor-earning", {
      body: { type: "admin_complete_challenge", progressId, challengeId, targetUserId },
    });
    if (data?.success) {
      toast.success(`Rewarded $${data.rewarded}`);
      queryClient.invalidateQueries({ queryKey: ["admin_challenge_progress"] });
    } else {
      toast.error("Failed to complete");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Female Earning Bonus Challenges</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("challenges")}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${tab === "challenges" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
        >
          <Plus className="w-4 h-4 inline mr-1" /> Manage Challenges
        </button>
        <button
          onClick={() => setTab("progress")}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${tab === "progress" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
        >
          <Users className="w-4 h-4 inline mr-1" /> Anchor Progress
        </button>
      </div>

      {tab === "challenges" && (
        <>
          {/* Create form */}
          <div className="bg-card border rounded-lg p-4 mb-6 max-w-lg">
            <h2 className="font-bold mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> New Bonus Challenge</h2>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Video chat 5 guys privately"
              className="w-full border rounded-lg px-3 py-2 mb-2 bg-background text-foreground"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              className="w-full border rounded-lg px-3 py-2 mb-2 bg-background text-foreground resize-none"
              rows={2}
            />
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">Challenge Type</label>
                <select
                  value={challengeType}
                  onChange={(e) => setChallengeType(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
                >
                  {CHALLENGE_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">Target Count</label>
                <input
                  type="number"
                  min="1"
                  value={targetCount}
                  onChange={(e) => setTargetCount(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="text-xs font-bold text-muted-foreground mb-1 block">Cash Reward ($)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rewardAmount}
                  onChange={(e) => setRewardAmount(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full border rounded-lg pl-8 pr-3 py-2 bg-background text-foreground"
                />
              </div>
            </div>
            <button onClick={handleAdd} disabled={adding} className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-lg">
              {adding ? "Adding..." : "Add Challenge"}
            </button>
          </div>

          {/* Challenge list */}
          <div className="space-y-3 max-w-lg">
            {challenges.map((c: any) => (
              <div key={c.id} className="bg-card border rounded-lg p-4 flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold">{c.title}</h3>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                      ${Number(c.reward_amount).toFixed(2)}
                    </span>
                  </div>
                  {c.description && <p className="text-sm text-muted-foreground mt-1">{c.description}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    Type: {CHALLENGE_TYPES.find(t => t.value === c.challenge_type)?.label || c.challenge_type} · Target: {c.target_count}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <button
                    onClick={() => toggleActive(c.id, c.is_active)}
                    className="text-xs font-bold px-3 py-1 rounded-lg border hover:bg-accent"
                  >
                    {c.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={() => deleteChallenge(c.id)} className="text-destructive hover:opacity-70">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {challenges.length === 0 && (
              <p className="text-muted-foreground text-sm">No bonus challenges yet. Create one above!</p>
            )}
          </div>
        </>
      )}

      {tab === "progress" && (
        <div>
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2">
            <Trophy className="w-5 h-5" /> This Week's Progress
          </h2>

          {progressLoading && <p className="text-muted-foreground text-sm">Loading...</p>}

          {!progressLoading && allProgress.length === 0 && (
            <p className="text-muted-foreground text-sm">No anchor has started any challenge this week yet.</p>
          )}

          <div className="space-y-3 max-w-2xl">
            {allProgress.map((p: any) => {
              const target = getChallengeTarget(p.challenge_id);
              const current = p.unique_partners?.length ?? 0;
              const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;

              return (
                <div key={p.id} className="bg-card border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-sm">{getMemberName(p.user_id)}</p>
                      <p className="text-xs text-muted-foreground">{getChallengeName(p.challenge_id)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.rewarded ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Completed
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => markComplete(p.id, p.challenge_id, p.user_id)}
                            className="text-xs font-bold px-3 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700"
                          >
                            <CheckCircle className="w-3 h-3 inline mr-1" /> Complete & Reward
                          </button>
                          <button
                            onClick={() => resetProgress(p.id)}
                            className="text-xs font-bold px-3 py-1 rounded-lg border hover:bg-accent"
                          >
                            <RotateCcw className="w-3 h-3 inline mr-1" /> Reset
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-muted-foreground">{current}/{target} unique guys</span>
                      <span className="text-xs text-muted-foreground">{Math.round(pct)}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-muted">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          background: p.rewarded ? '#22c55e' : '#f59e0b',
                        }}
                      />
                    </div>
                  </div>

                  {/* Partner list */}
                  {p.unique_partners?.length > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Partner IDs: {p.unique_partners.map((id: string) => id.slice(0, 8)).join(", ")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAnchorChallengesPage;
