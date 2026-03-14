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
    const { memberId, memberGender } = await req.json();

    if (!memberId || !memberGender) {
      return new Response(
        JSON.stringify({ success: false, message: "memberId and memberGender required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize gender to lowercase for consistent comparison
    const normalizedGender = memberGender.toLowerCase();

    // Check if this is a test account
    const { data: member } = await supabase
      .from("members")
      .select("is_test_account")
      .eq("id", memberId)
      .maybeSingle();

    if (member?.is_test_account) {
      return new Response(
        JSON.stringify({ success: true, message: "test_account_skipped" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting: 5-minute cooldown per gender segment
    const segment = normalizedGender === "female" ? "female_searching" : "male_searching";
    const { data: cooldown } = await supabase
      .from("notification_cooldowns")
      .select("last_notified_at")
      .eq("gender_segment", segment)
      .maybeSingle();

    if (cooldown) {
      const elapsed = Date.now() - new Date(cooldown.last_notified_at).getTime();
      if (elapsed < 5 * 60 * 1000) {
        return new Response(
          JSON.stringify({ success: true, message: "cooldown_active" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Determine who to notify (opposite gender, offline, notify_enabled)
    const targetGender = normalizedGender === "female" ? "male" : "female";

    // Query members to notify — use ilike for case-insensitive gender match
    const { data: targets } = await supabase
      .from("members")
      .select("id, push_token")
      .eq("notify_enabled", true)
      .ilike("gender", targetGender)
      .eq("is_test_account", false)
      .neq("id", memberId)
      .limit(100);

    // Send Discord webhook notification
    const discordWebhookUrl = Deno.env.get("DISCORD_WEBHOOK_URL");
    const discordSent = await sendDiscordNotification(
      discordWebhookUrl,
      normalizedGender,
    );

    // Send FCM push notifications if configured
    const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
    let pushSent = 0;
    if (fcmServerKey && targets && targets.length > 0) {
      const tokens = targets
        .map((t) => t.push_token)
        .filter((t): t is string => !!t);

      if (tokens.length > 0) {
        pushSent = await sendFcmNotifications(fcmServerKey, tokens, normalizedGender);
      }
    }

    // Update cooldown
    await supabase
      .from("notification_cooldowns")
      .upsert(
        { gender_segment: segment, last_notified_at: new Date().toISOString() },
        { onConflict: "gender_segment" }
      );

    return new Response(
      JSON.stringify({
        success: true,
        message: "notifications_sent",
        discord_sent: discordSent,
        push_sent: pushSent,
        targets_found: targets?.length ?? 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("match-notify error:", error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendDiscordNotification(
  webhookUrl: string | undefined,
  gender: string,
): Promise<boolean> {
  if (!webhookUrl) return false;

  const siteUrl = "https://c24club.lovable.app";
  const emoji = gender === "female" ? "👩" : "👨";
  const displayGender = gender === "female" ? "Female" : "Male";
  const content = `📢 A new ${emoji} **${displayGender}** user is waiting for a match! Click here to be their next partner: ${siteUrl}/videocall`;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    return res.ok;
  } catch (err) {
    console.error("Discord webhook error:", err);
    return false;
  }
}

async function sendFcmNotifications(
  serverKey: string,
  tokens: string[],
  searchingGender: string,
): Promise<number> {
  const title = "Someone's waiting on C24 Club!";
  const body =
    searchingGender === "female"
      ? "A female user is online and waiting for a match!"
      : "A male user is searching — jump in and start earning!";

  let sent = 0;
  const batchSize = 1000;
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    try {
      const res = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `key=${serverKey}`,
        },
        body: JSON.stringify({
          registration_ids: batch,
          notification: { title, body, icon: "/favicon-96x96.png" },
          data: { url: "/videocall" },
        }),
      });
      if (res.ok) {
        const result = await res.json();
        sent += result.success ?? 0;
      }
    } catch (err) {
      console.error("FCM batch error:", err);
    }
  }
  return sent;
}