import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingBag, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Row = {
  id: string;
  user_id: string;
  platform: string;
  sku: string;
  action: string;
  vip_tier: string | null;
  minutes_added: number | null;
  recipient_id: string | null;
  purchase_token_hash: string | null;
  created_at: string;
  member?: { name: string | null; email: string | null } | null;
};

const PlatformBadge = ({ platform }: { platform: string }) => {
  const p = platform.toLowerCase();
  if (p === "android")
    return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Google Play</Badge>;
  if (p === "ios")
    return <Badge className="bg-sky-500/10 text-sky-500 border-sky-500/20">App Store</Badge>;
  return <Badge variant="secondary">{platform}</Badge>;
};

const AdminIapPurchasesPage = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"all" | "android" | "ios">("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("iap_purchases")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      // Bulk-fetch member info
      const userIds = Array.from(new Set((data ?? []).map((r) => r.user_id)));
      let memberMap: Record<string, { name: string | null; email: string | null }> = {};
      if (userIds.length > 0) {
        const { data: members } = await supabase
          .from("members")
          .select("id, name, email")
          .in("id", userIds);
        memberMap = Object.fromEntries((members ?? []).map((m) => [m.id, { name: m.name, email: m.email }]));
      }

      setRows(((data ?? []) as Row[]).map((r) => ({ ...r, member: memberMap[r.user_id] ?? null })));
    } catch (e: any) {
      toast.error("Failed to load purchases", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (platformFilter !== "all" && r.platform.toLowerCase() !== platformFilter) return false;
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      if (!q) return true;
      return (
        r.member?.name?.toLowerCase().includes(q) ||
        r.member?.email?.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.user_id.toLowerCase().includes(q)
      );
    });
  }, [rows, search, platformFilter, actionFilter]);

  const counts = useMemo(() => {
    const byPlatform: Record<string, number> = { all: rows.length, android: 0, ios: 0 };
    rows.forEach((r) => {
      const p = r.platform.toLowerCase();
      if (p === "android" || p === "ios") byPlatform[p]++;
    });
    return byPlatform;
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-emerald-500" />
            Native App Purchases
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Every verified Google Play / App Store transaction. {rows.length} total in the last 500 records.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "all", label: `All (${counts.all ?? 0})` },
          { key: "android", label: `Google Play (${counts.android ?? 0})` },
          { key: "ios", label: `App Store (${counts.ios ?? 0})` },
        ].map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant={platformFilter === p.key ? "default" : "outline"}
            onClick={() => setPlatformFilter(p.key as any)}
          >
            {p.label}
          </Button>
        ))}
        <div className="ml-2 flex items-center gap-2">
          {["all", "verify-subscription", "verify-minutes", "verify-gift", "verify-unfreeze"].map((a) => (
            <Button
              key={a}
              size="sm"
              variant={actionFilter === a ? "secondary" : "ghost"}
              onClick={() => setActionFilter(a)}
              className="h-8 text-xs"
            >
              {a === "all" ? "All actions" : a.replace("verify-", "")}
            </Button>
          ))}
        </div>
        <Input
          placeholder="Search name, email, SKU, user id…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto w-64"
        />
      </div>

      {/* Table */}
      <div className="rounded-md border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5">When</th>
              <th className="text-left px-4 py-2.5">User</th>
              <th className="text-left px-4 py-2.5">Platform</th>
              <th className="text-left px-4 py-2.5">SKU</th>
              <th className="text-left px-4 py-2.5">Action</th>
              <th className="text-left px-4 py-2.5">Tier</th>
              <th className="text-left px-4 py-2.5">Minutes</th>
              <th className="text-left px-4 py-2.5">Token</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  <td colSpan={8} className="px-4 py-3">
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                  No purchases match these filters yet.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-foreground">{r.member?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.member?.email ?? r.user_id.slice(0, 8)}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <PlatformBadge platform={r.platform} />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.sku}</td>
                  <td className="px-4 py-2.5 text-xs">{r.action.replace("verify-", "")}</td>
                  <td className="px-4 py-2.5">
                    {r.vip_tier ? (
                      <Badge
                        className={
                          r.vip_tier === "premium"
                            ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                            : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        }
                      >
                        {r.vip_tier}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.minutes_added ?? "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
                    {r.purchase_token_hash ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminIapPurchasesPage;