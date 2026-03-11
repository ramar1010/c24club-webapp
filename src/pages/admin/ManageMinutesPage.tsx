import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Coins, Search } from "lucide-react";

const ManageMinutesPage = () => {
  const [searchEmail, setSearchEmail] = useState("");
  const [selectedUser, setSelectedUser] = useState<{ id: string; email: string; total_minutes: number } | null>(null);
  const [minutesToAdd, setMinutesToAdd] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  // Fetch all member_minutes for display
  const { data: allMinutes = [], refetch } = useQuery({
    queryKey: ["admin-all-minutes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_minutes")
        .select("*")
        .order("total_minutes", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    try {
      // Look up the user by checking member_minutes or just use the email as userId
      // Since we don't have a profiles table with email, we'll search by user_id directly
      const { data } = await supabase
        .from("member_minutes")
        .select("*")
        .eq("user_id", searchEmail.trim())
        .maybeSingle();

      if (data) {
        setSelectedUser({ id: data.user_id, email: data.user_id, total_minutes: data.total_minutes });
      } else {
        // User might not have a record yet, still allow adding
        setSelectedUser({ id: searchEmail.trim(), email: searchEmail.trim(), total_minutes: 0 });
        toast.info("No existing record — minutes will be created on add.");
      }
    } catch {
      toast.error("Search failed");
    }
    setSearching(false);
  };

  const handleAddMinutes = async () => {
    if (!selectedUser || !minutesToAdd) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("earn-minutes", {
        body: {
          type: "admin_add_minutes",
          targetUserId: selectedUser.id,
          minutes: parseInt(minutesToAdd),
          mode: "add",
        },
      });
      if (error) throw error;
      toast.success(`Added ${minutesToAdd} minutes. New total: ${data.newMinutes}`);
      setSelectedUser({ ...selectedUser, total_minutes: data.newMinutes });
      setMinutesToAdd("");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to add minutes");
    }
    setLoading(false);
  };

  const handleSetMinutes = async () => {
    if (!selectedUser || !minutesToAdd) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("earn-minutes", {
        body: {
          type: "admin_add_minutes",
          targetUserId: selectedUser.id,
          minutes: parseInt(minutesToAdd),
          mode: "set",
        },
      });
      if (error) throw error;
      toast.success(`Set minutes to ${data.newMinutes}`);
      setSelectedUser({ ...selectedUser, total_minutes: data.newMinutes });
      setMinutesToAdd("");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to set minutes");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Manage Minutes</h2>
        <p className="text-muted-foreground mt-1">Add or set minutes for any user to test features.</p>
      </div>

      {/* Search by User ID */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <Label className="text-sm font-medium">User ID</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Paste user UUID here..."
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={searching}>
            <Search className="w-4 h-4 mr-2" />
            Find
          </Button>
        </div>

        {selectedUser && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">User ID</p>
                <p className="font-mono text-sm">{selectedUser.id}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Current Minutes</p>
                <p className="text-2xl font-bold text-primary">{selectedUser.total_minutes}</p>
              </div>
            </div>

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-sm">Minutes</Label>
                <Input
                  type="number"
                  placeholder="e.g. 500"
                  value={minutesToAdd}
                  onChange={(e) => setMinutesToAdd(e.target.value)}
                />
              </div>
              <Button onClick={handleAddMinutes} disabled={loading || !minutesToAdd}>
                <Coins className="w-4 h-4 mr-2" />
                Add
              </Button>
              <Button variant="outline" onClick={handleSetMinutes} disabled={loading || !minutesToAdd}>
                Set To
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* All users with minutes */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="font-semibold mb-4">All Users with Minutes</h3>
        {allMinutes.length === 0 ? (
          <p className="text-muted-foreground text-sm">No users have earned minutes yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {allMinutes.map((m: any) => (
              <div
                key={m.id}
                className="flex items-center justify-between py-3 cursor-pointer hover:bg-muted/30 px-2 rounded transition-colors"
                onClick={() => {
                  setSearchEmail(m.user_id);
                  setSelectedUser({ id: m.user_id, email: m.user_id, total_minutes: m.total_minutes });
                }}
              >
                <div>
                  <p className="font-mono text-sm">{m.user_id}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.is_vip ? "⭐ VIP" : "Free"} · Updated {new Date(m.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="font-bold text-lg">{m.total_minutes} min</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageMinutesPage;
