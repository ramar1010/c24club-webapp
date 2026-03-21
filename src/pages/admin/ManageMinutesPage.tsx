import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Coins, DollarSign, Search, Star, Dices } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ManageMinutesPage = () => {
  const [searchEmail, setSearchEmail] = useState("");
  const [selectedUser, setSelectedUser] = useState<{ id: string; email: string; total_minutes: number; ad_points: number; cash_balance: number } | null>(null);
  const [minutesToAdd, setMinutesToAdd] = useState("");
  const [adPointsToAdd, setAdPointsToAdd] = useState("");
  const [cashBalanceToAdd, setCashBalanceToAdd] = useState("");
  const [wagerAmount, setWagerAmount] = useState("");
  const [wagerStatus, setWagerStatus] = useState("pending");
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
      const { data } = await supabase
        .from("member_minutes")
        .select("*")
        .eq("user_id", searchEmail.trim())
        .maybeSingle();

      const cashBal = await fetchCashBalance(searchEmail.trim());

      if (data) {
        setSelectedUser({ id: data.user_id, email: data.user_id, total_minutes: data.total_minutes, ad_points: data.ad_points ?? 0, cash_balance: cashBal });
      } else {
        setSelectedUser({ id: searchEmail.trim(), email: searchEmail.trim(), total_minutes: 0, ad_points: 0, cash_balance: cashBal });
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Manage Minutes, Ad Points & Cash</h2>
        <p className="text-muted-foreground mt-1">Add or set minutes, ad points, and anchor cash balance for any user.</p>
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

            {/* Wager Earnings controls */}
            <div className="border-t border-border pt-4 mt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Dices className="w-4 h-4" /> Add Wager Earning Record
              </h4>
              <p className="text-xs text-muted-foreground mb-3">
                Creates a payout record in the wager earnings modal (for marketing/demo purposes).
              </p>
              <div className="flex gap-2 items-end flex-wrap">
                <div className="flex-1 min-w-[120px]">
                  <Label className="text-sm">Amount ($)</Label>
                  <Input type="number" step="0.01" placeholder="e.g. 200.00" value={wagerAmount} onChange={(e) => setWagerAmount(e.target.value)} />
                </div>
                <div className="w-[140px]">
                  <Label className="text-sm">Status</Label>
                  <Select value={wagerStatus} onValueChange={setWagerStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={async () => {
                    if (!selectedUser || !wagerAmount) return;
                    setLoading(true);
                    try {
                      const amount = parseFloat(wagerAmount);
                      const { error } = await supabase.from("jackpot_payouts").insert({
                        user_id: selectedUser.id,
                        jackpot_amount: amount,
                        minutes_credited: 0,
                        status: wagerStatus,
                        paypal_email: wagerStatus === "paid" ? "marketing@demo.com" : null,
                      });
                      if (error) throw error;
                      toast.success(`Added $${amount.toFixed(2)} wager earning (${wagerStatus})`);
                      setWagerAmount("");
                    } catch (e: any) {
                      toast.error(e.message || "Failed to add wager earning");
                    }
                    setLoading(false);
                  }}
                  disabled={loading || !wagerAmount}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Dices className="w-4 h-4 mr-2" /> Add Earning
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
            {allMinutes.map((m: any) => (
              <div
                key={m.id}
                className="flex items-center justify-between py-3 cursor-pointer hover:bg-muted/30 px-2 rounded transition-colors"
                onClick={async () => {
                  setSearchEmail(m.user_id);
                  const cashBal = await fetchCashBalance(m.user_id);
                  setSelectedUser({ id: m.user_id, email: m.user_id, total_minutes: m.total_minutes, ad_points: m.ad_points ?? 0, cash_balance: cashBal });
                }}
              >
                <div>
                  <p className="font-mono text-sm">{m.user_id}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.is_vip ? "⭐ VIP" : "Free"} · Updated {new Date(m.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-4 items-center">
                  <span className="font-bold text-lg">{m.total_minutes} min</span>
                  <span className="font-bold text-sm text-yellow-500">⭐ {m.ad_points ?? 0}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageMinutesPage;
