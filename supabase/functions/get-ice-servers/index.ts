const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STUN_FALLBACK = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const host = Deno.env.get("METERED_TURN_HOST");
  const username = Deno.env.get("METERED_TURN_USERNAME");
  const credential = Deno.env.get("METERED_TURN_CREDENTIAL");

  const iceServers: RTCIceServer[] = [...STUN_FALLBACK];

  if (host && username && credential) {
    // Strip protocol if user pasted full URL
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

  return new Response(
    JSON.stringify({ iceServers }),
    {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
      status: 200,
    },
  );
});