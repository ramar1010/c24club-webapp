import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity,
  Database,
  AlertTriangle,
  Shield,
  Clock,
  Users,
  Video,
  Loader2,
  RefreshCw,
  Zap,
  Ban,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

interface HealthMetric {
  label: string;
  value: number | string;
  status: "healthy" | "warning" | "critical";
  detail?: string;
}

interface TableStat {
  name: string;
  count: number;
  staleCount?: number;
}

const SystemHealthPage = () => {
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Table row counts
  const [tableStats, setTableStats] = useState<TableStat[]>([]);

  // Stale data
  const [staleRooms, setStaleRooms] = useState(0);
  const [staleQueue, setStaleQueue] = useState(0);

  // Active sessions
  const [activeRooms, setActiveRooms] = useState(0);
  const [queueSize, setQueueSize] = useState(0);

  // Bans
  const [activeBans, setActiveBans] = useState(0);
  const [ipBans, setIpBans] = useState(0);
  const [recentBans24h, setRecentBans24h] = useState(0);

  // User stats
  const [totalMembers, setTotalMembers] = useState(0);
  const [vipMembers, setVipMembers] = useState(0);
  const [frozenMembers, setFrozenMembers] = useState(0);

  // Spins & redemptions
  const [pendingRedemptions, setPendingRedemptions] = useState(0);
  const [spinsToday, setSpinsToday] = useState(0);

  // Reports
  const [unreviewedReports, setUnreviewedReports] = useState(0);

  // NSFW strikes
  const [highStrikeUsers, setHighStrikeUsers] = useState(0);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      // Parallel fetch all stats
      const [
        membersRes,
        vipRes,
        frozenRes,
        activeRoomsRes,
        staleRoomsRes,
        queueRes,
        staleQueueRes,
        activeBansRes,
        ipBansRes,
        recentBansRes,
        pendingRedRes,
        spinsTodayRes,
        reportsRes,
        highStrikesRes,
        // Table counts for monitoring
        rewardsCountRes,
        promosCountRes,
        spinPrizesCountRes,
        challengesCountRes,
      ] = await Promise.all([
        // Members
        supabase.from("members").select("id", { count: "exact", head: true }),
        supabase.from("member_minutes").select("id", { count: "exact", head: true }).eq("is_vip", true),
        supabase.from("member_minutes").select("id", { count: "exact", head: true }).eq("is_frozen", true),

        // Rooms
        supabase.from("rooms").select("id", { count: "exact", head: true }).eq("status", "connected"),
        supabase.from("rooms").select("id", { count: "exact", head: true }).eq("status", "connected").lt("connected_at", twentyFourHoursAgo),

        // Queue
        supabase.from("waiting_queue").select("id", { count: "exact", head: true }),
        supabase.from("waiting_queue").select("id", { count: "exact", head: true }).lt("created_at", twentyFourHoursAgo),

        // Bans
        supabase.from("user_bans").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("user_bans").select("id", { count: "exact", head: true }).eq("is_active", true).not("ip_address", "is", null),
        supabase.from("user_bans").select("id", { count: "exact", head: true }).eq("is_active", true).gte("created_at", twentyFourHoursAgo),

        // Redemptions
        supabase.from("member_redemptions").select("id", { count: "exact", head: true }).eq("status", "processing"),

        // Spins today
        supabase.from("spin_results").select("id", { count: "exact", head: true }).gte("created_at", todayStart),

        // Unreviewed reports (reports with no corresponding ban action recently)
        supabase.from("user_reports").select("id", { count: "exact", head: true }),

        // High NSFW strike users (4+ strikes, close to auto-ban)
        supabase.from("member_minutes").select("id", { count: "exact", head: true }).gte("nsfw_strikes", 4),

        // Table counts
        supabase.from("rewards").select("id", { count: "exact", head: true }),
        supabase.from("promos").select("id", { count: "exact", head: true }),
        supabase.from("spin_prizes").select("id", { count: "exact", head: true }),
        supabase.from("weekly_challenges").select("id", { count: "exact", head: true }),
      ]);

      setTotalMembers(membersRes.count ?? 0);
      setVipMembers(vipRes.count ?? 0);
      setFrozenMembers(frozenRes.count ?? 0);
      setActiveRooms(activeRoomsRes.count ?? 0);
      setStaleRooms(staleRoomsRes.count ?? 0);
      setQueueSize(queueRes.count ?? 0);
      setStaleQueue(staleQueueRes.count ?? 0);
      setActiveBans(activeBansRes.count ?? 0);
      setIpBans(ipBansRes.count ?? 0);
      setRecentBans24h(recentBansRes.count ?? 0);
      setPendingRedemptions(pendingRedRes.count ?? 0);
      setSpinsToday(spinsTodayRes.count ?? 0);
      setUnreviewedReports(reportsRes.count ?? 0);
      setHighStrikeUsers(highStrikesRes.count ?? 0);

      setTableStats([
        { name: "members", count: membersRes.count ?? 0 },
        { name: "rooms", count: activeRoomsRes.count ?? 0, staleCount: staleRoomsRes.count ?? 0 },
        { name: "waiting_queue", count: queueRes.count ?? 0, staleCount: staleQueueRes.count ?? 0 },
        { name: "rewards", count: rewardsCountRes.count ?? 0 },
        { name: "promos", count: promosCountRes.count ?? 0 },
        { name: "user_bans", count: activeBansRes.count ?? 0 },
        { name: "spin_prizes", count: spinPrizesCountRes.count ?? 0 },
        { name: "weekly_challenges", count: challengesCountRes.count ?? 0 },
      ]);

      setLastRefresh(new Date());
    } catch (err) {
      console.error("Failed to fetch health stats:", err);
      toast.error("Failed to load system health data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60000); // Auto-refresh every 60s
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "warning": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "critical": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case "healthy": return "bg-green-500";
      case "warning": return "bg-yellow-500";
      case "critical": return "bg-red-500";
      default: return "bg-muted-foreground";
    }
  };

  // Build health metrics
  const liveMetrics: HealthMetric[] = [
    {
      label: "Active Video Calls",
      value: activeRooms,
      status: "healthy",
      detail: `${activeRooms} live connections`,
    },
    {
      label: "Matchmaking Queue",
      value: queueSize,
      status: queueSize > 50 ? "warning" : "healthy",
      detail: `${queueSize} users waiting`,
    },
    {
      label: "Stale Rooms (24h+)",
      value: staleRooms,
      status: staleRooms > 10 ? "critical" : staleRooms > 0 ? "warning" : "healthy",
      detail: staleRooms > 0 ? "Need cleanup — ghost connections" : "No stale rooms",
    },
    {
      label: "Stale Queue Entries (24h+)",
      value: staleQueue,
      status: staleQueue > 5 ? "critical" : staleQueue > 0 ? "warning" : "healthy",
      detail: staleQueue > 0 ? "Orphaned queue entries" : "Queue is clean",
    },
  ];

  const securityMetrics: HealthMetric[] = [
    {
      label: "Active Bans",
      value: activeBans,
      status: "healthy",
      detail: `${ipBans} include IP bans`,
    },
    {
      label: "Bans (Last 24h)",
      value: recentBans24h,
      status: recentBans24h > 10 ? "warning" : "healthy",
      detail: recentBans24h > 10 ? "Unusual spike in bans" : "Normal activity",
    },
    {
      label: "High NSFW Strikes (4+)",
      value: highStrikeUsers,
      status: highStrikeUsers > 5 ? "warning" : "healthy",
      detail: `${highStrikeUsers} users near auto-ban threshold`,
    },
    {
      label: "Total Reports Filed",
      value: unreviewedReports,
      status: "healthy",
      detail: "Total user reports in system",
    },
  ];

  const userMetrics: HealthMetric[] = [
    {
      label: "Total Members",
      value: totalMembers,
      status: "healthy",
    },
    {
      label: "VIP Members",
      value: vipMembers,
      status: "healthy",
      detail: totalMembers > 0 ? `${((vipMembers / totalMembers) * 100).toFixed(1)}% conversion` : "No members yet",
    },
    {
      label: "Frozen Accounts",
      value: frozenMembers,
      status: frozenMembers > totalMembers * 0.5 ? "warning" : "healthy",
      detail: totalMembers > 0 ? `${((frozenMembers / totalMembers) * 100).toFixed(1)}% of users` : "No members yet",
    },
  ];

  const activityMetrics: HealthMetric[] = [
    {
      label: "Pending Redemptions",
      value: pendingRedemptions,
      status: pendingRedemptions > 20 ? "warning" : "healthy",
      detail: pendingRedemptions > 0 ? "Awaiting fulfillment" : "All caught up",
    },
    {
      label: "Spins Today",
      value: spinsToday,
      status: "healthy",
    },
  ];

  const MetricCard = ({ metric }: { metric: HealthMetric }) => (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{metric.label}</p>
        <p className="text-xl font-bold text-foreground">{metric.value}</p>
        {metric.detail && <p className="text-xs text-muted-foreground">{metric.detail}</p>}
      </div>
      <div className="flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${getStatusDot(metric.status)}`} />
        <Badge variant="outline" className={`text-xs ${getStatusColor(metric.status)}`}>
          {metric.status}
        </Badge>
      </div>
    </div>
  );

  const overallStatus = [...liveMetrics, ...securityMetrics, ...userMetrics, ...activityMetrics].some(
    (m) => m.status === "critical"
  )
    ? "critical"
    : [...liveMetrics, ...securityMetrics, ...userMetrics, ...activityMetrics].some(
        (m) => m.status === "warning"
      )
    ? "warning"
    : "healthy";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            System Health
          </h2>
          <p className="text-muted-foreground mt-1">
            Monitor bottlenecks, stale data, and security — auto-refreshes every 60s
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full animate-pulse ${getStatusDot(overallStatus)}`} />
            <span className="text-sm font-medium text-foreground capitalize">{overallStatus}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-1">Refresh</span>
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Last updated: {lastRefresh.toLocaleTimeString()}
      </p>

      {/* Live Connections */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Video className="h-4 w-4 text-primary" />
            Live Connections & Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {liveMetrics.map((m) => (
              <MetricCard key={m.label} metric={m} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security & Moderation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-destructive" />
            Security & Moderation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {securityMetrics.map((m) => (
              <MetricCard key={m.label} metric={m} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* User Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            User Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {userMetrics.map((m) => (
              <MetricCard key={m.label} metric={m} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            Activity & Fulfillment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {activityMetrics.map((m) => (
              <MetricCard key={m.label} metric={m} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Table Row Counts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            Database Table Sizes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {tableStats.map((t) => (
              <div key={t.name} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
                <div>
                  <p className="text-sm font-mono text-muted-foreground">{t.name}</p>
                  <p className="text-lg font-bold text-foreground">{t.count.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  {t.count > 900 && (
                    <Badge variant="outline" className={getStatusColor("warning")}>
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Near limit
                    </Badge>
                  )}
                  {t.staleCount !== undefined && t.staleCount > 0 && (
                    <Badge variant="outline" className={getStatusColor("warning")}>
                      <Clock className="h-3 w-3 mr-1" />
                      {t.staleCount} stale
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            ⚠️ Default query limit is 1,000 rows. Tables approaching this need pagination or cleanup.
          </p>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {staleRooms > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Clean up {staleRooms} stale room(s)</p>
                  <p className="text-xs text-muted-foreground">Go to Chat Rooms → Disconnect Stale to free up ghost connections.</p>
                </div>
              </div>
            )}
            {staleQueue > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{staleQueue} orphaned queue entry/entries</p>
                  <p className="text-xs text-muted-foreground">Users stuck in matchmaking for 24h+ — likely disconnected without cleanup.</p>
                </div>
              </div>
            )}
            {highStrikeUsers > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <Ban className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{highStrikeUsers} user(s) at 4+ NSFW strikes</p>
                  <p className="text-xs text-muted-foreground">These users are one strike away from auto-ban. Monitor closely.</p>
                </div>
              </div>
            )}
            {pendingRedemptions > 10 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{pendingRedemptions} pending reward redemptions</p>
                  <p className="text-xs text-muted-foreground">Check Member Rewards to fulfill outstanding orders.</p>
                </div>
              </div>
            )}
            {recentBans24h > 10 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <Shield className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Ban spike: {recentBans24h} bans in last 24h</p>
                  <p className="text-xs text-muted-foreground">Unusual activity — could indicate a bot wave or false positives in NSFW detection.</p>
                </div>
              </div>
            )}
            {staleRooms === 0 && staleQueue === 0 && highStrikeUsers === 0 && pendingRedemptions <= 10 && recentBans24h <= 10 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <Activity className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">All systems healthy</p>
                  <p className="text-xs text-muted-foreground">No immediate action required.</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemHealthPage;
