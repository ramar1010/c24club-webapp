import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus, DollarSign } from "lucide-react";

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

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Female Earning Bonus Challenges</h1>

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
    </div>
  );
};

export default AdminAnchorChallengesPage;
