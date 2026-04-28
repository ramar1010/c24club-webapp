const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STUN_FALLBACK = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const iceServers: RTCIceServer[] = [...STUN_FALLBACK];

  // --- Cloudflare TURN (preferred) ---
  // Fetches per-session ephemeral credentials valid for 1 hour.
  const cfTokenId = Deno.env.get("CLOUDFLARE_TURN_TOKEN_ID");
  const cfApiToken = Deno.env.get("CLOUDFLARE_TURN_API_TOKEN");

  if (cfTokenId && cfApiToken) {
    try {
      const resp = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${cfTokenId}/credentials/generate-ice-servers`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cfApiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ttl: 3600 }),
        },
      );

      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data?.iceServers)) {
          // Cloudflare returns { iceServers: [{ urls: [...], username, credential }] }
          for (const srv of data.iceServers) {
            iceServers.push(srv);
          }
        } else if (data?.iceServers && typeof data.iceServers === "object") {
          iceServers.push(data.iceServers);
        }
      } else {
        const errText = await resp.text();
        console.error("[get-ice-servers] Cloudflare TURN error:", resp.status, errText);
      }
    } catch (e) {
      console.error("[get-ice-servers] Cloudflare fetch failed:", e);
    }
  } else {
    // --- Legacy Metered fallback (only if Cloudflare not configured) ---
    const host = Deno.env.get("METERED_TURN_HOST");
    const username = Deno.env.get("METERED_TURN_USERNAME");
    const credential = Deno.env.get("METERED_TURN_CREDENTIAL");

    if (host && username && credential) {
      const cleanHost = host
        .replace(/^stun:|^turn:|^turns:/i, "")
        .replace(/^https?:\/\//i, "")
        .replace(/\/$/, "");

      iceServers.push(
        { urls: `stun:${cleanHost}:80` },
        { urls: `turn:${cleanHost}:80`, username, credential },
        { urls: `turn:${cleanHost}:80?transport=tcp`, username, credential },
        { urls: `turn:${cleanHost}:443`, username, credential },
        { urls: `turns:${cleanHost}:443?transport=tcp`, username, credential },
      );
    }
  }

  return new Response(
    JSON.stringify({ iceServers }),
    {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        // Don't cache — credentials are per-session.
        "Cache-Control": "no-store",
      },
      status: 200,
    },
  );
});