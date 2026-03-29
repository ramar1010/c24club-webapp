import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  RefreshCw,
  Loader2,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Target,
  Wallet,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";

interface RevenueData {
  overview: {
    mrr: number;
    arr: number;
    revenue_today: number;
    revenue_7d: number;
    revenue_30d: number;
    revenue_prev_30d: number;
    revenue_90d: number;
    growth_rate: number;
    active_subscriptions: number;
    churn_rate: number;
    refunded_30d: number;
    available_balance: number;
    pending_balance: number;
  };
  projections: {
    projected_monthly: number;
    projected_quarterly: number;
    projected_yearly: number;
    arr: number;
  };
  subscriptions_by_product: Array<{ name: string; count: number; mrr: number }>;
  revenue_by_product: Array<{ name: string; revenue: number; count: number }>;
  daily_revenue: Array<{ date: string; amount: number }>;
  recent_transactions: Array<{
    id: string;
    amount: number;
    currency: string;
    created: number;
    description: string;
    customer_email: string | null;
    refunded: boolean;
  }>;
}

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
};

const formatDate = (timestamp: number) => {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
];

const RevenuePage = () => {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRevenue = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("admin-revenue");
      if (fnError) throw fnError;
      if (result?.error) throw new Error(result.error);
      setData(result);
    } catch (err: any) {
      console.error("Revenue fetch error:", err);
      setError(err.message || "Failed to load revenue data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRevenue();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={fetchRevenue}>Retry</Button>
      </div>
    );
  }

  if (!data) return null;

  const { overview, projections, subscriptions_by_product, revenue_by_product, daily_revenue, recent_transactions } = data;

  const chartData = daily_revenue.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    revenue: d.amount / 100,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-green-500" />
            Revenue Dashboard
          </h2>
          <p className="text-muted-foreground mt-1">Track income, subscriptions, and projections</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRevenue} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-1">Refresh</span>
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">MRR</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(overview.mrr)}</div>
            <p className="text-xs text-muted-foreground mt-1">Monthly Recurring Revenue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue (30d)</CardTitle>
            {overview.growth_rate >= 0 ? (
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(overview.revenue_30d)}</div>
            <p className={`text-xs mt-1 ${overview.growth_rate >= 0 ? "text-green-500" : "text-red-500"}`}>
              {overview.growth_rate >= 0 ? "+" : ""}{overview.growth_rate}% vs prev 30d
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Subs</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{overview.active_subscriptions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {overview.churn_rate}% churn (30d)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatCurrency(overview.revenue_today)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              7d: {formatCurrency(overview.revenue_7d)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Daily Revenue (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, "Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Projections */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-green-500" />
              Revenue Projections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
                <div>
                  <p className="text-sm text-muted-foreground">Projected Monthly</p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(projections.projected_monthly)}</p>
                </div>
                <Badge variant="outline" className="text-xs">Based on 30d avg</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
                <div>
                  <p className="text-sm text-muted-foreground">Projected Quarterly</p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(projections.projected_quarterly)}</p>
                </div>
                <Badge variant="outline" className="text-xs">Next 90 days</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
                <div>
                  <p className="text-sm text-muted-foreground">Projected Yearly</p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(projections.projected_yearly)}</p>
                </div>
                <Badge variant="outline" className="text-xs">Next 365 days</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-green-500/20 bg-green-500/5">
                <div>
                  <p className="text-sm text-muted-foreground">ARR (from subscriptions)</p>
                  <p className="text-lg font-bold text-green-500">{formatCurrency(projections.arr)}</p>
                </div>
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/30">MRR × 12</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stripe Balance & Health */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Financial Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
                <div>
                  <p className="text-sm text-muted-foreground">Available Balance</p>
                  <p className="text-lg font-bold text-green-500">{formatCurrency(overview.available_balance)}</p>
                </div>
                <Badge variant="outline" className="text-xs">Ready to payout</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Balance</p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(overview.pending_balance)}</p>
                </div>
                <Badge variant="outline" className="text-xs">Processing</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
                <div>
                  <p className="text-sm text-muted-foreground">Refunds (30d)</p>
                  <p className="text-lg font-bold text-red-500">{formatCurrency(overview.refunded_30d)}</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {overview.revenue_30d > 0
                    ? `${((overview.refunded_30d / overview.revenue_30d) * 100).toFixed(1)}% of rev`
                    : "0%"}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
                <div>
                  <p className="text-sm text-muted-foreground">90-Day Revenue</p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(overview.revenue_90d)}</p>
                </div>
                <Badge variant="outline" className="text-xs">Quarter view</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue by Product */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Revenue by Product (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revenue_by_product.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No revenue data yet</p>
            ) : (
              <div className="space-y-3">
                {revenue_by_product
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((p, i) => (
                    <div key={p.name} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.count} transaction{p.count !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-foreground">{formatCurrency(p.revenue)}</p>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscriptions by Product */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Active Subscriptions by Tier
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subscriptions_by_product.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No active subscriptions</p>
            ) : (
              <div className="space-y-3">
                {subscriptions_by_product
                  .sort((a, b) => b.mrr - a.mrr)
                  .map((s, i) => (
                    <div key={s.name} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/50">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <div>
                          <p className="text-sm font-medium text-foreground">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.count} subscriber{s.count !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">{formatCurrency(s.mrr)}/mo</p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recent_transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No recent transactions</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Date</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Customer</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Description</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Amount</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent_transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-3 text-foreground">{formatDate(tx.created)}</td>
                      <td className="py-2 px-3 text-muted-foreground">{tx.customer_email || "—"}</td>
                      <td className="py-2 px-3 text-foreground truncate max-w-[200px]">{tx.description}</td>
                      <td className="py-2 px-3 text-right font-medium text-foreground">{formatCurrency(tx.amount)}</td>
                      <td className="py-2 px-3 text-right">
                        {tx.refunded ? (
                          <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/30">Refunded</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/30">Paid</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RevenuePage;
