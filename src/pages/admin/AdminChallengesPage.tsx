import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

const challengeTypes = [
  { value: "manual", label: "Manual Proof" },
  { value: "auto_invite", label: "Auto: Invite Friends" },
  { value: "auto_chat_users", label: "Auto: Chat with N Users" },
  { value: "auto_minutes", label: "Auto: Earn N Minutes" },
  { value: "auto_referral", label: "Auto: Refer N Users" },
];

const rewardTypes = [
  { value: "cash", label: "Cash ($)" },
  { value: "minutes", label: "Minutes" },
  { value: "freeze_free", label: "Freeze-Free Days" },
];

const AdminChallengesPage = () => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [challengeType, setChallengeType] = useState("manual");
  const [rewardType, setRewardType] = useState("cash");
  const [rewardAmount, setRewardAmount] = useState("5");
  const [autoTarget, setAutoTarget] = useState("3");
  const [adding, setAdding] = useState(false);

  const { data: challenges = [] } = useQuery({
    queryKey: ["admin_challenges"],
    queryFn: async () => {
      const { data } = await supabase
        .from("weekly_challenges")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const handleAdd = async () => {
    if (!title.trim()) { toast.error("Title required"); return; }
    setAdding(true);

    const autoAction = challengeType !== "manual"
      ? JSON.stringify({ type: challengeType, target: parseInt(autoTarget) })
      : null;

    const { error } = await supabase.from("weekly_challenges").insert({
      title: title.trim(),
      description: description.trim() || null,
      challenge_type: challengeType === "manual" ? "manual" : "auto",
      reward_type: rewardType,
      reward_amount: parseFloat(rewardAmount),
      auto_track_action: autoAction,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Challenge created!");
      setTitle(""); setDescription("");
      setChallengeType("manual"); setRewardType("cash");
      setRewardAmount("5"); setAutoTarget("3");
    }
    setAdding(false);
    queryClient.invalidateQueries({ queryKey: ["admin_challenges"] });
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    await supabase.from("weekly_challenges").update({ is_active: !currentActive }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin_challenges"] });
  };

  const deleteChallenge = async (id: string) => {
    if (!confirm("Delete this challenge?")) return;
    await supabase.from("weekly_challenges").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin_challenges"] });
    toast.success("Deleted");
  };

  const formatReward = (c: any) => {
    const rt = c.reward_type || "freeze_free";
    const amt = c.reward_amount || 0;
    if (rt === "cash") return `$${amt}`;
    if (rt === "minutes") return `${amt} min`;
    return `${amt || 7} days freeze-free`;
  };

  const formatType = (c: any) => {
    const ct = c.challenge_type || "manual";
    if (ct === "manual") return "Manual proof";
    try {
      const action = JSON.parse(c.auto_track_action || "{}");
      const t = challengeTypes.find(t => t.value === action.type);
      return `${t?.label || "Auto"} (target: ${action.target})`;
    } catch {
      return "Auto-tracked";
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Weekly Challenges</h1>

      {/* Add New */}
      <div className="bg-card border rounded-lg p-4 mb-6 max-w-lg">
        <h2 className="font-bold mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> New Challenge</h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Challenge title"
          className="w-full border rounded-lg px-3 py-2 mb-2 bg-background text-foreground"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="w-full border rounded-lg px-3 py-2 mb-3 bg-background text-foreground resize-none"
          rows={2}
        />

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">Challenge Type</label>
            <select
              value={challengeType}
              onChange={(e) => setChallengeType(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
            >
              {challengeTypes.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">Reward Type</label>
            <select
              value={rewardType}
              onChange={(e) => setRewardType(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
            >
              {rewardTypes.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">
              Reward Amount {rewardType === "cash" ? "($)" : rewardType === "minutes" ? "(min)" : "(days)"}
            </label>
            <input
              type="number"
              value={rewardAmount}
              onChange={(e) => setRewardAmount(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
            />
          </div>
          {challengeType !== "manual" && (
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">Target Count</label>
              <input
                type="number"
                value={autoTarget}
                onChange={(e) => setAutoTarget(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
              />
            </div>
          )}
        </div>

        <button onClick={handleAdd} disabled={adding} className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-lg">
          {adding ? "Adding..." : "Add Challenge"}
        </button>
      </div>

      {/* List */}
      <div className="space-y-3 max-w-lg">
        {challenges.map((c: any) => (
          <div key={c.id} className="bg-card border rounded-lg p-4 flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold">{c.title}</h3>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {c.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              {c.description && <p className="text-sm text-muted-foreground mt-1">{c.description}</p>}
              <div className="flex gap-3 mt-1.5">
                <span className="text-xs text-muted-foreground">🎁 {formatReward(c)}</span>
                <span className="text-xs text-muted-foreground">📋 {formatType(c)}</span>
              </div>
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
      </div>
    </div>
  );
};

export default AdminChallengesPage;
