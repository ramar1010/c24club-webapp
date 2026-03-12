import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UNFREEZE_PRICE_ID = "price_1T9yuPA5n8uAZoY1iwusrN7M";

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
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { action } = await req.json();

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    if (action === "purchase") {
      // Create one-time payment for unfreeze
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      let customerId;
      if (customers.data.length > 0) customerId = customers.data[0].id;

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{ price: UNFREEZE_PRICE_ID, quantity: 1 }],
        mode: "payment",
        success_url: `${req.headers.get("origin")}/videocall?unfreeze=success`,
        cancel_url: `${req.headers.get("origin")}/videocall?unfreeze=cancel`,
        metadata: { user_id: user.id, type: "unfreeze" },
      });

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "apply") {
      // Apply unfreeze: set freeze_free_until to 7 days from now
      const freezeFreeUntil = new Date();
      freezeFreeUntil.setDate(freezeFreeUntil.getDate() + 7);

      await supabaseClient
        .from("member_minutes")
        .update({
          is_frozen: false,
          freeze_free_until: freezeFreeUntil.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "vip_unfreeze") {
      // VIP unfreeze: check if they have unfreezes remaining
      const { data: mm } = await supabaseClient
        .from("member_minutes")
        .select("vip_unfreezes_used, vip_unfreezes_reset_at, vip_tier")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mm?.vip_tier) {
        return new Response(JSON.stringify({ error: "VIP required" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      const { data: settings } = await supabaseClient
        .from("freeze_settings")
        .select("vip_unfreezes_per_month")
        .limit(1)
        .maybeSingle();

      const maxUnfreezes = settings?.vip_unfreezes_per_month ?? 3;

      // Reset counter if month has passed
      let usedCount = mm.vip_unfreezes_used ?? 0;
      if (mm.vip_unfreezes_reset_at) {
        const resetAt = new Date(mm.vip_unfreezes_reset_at);
        const now = new Date();
        if (now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
          usedCount = 0;
        }
      }

      if (usedCount >= maxUnfreezes) {
        return new Response(JSON.stringify({ error: "No VIP unfreezes remaining this month" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      const freezeFreeUntil = new Date();
      freezeFreeUntil.setDate(freezeFreeUntil.getDate() + 7);

      await supabaseClient
        .from("member_minutes")
        .update({
          is_frozen: false,
          freeze_free_until: freezeFreeUntil.toISOString(),
          vip_unfreezes_used: usedCount + 1,
          vip_unfreezes_reset_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true, remaining: maxUnfreezes - usedCount - 1 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unknown action");
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
