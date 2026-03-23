import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VIP_TIERS: Record<string, string> = {
  "prod_U8FATJpBAXNSXy": "basic",
  "prod_U8FBD9R49k8Kvd": "premium",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      logStep("No authorization header, returning not subscribed");
      return new Response(JSON.stringify({ subscribed: false, vip_tier: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData?.user) {
      logStep("Auth failed, returning not subscribed", { error: userError?.message });
      return new Response(JSON.stringify({ subscribed: false, vip_tier: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userData.user;
    if (!user.email) {
      logStep("No email found, returning not subscribed");
      return new Response(JSON.stringify({ subscribed: false, vip_tier: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    logStep("User authenticated", { userId: user.id });

    // First check if user has admin-granted VIP
    const { data: currentMinutes } = await supabaseClient
      .from("member_minutes")
      .select("is_vip, vip_tier, subscription_end, stripe_customer_id, admin_granted_vip")
      .eq("user_id", user.id)
      .maybeSingle();

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      // If admin-granted VIP, preserve it
      if (currentMinutes?.admin_granted_vip) {
        logStep("Admin-granted VIP preserved");
        return new Response(JSON.stringify({
          subscribed: true,
          vip_tier: currentMinutes.vip_tier,
          subscription_end: null,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseClient
        .from("member_minutes")
        .update({ is_vip: false, vip_tier: null, subscription_end: null, stripe_customer_id: null })
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ subscribed: false, vip_tier: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const hasActive = subscriptions.data.length > 0;
    let vipTier: string | null = null;
    let subscriptionEnd: string | null = null;

    if (hasActive) {
      const sub = subscriptions.data[0];
      try {
        const endVal = sub.current_period_end;
        if (typeof endVal === "number") {
          subscriptionEnd = new Date(endVal * 1000).toISOString();
        } else if (typeof endVal === "string") {
          subscriptionEnd = new Date(endVal).toISOString();
        }
      } catch {
        logStep("Could not parse current_period_end, skipping");
      }
      const productId = sub.items.data[0].price.product as string;
      vipTier = VIP_TIERS[productId] || "basic";
      logStep("Active subscription", { vipTier, subscriptionEnd });
    } else if (currentMinutes?.is_vip && !currentMinutes?.stripe_customer_id) {
      // Admin-granted VIP, preserve it even though they have a Stripe customer
      logStep("Admin-granted VIP preserved (has Stripe customer but no active sub)");
      return new Response(JSON.stringify({
        subscribed: true,
        vip_tier: currentMinutes.vip_tier,
        subscription_end: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      logStep("No active subscription");
    }

    // Sync to DB
    await supabaseClient
      .from("member_minutes")
      .update({
        is_vip: hasActive,
        vip_tier: vipTier,
        subscription_end: subscriptionEnd,
        stripe_customer_id: customerId,
      })
      .eq("user_id", user.id);

    return new Response(JSON.stringify({
      subscribed: hasActive,
      vip_tier: vipTier,
      subscription_end: subscriptionEnd,
    }), {
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
