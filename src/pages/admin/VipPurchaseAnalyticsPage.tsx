import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Crown, MousePointerClick, CheckCircle2 } from "lucide-react";

interface IntentRow {
  id: string;
  user_id: string;
  source: string;
  price_id: string | null;
  tier: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

const RANGE_OPTIONS: { label: string; days: number }[] = [
  { label: "24h", days: 1 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: 9999 },
];

const SOURCE_LABELS: Record<string, string> = {
  videocall_vip_overlay: "Videocall · VIP Features Overlay",
  minutes_frozen_popup: "Videocall · Minutes Frozen Popup",
  discover_female_banner: "Discover · Female Promo Banner",
  messages_female_banner: "Messages · Female Promo Banner",
  messages_vip_call_gate: "Messages · VIP Call Gate",
  messages_dm_paywall: "Messages · DM Paywall",
  discover_card_vip_call_gate: "Discover Card · VIP Call Gate",
  ios_native_vip: "📱 iOS App · VIP Purchase",
  android_native_vip: "🤖 Android App · VIP Purchase",
  native_vip: "📱 Native App · VIP Purchase",
  unknown: "Unknown / Legacy",
};

const prettySource = (s: string) => SOURCE_LABELS[s] ?? s;

const VipPurchaseAnalyticsPage = () => {
  const [rows, setRows] = useState<IntentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(30);
  const [memberMap, setMemberMap] = useState<Record<string, { name: string | null; email: string | null }>>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    const since = new Date(Date.now() - rangeDays * 86400_000).toISOString();
    (async () => {
      let q = supabase
        .from("vip_purchase_intents")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (rangeDays < 9999) q = q.gte("created_at", since);
      const { data, error } = await q;
      if (!active) return;
      if (error) {
        console.error(error);
        setRows([]);
        setLoading(false);
        return;
      }
      const list = (data ?? []) as IntentRow[];
      setRows(list);

      const userIds = Array.from(new Set(list.map((r) => r.user_id))).slice(0, 500);
      if (userIds.length) {
        const { data: members } = await supabase
          .from("members")
          .select("id, name, email")
          .in("id", userIds);
        const map: Record<string, { name: string | null; email: string | null }> = {};
        (members ?? []).forEach((m: any) => {
          map[m.id] = { name: m.name, email: m.email };
        });
        if (active) setMemberMap(map);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [rangeDays]);

  // Cross-reference completed status from member_minutes (is_vip = true for the user
  // and a subscription_end after the intent was created).
  const [vipUserIds, setVipUserIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const ids = Array.from(new Set(rows.map((r) => r.user_id))).slice(0, 500);
    if (!ids.length) return;
    (async () => {
      const { data } = await supabase
        .from("member_minutes")
        .select("user_id, is_vip")
        .in("user_id", ids);
      const set = new Set<string>();
      (data ?? []).forEach((r: any) => {
        if (r.is_vip) set.add(r.user_id);
      });
      setVipUserIds(set);
    })();
  }, [rows]);

  const stats = useMemo(() => {
    const bySource = new Map<string, { intents: number; converted: number; uniqueUsers: Set<string>; basic: number; premium: number }>();
    rows.forEach((r) => {
      const key = r.source || "unknown";
      const entry =
        bySource.get(key) || { intents: 0, converted: 0, uniqueUsers: new Set<string>(), basic: 0, premium: 0 };
      entry.intents++;
      entry.uniqueUsers.add(r.user_id);
      if (vipUserIds.has(r.user_id)) entry.converted++;
      if (r.tier === "basic") entry.basic++;
      if (r.tier === "premium") entry.premium++;
      bySource.set(key, entry);
    });
    const totals = {
      intents: rows.length,
      uniqueUsers: new Set(rows.map((r) => r.user_id)).size,
      converted: rows.filter((r) => vipUserIds.has(r.user_id)).length,
    };
    const sourceRows = Array.from(bySource.entries())
      .map(([source, v]) => ({
        source,
        intents: v.intents,
        uniqueUsers: v.uniqueUsers.size,
        converted: v.converted,
        conversionRate: v.intents ? (v.converted / v.intents) * 100 : 0,
        basic: v.basic,
        premium: v.premium,
      }))
      .sort((a, b) => b.intents - a.intents);
    return { totals, sourceRows };
  }, [rows, vipUserIds]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Crown className="h-6 w-6 text-yellow-500" /> VIP Purchase Analytics
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Where users initiate VIP checkout from — use this to know which surfaces drive purchases.
          </p>
        </div>
        <div className="flex gap-1.5">
          {RANGE_OPTIONS.map((o) => (
            <button
              key={o.label}
              onClick={() => setRangeDays(o.days)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition border ${
                rangeDays === o.days
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Checkout Clicks</CardTitle>
            <MousePointerClick className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totals.intents}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.totals.uniqueUsers} unique users</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Currently VIP</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totals.converted}</div>
            <p className="text-xs text-muted-foreground mt-1">Clickers who are now VIP</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversion Rate</CardTitle>
            <Crown className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totals.intents ? ((stats.totals.converted / stats.totals.intents) * 100).toFixed(1) : "0"}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Click → VIP</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">By Source / Interface</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : stats.sourceRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No VIP checkout clicks in this range yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4">Source</th>
                    <th className="py-2 pr-4 text-right">Clicks</th>
                    <th className="py-2 pr-4 text-right">Unique</th>
                    <th className="py-2 pr-4 text-right">Basic</th>
                    <th className="py-2 pr-4 text-right">Premium</th>
                    <th className="py-2 pr-4 text-right">Converted</th>
                    <th className="py-2 pr-4 text-right">Conv. %</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.sourceRows.map((r) => (
                    <tr key={r.source} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 pr-4 font-medium">{prettySource(r.source)}</td>
                      <td className="py-2 pr-4 text-right">{r.intents}</td>
                      <td className="py-2 pr-4 text-right">{r.uniqueUsers}</td>
                      <td className="py-2 pr-4 text-right">{r.basic}</td>
                      <td className="py-2 pr-4 text-right">{r.premium}</td>
                      <td className="py-2 pr-4 text-right">{r.converted}</td>
                      <td className="py-2 pr-4 text-right">{r.conversionRate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Checkout Clicks</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nothing to show.</p>
          ) : (
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4">When</th>
                    <th className="py-2 pr-4">User</th>
                    <th className="py-2 pr-4">Source</th>
                    <th className="py-2 pr-4">Tier</th>
                    <th className="py-2 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 200).map((r) => {
                    const m = memberMap[r.user_id];
                    const isVip = vipUserIds.has(r.user_id);
                    return (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 pr-4 whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()}
                        </td>
                        <td className="py-2 pr-4">
                          <div className="font-medium">{m?.name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{m?.email ?? r.user_id.slice(0, 8)}</div>
                        </td>
                        <td className="py-2 pr-4 text-xs">{prettySource(r.source)}</td>
                        <td className="py-2 pr-4">
                          <Badge variant={r.tier === "premium" ? "default" : "secondary"} className="text-[10px]">
                            {r.tier ?? "—"}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4">
                          {isVip ? (
                            <Badge className="bg-green-500/15 text-green-600 hover:bg-green-500/15">VIP</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Not VIP</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VipPurchaseAnalyticsPage;