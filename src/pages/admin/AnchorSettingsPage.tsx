import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AnchorSettingsPage = () => {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["anchor-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anchor_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: cashoutSettings, isLoading: cashoutLoading } = useQuery({
    queryKey: ["cashout-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cashout_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const [maxCap, setMaxCap] = useState(5);
  const [ratePerMinute, setRatePerMinute] = useState(0.01);
  const [minCashout, setMinCashout] = useState(100);
  const [maxCashout, setMaxCashout] = useState(5000);

  // New active/idle rates
  const [activeRateCash, setActiveRateCash] = useState(1.5);
  const [activeRateTime, setActiveRateTime] = useState(30);
  const [idleRateCash, setIdleRateCash] = useState(0.1);
  const [idleRateTime, setIdleRateTime] = useState(30);

  useEffect(() => {
    if (settings) {
      setMaxCap(settings.max_anchor_cap);
      setActiveRateCash(Number(settings.active_rate_cash ?? 1.5));
      setActiveRateTime(settings.active_rate_time ?? 30);
      setIdleRateCash(Number(settings.idle_rate_cash ?? 0.1));
      setIdleRateTime(settings.idle_rate_time ?? 30);
    }
  }, [settings]);

  useEffect(() => {
    if (cashoutSettings) {
      setRatePerMinute(Number(cashoutSettings.rate_per_minute));
      setMinCashout(cashoutSettings.min_cashout_minutes);
      setMaxCashout(cashoutSettings.max_cashout_minutes);
    }
  }, [cashoutSettings]);

  const saveCapMutation = useMutation({
    mutationFn: async () => {
      if (!settings?.id) return;
      const { error } = await supabase
        .from("anchor_settings")
        .update({ max_anchor_cap: maxCap, updated_at: new Date().toISOString() })
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Slot cap saved!");
      queryClient.invalidateQueries({ queryKey: ["anchor-settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveEarningRatesMutation = useMutation({
    mutationFn: async () => {
      if (!settings?.id) return;
      const { error } = await supabase
        .from("anchor_settings")
        .update({
          active_rate_cash: activeRateCash,
          active_rate_time: activeRateTime,
          idle_rate_cash: idleRateCash,
          idle_rate_time: idleRateTime,
          updated_at: new Date().toISOString(),
        })
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Earning rates saved!");
      queryClient.invalidateQueries({ queryKey: ["anchor-settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveRateMutation = useMutation({
    mutationFn: async () => {
      if (!cashoutSettings?.id) return;
      const { error } = await supabase
        .from("cashout_settings")
        .update({
          rate_per_minute: ratePerMinute,
          min_cashout_minutes: minCashout,
          max_cashout_minutes: maxCashout,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cashoutSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cashout settings saved!");
      queryClient.invalidateQueries({ queryKey: ["cashout-settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: anchorAdminState } = useQuery({
    queryKey: ["anchor-admin-state"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("anchor-earning", {
        body: { type: "admin_get_all", userId: "admin" },
      });
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });

  const { data: cashoutRequests } = useQuery({
    queryKey: ["cashout-requests-admin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cashout_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  const { data: anchorPayouts } = useQuery({
    queryKey: ["anchor-payouts-admin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anchor_payouts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  const updateAnchorPayoutMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("anchor_payouts")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      toast.success(`Payout marked as ${status}`);
      queryClient.invalidateQueries({ queryKey: ["anchor-payouts-admin"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: members } = useQuery({
    queryKey: ["admin-members-lookup-anchor"],
    queryFn: async () => {
      const { data } = await supabase.from("members").select("id, name, email");
      return data ?? [];
    },
  });

  const memberName = (id: string) => {
    const m = members?.find((m) => m.id === id);
    return m?.name || m?.email || id?.slice(0, 8) + "...";
  };

  const clearSlotsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("anchor-earning", {
        body: { type: "admin_clear_slots", userId: "admin" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Slots cleared! ${data?.promoted ?? 0} queued users promoted.`);
      queryClient.invalidateQueries({ queryKey: ["anchor-admin-state"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const clearSingleSlotMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase.functions.invoke("anchor-earning", {
        body: { type: "admin_clear_slots", userId: "admin", sessionId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Slot cleared! ${data?.promoted ?? 0} queued users promoted.`);
      queryClient.invalidateQueries({ queryKey: ["anchor-admin-state"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateCashoutMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("cashout_requests")
        .update({ status, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      toast.success(`Request marked as ${status}`);
      queryClient.invalidateQueries({ queryKey: ["cashout-requests-admin"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || cashoutLoading) return <div className="p-6 text-center text-muted-foreground">Loading...</div>;

  const activeEarners = anchorAdminState?.sessions?.filter((session: any) => session.status === "active") ?? [];
  const queueData = anchorAdminState?.queue ?? [];
  const pendingRequests = cashoutRequests?.filter((r) => r.status === "pending") ?? [];
  const recentRequests = cashoutRequests?.filter((r) => r.status !== "pending") ?? [];

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-foreground">Female Earning System</h1>

      {/* Slot Cap */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-bold text-foreground">Concurrent Earner Slots</h2>
        <p className="text-sm text-muted-foreground">
          Maximum number of female users who can earn simultaneously. Others will be queued.
        </p>
        <div className="max-w-xs">
          <label className="block text-sm font-medium mb-1 text-foreground">Max Slots</label>
          <input
            type="number"
            min={1}
            value={maxCap}
            onChange={(e) => setMaxCap(parseInt(e.target.value) || 5)}
            className="w-full border border-input rounded-lg px-3 py-2 bg-background text-foreground"
          />
        </div>
        <button
          onClick={() => saveCapMutation.mutate()}
          disabled={saveCapMutation.isPending}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-bold hover:opacity-90 disabled:opacity-50"
        >
          {saveCapMutation.isPending ? "Saving..." : "Save Slot Cap"}
        </button>
      </div>

      {/* Active/Idle Earning Rates */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-bold text-foreground">Earning Rates</h2>
        <p className="text-sm text-muted-foreground">
          Females earn at different rates depending on whether they're connected to a guy (active) or waiting (idle).
        </p>

        {/* Active rate */}
        <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-green-500 font-black text-sm">🔥 ACTIVE RATE</span>
            <span className="text-xs text-muted-foreground">(on call with a male user)</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Cash Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={activeRateCash}
                onChange={(e) => setActiveRateCash(parseFloat(e.target.value) || 0)}
                className="w-full border border-input rounded-lg px-3 py-2 bg-background text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Every X minutes</label>
              <input
                type="number"
                min={1}
                value={activeRateTime}
                onChange={(e) => setActiveRateTime(parseInt(e.target.value) || 30)}
                className="w-full border border-input rounded-lg px-3 py-2 bg-background text-foreground"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Earns <span className="text-foreground font-bold">${activeRateCash.toFixed(2)}</span> every <span className="text-foreground font-bold">{activeRateTime} min</span> while chatting with a guy
            = <span className="text-green-500 font-bold">${((activeRateCash / activeRateTime) * 60).toFixed(2)}/hr</span>
          </p>
        </div>

        {/* Idle rate */}
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-yellow-500 font-black text-sm">💤 IDLE RATE</span>
            <span className="text-xs text-muted-foreground">(waiting / not connected)</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Cash Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={idleRateCash}
                onChange={(e) => setIdleRateCash(parseFloat(e.target.value) || 0)}
                className="w-full border border-input rounded-lg px-3 py-2 bg-background text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">Every X minutes</label>
              <input
                type="number"
                min={1}
                value={idleRateTime}
                onChange={(e) => setIdleRateTime(parseInt(e.target.value) || 30)}
                className="w-full border border-input rounded-lg px-3 py-2 bg-background text-foreground"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Earns <span className="text-foreground font-bold">${idleRateCash.toFixed(2)}</span> every <span className="text-foreground font-bold">{idleRateTime} min</span> while idle
            = <span className="text-yellow-500 font-bold">${((idleRateCash / idleRateTime) * 60).toFixed(2)}/hr</span>
          </p>
        </div>

        <button
          onClick={() => saveEarningRatesMutation.mutate()}
          disabled={saveEarningRatesMutation.isPending}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-bold hover:opacity-90 disabled:opacity-50"
        >
          {saveEarningRatesMutation.isPending ? "Saving..." : "Save Earning Rates"}
        </button>
      </div>

      {/* Cashout Settings */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-bold text-foreground">Cashout Settings</h2>
        <p className="text-sm text-muted-foreground">
          Controls how much each gifted minute is worth when females cash out, and the limits per cashout request.
        </p>

        {ratePerMinute > 0 && (
          <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-sm text-foreground">
            <p className="font-bold mb-1">💡 Quick Preview</p>
            <p className="text-muted-foreground text-xs">100 gifted minutes × ${ratePerMinute} = <span className="text-foreground font-bold">${(100 * ratePerMinute).toFixed(2)}</span></p>
            <p className="text-muted-foreground text-xs">Users must have at least <span className="text-foreground font-bold">{minCashout} gifted minutes</span> to request a cashout</p>
            <p className="text-muted-foreground text-xs">Users can cash out up to <span className="text-foreground font-bold">{maxCashout} gifted minutes</span> per request</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">Rate per Gifted Minute ($)</label>
            <input
              type="number"
              step="0.001"
              min={0}
              value={ratePerMinute}
              onChange={(e) => setRatePerMinute(parseFloat(e.target.value) || 0.01)}
              className="w-full border border-input rounded-lg px-3 py-2 bg-background text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">Min Cashout (minutes)</label>
            <input
              type="number"
              min={1}
              value={minCashout}
              onChange={(e) => setMinCashout(parseInt(e.target.value) || 100)}
              className="w-full border border-input rounded-lg px-3 py-2 bg-background text-foreground"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">Max Cashout (minutes)</label>
            <input
              type="number"
              min={1}
              value={maxCashout}
              onChange={(e) => setMaxCashout(parseInt(e.target.value) || 5000)}
              className="w-full border border-input rounded-lg px-3 py-2 bg-background text-foreground"
            />
          </div>
        </div>
        <button
          onClick={() => saveRateMutation.mutate()}
          disabled={saveRateMutation.isPending}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-bold hover:opacity-90 disabled:opacity-50"
        >
          {saveRateMutation.isPending ? "Saving..." : "Save Cashout Settings"}
        </button>
      </div>

      {/* Active Earners */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-foreground">
            Active Earners ({activeEarners?.length ?? 0}/{maxCap})
          </h2>
          {(activeEarners && activeEarners.length > 0) && (
            <button
              onClick={() => clearSlotsMutation.mutate()}
              disabled={clearSlotsMutation.isPending}
              className="px-4 py-1.5 text-xs font-bold bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {clearSlotsMutation.isPending ? "Clearing..." : "Clear All Slots"}
            </button>
          )}
        </div>
        {(!activeEarners || activeEarners.length === 0) ? (
          <p className="text-muted-foreground text-sm">No active female earners</p>
        ) : (
          <div className="space-y-2">
            {activeEarners.map((s: any, i: number) => (
              <div key={s.id} className="flex items-center justify-between bg-accent/10 border border-accent/30 rounded-lg px-4 py-2">
                <span className="font-bold text-sm text-foreground">#{i + 1} — {memberName(s.user_id)}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {s.current_mode === "active" ? "🔥" : "💤"} {s.elapsed_seconds}s · ${Number(s.cash_balance).toFixed(2)}
                  </span>
                  <button
                    onClick={() => clearSingleSlotMutation.mutate(s.id)}
                    disabled={clearSingleSlotMutation.isPending}
                    className="px-2 py-1 text-xs font-bold bg-destructive/80 text-destructive-foreground rounded hover:opacity-90 disabled:opacity-50"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Waiting Queue */}
      {(queueData && queueData.length > 0) && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-bold mb-3 text-foreground">
            Waiting Queue ({queueData.length})
          </h2>
          <div className="space-y-2">
            {queueData.map((q: any, i: number) => (
              <div key={q.id} className="flex items-center justify-between bg-muted/30 border border-border rounded-lg px-4 py-2">
                <span className="font-bold text-sm text-foreground">#{i + 1} — {memberName(q.user_id)}</span>
                <span className="text-xs text-muted-foreground">
                  Queued {new Date(q.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Cashout Requests */}
      {pendingRequests.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-bold mb-3 text-foreground">Pending Cashout Requests ({pendingRequests.length})</h2>
          <div className="space-y-2">
            {pendingRequests.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between border border-warning/30 bg-warning/5 rounded-lg px-4 py-2">
                <div>
                  <span className="font-bold text-sm text-foreground">{memberName(r.user_id)}</span>
                  <span className="text-xs text-muted-foreground ml-2">{r.paypal_email}</span>
                  <span className="text-xs text-muted-foreground ml-2">{r.minutes_amount} min → ${Number(r.cash_amount).toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateCashoutMutation.mutate({ id: r.id, status: "approved" })}
                    disabled={updateCashoutMutation.isPending}
                    className="px-3 py-1 text-xs font-bold bg-success text-success-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => updateCashoutMutation.mutate({ id: r.id, status: "rejected" })}
                    disabled={updateCashoutMutation.isPending}
                    className="px-3 py-1 text-xs font-bold bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Cashout History */}
      {recentRequests.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-bold mb-3 text-foreground">Recent Cashout History</h2>
          <div className="space-y-2">
            {recentRequests.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between border border-border rounded-lg px-4 py-2">
                <div>
                  <span className="font-bold text-sm text-foreground">{memberName(r.user_id)}</span>
                  <span className="text-xs text-muted-foreground ml-2">{r.minutes_amount} min → ${Number(r.cash_amount).toFixed(2)}</span>
                </div>
                <span className={`text-xs font-bold uppercase ${r.status === "approved" ? "text-success" : "text-destructive"}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnchorSettingsPage;
