import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AnchorSettingsPage = () => {
  const queryClient = useQueryClient();

  // Anchor settings (slot cap)
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

  // Cashout settings (earning rate)
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

  useEffect(() => {
    if (settings) setMaxCap(settings.max_anchor_cap);
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
      toast.success("Earning rate settings saved!");
      queryClient.invalidateQueries({ queryKey: ["cashout-settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Queue data
  const { data: activeEarners } = useQuery({
    queryKey: ["anchor-active-earners-admin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anchor_sessions")
        .select("*")
        .eq("status", "active")
        .order("created_at");
      return data ?? [];
    },
    refetchInterval: 10000,
  });

  const { data: queueData } = useQuery({
    queryKey: ["anchor-queue-admin"],
    queryFn: async () => {
      const { data } = await supabase.from("anchor_queue").select("*").order("created_at");
      return data ?? [];
    },
    refetchInterval: 10000,
  });

  // Cashout requests
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

      {/* Earning Rate Settings */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-bold text-foreground">Earning & Cashout Rate</h2>
        <p className="text-sm text-muted-foreground">
          Controls how much each minute is worth when females cash out. Also sets min/max cashout limits.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">Rate per Minute ($)</label>
            <input
              type="number"
              step="0.001"
              min={0}
              value={ratePerMinute}
              onChange={(e) => setRatePerMinute(parseFloat(e.target.value) || 0.01)}
              className="w-full border border-input rounded-lg px-3 py-2 bg-background text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">e.g. 0.01 = $0.01/min</p>
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
          {saveRateMutation.isPending ? "Saving..." : "Save Rate Settings"}
        </button>
      </div>

      {/* Active Queue */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-lg font-bold mb-3 text-foreground">
          Active Earners ({queueData?.length ?? 0}/{maxCap})
        </h2>
        {(!queueData || queueData.length === 0) ? (
          <p className="text-muted-foreground text-sm">No active female earners</p>
        ) : (
          <div className="space-y-2">
            {queueData.map((q, i) => (
              <div key={q.id} className="flex items-center justify-between bg-accent/10 border border-accent/30 rounded-lg px-4 py-2">
                <span className="font-bold text-sm text-foreground">#{i + 1} — {memberName(q.user_id)}</span>
                <span className="text-xs text-muted-foreground">
                  Joined {new Date(q.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Cashout Requests */}
      {pendingRequests.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-bold mb-3 text-foreground">Pending Cashout Requests ({pendingRequests.length})</h2>
          <div className="space-y-2">
            {pendingRequests.map((r) => (
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
            {recentRequests.map((r) => (
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
