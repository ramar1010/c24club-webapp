import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHADOWBAN_THRESHOLD = 2; // # of distinct female reporters in window
const REPORT_WINDOW_HOURS = 24;
const SHADOWBAN_HOURS = 24;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const reporterId = userData.user?.id;
    if (!reporterId) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { reportedUserId, roomId, skipSeconds } = body ?? {};
    if (!reportedUserId || typeof reportedUserId !== "string") {
      return new Response(JSON.stringify({ error: "reportedUserId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (reportedUserId === reporterId) {
      return new Response(JSON.stringify({ error: "cannot report self" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Only female reporters count for fast-skip shadowban (gender-imbalanced safety)
    const { data: reporter } = await admin
      .from("members")
      .select("gender")
      .eq("id", reporterId)
      .maybeSingle();
    if (!reporter || reporter.gender?.toLowerCase() !== "female") {
      return new Response(JSON.stringify({ success: true, ignored: "not_female" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dedupe: skip if same reporter already reported same user in last 24h
    const sinceWindow = new Date(Date.now() - REPORT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const { data: existing } = await admin
      .from("fast_skip_reports")
      .select("id")
      .eq("reporter_id", reporterId)
      .eq("reported_user_id", reportedUserId)
      .gte("created_at", sinceWindow)
      .limit(1);

    if (!existing || existing.length === 0) {
      await admin.from("fast_skip_reports").insert({
        reporter_id: reporterId,
        reported_user_id: reportedUserId,
        room_id: roomId ?? null,
        skip_seconds: typeof skipSeconds === "number" ? skipSeconds : null,
      });
    }

    // Count distinct reporters in window
    const { data: reports } = await admin
      .from("fast_skip_reports")
      .select("reporter_id")
      .eq("reported_user_id", reportedUserId)
      .gte("created_at", sinceWindow);

    const distinctReporters = new Set((reports ?? []).map((r) => r.reporter_id));

    let shadowbanned = false;
    if (distinctReporters.size >= SHADOWBAN_THRESHOLD) {
      // Check active ban first to avoid stacking
      const { data: activeBan } = await admin
        .from("user_bans")
        .select("id")
        .eq("user_id", reportedUserId)
        .eq("is_active", true)
        .limit(1);

      if (!activeBan || activeBan.length === 0) {
        const expiresAt = new Date(Date.now() + SHADOWBAN_HOURS * 60 * 60 * 1000).toISOString();
        await admin.from("user_bans").insert({
          user_id: reportedUserId,
          reason: "Multiple female users flagged behavior as inappropriate",
          ban_type: "shadow_24h",
          ban_source: "fast_skip_auto",
          is_active: true,
          expires_at: expiresAt,
        });
        shadowbanned = true;
      }
    }

    return new Response(
      JSON.stringify({ success: true, shadowbanned, reporters: distinctReporters.size }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});