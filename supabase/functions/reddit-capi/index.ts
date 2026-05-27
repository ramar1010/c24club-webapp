// Reddit Conversions API (CAPI) mirror endpoint.
// Receives event payloads from the browser, hashes PII, and forwards
// to Reddit's server-side conversions endpoint. Uses the same
// conversionId as the browser pixel so Reddit deduplicates.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const PIXEL_ID = "t2_80vn1q03";
const REDDIT_ENDPOINT = `https://ads-api.reddit.com/api/v3/pixels/${PIXEL_ID}/conversion_events`;

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getClientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const token = Deno.env.get("REDDIT_CAPI_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ error: "REDDIT_CAPI_TOKEN not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const {
    event,
    conversionId,
    value,
    currency,
    itemCount,
    customEventName,
    email,
    externalId,
    clickId,
    screen,
    url,
    referrer,
    userAgent,
  } = body ?? {};

  if (!event || typeof event !== "string") {
    return new Response(JSON.stringify({ error: "Missing event" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ip = getClientIp(req);
  const ua = userAgent || req.headers.get("user-agent") || undefined;

  const user: Record<string, any> = {};
  if (email) user.email = await sha256(String(email));
  if (externalId) user.external_id = await sha256(String(externalId));
  if (ip) user.ip_address = ip;
  if (ua) user.user_agent = ua;
  if (screen && typeof screen === "object" && screen.width && screen.height) {
    user.screen_dimensions = {
      width: Number(screen.width),
      height: Number(screen.height),
    };
  }

  const isCustom = event === "Custom";
  const eventObj: Record<string, any> = {
    event_at: Date.now(), // Unix epoch ms (must be <7 days old)
    action_source: "website",
    type: isCustom && customEventName
      ? { tracking_type: "CUSTOM", custom_event_name: customEventName }
      : { tracking_type: event },
    ...(clickId ? { click_id: String(clickId) } : {}),
    event_metadata: {
      conversion_id: conversionId,
      ...(value != null ? { value: Number(value), value_decimal: Number(value) } : {}),
      ...(currency ? { currency } : {}),
      ...(itemCount != null ? { item_count: Number(itemCount) } : {}),
      ...(url ? { conversion_url: url } : {}),
      ...(referrer ? { referrer } : {}),
    },
    user,
  };

  const payload = { data: { events: [eventObj] } };

  try {
    const resp = await fetch(REDDIT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    if (!resp.ok) {
      console.error("Reddit CAPI error", resp.status, text);
      return new Response(
        JSON.stringify({ ok: false, status: resp.status, body: text }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true, response: text }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Reddit CAPI fetch failed", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});