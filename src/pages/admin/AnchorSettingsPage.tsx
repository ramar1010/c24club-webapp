import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
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

  const [form, setForm] = useState({
    max_anchor_cap: 5,
    chill_hour_start: "00:00",
    power_hour_start: "19:00",
    power_hour_end: "00:00",
    power_rate_cash: 1.5,
    power_rate_time: 30,
    chill_reward_time: 45,
    chill_disabled: false,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        max_anchor_cap: settings.max_anchor_cap,
        chill_hour_start: settings.chill_hour_start,
        power_hour_start: settings.power_hour_start,
        power_hour_end: settings.power_hour_end,
        power_rate_cash: Number(settings.power_rate_cash),
        power_rate_time: settings.power_rate_time,
        chill_reward_time: settings.chill_reward_time,
        chill_disabled: settings.chill_disabled ?? false,
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!settings?.id) return;
      const { error } = await supabase
        .from("anchor_settings")
        .update({
          ...form,
          updated_at: new Date().toISOString(),
        })
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Anchor settings saved!");
      queryClient.invalidateQueries({ queryKey: ["anchor-settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updatePayoutMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("anchor_payouts")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      toast.success(`Payout marked as ${status}`);
      queryClient.invalidateQueries({ queryKey: ["anchor-admin-data"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Fetch active sessions and queue
  const { data: anchorData } = useQuery({
    queryKey: ["anchor-admin-data"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("anchor-earning", {
        body: { type: "admin_get_all", userId: "admin" },
      });
      return data;
    },
    refetchInterval: 10000,
  });

  // Member name lookup
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

  if (isLoading) return <div className="p-6 text-center text-neutral-400">Loading...</div>;

  const activeSessions = anchorData?.sessions?.filter((s: any) => s.status === "active") ?? [];
  const pausedSessions = anchorData?.sessions?.filter((s: any) => s.status === "paused") ?? [];
  const queue = anchorData?.queue ?? [];
  const payouts = anchorData?.payouts ?? [];

  return (
    <div className="p-6 space-y-8 max-w-4xl">
      <h1 className="text-2xl font-bold">Anchor User System</h1>

      {/* Settings form */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border p-6 space-y-4">
        <h2 className="text-lg font-bold">Configuration</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Max Anchor Cap</label>
            <input
              type="number"
              min={1}
              value={form.max_anchor_cap}
              onChange={(e) => setForm({ ...form, max_anchor_cap: parseInt(e.target.value) || 5 })}
              className="w-full border rounded-lg px-3 py-2 bg-background"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Chill Hours Start (EST)</label>
            <input
              type="time"
              value={form.chill_hour_start}
              onChange={(e) => setForm({ ...form, chill_hour_start: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 bg-background"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Power Hours Start (EST)</label>
            <input
              type="time"
              value={form.power_hour_start}
              onChange={(e) => setForm({ ...form, power_hour_start: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 bg-background"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Power Hours End (EST)</label>
            <input
              type="time"
              value={form.power_hour_end}
              onChange={(e) => setForm({ ...form, power_hour_end: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 bg-background"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Power Rate ($ per block)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={form.power_rate_cash}
              onChange={(e) => setForm({ ...form, power_rate_cash: parseFloat(e.target.value) || 1.5 })}
              className="w-full border rounded-lg px-3 py-2 bg-background"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Power Rate Time (minutes)</label>
            <input
              type="number"
              min={1}
              value={form.power_rate_time}
              onChange={(e) => setForm({ ...form, power_rate_time: parseInt(e.target.value) || 30 })}
              className="w-full border rounded-lg px-3 py-2 bg-background"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Chill Reward Time (minutes)</label>
            <input
              type="number"
              min={1}
              value={form.chill_reward_time}
              onChange={(e) => setForm({ ...form, chill_reward_time: parseInt(e.target.value) || 45 })}
              className="w-full border rounded-lg px-3 py-2 bg-background"
            />
          </div>
        </div>

        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-bold hover:opacity-90 disabled:opacity-50"
        >
          {saveMutation.isPending ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {/* Active Sessions */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border p-6">
        <h2 className="text-lg font-bold mb-3">
          Active Anchors ({activeSessions.length}/{form.max_anchor_cap})
        </h2>
        {activeSessions.length === 0 ? (
          <p className="text-neutral-500 text-sm">No active anchor users</p>
        ) : (
          <div className="space-y-2">
            {activeSessions.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2">
                <div>
                  <span className="font-bold text-sm">{memberName(s.user_id)}</span>
                  <span className="text-xs text-neutral-500 ml-2">
                    {Math.floor(s.elapsed_seconds / 60)}m elapsed · ${Number(s.cash_balance).toFixed(2)} balance
                  </span>
                </div>
                <span className="text-xs font-bold text-green-400 uppercase">{s.current_mode}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border p-6">
          <h2 className="text-lg font-bold mb-3">Queue ({queue.length})</h2>
          <div className="space-y-2">
            {queue.map((q: any, i: number) => (
              <div key={q.id} className="flex items-center justify-between bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-2">
                <span className="font-bold text-sm">#{i + 1} — {memberName(q.user_id)}</span>
                <span className="text-xs text-neutral-500">
                  Joined {new Date(q.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Payouts */}
      {payouts.length > 0 && (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border p-6">
          <h2 className="text-lg font-bold mb-3">Recent Payouts</h2>
          <div className="space-y-2">
            {payouts.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between border border-neutral-700 rounded-lg px-4 py-2">
                <div>
                  <span className="font-bold text-sm">{memberName(p.user_id)}</span>
                  <span className="text-xs text-neutral-500 ml-2">{p.paypal_email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-green-400">${Number(p.amount).toFixed(2)}</span>
                  <span className={`text-xs font-bold ${p.status === "pending" ? "text-yellow-400" : p.status === "paid" ? "text-green-400" : "text-red-400"}`}>
                    {p.status.toUpperCase()}
                  </span>
                  {p.status === "pending" && (
                    <>
                      <button
                        onClick={() => updatePayoutMutation.mutate({ id: p.id, status: "paid" })}
                        disabled={updatePayoutMutation.isPending}
                        className="px-3 py-1 text-xs font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        Mark Paid
                      </button>
                      <button
                        onClick={() => updatePayoutMutation.mutate({ id: p.id, status: "rejected" })}
                        disabled={updatePayoutMutation.isPending}
                        className="px-3 py-1 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnchorSettingsPage;
