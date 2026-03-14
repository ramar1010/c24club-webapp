import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Not authenticated");

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) throw new Error("Not authorized");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60;
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTimestamp = Math.floor(todayStart.getTime() / 1000);

    // Fetch in parallel
    const [
      balanceRes,
      activeSubs,
      canceledSubs,
      recentCharges,
      chargesLast30,
      chargesPrev30,
      chargesToday,
      chargesLast7,
      chargesLast90,
      products,
      allPrices,
    ] = await Promise.all([
      stripe.balance.retrieve(),
      stripe.subscriptions.list({ status: "active", limit: 100 }),
      stripe.subscriptions.list({ status: "canceled", limit: 100 }),
      stripe.charges.list({ limit: 20, created: { gte: thirtyDaysAgo } }),
      stripe.charges.list({ limit: 100, created: { gte: thirtyDaysAgo }, expand: ["data.invoice"] }),
      stripe.charges.list({ limit: 100, created: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } }),
      stripe.charges.list({ limit: 100, created: { gte: todayTimestamp } }),
      stripe.charges.list({ limit: 100, created: { gte: sevenDaysAgo } }),
      stripe.charges.list({ limit: 100, created: { gte: ninetyDaysAgo } }),
      stripe.products.list({ limit: 100, active: true }),
      stripe.prices.list({ limit: 100, active: true, expand: ["data.product"] }),
    ]);

    // Calculate totals (only succeeded charges)
    const succeeded30 = chargesLast30.data.filter((c) => c.status === "succeeded");
    const succeededPrev30 = chargesPrev30.data.filter((c) => c.status === "succeeded");
    const succeededToday = chargesToday.data.filter((c) => c.status === "succeeded");
    const succeeded7 = chargesLast7.data.filter((c) => c.status === "succeeded");
    const succeeded90 = chargesLast90.data.filter((c) => c.status === "succeeded");

    const revenue30 = succeeded30.reduce((sum, c) => sum + c.amount, 0);
    const revenuePrev30 = succeededPrev30.reduce((sum, c) => sum + c.amount, 0);
    const revenueToday = succeededToday.reduce((sum, c) => sum + c.amount, 0);
    const revenue7 = succeeded7.reduce((sum, c) => sum + c.amount, 0);
    const revenue90 = succeeded90.reduce((sum, c) => sum + c.amount, 0);

    // MRR from active subscriptions
    let mrr = 0;
    const subsByProduct: Record<string, { count: number; mrr: number; name: string }> = {};

    for (const sub of activeSubs.data) {
      for (const item of sub.items.data) {
        const price = item.price;
        let monthlyAmount = price.unit_amount || 0;

        if (price.recurring?.interval === "year") {
          monthlyAmount = Math.round(monthlyAmount / 12);
        } else if (price.recurring?.interval === "week") {
          monthlyAmount = monthlyAmount * 4;
        } else if (price.recurring?.interval === "day") {
          monthlyAmount = monthlyAmount * 30;
        }

        mrr += monthlyAmount;

        const prodId = typeof price.product === "string" ? price.product : price.product?.id || "unknown";
        const prodName = products.data.find((p) => p.id === prodId)?.name || prodId;

        if (!subsByProduct[prodId]) {
          subsByProduct[prodId] = { count: 0, mrr: 0, name: prodName };
        }
        subsByProduct[prodId].count += 1;
        subsByProduct[prodId].mrr += monthlyAmount;
      }
    }

    // Revenue by product from charges
    const revenueByProduct: Record<string, { name: string; revenue: number; count: number }> = {};
    for (const charge of succeeded30) {
      const inv = charge.invoice as Stripe.Invoice | null;
      let prodName = "One-time Payment";
      if (inv && typeof inv === "object" && inv.lines?.data?.length > 0) {
        const lineItem = inv.lines.data[0];
        const prodId = typeof lineItem.price?.product === "string" ? lineItem.price.product : "";
        prodName = products.data.find((p) => p.id === prodId)?.name || prodName;
      }
      if (!revenueByProduct[prodName]) {
        revenueByProduct[prodName] = { name: prodName, revenue: 0, count: 0 };
      }
      revenueByProduct[prodName].revenue += charge.amount;
      revenueByProduct[prodName].count += 1;
    }

    // Daily revenue for last 30 days (for chart)
    const dailyRevenue: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      dailyRevenue[key] = 0;
    }
    for (const charge of succeeded30) {
      const d = new Date(charge.created * 1000).toISOString().split("T")[0];
      if (dailyRevenue[d] !== undefined) {
        dailyRevenue[d] += charge.amount;
      }
    }

    // Growth rate
    const growthRate = revenuePrev30 > 0 ? ((revenue30 - revenuePrev30) / revenuePrev30) * 100 : revenue30 > 0 ? 100 : 0;

    // Churn (canceled in last 30 days vs active)
    const recentCanceled = canceledSubs.data.filter(
      (s) => s.canceled_at && s.canceled_at >= thirtyDaysAgo
    ).length;
    const churnRate = activeSubs.data.length + recentCanceled > 0
      ? (recentCanceled / (activeSubs.data.length + recentCanceled)) * 100
      : 0;

    // Projections
    const arr = mrr * 12;
    const avgDailyRevenue = revenue30 / 30;
    const projectedMonthly = avgDailyRevenue * 30;
    const projectedQuarterly = avgDailyRevenue * 90;
    const projectedYearly = avgDailyRevenue * 365;

    // Recent transactions
    const recentTransactions = recentCharges.data
      .filter((c) => c.status === "succeeded")
      .slice(0, 15)
      .map((c) => ({
        id: c.id,
        amount: c.amount,
        currency: c.currency,
        created: c.created,
        description: c.description || c.statement_descriptor || "Payment",
        customer_email: c.billing_details?.email || c.receipt_email || null,
        refunded: c.refunded,
      }));

    // Stripe balance
    const availableBalance = balanceRes.available.reduce((s, b) => s + b.amount, 0);
    const pendingBalance = balanceRes.pending.reduce((s, b) => s + b.amount, 0);

    // Refunds in last 30 days
    const refundedAmount30 = succeeded30
      .filter((c) => c.refunded || (c.amount_refunded && c.amount_refunded > 0))
      .reduce((sum, c) => sum + (c.amount_refunded || 0), 0);

    return new Response(
      JSON.stringify({
        overview: {
          mrr,
          arr,
          revenue_today: revenueToday,
          revenue_7d: revenue7,
          revenue_30d: revenue30,
          revenue_prev_30d: revenuePrev30,
          revenue_90d: revenue90,
          growth_rate: Math.round(growthRate * 10) / 10,
          active_subscriptions: activeSubs.data.length,
          churn_rate: Math.round(churnRate * 10) / 10,
          refunded_30d: refundedAmount30,
          available_balance: availableBalance,
          pending_balance: pendingBalance,
        },
        projections: {
          projected_monthly: Math.round(projectedMonthly),
          projected_quarterly: Math.round(projectedQuarterly),
          projected_yearly: Math.round(projectedYearly),
          arr,
        },
        subscriptions_by_product: Object.values(subsByProduct),
        revenue_by_product: Object.values(revenueByProduct),
        daily_revenue: Object.entries(dailyRevenue).map(([date, amount]) => ({ date, amount })),
        recent_transactions: recentTransactions,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("admin-revenue error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: err.message?.includes("Not authorized") ? 403 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
