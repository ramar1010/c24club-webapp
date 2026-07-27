import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AnchorSettingsPage = () => {
  const queryClient = useQueryClient();

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

  const [ratePerMinute, setRatePerMinute] = useState(0.01);
  const [minCashout, setMinCashout] = useState(100);
  const [maxCashout, setMaxCashout] = useState(5000);

  useEffect(() => {
    if (cashoutSettings) {
      setRatePerMinute(Number(cashoutSettings.rate_per_minute));
      setMinCashout(cashoutSettings.min_cashout_minutes);
      setMaxCashout(cashoutSettings.max_cashout_minutes);
    }
  }, [cashoutSettings]);

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
  });

  const { data: converters } = useQuery({
    queryKey: ["female-converters"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bounty_earnings")
        .select("female_id, male_id, amount_minutes, source, created_at, clawed_back")
        .eq("clawed_back", false)
        .in("source", ["basic", "premium"])
        .order("created_at", { ascending: false });
      const map = new Map<string, { female_id: string; males: Set<string>; minutes: number; basic: number; premium: number; last: string }>();
      for (const row of data ?? []) {
        const key = row.female_id as string;
        const entry = map.get(key) ?? { female_id: key, males: new Set(), minutes: 0, basic: 0, premium: 0, last: row.created_at as string };
        entry.males.add(row.male_id as string);
        entry.minutes += row.amount_minutes ?? 0;
        if (row.source === "basic") entry.basic += 1;
        if (row.source === "premium") entry.premium += 1;
        if ((row.created_at as string) > entry.last) entry.last = row.created_at as string;
        map.set(key, entry);
      }
      return Array.from(map.values())
        .map((e) => ({ ...e, males_count: e.males.size }))
        .sort((a, b) => b.males_count - a.males_count || b.minutes - a.minutes);
    },
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

  if (cashoutLoading) return <div className="p-6 text-center text-muted-foreground">Loading...</div>;

  const pendingRequests = cashoutRequests?.filter((r) => r.status === "pending") ?? [];
  const recentRequests = cashoutRequests?.filter((r) => r.status !== "pending") ?? [];

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-foreground">Payout Settings</h1>

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

      {/* Top Female Converters */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-lg font-bold mb-1 text-foreground">Female Converters</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Females who converted male users to VIP (bounty earnings). Ranked by unique guys converted.
        </p>
        {!converters || converters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No conversions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">Female</th>
                  <th className="py-2 pr-3">Guys Converted</th>
                  <th className="py-2 pr-3">Basic</th>
                  <th className="py-2 pr-3">Premium</th>
                  <th className="py-2 pr-3">Total Minutes</th>
                  <th className="py-2 pr-3">Cash Value</th>
                  <th className="py-2 pr-3">Last Conversion</th>
                </tr>
              </thead>
              <tbody>
                {converters.map((c) => (
                  <tr key={c.female_id} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-bold text-foreground">{memberName(c.female_id)}</td>
                    <td className="py-2 pr-3">{c.males_count}</td>
                    <td className="py-2 pr-3">{c.basic}</td>
                    <td className="py-2 pr-3">{c.premium}</td>
                    <td className="py-2 pr-3">{c.minutes}</td>
                    <td className="py-2 pr-3 text-success font-bold">${(c.minutes * 0.01).toFixed(2)}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{new Date(c.last).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnchorSettingsPage;
