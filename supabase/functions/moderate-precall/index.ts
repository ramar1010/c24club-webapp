import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function classify(lovableKey: string, contentParts: any[]): Promise<{ flagged: boolean; reason?: string; score?: number }> {
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
            'You are an image moderation classifier. Respond ONLY with strict JSON: {"nudity":0-1,"sexual_activity":0-1,"gore":0-1,"offensive":0-1}. No prose.',
        },
        { role: "user", content: contentParts },
      ],
      temperature: 0,
    }),
  });

  if (!aiRes.ok) {
    console.error("AI error:", await aiRes.text());
    return { flagged: false };
  }
  const aiJson = await aiRes.json();
  const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
  let scores: Record<string, number> = {};
  try {
    scores = JSON.parse(String(raw).replace(/```json|```/g, "").trim());
  } catch {
    return { flagged: false };
  }
  const all = {
    nudity: Number(scores?.nudity ?? 0),
    sexual_activity: Number(scores?.sexual_activity ?? 0),
    gore: Number(scores?.gore ?? 0),
    offensive: Number(scores?.offensive ?? 0),
  };
  const flagged = all.nudity > 0.7 || all.sexual_activity > 0.5 || all.gore > 0.7 || all.offensive > 0.7;
  if (!flagged) return { flagged: false };
  const top = Object.entries(all).sort((a, b) => b[1] - a[1])[0];
  return { flagged: true, reason: top[0], score: top[1] };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const lovableKey = Deno.env.get("LOVABLE_API_KEY") ?? "";

    if (!lovableKey) {
      return new Response(JSON.stringify({ flagged: false, error: "LOVABLE_API_KEY missing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user?.id) throw new Error("Not authenticated");

    const { frame, selfie_url } = await req.json();

    let frameResult: { flagged: boolean; reason?: string; score?: number } = { flagged: false };
    if (frame) {
      frameResult = await classify(lovableKey, [
        { type: "text", text: "Classify this live camera preview. JSON only." },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${frame}` } },
      ]);
    }

    let selfieResult: { flagged: boolean; reason?: string; score?: number } = { flagged: false };
    if (selfie_url) {
      selfieResult = await classify(lovableKey, [
        { type: "text", text: "Classify this profile selfie. JSON only." },
        { type: "image_url", image_url: { url: selfie_url } },
      ]);
    }

    const flagged = frameResult.flagged || selfieResult.flagged;
    const source = frameResult.flagged ? "preview" : selfieResult.flagged ? "selfie" : null;
    const reason = frameResult.flagged ? frameResult.reason : selfieResult.reason;

    if (!flagged) {
      return new Response(JSON.stringify({ flagged: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: mm } = await supabaseAdmin
      .from("member_minutes")
      .select("id, nsfw_strikes")
      .eq("user_id", user.id)
      .maybeSingle();
    const newStrikes = Math.max(0, Number(mm?.nsfw_strikes ?? 0)) + 1;
    if (mm?.id) {
      await supabaseAdmin.from("member_minutes").update({ nsfw_strikes: newStrikes }).eq("id", mm.id);
    } else {
      await supabaseAdmin.from("member_minutes").insert({ user_id: user.id, nsfw_strikes: newStrikes });
    }

    await supabaseAdmin.from("user_reports").insert({
      reporter_id: user.id,
      reported_user_id: user.id,
      reason: "AI_PRECALL_BLOCK",
      details: `Pre-call ${source} flagged: ${reason}`,
    });

    console.log(`moderate-precall blocked ${user.id} via ${source} (${reason}) — strike #${newStrikes}`);

    return new Response(
      JSON.stringify({ flagged: true, source, reason, strikes: newStrikes }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("moderate-precall error:", err.message);
    return new Response(JSON.stringify({ flagged: false, error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
