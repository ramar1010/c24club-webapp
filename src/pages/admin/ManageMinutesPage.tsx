import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Coins, DollarSign, Search, Star, Trophy } from "lucide-react";

type FreezeInfo = {
  is_frozen: boolean;
  frozen_at: string | null;
  freeze_free_until: string | null;
};

const formatFreezeStatus = (f: FreezeInfo) => {
  if (f.is_frozen) {
    return { label: "❄️ Frozen", detail: f.frozen_at ? `Since ${new Date(f.frozen_at).toLocaleDateString()}` : "", color: "text-blue-400" };
  }
  if (f.freeze_free_until) {
    const until = new Date(f.freeze_free_until);
    if (until > new Date()) {
      return { label: "🛡️ Protected", detail: `Until ${until.toLocaleDateString()} ${until.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`, color: "text-emerald-500" };
    }
    return { label: "⚠️ Eligible to refreeze", detail: `Protection ended ${until.toLocaleDateString()}`, color: "text-amber-500" };
  }
  return { label: "✓ Active", detail: "Never frozen", color: "text-muted-foreground" };
};

const ManageMinutesPage = () => {
  const [searchEmail, setSearchEmail] = useState("");
  const [selectedUser, setSelectedUser] = useState<{ id: string; email: string; total_minutes: number; ad_points: number; cash_balance: number; freeze: FreezeInfo } | null>(null);
  const [minutesToAdd, setMinutesToAdd] = useState("");
  const [adPointsToAdd, setAdPointsToAdd] = useState("");
  const [cashBalanceToAdd, setCashBalanceToAdd] = useState("");
  const [challengeAmount, setChallengeAmount] = useState("");
  const [challengeTitle, setChallengeTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

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

  // Fetch member emails so we can search/display by email
  const { data: memberEmailMap = {} } = useQuery({
    queryKey: ["admin-member-emails"],
    queryFn: async () => {
      const map: Record<string, string> = {};
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("members")
          .select("id, email")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        data.forEach((m: any) => { if (m.email) map[m.id] = m.email; });
        if (data.length < pageSize) break;
      }
      return map;
    },
  });

  const [tableSearch, setTableSearch] = useState("");

  const resolveUserIdFromInput = async (input: string): Promise<string | null> => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    // UUID heuristic
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) return trimmed;
    // Look up by email (case-insensitive)
    const { data } = await supabase
      .from("members")
      .select("id")
      .ilike("email", trimmed)
      .maybeSingle();
    return data?.id ?? null;
  };

  // Fetch cash-type weekly challenges for the dropdown
  const { data: cashChallenges = [] } = useQuery({
    queryKey: ["admin-cash-challenges"],
    queryFn: async () => {
      const { data } = await supabase
        .from("weekly_challenges")
        .select("id, title, reward_amount, reward_type")
        .eq("reward_type", "cash")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const fetchCashBalance = async (userId: string): Promise<number> => {
    const { data } = await supabase
      .from("anchor_sessions")
      .select("cash_balance")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.cash_balance ?? 0;
  };

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    try {
      const userId = await resolveUserIdFromInput(searchEmail);
      if (!userId) {
        toast.error("No user found for that email or UUID");
        setSearching(false);
        return;
      }
      const { data } = await supabase
        .from("member_minutes")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      const cashBal = await fetchCashBalance(userId);
      const email = memberEmailMap[userId] ?? userId;

      const freeze: FreezeInfo = {
        is_frozen: data?.is_frozen ?? false,
        frozen_at: data?.frozen_at ?? null,
        freeze_free_until: data?.freeze_free_until ?? null,
      };

      if (data) {
        setSelectedUser({ id: userId, email, total_minutes: data.total_minutes, ad_points: data.ad_points ?? 0, cash_balance: cashBal, freeze });
      } else {
        setSelectedUser({ id: userId, email, total_minutes: 0, ad_points: 0, cash_balance: cashBal, freeze });
        toast.info("No existing record — values will be created on add.");
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
        body: { type: "admin_add_minutes", targetUserId: selectedUser.id, minutes: parseInt(minutesToAdd), mode: "add" },
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
        body: { type: "admin_add_minutes", targetUserId: selectedUser.id, minutes: parseInt(minutesToAdd), mode: "set" },
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

  const handleAddAdPoints = async () => {
    if (!selectedUser || !adPointsToAdd) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("earn-minutes", {
        body: { type: "admin_ad_points", targetUserId: selectedUser.id, points: parseInt(adPointsToAdd), mode: "add" },
      });
      if (error) throw error;
      toast.success(`Added ${adPointsToAdd} ad points. New total: ${data.totalAdPoints}`);
      setSelectedUser({ ...selectedUser, ad_points: data.totalAdPoints });
      setAdPointsToAdd("");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to add ad points");
    }
    setLoading(false);
  };

  const handleSetAdPoints = async () => {
    if (!selectedUser || !adPointsToAdd) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("earn-minutes", {
        body: { type: "admin_ad_points", targetUserId: selectedUser.id, points: parseInt(adPointsToAdd), mode: "set" },
      });
      if (error) throw error;
      toast.success(`Set ad points to ${data.totalAdPoints}`);
      setSelectedUser({ ...selectedUser, ad_points: data.totalAdPoints });
      setAdPointsToAdd("");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to set ad points");
    }
    setLoading(false);
  };

  const upsertCashBalance = async (newBalance: number) => {
    const { data: existing } = await supabase
      .from("anchor_sessions")
      .select("id")
      .eq("user_id", selectedUser!.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("anchor_sessions")
        .update({ cash_balance: newBalance })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("anchor_sessions")
        .insert({ user_id: selectedUser!.id, cash_balance: newBalance, status: "active" });
      if (error) throw error;
    }
    return newBalance;
  };

  const handleAddCashBalance = async () => {
    if (!selectedUser || !cashBalanceToAdd) return;
    setLoading(true);
    try {
      const amount = parseFloat(cashBalanceToAdd);
      const newBalance = await upsertCashBalance(selectedUser.cash_balance + amount);
      toast.success(`Added $${amount.toFixed(2)}. New balance: $${newBalance.toFixed(2)}`);
      setSelectedUser({ ...selectedUser, cash_balance: newBalance });
      setCashBalanceToAdd("");
    } catch (e: any) {
      toast.error(e.message || "Failed to add cash balance");
    }
    setLoading(false);
  };

  const handleSetCashBalance = async () => {
    if (!selectedUser || !cashBalanceToAdd) return;
    setLoading(true);
    try {
      const amount = parseFloat(cashBalanceToAdd);
      const newBalance = await upsertCashBalance(amount);
      toast.success(`Set cash balance to $${newBalance.toFixed(2)}`);
      setSelectedUser({ ...selectedUser, cash_balance: newBalance });
      setCashBalanceToAdd("");
    } catch (e: any) {
      toast.error(e.message || "Failed to set cash balance");
    }
    setLoading(false);
  };

  const handleAddChallengeEarning = async () => {
    if (!selectedUser) return;
    setLoading(true);
    try {
      let challengeId: string;
      const customAmount = parseFloat(challengeAmount);

      if (challengeTitle && cashChallenges.length > 0) {
        // Use selected existing challenge
        challengeId = challengeTitle;
      } else {
        // Create a temporary challenge for this earning
        const title = `Marketing Demo ($${customAmount || 10})`;
        const { data: newChallenge, error: cErr } = await supabase
          .from("weekly_challenges")
          .insert({
            title,
            reward_type: "cash",
            reward_amount: customAmount || 10,
            is_active: false,
            theme: "emerald",
            challenge_type: "manual",
          })
          .select("id")
          .single();
        if (cErr) throw cErr;
        challengeId = newChallenge.id;
      }

      // If a custom amount was entered, update the challenge's reward_amount
      if (customAmount && challengeTitle) {
        await supabase
          .from("weekly_challenges")
          .update({ reward_amount: customAmount })
          .eq("id", challengeId);
      }

      // Create an approved submission for this user
      const { error: sErr } = await supabase
        .from("challenge_submissions")
        .insert({
          user_id: selectedUser.id,
          challenge_id: challengeId,
          status: "approved",
          proof_text: "Admin-added for marketing",
        });
      if (sErr) throw sErr;

      const selectedChallenge = cashChallenges.find((c: any) => c.id === challengeId);
      const displayAmount = customAmount || selectedChallenge?.reward_amount || 10;
      toast.success(`Added $${displayAmount} challenge earning to user's Challenge Earnings modal`);
      setChallengeAmount("");
      setChallengeTitle("");
    } catch (e: any) {
      toast.error(e.message || "Failed to add challenge earning");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Manage Minutes, Ad Points & Cash</h2>
        <p className="text-muted-foreground mt-1">Add or set minutes, ad points, anchor cash balance, and challenge earnings for any user.</p>
      </div>

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
          <div className="bg-muted/50 rounded-lg p-4 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">User ID</p>
                <p className="font-mono text-sm">{selectedUser.id}</p>
              </div>
              <div className="flex gap-6 text-right">
                <div>
                  <p className="text-sm text-muted-foreground">Minutes</p>
                  <p className="text-2xl font-bold text-primary">{selectedUser.total_minutes}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ad Points</p>
                  <p className="text-2xl font-bold text-yellow-500">{selectedUser.ad_points}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cash Balance</p>
                  <p className="text-2xl font-bold text-green-500">${selectedUser.cash_balance.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Freeze status */}
            {(() => {
              const s = formatFreezeStatus(selectedUser.freeze);
              return (
                <div className="rounded-md border border-border bg-background/40 px-3 py-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Freeze Status</p>
                    <p className={`text-sm font-semibold ${s.color}`}>{s.label}</p>
                  </div>
                  {s.detail && <p className="text-xs text-muted-foreground">{s.detail}</p>}
                </div>
              );
            })()}

            {/* Minutes controls */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-sm">Minutes</Label>
                <Input type="number" placeholder="e.g. 500" value={minutesToAdd} onChange={(e) => setMinutesToAdd(e.target.value)} />
              </div>
              <Button onClick={handleAddMinutes} disabled={loading || !minutesToAdd}>
                <Coins className="w-4 h-4 mr-2" />Add
              </Button>
              <Button variant="outline" onClick={handleSetMinutes} disabled={loading || !minutesToAdd}>Set To</Button>
            </div>

            {/* Ad Points controls */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-sm">Ad Points</Label>
                <Input type="number" placeholder="e.g. 100" value={adPointsToAdd} onChange={(e) => setAdPointsToAdd(e.target.value)} />
              </div>
              <Button onClick={handleAddAdPoints} disabled={loading || !adPointsToAdd} className="bg-yellow-500 hover:bg-yellow-600 text-black">
                <Star className="w-4 h-4 mr-2" />Add
              </Button>
              <Button variant="outline" onClick={handleSetAdPoints} disabled={loading || !adPointsToAdd}>Set To</Button>
            </div>

            {/* Cash Balance controls */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-sm">Cash Balance ($)</Label>
                <Input type="number" step="0.01" placeholder="e.g. 25.00" value={cashBalanceToAdd} onChange={(e) => setCashBalanceToAdd(e.target.value)} />
              </div>
              <Button onClick={handleAddCashBalance} disabled={loading || !cashBalanceToAdd} className="bg-green-500 hover:bg-green-600 text-white">
                <DollarSign className="w-4 h-4 mr-2" />Add
              </Button>
              <Button variant="outline" onClick={handleSetCashBalance} disabled={loading || !cashBalanceToAdd}>Set To</Button>
            </div>

            {/* Challenge Earnings controls */}
            <div className="border-t border-border pt-4 mt-4">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-emerald-500" /> Add Challenge Cash Earning
              </h4>
              <p className="text-xs text-muted-foreground mb-3">
                Creates an approved challenge submission so it appears in the user's "Challenge Earnings" cashout modal. For TikTok marketing.
              </p>
              <div className="flex gap-2 items-end flex-wrap">
                {cashChallenges.length > 0 && (
                  <div className="flex-1 min-w-[160px]">
                    <Label className="text-sm">Challenge (optional)</Label>
                    <select
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={challengeTitle}
                      onChange={(e) => setChallengeTitle(e.target.value)}
                    >
                      <option value="">Auto-create demo challenge</option>
                      {cashChallenges.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.title} (${c.reward_amount})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="w-[130px]">
                  <Label className="text-sm">Amount ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 35"
                    value={challengeAmount}
                    onChange={(e) => setChallengeAmount(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleAddChallengeEarning}
                  disabled={loading || (!challengeAmount && !challengeTitle)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Trophy className="w-4 h-4 mr-2" /> Add Earning
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="font-semibold mb-4">All Users with Minutes</h3>
        {allMinutes.length === 0 ? (
          <p className="text-muted-foreground text-sm">No users have earned minutes yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {allMinutes.map((m: any) => {
              const freeze: FreezeInfo = {
                is_frozen: m.is_frozen ?? false,
                frozen_at: m.frozen_at ?? null,
                freeze_free_until: m.freeze_free_until ?? null,
              };
              const s = formatFreezeStatus(freeze);
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-3 cursor-pointer hover:bg-muted/30 px-2 rounded transition-colors"
                  onClick={async () => {
                    setSearchEmail(m.user_id);
                    const cashBal = await fetchCashBalance(m.user_id);
                    setSelectedUser({ id: m.user_id, email: m.user_id, total_minutes: m.total_minutes, ad_points: m.ad_points ?? 0, cash_balance: cashBal, freeze });
                  }}
                >
                  <div>
                    <p className="font-mono text-sm">{m.user_id}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.is_vip ? "⭐ VIP" : "Free"} · Updated {new Date(m.updated_at).toLocaleDateString()}
                    </p>
                    <p className={`text-xs ${s.color}`}>
                      {s.label}
                      {s.detail ? ` · ${s.detail}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-4 items-center">
                    <span className="font-bold text-lg">{m.total_minutes} min</span>
                    <span className="font-bold text-sm text-yellow-500">⭐ {m.ad_points ?? 0}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageMinutesPage;
