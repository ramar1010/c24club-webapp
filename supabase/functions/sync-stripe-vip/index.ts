import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VIP_TIERS: Record<string, string> = {
  "prod_U8FATJpBAXNSXy": "basic",
  "prod_U8FBD9R49k8Kvd": "premium",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SYNC-STRIPE-VIP] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Fetch all active subscriptions from Stripe
    const allActive: any[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const params: any = { status: "active", limit: 100, expand: ["data.customer"] };
      if (startingAfter) params.starting_after = startingAfter;
      const batch = await stripe.subscriptions.list(params);
      allActive.push(...batch.data);
      hasMore = batch.has_more;
      if (batch.data.length > 0) startingAfter = batch.data[batch.data.length - 1].id;
    }

    logStep("Fetched active subscriptions", { count: allActive.length });

    let synced = 0;
    let skipped = 0;

    for (const sub of allActive) {
      const customer = sub.customer as any;
      const email = customer?.email;
      if (!email) { skipped++; continue; }

      // Find user by email in members table
      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (!member) { skipped++; continue; }

      const productId = sub.items.data[0]?.price?.product as string;
      const vipTier = VIP_TIERS[productId] || "basic";

      let subscriptionEnd: string | null = null;
      try {
        const endVal = sub.current_period_end;
        if (typeof endVal === "number") {
          subscriptionEnd = new Date(endVal * 1000).toISOString();
        }
      } catch { /* skip */ }

      await supabase.from("member_minutes").upsert({
        user_id: member.id,
        is_vip: true,
        vip_tier: vipTier,
        subscription_end: subscriptionEnd,
        stripe_customer_id: customer.id,
      }, { onConflict: "user_id" });

      synced++;
    }

    // Also clear VIP for users who have stripe_customer_id but no active sub
    const { data: vipRows } = await supabase
      .from("member_minutes")
      .select("user_id, stripe_customer_id, admin_granted_vip")
      .eq("is_vip", true)
      .eq("admin_granted_vip", false)
      .not("stripe_customer_id", "is", null);

    let cleared = 0;
    const activeCustomerIds = new Set(allActive.map(s => (s.customer as any)?.id).filter(Boolean));

    for (const row of vipRows ?? []) {
      if (row.stripe_customer_id && !activeCustomerIds.has(row.stripe_customer_id)) {
        await supabase.from("member_minutes").update({
          is_vip: false,
          vip_tier: null,
          subscription_end: null,
        }).eq("user_id", row.user_id);
        cleared++;
      }
    }

    logStep("Sync complete", { synced, skipped, cleared });

    return new Response(JSON.stringify({ synced, skipped, cleared }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    logStep("ERROR", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
