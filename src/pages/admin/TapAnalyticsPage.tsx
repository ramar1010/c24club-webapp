import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDown, ArrowUp, Download, TrendingUp, Users } from "lucide-react";

interface ClickSummary {
  user_id: string;
  name: string;
  email: string | null;
  gender: string | null;
  click_count: number;
  first_click: string;
  last_click: string;
}

type SortKey = "name" | "email" | "gender" | "click_count" | "first_click" | "last_click";
type SortDir = "asc" | "desc";

const TapAnalyticsPage = () => {
  const [summaries, setSummaries] = useState<ClickSummary[]>([]);
  const [totalClicks, setTotalClicks] = useState(0);
  const [uniqueUsers, setUniqueUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("click_count");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: clicks } = await supabase
        .from("app_download_clicks")
        .select("user_id, created_at")
        .order("created_at", { ascending: false });

      if (!clicks || clicks.length === 0) {
        setLoading(false);
        return;
      }

      setTotalClicks(clicks.length);

      const grouped = new Map<string, { count: number; first: string; last: string }>();
      for (const c of clicks) {
        const existing = grouped.get(c.user_id);
        if (existing) {
          existing.count++;
          if (c.created_at < existing.first) existing.first = c.created_at;
          if (c.created_at > existing.last) existing.last = c.created_at;
        } else {
          grouped.set(c.user_id, { count: 1, first: c.created_at, last: c.created_at });
        }
      }

      setUniqueUsers(grouped.size);

      const userIds = Array.from(grouped.keys());
      const { data: members } = await supabase
        .from("members")
        .select("id, name, email, gender")
        .in("id", userIds);

      const memberMap = new Map((members || []).map(m => [m.id, m]));

      const results: ClickSummary[] = Array.from(grouped.entries())
        .map(([uid, data]) => {
          const member = memberMap.get(uid);
          return {
            user_id: uid,
            name: member?.name || "Unknown",
            email: member?.email || null,
            gender: member?.gender || null,
            click_count: data.count,
            first_click: data.first,
            last_click: data.last,
          };
        })
        .sort((a, b) => b.click_count - a.click_count);

      setSummaries(results);
      setLoading(false);
    };

    fetchData();
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "click_count" ? "desc" : "asc");
    }
  };

  const sorted = useMemo(() => {
    return [...summaries].sort((a, b) => {
      let cmp = 0;
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) cmp = 0;
      else if (av == null) cmp = -1;
      else if (bv == null) cmp = 1;
      else if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [summaries, sortKey, sortDir]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? <ArrowUp className="inline h-3 w-3 ml-1" /> : <ArrowDown className="inline h-3 w-3 ml-1" />;
  };

  const avgClicks = uniqueUsers > 0 ? (totalClicks / uniqueUsers).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">App Download Analytics</h2>
        <p className="text-muted-foreground mt-1">Track users who tapped to download the native app from the popup.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Clicks</CardTitle>
            <Download className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalClicks}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unique Users</CardTitle>
            <Users className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{uniqueUsers}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Clicks / User</CardTitle>
            <TrendingUp className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{avgClicks}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Download Clicks by User</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : sorted.length === 0 ? (
            <p className="text-muted-foreground">No download clicks recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>Name<SortIcon col="name" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("email")}>Email<SortIcon col="email" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("gender")}>Gender<SortIcon col="gender" /></TableHead>
                  <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("click_count")}>Clicks<SortIcon col="click_count" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("first_click")}>First Click<SortIcon col="first_click" /></TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("last_click")}>Last Click<SortIcon col="last_click" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((s) => (
                  <TableRow key={s.user_id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.email || "—"}</TableCell>
                    <TableCell className="capitalize">{s.gender || "—"}</TableCell>
                    <TableCell className="text-right font-bold">{s.click_count}</TableCell>
                    <TableCell>{new Date(s.first_click).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(s.last_click).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TapAnalyticsPage;
