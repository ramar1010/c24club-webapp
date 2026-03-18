import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("Not authenticated");

    const { action, minutes_amount, paypal_email, request_id } = await req.json();

    if (action === "request-cashout") {
      if (!minutes_amount || !paypal_email) throw new Error("Missing required fields");
      if (typeof paypal_email !== "string" || !paypal_email.includes("@")) throw new Error("Invalid PayPal email");

      // Get cashout settings
      const { data: settings } = await supabaseAdmin
        .from("cashout_settings")
        .select("*")
        .limit(1)
        .single();

      if (!settings) throw new Error("Cashout not available");

      if (minutes_amount < settings.min_cashout_minutes) {
        throw new Error(`Minimum cashout is ${settings.min_cashout_minutes} minutes`);
      }
      if (minutes_amount > settings.max_cashout_minutes) {
        throw new Error(`Maximum cashout is ${settings.max_cashout_minutes} minutes`);
      }

      // Check user gifted minutes balance (only gifted minutes can be cashed out)
      const { data: userMinutes } = await supabaseAdmin
        .from("member_minutes")
        .select("total_minutes, gifted_minutes")
        .eq("user_id", user.id)
        .single();

      if (!userMinutes || (userMinutes as any).gifted_minutes < minutes_amount) {
        throw new Error("Insufficient gifted minutes balance. You can only cash out minutes received as gifts.");
      }

      // Check for pending cashout
      const { data: pending } = await supabaseAdmin
        .from("cashout_requests")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .limit(1);

      if (pending && pending.length > 0) {
        throw new Error("You already have a pending cashout request");
      }

      const cashAmount = Number((minutes_amount * settings.rate_per_minute).toFixed(2));

      // Deduct minutes
      await supabaseAdmin
        .from("member_minutes")
        .update({ total_minutes: userMinutes.total_minutes - minutes_amount })
        .eq("user_id", user.id);

      // Create cashout request
      await supabaseAdmin.from("cashout_requests").insert({
        user_id: user.id,
        minutes_amount,
        cash_amount: cashAmount,
        paypal_email,
        status: "pending",
      });

      // Admin notification
      await supabaseAdmin.from("admin_notifications").insert({
        type: "cashout_request",
        title: "Cashout Request",
        message: `User requested $${cashAmount} cashout (${minutes_amount} min)`,
        reference_id: user.id,
      });

      return new Response(JSON.stringify({ success: true, cash_amount: cashAmount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get-settings") {
      const { data: settings } = await supabaseAdmin
        .from("cashout_settings")
        .select("*")
        .limit(1)
        .single();

      return new Response(JSON.stringify({ settings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
