import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

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
  console.log(`[SESSION-INIT] ${step}${d}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    // 1) Get client IP
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      null;

    // 2) Check IP ban
    let ipBan: { banned: boolean; reason?: string; ban_type?: string; created_at?: string } = { banned: false };
    if (ip && ip !== "unknown") {
      const { data } = await supabase
        .from("user_bans")
        .select("reason, ban_type, created_at")
        .eq("ip_address", ip)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        ipBan = { banned: true, reason: data.reason, ban_type: data.ban_type, created_at: data.created_at };
      }
    }

    // 3) Check subscription if authenticated
    let subscription = { subscribed: false, vip_tier: null as string | null, subscription_end: null as string | null };

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;

    if (token) {
      const { data: userData } = await supabase.auth.getUser(token);
      const user = userData?.user;

      if (user?.email) {
        logStep("Checking subscription", { userId: user.id });

        // Check admin-granted VIP first
        const { data: currentMinutes } = await supabase
          .from("member_minutes")
          .select("is_vip, vip_tier, subscription_end, stripe_customer_id, admin_granted_vip")
          .eq("user_id", user.id)
          .maybeSingle();

        // Check for an active IAP (Google Play / Apple) subscription so we don't
        // overwrite mobile-store VIP with a Stripe-only check.
        const { data: latestIap } = await supabase
          .from("iap_purchases")
          .select("vip_tier, sku, platform, created_at")
          .eq("user_id", user.id)
          .eq("action", "verify-subscription")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const iapStillValid = (() => {
          if (!latestIap?.created_at || !latestIap?.vip_tier) return false;
          const created = new Date(latestIap.created_at).getTime();
          const windowMs = latestIap.vip_tier === "premium"
            ? 31 * 24 * 60 * 60 * 1000   // monthly
            : 8 * 24 * 60 * 60 * 1000;   // weekly (+1d grace)
          return Date.now() - created < windowMs;
        })();

        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

        if (stripeKey) {
          const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
          const customers = await stripe.customers.list({ email: user.email, limit: 1 });

          if (customers.data.length > 0) {
            const customerId = customers.data[0].id;
            const subs = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });

            if (subs.data.length > 0) {
              const sub = subs.data[0];
              let subscriptionEnd: string | null = null;
              try {
                const endVal = sub.current_period_end;
                subscriptionEnd = typeof endVal === "number"
                  ? new Date(endVal * 1000).toISOString()
                  : typeof endVal === "string" ? new Date(endVal).toISOString() : null;
              } catch {}

              const productId = sub.items.data[0].price.product as string;
              const vipTier = VIP_TIERS[productId] || "basic";

              subscription = { subscribed: true, vip_tier: vipTier, subscription_end: subscriptionEnd };

              await supabase.from("member_minutes").upsert({
                user_id: user.id, is_vip: true, vip_tier: vipTier,
                subscription_end: subscriptionEnd, stripe_customer_id: customerId,
              }, { onConflict: "user_id" });
            } else if (currentMinutes?.admin_granted_vip) {
              subscription = { subscribed: true, vip_tier: currentMinutes.vip_tier || "premium", subscription_end: null };
            } else if (iapStillValid) {
              subscription = { subscribed: true, vip_tier: latestIap!.vip_tier!, subscription_end: null };
            } else {
              await supabase.from("member_minutes").upsert({
                user_id: user.id, is_vip: false, vip_tier: null,
                subscription_end: null, stripe_customer_id: customerId,
              }, { onConflict: "user_id" });
            }
          } else if (currentMinutes?.admin_granted_vip) {
            subscription = { subscribed: true, vip_tier: currentMinutes.vip_tier || "premium", subscription_end: null };
          } else if (iapStillValid) {
            subscription = { subscribed: true, vip_tier: latestIap!.vip_tier!, subscription_end: null };
          } else {
            await supabase.from("member_minutes").upsert({
              user_id: user.id, is_vip: false, vip_tier: null,
              subscription_end: null, stripe_customer_id: null,
            }, { onConflict: "user_id" });
          }
        } else if (currentMinutes?.admin_granted_vip) {
          subscription = { subscribed: true, vip_tier: currentMinutes.vip_tier || "premium", subscription_end: null };
        } else if (iapStillValid) {
          subscription = { subscribed: true, vip_tier: latestIap!.vip_tier!, subscription_end: null };
        }
      }
    }

    return new Response(JSON.stringify({
      ip: ip || null,
      ip_ban: ipBan,
      subscription,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    logStep("ERROR", { message: err.message });
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
