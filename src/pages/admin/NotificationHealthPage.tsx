import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

type Status = "healthy" | "warning" | "down";

interface CheckResult {
  title: string;
  status: Status;
  description: string;
  metric: string;
}

const statusIcon: Record<Status, string> = {
  healthy: "🟢",
  warning: "🟡",
  down: "🔴",
};

const statusBadgeVariant: Record<Status, "default" | "secondary" | "destructive"> = {
  healthy: "default",
  warning: "secondary",
  down: "destructive",
};

const statusLabel: Record<Status, string> = {
  healthy: "Healthy",
  warning: "Warning",
  down: "Down",
};

const ago = (d: string | null) =>
  d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : "never";

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function fetchAllChecks(): Promise<{
  males: CheckResult[];
  females: CheckResult[];
  general: CheckResult[];
}> {
  const now = new Date();
  const h2 = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // ---- MALE CHECKS ----

  // 1. Male Batch Notifications
  const maleBatch = await safeQuery(async () => {
    const { data, error } = await supabase
      .from("male_search_batch_log")
      .select("last_reset_at, join_count")
      .order("last_reset_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { title: "Male Batch Notifications (Females Joined)", status: "down" as Status, description: "No entries exist", metric: "No data" };
    const recent = new Date(data.last_reset_at) > new Date(h2);
    return {
      title: "Male Batch Notifications (Females Joined)",
      status: recent ? "healthy" as Status : "warning" as Status,
      description: recent ? "Batch processing active" : "No updates in the last 2 hours",
      metric: `Last reset: ${ago(data.last_reset_at)} · Count: ${data.join_count}`,
    };
  }, { title: "Male Batch Notifications (Females Joined)", status: "down" as Status, description: "Table not found", metric: "N/A" });

  // 2. Male New Match (rooms where female initiated = member1_gender='female')
  const maleMatch = await safeQuery(async () => {
    const { count, error } = await supabase
      .from("rooms")
      .select("id", { count: "exact", head: true })
      .eq("member1_gender", "female")
      .gte("created_at", h2);
    if (error) throw error;
    const c = count ?? 0;
    return {
      title: "Male New Match Notification",
      status: c > 0 ? "healthy" as Status : "warning" as Status,
      description: c > 0 ? "Female-initiated rooms found recently" : "No female-initiated rooms in 2 hours",
      metric: `${c} rooms in last 2h`,
    };
  }, { title: "Male New Match Notification", status: "down" as Status, description: "Query failed", metric: "N/A" });

  // 3. Male Incoming Direct Call (invitee is male)
  const maleDirectCall = await safeQuery(async () => {
    const { data, error } = await supabase
      .from("direct_call_invites")
      .select("invitee_id")
      .gte("created_at", h24);
    if (error) throw error;
    if (!data || data.length === 0)
      return { title: "Male Incoming Direct Call", status: "warning" as Status, description: "No direct call invites in 24h", metric: "0 invites" };
    // We can't easily filter by gender here without joining, so show total
    return {
      title: "Male Incoming Direct Call",
      status: "healthy" as Status,
      description: "Direct call invites active",
      metric: `${data.length} total invites in 24h`,
    };
  }, { title: "Male Incoming Direct Call", status: "down" as Status, description: "Query failed", metric: "N/A" });

  // 4. Male DM Received
  const maleDm = await safeQuery(async () => {
    const { count, error } = await supabase
      .from("dm_messages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", h24);
    if (error) throw error;
    const c = count ?? 0;
    return {
      title: "Male DM Received",
      status: c > 0 ? "healthy" as Status : "warning" as Status,
      description: c > 0 ? "DM messages flowing" : "No DMs in 24h",
      metric: `${c} messages in 24h`,
    };
  }, { title: "Male DM Received", status: "down" as Status, description: "Query failed", metric: "N/A" });

  // 5. Male Interest/Match
  const maleInterest = await safeQuery(async () => {
    const { count, error } = await supabase
      .from("member_interests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", h24);
    if (error) throw error;
    const c = count ?? 0;
    return {
      title: "Male Interest/Match Notification",
      status: c > 0 ? "healthy" as Status : "warning" as Status,
      description: c > 0 ? "Interest notifications active" : "No interests expressed in 24h",
      metric: `${c} interests in 24h`,
    };
  }, { title: "Male Interest/Match Notification", status: "down" as Status, description: "Query failed", metric: "N/A" });

  // ---- FEMALE CHECKS ----

  // 1. Female Batch Notifications (same table, check for female-side data)
  const femaleBatch = await safeQuery(async () => {
    const { count, error } = await supabase
      .from("male_search_batch_log")
      .select("id", { count: "exact", head: true })
      .gte("last_reset_at", h2);
    if (error) throw error;
    const c = count ?? 0;
    return {
      title: "Female Batch Notifications (Males Joined)",
      status: c > 0 ? "healthy" as Status : "warning" as Status,
      description: c > 0 ? "Female batch log entries updated recently" : "No batch updates in 2 hours",
      metric: `${c} active entries in 2h`,
    };
  }, { title: "Female Batch Notifications (Males Joined)", status: "down" as Status, description: "Table not found", metric: "N/A" });

  // 2. Female New Match (rooms where male initiated = member1_gender='male')
  const femaleMatch = await safeQuery(async () => {
    const { count, error } = await supabase
      .from("rooms")
      .select("id", { count: "exact", head: true })
      .eq("member1_gender", "male")
      .gte("created_at", h2);
    if (error) throw error;
    const c = count ?? 0;
    return {
      title: "Female New Match Notification",
      status: c > 0 ? "healthy" as Status : "warning" as Status,
      description: c > 0 ? "Male-initiated rooms found recently" : "No male-initiated rooms in 2 hours",
      metric: `${c} rooms in last 2h`,
    };
  }, { title: "Female New Match Notification", status: "down" as Status, description: "Query failed", metric: "N/A" });

  // 3. Female Incoming Direct Call
  const femaleDirectCall = await safeQuery(async () => {
    const { data, error } = await supabase
      .from("direct_call_invites")
      .select("invitee_id")
      .gte("created_at", h24);
    if (error) throw error;
    const c = data?.length ?? 0;
    return {
      title: "Female Incoming Direct Call",
      status: c > 0 ? "healthy" as Status : "warning" as Status,
      description: c > 0 ? "Direct call invites active" : "No direct call invites in 24h",
      metric: `${c} total invites in 24h`,
    };
  }, { title: "Female Incoming Direct Call", status: "down" as Status, description: "Query failed", metric: "N/A" });

  // 4. Female DM Received
  const femaleDm = await safeQuery(async () => {
    const { count, error } = await supabase
      .from("dm_messages")
      .select("id", { count: "exact", head: true })
      .gte("created_at", h24);
    if (error) throw error;
    const c = count ?? 0;
    return {
      title: "Female DM Received",
      status: c > 0 ? "healthy" as Status : "warning" as Status,
      description: c > 0 ? "DM messages flowing" : "No DMs in 24h",
      metric: `${c} messages in 24h`,
    };
  }, { title: "Female DM Received", status: "down" as Status, description: "Query failed", metric: "N/A" });

  // 5. Female Interest/Match
  const femaleInterest = await safeQuery(async () => {
    const { count, error } = await supabase
      .from("member_interests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", h24);
    if (error) throw error;
    const c = count ?? 0;
    return {
      title: "Female Interest/Match Notification",
      status: c > 0 ? "healthy" as Status : "warning" as Status,
      description: c > 0 ? "Interest notifications active" : "No interests expressed in 24h",
      metric: `${c} interests in 24h`,
    };
  }, { title: "Female Interest/Match Notification", status: "down" as Status, description: "Query failed", metric: "N/A" });

  // ---- GENERAL CHECKS ----

  // 1. Push Token Coverage
  const pushCoverage = await safeQuery(async () => {
    const { data: allMembers } = await supabase
      .from("members")
      .select("gender, push_token");
    if (!allMembers || allMembers.length === 0)
      return { title: "Push Token Coverage", status: "down" as Status, description: "No members found", metric: "N/A" };
    const males = allMembers.filter((m) => m.gender === "male");
    const females = allMembers.filter((m) => m.gender === "female");
    const malePct = males.length ? Math.round((males.filter((m) => m.push_token).length / males.length) * 100) : 0;
    const femalePct = females.length ? Math.round((females.filter((m) => m.push_token).length / females.length) * 100) : 0;
    const bad = malePct < 30 || femalePct < 30;
    return {
      title: "Push Token Coverage",
      status: bad ? "down" as Status : "healthy" as Status,
      description: bad ? "Token coverage below 30% for one or more genders" : "Good push token coverage",
      metric: `Males: ${malePct}% · Females: ${femalePct}%`,
    };
  }, { title: "Push Token Coverage", status: "down" as Status, description: "Query failed", metric: "N/A" });

  // 2. Push Notification Log
  const pushLog = await safeQuery(async () => {
    const { data, error } = await supabase
      .from("push_notification_log")
      .select("last_sent_at, notification_type, user_id")
      .order("last_sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return { title: "Push Notification Log", status: "warning" as Status, description: "No notifications sent", metric: "Empty log" };
    const recent = new Date(data.last_sent_at) > new Date(h24);
    return {
      title: "Push Notification Log",
      status: recent ? "healthy" as Status : "warning" as Status,
      description: recent ? "Push notifications being sent" : "No notifications in last 24h",
      metric: `Last sent: ${ago(data.last_sent_at)} · Type: ${data.notification_type}`,
    };
  }, { title: "Push Notification Log", status: "down" as Status, description: "Table not found", metric: "N/A" });

  // 3. VIP Upgrade
  const vipUpgrade = await safeQuery(async () => {
    const { count, error } = await supabase
      .from("member_minutes")
      .select("id", { count: "exact", head: true })
      .eq("is_vip", true)
      .gte("updated_at", h24);
    if (error) throw error;
    const c = count ?? 0;
    return {
      title: "VIP Upgrade Notification",
      status: c > 0 ? "healthy" as Status : "warning" as Status,
      description: c > 0 ? "VIP upgrades detected" : "No VIP upgrades in 24h",
      metric: `${c} VIP updates in 24h`,
    };
  }, { title: "VIP Upgrade Notification", status: "down" as Status, description: "Query failed", metric: "N/A" });

  // 4. Ban Notification
  const banNotif = await safeQuery(async () => {
    const { data, error } = await supabase
      .from("user_bans")
      .select("created_at")
      .gte("created_at", h24)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const c = data?.length ?? 0;
    return {
      title: "Ban Notification",
      status: "healthy" as Status,
      description: c > 0 ? "Recent bans issued" : "No bans in 24h",
      metric: c > 0 ? `${c} bans · Last: ${ago(data![0].created_at)}` : "0 bans in 24h",
    };
  }, { title: "Ban Notification", status: "down" as Status, description: "Table not found", metric: "N/A" });

  return {
    males: [maleBatch, maleMatch, maleDirectCall, maleDm, maleInterest],
    females: [femaleBatch, femaleMatch, femaleDirectCall, femaleDm, femaleInterest],
    general: [pushCoverage, pushLog, vipUpgrade, banNotif],
  };
}

function StatusCard({ result }: { result: CheckResult }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{result.title}</CardTitle>
          <Badge variant={statusBadgeVariant[result.status]}>
            {statusIcon[result.status]} {statusLabel[result.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{result.description}</p>
        <p className="text-xs text-muted-foreground mt-1 font-mono">{result.metric}</p>
      </CardContent>
    </Card>
  );
}

export default function NotificationHealthPage() {
  const { data, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["notification-health"],
    queryFn: fetchAllChecks,
    refetchInterval: 60_000,
  });

  const issueCount = data
    ? [...data.males, ...data.females, ...data.general].filter(
        (r) => r.status !== "healthy"
      ).length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notification Health Dashboard</h1>
          {dataUpdatedAt > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Last checked: {new Date(dataUpdatedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh All
        </Button>
      </div>

      {/* Summary banner */}
      {data && (
        <div
          className={`p-4 rounded-lg border ${
            issueCount === 0
              ? "bg-green-500/10 border-green-500/30 text-green-400"
              : "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
          }`}
        >
          {issueCount === 0
            ? "All Systems Healthy ✅"
            : `${issueCount} issue${issueCount > 1 ? "s" : ""} detected ⚠️`}
        </div>
      )}

      {isLoading && !data && (
        <p className="text-muted-foreground">Loading checks…</p>
      )}

      {data && (
        <>
          <section>
            <h2 className="text-lg font-semibold mb-3">👨 Male Notifications</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.males.map((r) => (
                <StatusCard key={r.title} result={r} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">👩 Female Notifications</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.females.map((r) => (
                <StatusCard key={r.title} result={r} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">🔔 General (Both)</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.general.map((r) => (
                <StatusCard key={r.title} result={r} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
