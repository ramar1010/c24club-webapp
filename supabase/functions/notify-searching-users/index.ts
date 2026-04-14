import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Get the most recent queue entry to determine who just joined
    const { data: queueRows, error: queueErr } = await supabaseAdmin
      .from("waiting_queue")
      .select("member_id, member_gender, gender_preference")
      .order("created_at", { ascending: false })
      .limit(1);

    if (queueErr) {
      return new Response(JSON.stringify({ success: false, reason: queueErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!queueRows || queueRows.length === 0) {
      return new Response(JSON.stringify({ success: true, notified: 0, reason: "Queue is empty" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const joiner = queueRows[0];
    const joinerGender = (joiner.member_gender || "").toLowerCase();

    // Determine which gender to notify (opposite of the joiner)
    // If a male joins → notify females; if a female joins → notify males
    let targetGender: string | null = null;
    if (joinerGender === "male") {
      targetGender = "female";
    } else if (joinerGender === "female") {
      targetGender = "male";
    }

    // 2. Find eligible users (inactive 30min–24h, notifications on, opposite gender)
    const now = new Date();
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // Get users currently in active rooms to exclude
    const { data: activeRoomMembers } = await supabaseAdmin
      .from("rooms")
      .select("member1, member2")
      .eq("status", "active");

    const activeMemberIds = new Set<string>();
    if (activeRoomMembers) {
      for (const room of activeRoomMembers) {
        if (room.member1) activeMemberIds.add(room.member1);
        if (room.member2) activeMemberIds.add(room.member2);
      }
    }

    let query = supabaseAdmin
      .from("members")
      .select("id, gender")
      .eq("notify_enabled", true)
      .lt("last_active_at", thirtyMinAgo)
      .gt("last_active_at", twentyFourHoursAgo)
      .not("push_token", "is", null);

    // Apply gender filter — only notify the opposite gender
    if (targetGender) {
      query = query.ilike("gender", targetGender);
    }

    const { data: candidates, error: candidateErr } = await query.limit(100);

    if (candidateErr) {
      return new Response(JSON.stringify({ success: false, reason: candidateErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ success: true, notified: 0, reason: "No eligible users", targetGender }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Filter out users already in active rooms
    const eligibleUsers = candidates.filter((c) => !activeMemberIds.has(c.id));

    if (eligibleUsers.length === 0) {
      return new Response(JSON.stringify({ success: true, notified: 0, reason: "All candidates are in active rooms" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Send gender-appropriate push notifications
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    let notified = 0;

    // Tailor message based on who's searching
    const notifTitle = joinerGender === "male"
      ? "🟢 A guy is looking to chat!"
      : joinerGender === "female"
        ? "🟢 A girl is looking to chat!"
        : "🟢 Someone is searching for a chat!";

    const notifBody = "Join now and get matched instantly.";

    for (const user of eligibleUsers) {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            user_id: user.id,
            title: notifTitle,
            body: notifBody,
            data: { screen: "videocall" },
            notification_type: "searching_users",
            cooldown_minutes: 2,
          }),
        });
        const result = await resp.json();
        if (result.success) notified++;
      } catch (e) {
        console.error(`Failed to notify ${user.id}:`, e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      notified,
      total_candidates: eligibleUsers.length,
      joiner_gender: joinerGender,
      target_gender: targetGender,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    return new Response(JSON.stringify({ success: false, reason: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
