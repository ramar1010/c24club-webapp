import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, UserPlus, TrendingUp, Activity, Crown, BarChart3, ArrowUp, ArrowDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format, subDays, startOfDay, startOfWeek, startOfMonth, parseISO, differenceInDays, isAfter } from "date-fns";

const COLORS = ["hsl(210, 80%, 55%)", "hsl(150, 60%, 45%)", "hsl(35, 90%, 55%)", "hsl(340, 70%, 55%)", "hsl(260, 60%, 55%)"];

type TimeRange = "7d" | "30d" | "90d" | "all";

const UserAnalyticsPage = () => {
  const [range, setRange] = useState<TimeRange>("30d");

  const { data: members = [] } = useQuery({
    queryKey: ["analytics-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, created_at, gender, country, membership, found_us_via")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: memberMinutes = [] } = useQuery({
    queryKey: ["analytics-minutes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_minutes")
        .select("user_id, is_vip, total_minutes, vip_tier");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: redemptions = [] } = useQuery({
    queryKey: ["analytics-redemptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_redemptions")
        .select("id, created_at, user_id")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rangeStart = useMemo(() => {
    if (range === "all") return new Date(0);
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    return startOfDay(subDays(new Date(), days));
  }, [range]);

  const filteredMembers = useMemo(
    () => members.filter((m) => isAfter(parseISO(m.created_at), rangeStart)),
    [members, rangeStart]
  );

  const prevRangeStart = useMemo(() => {
    if (range === "all") return new Date(0);
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    return startOfDay(subDays(rangeStart, days));
  }, [range, rangeStart]);

  const prevMembers = useMemo(
    () => members.filter((m) => {
      const d = parseISO(m.created_at);
      return isAfter(d, prevRangeStart) && !isAfter(d, rangeStart);
    }),
    [members, prevRangeStart, rangeStart]
  );

  const growthPercent = prevMembers.length > 0
    ? Math.round(((filteredMembers.length - prevMembers.length) / prevMembers.length) * 100)
    : filteredMembers.length > 0 ? 100 : 0;

  // Signup trend chart
  const signupTrend = useMemo(() => {
    const buckets = new Map<string, number>();
    const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : differenceInDays(new Date(), parseISO(members[0]?.created_at ?? new Date().toISOString()));
    const useWeekly = days > 60;

    filteredMembers.forEach((m) => {
      const d = parseISO(m.created_at);
      const key = useWeekly
        ? format(startOfWeek(d), "MMM dd")
        : format(startOfDay(d), "MMM dd");
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    });

    // Fill gaps
    const result: { date: string; signups: number }[] = [];
    for (let i = 0; i < Math.min(days, 365); i++) {
      const d = subDays(new Date(), days - 1 - i);
      const key = useWeekly
        ? format(startOfWeek(d), "MMM dd")
        : format(startOfDay(d), "MMM dd");
      if (result.length === 0 || result[result.length - 1].date !== key) {
        result.push({ date: key, signups: buckets.get(key) ?? 0 });
      }
    }
    return result;
  }, [filteredMembers, range, members]);

  // Cumulative growth
  const cumulativeGrowth = useMemo(() => {
    let total = members.filter((m) => !isAfter(parseISO(m.created_at), rangeStart)).length;
    return signupTrend.map((d) => {
      total += d.signups;
      return { date: d.date, total };
    });
  }, [signupTrend, members, rangeStart]);

  // Gender distribution
  const genderData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredMembers.forEach((m) => {
      const g = m.gender || "Unknown";
      counts[g] = (counts[g] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredMembers]);

  // Top countries
  const countryData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredMembers.forEach((m) => {
      const c = m.country || "Unknown";
      counts[c] = (counts[c] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [filteredMembers]);

  // Traffic source distribution
  const trafficSourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredMembers.forEach((m) => {
      const source = (m as any).found_us_via || "Not set";
      const label = source.charAt(0).toUpperCase() + source.slice(1);
      counts[label] = (counts[label] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [filteredMembers]);

  // VIP stats
  const vipCount = memberMinutes.filter((m) => m.is_vip).length;
  const vipRate = members.length > 0 ? ((vipCount / members.length) * 100).toFixed(1) : "0";

  // Active users (have minutes > 0)
  const activeUsers = memberMinutes.filter((m) => m.total_minutes > 0).length;
  const activeRate = members.length > 0 ? ((activeUsers / members.length) * 100).toFixed(1) : "0";

  // Daily average signups
  const daysInRange = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : Math.max(1, differenceInDays(new Date(), parseISO(members[0]?.created_at ?? new Date().toISOString())));
  const dailyAvg = (filteredMembers.length / Math.max(1, daysInRange)).toFixed(1);

  const statCards = [
    { label: "Total Members", value: members.length, icon: Users, color: "text-blue-500" },
    { label: `New (${range})`, value: filteredMembers.length, icon: UserPlus, color: "text-green-500", badge: growthPercent },
    { label: "Daily Average", value: dailyAvg, icon: BarChart3, color: "text-amber-500" },
    { label: "VIP Members", value: vipCount, icon: Crown, color: "text-purple-500", sub: `${vipRate}% conversion` },
    { label: "Active Users", value: activeUsers, icon: Activity, color: "text-teal-500", sub: `${activeRate}% active` },
    { label: "Redemptions", value: redemptions.length, icon: TrendingUp, color: "text-rose-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">User Analytics</h2>
          <p className="text-muted-foreground mt-1">Track user growth, acquisition & engagement</p>
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as TimeRange)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">{stat.label}</CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                {"badge" in stat && stat.badge !== undefined && (
                  <p className={`text-xs flex items-center gap-1 mt-1 ${stat.badge >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {stat.badge >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    {Math.abs(stat.badge)}% vs previous period
                  </p>
                )}
                {"sub" in stat && stat.sub && (
                  <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Signup trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">New Signups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={signupTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="signups" fill="hsl(210, 80%, 55%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Cumulative growth */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Cumulative Growth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cumulativeGrowth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  <defs>
                    <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(150, 60%, 45%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(150, 60%, 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="total" stroke="hsl(150, 60%, 45%)" fill="url(#growthGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Gender pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Gender Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {genderData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top countries */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top Countries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={countryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="value" fill="hsl(260, 60%, 55%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Traffic Source */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Traffic Source — How Did You Find Us?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={trafficSourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {trafficSourceData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Traffic source bar breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Traffic Source Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trafficSourceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="value" fill="hsl(35, 90%, 55%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserAnalyticsPage;
