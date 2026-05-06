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
    const sightengineUser = Deno.env.get("SIGHTENGINE_API_USER") ?? "";
    const sightengineSecret = Deno.env.get("SIGHTENGINE_API_SECRET") ?? "";

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user?.id) throw new Error("Not authenticated");

    const { image_url } = await req.json();
    if (!image_url) throw new Error("Missing image_url");

    if (!sightengineUser || !sightengineSecret) {
      return new Response(
        JSON.stringify({ flagged: false, error: "Sightengine not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Ask Sightengine to fetch the URL directly
    const params = new URLSearchParams({
      url: image_url,
      models: "nudity-2.0,offensive,gore",
      api_user: sightengineUser,
      api_secret: sightengineSecret,
    });

    const moderationRes = await fetch(`https://api.sightengine.com/1.0/check.json?${params.toString()}`);

    if (!moderationRes.ok) {
      const errText = await moderationRes.text();
      console.error("Sightengine error:", errText);
      return new Response(
        JSON.stringify({ flagged: false, error: "Sightengine API error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const result = await moderationRes.json();

    const nudityActivity = result?.nudity?.sexual_activity ?? 0;
    const nudityDisplay = result?.nudity?.sexual_display ?? 0;
    const nudityVeryS = result?.nudity?.very_suggestive ?? 0;
    const offensive = result?.offensive?.prob ?? 0;
    const gore = result?.gore?.prob ?? 0;

    const isFlagged =
      nudityActivity > 0.5 ||
      nudityDisplay > 0.5 ||
      nudityVeryS > 0.7 ||
      offensive > 0.7 ||
      gore > 0.7;

    if (!isFlagged) {
      return new Response(
        JSON.stringify({ flagged: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const scores: Record<string, number> = {
      nudity_sexual_activity: nudityActivity,
      nudity_sexual_display: nudityDisplay,
      nudity_very_suggestive: nudityVeryS,
      offensive: offensive,
      gore: gore,
    };
    const topReason = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];

    // Mark selfie as denied + remove from discover
    await supabaseAdmin.from("members").update({
      image_status: "denied",
      is_discoverable: false,
    } as any).eq("id", user.id);

    // Log report
    await supabaseAdmin.from("user_reports").insert({
      reporter_id: user.id,
      reported_user_id: user.id,
      reason: "AI_AUTO_MODERATION_SELFIE",
      details: `Selfie auto-detected: ${topReason} (score: ${scores[topReason].toFixed(2)}). URL: ${image_url}`,
    });

    // Check existing ban
    const { data: existingBan } = await supabaseAdmin
      .from("user_bans")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (existingBan) {
      return new Response(
        JSON.stringify({ flagged: true, reason: topReason, score: scores[topReason], banned: true, alreadyBanned: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Increment NSFW strikes (shared with videocall moderation)
    const { data: mm } = await supabaseAdmin
      .from("member_minutes")
      .select("id, nsfw_strikes")
      .eq("user_id", user.id)
      .maybeSingle();

    const currentStrikes = Math.max(0, Number(mm?.nsfw_strikes ?? 0));
    const newStrikes = Math.min(3, currentStrikes + 1);
    const strikePayload = { nsfw_strikes: newStrikes };
    if (mm?.id) {
      await supabaseAdmin.from("member_minutes").update(strikePayload).eq("id", mm.id);
    } else {
      await supabaseAdmin.from("member_minutes").insert({ user_id: user.id, ...strikePayload });
    }
    console.log(`moderate-selfie strike ${newStrikes}/3 for ${user.id} (${topReason})`);

    let banned = false;
    if (newStrikes >= 3) {
      const { data: memberData } = await supabaseAdmin
        .from("members")
        .select("last_ip")
        .eq("id", user.id)
        .maybeSingle();

      const { error: banError } = await supabaseAdmin.from("user_bans").insert({
        user_id: user.id,
        reason: `Automated NSFW selfie upload (3 strikes — last: ${topReason})`,
        ban_type: "standard",
        is_active: true,
        ip_address: memberData?.last_ip ?? null,
        ban_source: "selfie_upload",
      });

      if (!banError) {
        banned = true;
        if (mm?.id) {
          await supabaseAdmin.from("member_minutes").update({ nsfw_strikes: 0 }).eq("id", mm.id);
        }
        console.log(`moderate-selfie banned ${user.id} after 3 strikes`);
      } else {
        console.error("Failed to insert ban:", banError.message);
      }
    }

    return new Response(
      JSON.stringify({ flagged: true, reason: topReason, score: scores[topReason], strikes: banned ? 0 : newStrikes, banned }),
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