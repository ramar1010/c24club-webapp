import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results: Record<string, number> = {};

    // 1. Delete disconnected rooms older than 7 days
    const { count: roomCount } = await supabase
      .from("rooms")
      .delete({ count: "exact" })
      .eq("status", "disconnected")
      .lt("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
    results.old_rooms = roomCount || 0;

    // 2. Delete expired/declined direct call invites older than 1 day
    const { count: inviteCount } = await supabase
      .from("direct_call_invites")
      .delete({ count: "exact" })
      .in("status", ["expired", "declined", "cancelled"])
      .lt("created_at", new Date(Date.now() - 86400000).toISOString());
    results.old_invites = inviteCount || 0;

    // 3. Delete read admin notifications older than 30 days
    const { count: notifCount } = await supabase
      .from("admin_notifications")
      .delete({ count: "exact" })
      .eq("is_read", true)
      .lt("created_at", new Date(Date.now() - 30 * 86400000).toISOString());
    results.old_notifications = notifCount || 0;

    // 4. Delete email send logs older than 30 days
    const { count: emailLogCount } = await supabase
      .from("email_send_log")
      .delete({ count: "exact" })
      .lt("created_at", new Date(Date.now() - 30 * 86400000).toISOString());
    results.old_email_logs = emailLogCount || 0;

    // 5. Delete SMS delivery logs older than 30 days
    const { count: smsLogCount } = await supabase
      .from("sms_delivery_log")
      .delete({ count: "exact" })
      .lt("created_at", new Date(Date.now() - 30 * 86400000).toISOString());
    results.old_sms_logs = smsLogCount || 0;

    // 6. Delete promo analytics older than 90 days
    const { count: promoCount } = await supabase
      .from("promo_analytics")
      .delete({ count: "exact" })
      .lt("viewed_at", new Date(Date.now() - 90 * 86400000).toISOString());
    results.old_promo_analytics = promoCount || 0;

    // 7. Delete pending direct call invites that expired
    const { count: expiredInvites } = await supabase
      .from("direct_call_invites")
      .delete({ count: "exact" })
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString());
    results.expired_pending_invites = expiredInvites || 0;

    console.log("Cleanup results:", results);

    return new Response(JSON.stringify({ success: true, cleaned: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
