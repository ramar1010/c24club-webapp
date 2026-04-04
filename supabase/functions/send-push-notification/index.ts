import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function base64urlEncode(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encodeJsonB64(obj: unknown): string {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  return base64urlEncode(bytes);
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binaryStr = atob(cleaned);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  return crypto.subtle.importKey(
    "pkcs8",
    bytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function createServiceAccountJwt(serviceAccount: Record<string, string>, scope: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeJsonB64({ alg: "RS256", typ: "JWT" });
  const payload = encodeJsonB64({
    iss: serviceAccount.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  });
  const signingInput = `${header}.${payload}`;
  const key = await importPrivateKey(serviceAccount.private_key);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64urlEncode(new Uint8Array(signature))}`;
}

async function getAccessToken(serviceAccount: Record<string, string>): Promise<string> {
  const jwt = await createServiceAccountJwt(serviceAccount, "https://www.googleapis.com/auth/firebase.messaging");
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!resp.ok) throw new Error(`Failed to obtain access token: ${await resp.text()}`);
  const { access_token } = await resp.json();
  return access_token as string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { user_id, title, body, data = {}, notification_type, cooldown_minutes } = await req.json();

    if (!user_id || !title || !body) {
      return new Response(JSON.stringify({ success: false, reason: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: member } = await supabaseAdmin
      .from("members").select("push_token, notify_enabled").eq("id", user_id).maybeSingle();

    if (!member?.push_token) {
      return new Response(JSON.stringify({ success: false, skipped: true, reason: "No push token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!member.notify_enabled) {
      return new Response(JSON.stringify({ success: false, skipped: true, reason: "Notifications disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (cooldown_minutes && notification_type) {
      const { data: logEntry } = await supabaseAdmin
        .from("push_notification_log").select("last_sent_at")
        .eq("user_id", user_id).eq("notification_type", notification_type).maybeSingle();
      if (logEntry?.last_sent_at) {
        const lastSent = new Date(logEntry.last_sent_at).getTime();
        if (Date.now() - lastSent < cooldown_minutes * 60 * 1000) {
          return new Response(JSON.stringify({ success: false, skipped: true, reason: "Cooldown active" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    if (notification_type) {
      await supabaseAdmin.from("push_notification_log").upsert(
        { user_id, notification_type, last_sent_at: new Date().toISOString() },
        { onConflict: "user_id,notification_type" },
      );
    }

    const serviceAccount = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT")!);
    const accessToken = await getAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;

    const fcmResp = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token: member.push_token,
          notification: { title, body },
          data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
          android: { priority: "high", notification: { channel_id: "default" } },
          apns: { payload: { aps: { alert: { title, body }, sound: "default", badge: 0 } } },
        },
      }),
    });

    const fcmBody = await fcmResp.json();

    if (!fcmResp.ok) {
      const errorCode = fcmBody?.error?.status;
      if (errorCode === "UNREGISTERED" || errorCode === "NOT_FOUND") {
        await supabaseAdmin.from("members").update({ push_token: null }).eq("id", user_id);
      }
      return new Response(JSON.stringify({ success: false, reason: fcmBody?.error?.message }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: unknown) {
    return new Response(JSON.stringify({ success: false, reason: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
