import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDown, ArrowUp, MousePointerClick, TrendingUp, Users } from "lucide-react";

interface TapSummary {
  user_id: string;
  name: string;
  email: string | null;
  gender: string | null;
  tap_count: number;
  first_tap: string;
  last_tap: string;
}

type SortKey = "name" | "email" | "gender" | "tap_count" | "first_tap" | "last_tap";
type SortDir = "asc" | "desc";

const TapAnalyticsPage = () => {
  const [summaries, setSummaries] = useState<TapSummary[]>([]);
  const [totalTaps, setTotalTaps] = useState(0);
  const [uniqueUsers, setUniqueUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("tap_count");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Fetch all tap events
      const { data: taps } = await supabase
        .from("tap_me_events")
        .select("user_id, created_at")
        .order("created_at", { ascending: false });

      if (!taps || taps.length === 0) {
        setLoading(false);
        return;
      }

      setTotalTaps(taps.length);

      // Group by user
      const grouped = new Map<string, { count: number; first: string; last: string }>();
      for (const t of taps) {
        const existing = grouped.get(t.user_id);
        if (existing) {
          existing.count++;
          if (t.created_at < existing.first) existing.first = t.created_at;
          if (t.created_at > existing.last) existing.last = t.created_at;
        } else {
          grouped.set(t.user_id, { count: 1, first: t.created_at, last: t.created_at });
        }
      }

      setUniqueUsers(grouped.size);

      // Fetch member info
      const userIds = Array.from(grouped.keys());
      const { data: members } = await supabase
        .from("members")
        .select("id, name, email, gender")
        .in("id", userIds);

      const memberMap = new Map((members || []).map(m => [m.id, m]));

      const results: TapSummary[] = Array.from(grouped.entries())
        .map(([uid, data]) => {
          const member = memberMap.get(uid);
          return {
            user_id: uid,
            name: member?.name || "Unknown",
            email: member?.email || null,
            gender: member?.gender || null,
            tap_count: data.count,
            first_tap: data.first,
            last_tap: data.last,
          };
        })
        .sort((a, b) => b.tap_count - a.tap_count);

      setSummaries(results);
      setLoading(false);
    };

    fetchData();
  }, []);

  const avgTaps = uniqueUsers > 0 ? (totalTaps / uniqueUsers).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Tap Me Analytics</h2>
        <p className="text-muted-foreground mt-1">Track engagement with the "Tap Me" button</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Taps</CardTitle>
            <MousePointerClick className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalTaps}</div></CardContent>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Taps / User</CardTitle>
            <TrendingUp className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{avgTaps}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tap Events by User</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : summaries.length === 0 ? (
            <p className="text-muted-foreground">No tap events recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead className="text-right">Tap Count</TableHead>
                  <TableHead>First Tap</TableHead>
                  <TableHead>Last Tap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.map((s) => (
                  <TableRow key={s.user_id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.email || "—"}</TableCell>
                    <TableCell className="capitalize">{s.gender || "—"}</TableCell>
                    <TableCell className="text-right font-bold">{s.tap_count}</TableCell>
                    <TableCell>{new Date(s.first_tap).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(s.last_tap).toLocaleDateString()}</TableCell>
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
