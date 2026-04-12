import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const record = payload.record ?? payload;

    const { user_id, status, reward_title, shipping_tracking_url } = record;

    if (!user_id || !status) {
      return new Response(
        JSON.stringify({ success: false, reason: "Missing user_id or status" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (status !== "Order shipped" && status !== "cancelled") {
      return new Response(
        JSON.stringify({ success: false, skipped: true, reason: "Status not actionable" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const title = status === "Order shipped"
      ? "🚚 Your order has shipped!"
      : "❌ Your order has been cancelled";

    const rewardLabel = reward_title ? `"${reward_title}"` : "Your reward";

    const body = status === "Order shipped"
      ? `${rewardLabel} is on its way! Tap to track your package.`
      : `${rewardLabel} order was cancelled. Contact support if you have questions.`;

    const data: Record<string, string> = {
      type: "redemption_status",
      status,
      screen: "/(tabs)/profile",
    };

    if (status === "Order shipped" && shipping_tracking_url) {
      data.tracking_url = shipping_tracking_url;
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const resp = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        user_id,
        title,
        body,
        data,
        notification_type: "redemption_status",
        force_send: true,
      }),
    });

    const result = await resp.json();
    return new Response(
      JSON.stringify({ success: true, push: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, reason: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
