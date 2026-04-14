import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- FCM v1 OAuth2 helper ---
function base64url(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
  token_uri: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: serviceAccount.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: serviceAccount.token_uri,
        iat: now,
        exp: now + 3600,
      })
    )
  );

  const signingInput = `${header}.${payload}`;

  // Import RSA private key
  const pemBody = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${base64url(new Uint8Array(signature))}`;

  const tokenRes = await fetch(serviceAccount.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    throw new Error(`OAuth2 token error: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

// --- Main handler ---
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

    const normalizedGender = memberGender.toLowerCase();

    // Check if test account
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
      if (elapsed < 2 * 60 * 1000) {
        return new Response(
          JSON.stringify({ success: true, message: "cooldown_active" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Targets: opposite gender, notify_enabled, with push_token
    const targetGender = normalizedGender === "female" ? "male" : "female";
    const { data: targets } = await supabase
      .from("members")
      .select("id, push_token")
      .eq("notify_enabled", true)
      .ilike("gender", targetGender)
      .eq("is_test_account", false)
      .not("push_token", "is", null)
      .neq("id", memberId)
      .limit(100);

    // Discord
    const discordWebhookUrl = Deno.env.get("DISCORD_WEBHOOK_URL");
    const discordSent = await sendDiscordNotification(discordWebhookUrl, normalizedGender);

    // Queue-join push notifications are sent by videocall-match.
    // This function keeps the secondary notification channels only,
    // so users do not receive duplicate pushes for the same join event.
    const pushSent = 0;
    const pushFailed = 0;
    const pushError: string | null = null;

    // Update cooldown and increment email counter
    const { data: updatedCooldown } = await supabase
      .from("notification_cooldowns")
      .upsert(
        {
          gender_segment: segment,
          last_notified_at: new Date().toISOString(),
          email_notify_counter: (cooldown as any)?.email_notify_counter
            ? (cooldown as any).email_notify_counter + 1
            : 1,
        },
        { onConflict: "gender_segment" }
      )
      .select("email_notify_counter")
      .single();

    // Send email every 5th join to avoid spamming
    const EMAIL_EVERY_N = 5;
    let emailsSent = 0;
    const currentCount = updatedCooldown?.email_notify_counter ?? 1;

    if (currentCount % EMAIL_EVERY_N === 0) {
      // Get opposite-gender members with notify_enabled + email
      const { data: emailTargets } = await supabase
        .from("members")
        .select("id, email, name, gender")
        .eq("notify_enabled", true)
        .ilike("gender", targetGender)
        .eq("is_test_account", false)
        .neq("id", memberId)
        .not("email", "is", null)
        .limit(200);

      if (emailTargets && emailTargets.length > 0) {
        // Load template from DB so admins can edit it
        const templateKey = normalizedGender === "male" ? "male_online_notify" : "female_online_notify";
        const { data: emailTemplate } = await supabase
          .from("email_templates")
          .select("subject, body, is_active")
          .eq("template_key", templateKey)
          .eq("is_active", true)
          .maybeSingle();

        if (emailTemplate) {
          for (const target of emailTargets) {
            const emailBody = emailTemplate.body.replace(/\{\{user_name\}\}/g, target.name || "there");
            const emailSubject = emailTemplate.subject;

          try {
            await supabase.rpc("enqueue_email", {
              queue_name: "transactional_emails",
              payload: {
                run_id: crypto.randomUUID(),
                to: target.email,
                from: `C24Club <support@c24club.com>`,
                sender_domain: "notify.c24club.com",
                subject: emailSubject,
                html: emailBody,
                text: emailBody.replace(/<[^>]*>/g, ""),
                purpose: "transactional",
                label: "user_online_notify",
                message_id: `online-notify-${segment}-${Date.now()}-${target.id}`,
                queued_at: new Date().toISOString(),
              },
            });
            emailsSent++;
          } catch (emailErr) {
            console.error("Failed to enqueue email for", target.email, emailErr);
          }
        }
        } // end emailTemplate check
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "notifications_sent",
        discord_sent: discordSent,
        push_sent: pushSent,
        push_failed: pushFailed,
        push_error: pushError,
        targets_found: targets?.length ?? 0,
        emails_sent: emailsSent,
        email_counter: currentCount,
        email_threshold: EMAIL_EVERY_N,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("match-notify error:", error);
    return new Response(
      JSON.stringify({ success: false, message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// --- Discord ---
async function sendDiscordNotification(
  webhookUrl: string | undefined,
  gender: string,
): Promise<boolean> {
  if (!webhookUrl) return false;

  const siteUrl = "https://c24club.com";
  let content: string;
  if (gender === "male") {
    content = `EARN CASH NOW! A male user joined which means you can earn just by connecting with him or just by idling on our website! - C24Club video chat\n${siteUrl}/videocall`;
  } else {
    content = `Hey guys a female user joined and is looking for someone to video chat. - C24Club video chat\n${siteUrl}/videocall`;
  }

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

// --- Push dispatcher ---
async function sendPushNotifications(
  supabaseUrl: string,
  serviceRoleKey: string,
  targets: { id: string; push_token: string | null }[],
  searchingGender: string,
): Promise<{ sent: number; failed: number; error: string | null }> {
  const title =
    searchingGender === "male"
      ? "Earn CASH NOW! A Male User Is Online Wanting To Chat! - C24Club Video Chat"
      : "A girl is looking to video chat. Join now before she leaves! - C24Club Video Chat";
  const body = "";

  let sent = 0;
  let failed = 0;
  let lastError: string | null = null;

  const notificationType = searchingGender === "male" ? "male_online_notify" : "female_online_notify";

  const promises = targets.filter((target) => !!target.push_token).map(async (target) => {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          user_id: target.id,
          title,
          body,
          data: {
            deepLink: "/chat",
            screen: "/chat",
            channelId: "default",
          },
          notification_type: notificationType,
          cooldown_minutes: 2,
        }),
      });

      const raw = await res.text();
      let parsed = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = null;
      }
      if (res.ok && parsed?.success !== false) {
        sent++;
      } else {
        failed++;
        lastError = parsed?.reason || raw || `Push send failed (${res.status})`;
        console.error("Push send failed:", lastError);
      }
    } catch (err) {
      failed++;
      lastError = err instanceof Error ? err.message : String(err);
    }
  });

  await Promise.all(promises);
  return { sent, failed, error: lastError };
}
