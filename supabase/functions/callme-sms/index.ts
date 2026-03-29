import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { inviteeId, callerName } = await req.json();
    if (!inviteeId) {
      return new Response(
        JSON.stringify({ success: false, message: "inviteeId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get invitee's phone number
    const { data: invitee } = await supabase
      .from("members")
      .select("phone_number, name")
      .eq("id", inviteeId)
      .maybeSingle();

    if (!invitee?.phone_number) {
      return new Response(
        JSON.stringify({ success: true, message: "no_phone_number" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const telnyxApiKey = Deno.env.get("TELNYX_API_KEY");
    const telnyxFrom = Deno.env.get("TELNYX_FROM_NUMBER");

    if (!telnyxApiKey || !telnyxFrom) {
      return new Response(
        JSON.stringify({ success: false, message: "sms_not_configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const displayName = callerName || "Someone";
    const messageBody = `[C24Club] ${displayName} wants to video chat with you! Tap to join: https://c24club.com/videocall`;

    // Send SMS via Telnyx
    const smsRes = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${telnyxApiKey}`,
      },
      body: JSON.stringify({
        from: telnyxFrom,
        to: invitee.phone_number,
        text: messageBody,
        use_profile_webhooks: false,
        auto_detect: true,
      }),
    });

    const smsData = await smsRes.json();

    return new Response(
      JSON.stringify({ success: smsRes.ok, message: smsRes.ok ? "sms_sent" : smsData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("callme-sms error:", error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
