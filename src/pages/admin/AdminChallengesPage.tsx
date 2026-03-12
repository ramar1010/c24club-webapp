import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

const AdminChallengesPage = () => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
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
    const { error } = await supabase.from("weekly_challenges").insert({
      title: title.trim(),
      description: description.trim() || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Challenge created!");
      setTitle(""); setDescription("");
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
        <button onClick={handleAdd} disabled={adding} className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-lg">
          {adding ? "Adding..." : "Add Challenge"}
        </button>
      </div>

      {/* List */}
      <div className="space-y-3 max-w-lg">
        {challenges.map((c: any) => (
          <div key={c.id} className="bg-card border rounded-lg p-4 flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold">{c.title}</h3>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {c.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              {c.description && <p className="text-sm text-muted-foreground mt-1">{c.description}</p>}
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
