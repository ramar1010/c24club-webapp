import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(signingInput))
  );
  const jwt = `${signingInput}.${base64url(sig)}`;

  const tokenRes = await fetch(serviceAccount.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(`OAuth2 error: ${JSON.stringify(tokenData)}`);
  return tokenData.access_token;
}

async function sendFcmPush(
  accessToken: string,
  projectId: string,
  token: string,
  notification: { title: string; body: string },
  webpushLink: string
) {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      message: {
        token,
        notification,
        webpush: {
          fcm_options: { link: webpushLink },
          notification: { icon: "/favicon-96x96.png" },
        },
      },
    }),
  });
  const raw = await res.text();
  return { ok: res.ok, raw };
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
      return new Response(
        JSON.stringify({ success: false, message: "inviterId and inviteeId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      return new Response(
        JSON.stringify({ success: false, message: "firebase_not_configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;

    // ── MISSED CALL ──
    // Notify the CALLER (inviter) that the invitee declined or the call expired
    if (action === "missed") {
      const [{ data: invitee }, { data: inviter }] = await Promise.all([
        supabase.from("members").select("name").eq("id", inviteeId).maybeSingle(),
        supabase.from("members").select("push_token, notify_enabled").eq("id", inviterId).maybeSingle(),
      ]);

      const inviteeName = invitee?.name || "Someone";

      if (!inviter?.push_token || !inviter?.notify_enabled) {
        return new Response(
          JSON.stringify({ success: true, message: "no_push_token_or_disabled" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Rate limit: max 3 missed call notifications per callee per hour (20-min cooldown)
      const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      const { data: recentLogs } = await supabase
        .from("push_notification_log")
        .select("id")
        .eq("user_id", inviterId)
        .eq("notification_type", `missed_direct_call_${inviteeId}`)
        .gt("last_sent_at", twentyMinAgo)
        .limit(1);

      if (recentLogs && recentLogs.length > 0) {
        return new Response(
          JSON.stringify({ success: true, message: "cooldown_active" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await sendFcmPush(
        accessToken,
        projectId,
        inviter.push_token,
        {
          title: `📞 Missed call from ${inviteeName}`,
          body: `${inviteeName} tried to video call you — tap to call back!`,
        },
        "https://c24club.com/discover"
      );

      // Log to push_notification_log for cooldown tracking
      if (result.ok) {
        await supabase.from("push_notification_log").upsert(
          {
            user_id: inviterId,
            notification_type: `missed_direct_call_${inviteeId}`,
            last_sent_at: new Date().toISOString(),
          },
          { onConflict: "user_id,notification_type" }
        );
      }

      return new Response(
        JSON.stringify({ success: result.ok, message: result.ok ? "missed_push_sent" : result.raw }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── INCOMING CALL (default) ──
    // Notify the INVITEE that they have an incoming call
    const [{ data: inviter }, { data: invitee }] = await Promise.all([
      supabase.from("members").select("name").eq("id", inviterId).maybeSingle(),
      supabase.from("members").select("push_token, notify_enabled").eq("id", inviteeId).maybeSingle(),
    ]);

    const inviterName = inviter?.name || "Someone";

    if (!invitee?.push_token || !invitee?.notify_enabled) {
      return new Response(
        JSON.stringify({ success: true, message: "no_push_token_or_disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await sendFcmPush(
      accessToken,
      projectId,
      invitee.push_token,
      {
        title: `📹 ${inviterName} wants to video chat!`,
        body: "Your Discover match is waiting for you. Join now!",
      },
      "https://c24club.com/videocall"
    );

    return new Response(
      JSON.stringify({ success: result.ok, message: result.ok ? "push_sent" : result.raw }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("notify-direct-call error:", error);
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
