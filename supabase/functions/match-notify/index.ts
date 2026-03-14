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
      if (elapsed < 5 * 60 * 1000) {
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
      .neq("id", memberId)
      .limit(100);

    // Discord
    const discordWebhookUrl = Deno.env.get("DISCORD_WEBHOOK_URL");
    const discordSent = await sendDiscordNotification(discordWebhookUrl, normalizedGender);

    // FCM v1 push
    let pushSent = 0;
    let pushFailed = 0;
    let pushError: string | null = null;

    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (serviceAccountJson && targets && targets.length > 0) {
      const tokens = targets.map((t) => t.push_token).filter((t): t is string => !!t);

      if (tokens.length > 0) {
        try {
          const serviceAccount = JSON.parse(serviceAccountJson);
          const accessToken = await getAccessToken(serviceAccount);
          const projectId = serviceAccount.project_id;

          const result = await sendFcmV1Notifications(accessToken, projectId, tokens, normalizedGender);
          pushSent = result.sent;
          pushFailed = result.failed;
          pushError = result.error;
        } catch (err) {
          pushError = err instanceof Error ? err.message : String(err);
          pushFailed = tokens.length;
          console.error("FCM v1 auth/send error:", pushError);
        }
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
        push_failed: pushFailed,
        push_error: pushError,
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

// --- Discord ---
async function sendDiscordNotification(
  webhookUrl: string | undefined,
  gender: string,
): Promise<boolean> {
  if (!webhookUrl) return false;

  const siteUrl = "https://c24club.lovable.app";
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

// --- FCM HTTP v1 ---
async function sendFcmV1Notifications(
  accessToken: string,
  projectId: string,
  tokens: string[],
  searchingGender: string,
): Promise<{ sent: number; failed: number; error: string | null }> {
  const title =
    searchingGender === "male"
      ? "Earn CASH NOW! A Male User Is Online Wanting To Chat! - C24Club Video Chat"
      : "A female user is waiting to video chat. Join now before she leaves! - C24Club Video Chat";
  const body = "";

  let sent = 0;
  let failed = 0;
  let lastError: string | null = null;

  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  // FCM v1 sends one message per token
  const promises = tokens.map(async (token) => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            webpush: {
              fcm_options: { link: "https://c24club.lovable.app/videocall" },
              notification: { icon: "/favicon-96x96.png" },
            },
          },
        }),
      });

      const raw = await res.text();
      if (res.ok) {
        sent++;
      } else {
        failed++;
        lastError = `FCM v1 ${res.status}: ${raw}`;
        console.error("FCM v1 send failed for token:", lastError);
      }
    } catch (err) {
      failed++;
      lastError = err instanceof Error ? err.message : String(err);
    }
  });

  await Promise.all(promises);
  return { sent, failed, error: lastError };
}
