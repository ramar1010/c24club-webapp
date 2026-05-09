import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const lovableKey = Deno.env.get("LOVABLE_API_KEY") ?? "";

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user?.id) throw new Error("Not authenticated");

    const { image_url } = await req.json();
    if (!image_url) throw new Error("Missing image_url");

    if (!lovableKey) {
      return new Response(
        JSON.stringify({ flagged: false, error: "LOVABLE_API_KEY not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are an image moderation classifier. Respond ONLY with strict JSON: {\"nudity\":0-1,\"sexual_activity\":0-1,\"gore\":0-1,\"offensive\":0-1}. No prose.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Classify this profile selfie. Output JSON only." },
              { type: "image_url", image_url: { url: image_url } },
            ],
          },
        ],
        temperature: 0,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("Lovable AI error:", errText);
      return new Response(
        JSON.stringify({ flagged: false, error: "AI moderation error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let scores: Record<string, number> = {};
    try {
      const cleaned = String(raw).replace(/```json|```/g, "").trim();
      scores = JSON.parse(cleaned);
    } catch {
      scores = {};
    }

    const nudity = Number(scores?.nudity ?? 0);
    const sexual = Number(scores?.sexual_activity ?? 0);
    const gore = Number(scores?.gore ?? 0);
    const offensive = Number(scores?.offensive ?? 0);

    const isFlagged = nudity > 0.7 || sexual > 0.5 || gore > 0.7 || offensive > 0.7;

    if (!isFlagged) {
      return new Response(
        JSON.stringify({ flagged: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const allScores = { nudity, sexual_activity: sexual, gore, offensive };
    const topReason = Object.entries(allScores).sort((a, b) => b[1] - a[1])[0][0];

    // Reject the selfie: mark denied + remove from discover. NO BAN.
    await supabaseAdmin.from("members").update({
      image_status: "denied",
      is_discoverable: false,
    } as any).eq("id", user.id);

    await supabaseAdmin.from("user_reports").insert({
      reporter_id: user.id,
      reported_user_id: user.id,
      reason: "AI_AUTO_MODERATION_SELFIE",
      details: `Selfie auto-detected: ${topReason} (score: ${(allScores as any)[topReason].toFixed(2)}). URL: ${image_url}`,
    });

    console.log(`moderate-selfie rejected selfie for ${user.id} (${topReason}) — no ban`);

    return new Response(
      JSON.stringify({ flagged: true, reason: topReason, score: (allScores as any)[topReason], banned: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    console.error("moderate-selfie error:", err.message);
    return new Response(
      JSON.stringify({ flagged: false, error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
