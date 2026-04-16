import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function invokePushNotification(supabaseUrl: string, serviceRoleKey: string, payload: Record<string, unknown>) {
  const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  return {
    ok: response.ok && parsed?.success !== false,
    parsed,
    raw,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const { inviterId, inviteeId, action } = body;

    if (!inviterId || !inviteeId) {
      return new Response(JSON.stringify({ success: false, message: "inviterId and inviteeId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── MISSED CALL ──
    // Notify the CALLER (inviter) that the invitee declined or the call expired
    if (action === "missed") {
      const { data: invitee } = await supabase.from("members").select("name").eq("id", inviteeId).maybeSingle();

      const inviteeName = invitee?.name || "Someone";
      const result = await invokePushNotification(supabaseUrl, serviceRoleKey, {
        user_id: inviterId,
        title: `📞 Missed call from ${inviteeName}`,
        body: `${inviteeName} tried to video call you — tap to call back!`,
        data: {
          deepLink: "/discover",
          screen: "/discover",
          channelId: "default",
        },
        notification_type: `missed_direct_call_${inviteeId}`,
        cooldown_minutes: 2,
      });

      return new Response(
        JSON.stringify({
          success: result.ok,
          message: result.ok ? "missed_push_sent" : result.parsed?.reason || result.raw,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── INCOMING CALL (default) ──
    // Notify the INVITEE that they have an incoming call
    const { data: inviter } = await supabase.from("members").select("name").eq("id", inviterId).maybeSingle();
    const { data: invitee } = await supabase
      .from("members")
      .select("push_token, notify_enabled")
      .eq("id", inviteeId)
      .maybeSingle();

    console.log(
      `[notify-direct-call] incoming: inviterId=${inviterId}, inviteeId=${inviteeId}, invitee_push_token=${invitee?.push_token ? "SET" : "NULL"}, notify_enabled=${invitee?.notify_enabled}`,
    );

    const inviterName = inviter?.name || "Someone";
    const result = await invokePushNotification(supabaseUrl, serviceRoleKey, {
      user_id: inviteeId,
      title: `📹 ${inviterName} wants to video chat!`,
      body: "Earn rewards before they leave! Join now",
      data: {
        deepLink: "/chat",
        screen: "/chat",
        channelId: "incoming_calls",
      },
      notification_type: `incoming_direct_call_${inviterId}`,
    });

    console.log(`[notify-direct-call] push result: ok=${result.ok}, raw=${result.raw}`);

    return new Response(
      JSON.stringify({ success: result.ok, message: result.ok ? "push_sent" : result.parsed?.reason || result.raw }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("notify-direct-call error:", error);
    return new Response(JSON.stringify({ success: false, message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
