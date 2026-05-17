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

function isExpoPushToken(token: string): boolean {
  return /^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(token);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function extractRetryAfterMs(raw: string, parsed: any, headerRetryAfter?: string | null): number | null {
  // Try parsed body for retryAfterMs / retry_after
  const candidates = [
    parsed?.retryAfterMs,
    parsed?.errors?.[0]?.retryAfterMs,
    parsed?.errors?.[0]?.details?.retryAfterMs,
    parsed?.error?.details?.retryAfterMs,
  ];
  for (const c of candidates) {
    const n = typeof c === "string" ? parseInt(c, 10) : c;
    if (typeof n === "number" && !isNaN(n) && n > 0) return n;
  }
  // Regex scan as fallback
  const m = raw?.match(/retryAfterMs["'\s:]+(\d+)/i);
  if (m) return parseInt(m[1], 10);
  if (headerRetryAfter) {
    const secs = parseInt(headerRetryAfter, 10);
    if (!isNaN(secs)) return secs * 1000;
  }
  return null;
}

function isRateLimitSignal(raw: string, parsed: any, status: number): boolean {
  if (status === 429) return true;
  const blob = JSON.stringify(parsed ?? "") + " " + (raw ?? "");
  return /RateLimit|rate.?limit|TOO_MANY|too many requests|quota/i.test(blob);
}

function getWebLink(data: Record<string, unknown>): string {
  const rawLink = typeof data.deepLink === "string" ? data.deepLink : typeof data.screen === "string" ? data.screen : "/";
  if (rawLink.startsWith("http://") || rawLink.startsWith("https://")) return rawLink;
  return `https://c24club.com${rawLink.startsWith("/") ? rawLink : `/${rawLink}`}`;
}

type PushResult = {
  ok: boolean;
  provider: "expo" | "fcm";
  reason?: string;
  clearToken?: boolean;
};

async function sendExpoPush(
  token: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<PushResult> {
  const channelId = typeof data.channelId === "string" ? data.channelId : "default";
  const maxAttempts = 4;
  let lastReason = "Expo push send failed";
  let lastClear = false;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const resp = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ to: token, title, body, data, sound: "default", priority: "high", channelId }),
    });
    const raw = await resp.text();
    let parsed: any = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = null; }
    const ticket = Array.isArray(parsed?.data) ? parsed.data[0] : parsed?.data;

    if (resp.ok && ticket?.status === "ok") return { ok: true, provider: "expo" };

    const expoError =
      ticket?.details?.error || parsed?.errors?.[0]?.code || parsed?.errors?.[0]?.message ||
      ticket?.message || raw || "Expo push send failed";
    lastReason = expoError;
    lastClear = expoError === "DeviceNotRegistered";

    const isRateLimited = isRateLimitSignal(raw, parsed, resp.status);
    if (!isRateLimited || attempt === maxAttempts) break;

    const retryAfter = extractRetryAfterMs(raw, parsed, resp.headers.get("retry-after"));
    const backoff = Math.min(retryAfter ?? 0, 60000) ||
      Math.min(1000 * 2 ** (attempt - 1), 8000) + Math.floor(Math.random() * 250);
    console.log(`[send-push] expo rate-limited, attempt ${attempt}/${maxAttempts}, waiting ${backoff}ms`);
    await sleep(backoff);
  }
  return { ok: false, provider: "expo", reason: lastReason, clearToken: lastClear };
}

async function sendFcmPush(
  token: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<PushResult> {
  const serviceAccount = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT")!);
  const accessToken = await getAccessToken(serviceAccount);
  const projectId = serviceAccount.project_id;
  const channelId = typeof data.channelId === "string" ? data.channelId : "default";
  const webLink = getWebLink(data);

  const payload = JSON.stringify({
    message: {
      token,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: "high", notification: { channel_id: channelId, sound: "default" } },
      apns: {
        payload: {
          aps: {
            alert: { title, body },
            sound: "default", badge: 0,
            "content-available": 1, "mutable-content": 1,
          },
        },
      },
      webpush: { fcm_options: { link: webLink } },
    },
  });

  const maxAttempts = 4;
  let lastReason = "FCM push send failed";
  let lastClear = false;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const fcmResp = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: payload,
    });
    const raw = await fcmResp.text();
    let fcmBody: any = null;
    try { fcmBody = raw ? JSON.parse(raw) : null; } catch { fcmBody = null; }

    if (fcmResp.ok) return { ok: true, provider: "fcm" };

    const errorCode = fcmBody?.error?.status;
    lastReason = fcmBody?.error?.message || raw || "FCM push send failed";
    lastClear = errorCode === "UNREGISTERED" || errorCode === "NOT_FOUND";

    const isRateLimited =
      fcmResp.status === 429 || errorCode === "RESOURCE_EXHAUSTED" || errorCode === "UNAVAILABLE" ||
      isRateLimitSignal(raw, fcmBody, fcmResp.status);
    if (!isRateLimited || attempt === maxAttempts) break;

    const retryAfter = extractRetryAfterMs(raw, fcmBody, fcmResp.headers.get("retry-after"));
    const backoff = Math.min(retryAfter ?? 0, 60000) ||
      Math.min(1000 * 2 ** (attempt - 1), 8000) + Math.floor(Math.random() * 250);
    console.log(`[send-push] fcm rate-limited (${errorCode || fcmResp.status}), attempt ${attempt}/${maxAttempts}, waiting ${backoff}ms`);
    await sleep(backoff);
  }
  return { ok: false, provider: "fcm", reason: lastReason, clearToken: lastClear };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { user_id, title, body, data = {}, notification_type, cooldown_minutes } = await req.json();

    if (!user_id || !title) {
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

    const normalizedData = typeof data === "object" && data !== null ? data as Record<string, unknown> : {};
    const result = isExpoPushToken(member.push_token)
      ? await sendExpoPush(member.push_token, title, body, normalizedData)
      : await sendFcmPush(member.push_token, title, body, normalizedData);

    if (!result.ok) {
      if (result.clearToken) {
        await supabaseAdmin.from("members").update({ push_token: null }).eq("id", user_id);
      }
      return new Response(JSON.stringify({ success: false, reason: result.reason, provider: result.provider }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (notification_type) {
      await supabaseAdmin.from("push_notification_log").upsert(
        { user_id, notification_type, last_sent_at: new Date().toISOString() },
        { onConflict: "user_id,notification_type" },
      );
    }

    return new Response(JSON.stringify({ success: true, provider: result.provider }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: unknown) {
    return new Response(JSON.stringify({ success: false, reason: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
