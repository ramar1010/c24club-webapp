import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Send push fan-out in small chunks to stay under the Edge Functions invoke
// rate limit. Without chunking, a 30+ user fanout fires all calls in parallel
// and the first chunk fails with RateLimitError (silently dropped) — that's
// why some Android users (and anyone early in the list) miss notifications
// while users later in the list see "Cooldown active" from the backup path.
async function chunkedPushFanout(
  supabase: ReturnType<typeof createClient>,
  users: Array<{ id: string }>,
  notification_type: string,
  opts: { title: string; body: string; cooldown_minutes: number },
) {
  const CHUNK = 5;
  const DELAY_MS = 350;
  const MAX_ATTEMPTS = 4;

  const isRateLimited = (r: any): { limited: boolean; retryAfterMs: number | null } => {
    const blob = JSON.stringify(r ?? "");
    const m = blob.match(/retryAfterMs["'\s:]+(\d+)/i);
    const limited = /RateLimit|rate.?limit|TOO_MANY|429|RESOURCE_EXHAUSTED/i.test(blob);
    return { limited, retryAfterMs: m ? parseInt(m[1], 10) : null };
  };

  const invokeWithRetry = async (userId: string) => {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let r: any;
      try {
        r = await supabase.functions.invoke("send-push-notification", {
          body: {
            user_id: userId,
            title: opts.title,
            body: opts.body,
            data: { deepLink: "/(tabs)/chat" },
            notification_type,
            cooldown_minutes: opts.cooldown_minutes,
          },
        });
      } catch (err) {
        r = { error: String(err) };
      }
      const errPayload = r?.error ?? r?.data;
      const { limited, retryAfterMs } = isRateLimited(errPayload);
      const success = r?.data && !r?.error && r?.data?.success !== false;
      const skipped = r?.data?.skipped === true;

      if (success || skipped || !limited || attempt === MAX_ATTEMPTS) {
        console.log(
          JSON.stringify({
            tag: "fanout_push_result",
            type: notification_type,
            user: userId,
            attempt,
            result: r?.data ?? r?.error ?? null,
          }),
        );
        return r;
      }

      const backoff = Math.min(retryAfterMs ?? 0, 60000) ||
        Math.min(1000 * 2 ** (attempt - 1), 8000) + Math.floor(Math.random() * 250);
      console.log(
        JSON.stringify({
          tag: "fanout_rate_limited_retry",
          type: notification_type,
          user: userId,
          attempt,
          backoff_ms: backoff,
        }),
      );
      await new Promise((res) => setTimeout(res, backoff));
    }
  };

  for (let i = 0; i < users.length; i += CHUNK) {
    const slice = users.slice(i, i + CHUNK);
    await Promise.all(slice.map((u) => invokeWithRetry(u.id)));
    if (i + CHUNK < users.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { type, memberId, channelId, genderPreference, memberGender, partnerId, voiceMode } = await req.json();

    // Helper: did this user open the app from a push notification in the last 10 minutes?
    const fromPushFor = async (uid: string | null | undefined): Promise<boolean> => {
      if (!uid) return false;
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("push_open_events")
        .select("id")
        .eq("user_id", uid)
        .gte("opened_at", since)
        .limit(1);
      return !!(data && data.length > 0);
    };

    if (type === "join") {
      await supabase.from("waiting_queue").delete().eq("member_id", memberId);

      const { data: directInvites } = await supabase
        .from("direct_call_invites")
        .select("*")
        .or(`inviter_id.eq.${memberId},invitee_id.eq.${memberId}`)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

      if (directInvites && directInvites.length > 0) {
        const invite = directInvites[0];
        const directPartnerId = invite.inviter_id === memberId ? invite.invitee_id : invite.inviter_id;

        const { data: partnerInQueue } = await supabase
          .from("waiting_queue")
          .select("*")
          .eq("member_id", directPartnerId)
          .limit(1);

        if (partnerInQueue && partnerInQueue.length > 0) {
          const partner = partnerInQueue[0];
          await supabase.from("waiting_queue").delete().eq("id", partner.id);
          await supabase.from("direct_call_invites").update({ status: "matched" }).eq("id", invite.id);

          const roomId = crypto.randomUUID();
          const [m1FromPush, m2FromPush] = await Promise.all([
            fromPushFor(partner.member_id),
            fromPushFor(memberId),
          ]);
          await supabase.from("rooms").insert({
            id: roomId,
            member1: partner.member_id,
            member2: memberId,
            channel1: partner.channel_id,
            channel2: channelId,
            member1_gender: partner.member_gender,
            member2_gender: memberGender,
            member1_voice_mode: partner.voice_mode ?? false,
            member2_voice_mode: voiceMode ?? false,
            status: "connected",
            connected_at: new Date().toISOString(),
            member1_from_push: m1FromPush,
            member2_from_push: m2FromPush,
          });

          return new Response(
            JSON.stringify({
              success: true,
              message: "partner_found",
              roomId,
              partnerId: partner.member_id,
              partnerChannelId: partner.channel_id,
              partnerVoiceMode: partner.voice_mode ?? false,
              partnerGender: partner.member_gender ?? null,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      let query = supabase
        .from("waiting_queue")
        .select("*")
        .neq("member_id", memberId)
        .order("created_at", { ascending: true })
        .limit(1);

      if (genderPreference === "Male" || genderPreference === "Female") {
        query = query.eq("member_gender", genderPreference);
      }

      let { data: matches } = await query;

      if ((!matches || matches.length === 0) && genderPreference !== "Both") {
        const { data: anyMatches } = await supabase
          .from("waiting_queue")
          .select("*")
          .neq("member_id", memberId)
          .order("created_at", { ascending: true })
          .limit(1);
        matches = anyMatches;
      }

      if (matches && matches.length > 0) {
        const partner = matches[0];
        await supabase.from("waiting_queue").delete().eq("id", partner.id);

        const roomId = crypto.randomUUID();
        const [m1FromPush, m2FromPush] = await Promise.all([
          fromPushFor(partner.member_id),
          fromPushFor(memberId),
        ]);
        await supabase.from("rooms").insert({
          id: roomId,
          member1: partner.member_id,
          member2: memberId,
          channel1: partner.channel_id,
          channel2: channelId,
          member1_gender: partner.member_gender,
          member2_gender: memberGender,
          member1_voice_mode: partner.voice_mode ?? false,
          member2_voice_mode: voiceMode ?? false,
          status: "connected",
          connected_at: new Date().toISOString(),
          member1_from_push: m1FromPush,
          member2_from_push: m2FromPush,
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: "partner_found",
            roomId,
            partnerId: partner.member_id,
            partnerChannelId: partner.channel_id,
            partnerVoiceMode: partner.voice_mode ?? false,
            partnerGender: partner.member_gender ?? null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // No match — add to queue
      await supabase.from("waiting_queue").insert({
        member_id: memberId,
        channel_id: channelId,
        gender_preference: genderPreference || "Both",
        member_gender: memberGender,
        voice_mode: voiceMode ?? false,
      });

      // 🔔 Female joined — notify eligible male users
      if (memberGender?.toLowerCase() === "female") {
        const { data: activeRoomsM } = await supabase.from("rooms").select("member1, member2").eq("status", "active");
        const activeIdsM = new Set<string>();
        if (activeRoomsM) {
          for (const r of activeRoomsM) {
            if (r.member1) activeIdsM.add(r.member1);
            if (r.member2) activeIdsM.add(r.member2);
          }
        }

        const { data: maleUsers } = await supabase
          .from("members")
          .select("id, name, push_token, last_active_at")
          .ilike("gender", "male")
          .eq("notify_enabled", true)
          .eq("is_test_account", false)
          .not("push_token", "is", null)
          .neq("id", memberId)
          .order("last_active_at", { ascending: false, nullsFirst: false })
          .limit(500);

        const eligibleMales = (maleUsers ?? []).filter((u) => !activeIdsM.has(u.id) && u.push_token);
        const excludedActive = (maleUsers ?? []).filter((u) => activeIdsM.has(u.id)).map((u) => u.id);
        console.log(JSON.stringify({
          tag: "fanout_female_joined",
          joiner: memberId,
          candidates: maleUsers?.length ?? 0,
          eligible: eligibleMales.length,
          excluded_active: excludedActive.length,
          eligible_ids: eligibleMales.map((u) => u.id),
        }));

        if (eligibleMales.length > 0) {
          chunkedPushFanout(supabase, eligibleMales, "female_searching", {
            title: "🔥 A girl is looking for a video chat!",
            body: "Hurry before she leaves — tap to join now!",
            cooldown_minutes: 2,
          }).catch(console.error);
        }
      }

      // 🔔 Male joined — notify eligible female users
      if (memberGender?.toLowerCase() === "male") {
        const { data: activeRooms } = await supabase.from("rooms").select("member1, member2").eq("status", "active");

        const activeIds = new Set<string>();
        if (activeRooms) {
          for (const r of activeRooms) {
            if (r.member1) activeIds.add(r.member1);
            if (r.member2) activeIds.add(r.member2);
          }
        }

        const { data: femaleUsers } = await supabase
          .from("members")
          .select("id, name, male_search_notify_mode, push_token, last_active_at")
          .ilike("gender", "female")
          .eq("notify_enabled", true)
          .eq("is_test_account", false)
          .neq("male_search_notify_mode", "off")
          .order("last_active_at", { ascending: false, nullsFirst: false })
          .limit(500);

        if (femaleUsers && femaleUsers.length > 0) {
          const everyUsers = femaleUsers.filter(
            (f) => f.male_search_notify_mode === "every" && !activeIds.has(f.id) && f.push_token,
          );
          const batchedUsers = femaleUsers.filter(
            (f) => f.male_search_notify_mode === "batched" && !activeIds.has(f.id),
          );
          console.log(JSON.stringify({
            tag: "fanout_male_joined",
            joiner: memberId,
            candidates: femaleUsers.length,
            every: everyUsers.length,
            batched: batchedUsers.length,
            excluded_active: femaleUsers.filter((f) => activeIds.has(f.id)).length,
            every_ids: everyUsers.map((u) => u.id),
          }));

          if (everyUsers.length > 0) {
            chunkedPushFanout(supabase, everyUsers, "male_search_every", {
              title: "💬 Money Awaits - A guy is looking to video chat!",
              body: "Tap to join and start chatting now!",
              cooldown_minutes: 5,
            }).catch(console.error);
          }

          if (batchedUsers.length > 0) {
            Promise.all(
              batchedUsers.map((user) => supabase.rpc("increment_male_search_count", { p_female_id: user.id })),
            ).catch(console.error);
          }
        }
      }

      fetch(`${supabaseUrl}/functions/v1/match-notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ memberId, memberGender }),
      }).catch((err) => console.warn("match-notify fire failed:", err));

      return new Response(JSON.stringify({ success: true, message: "added_to_queue" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "disconnect") {
      await supabase
        .from("rooms")
        .update({ status: "disconnected", disconnected_at: new Date().toISOString() })
        .or(`and(member1.eq.${memberId}),and(member2.eq.${memberId})`)
        .eq("status", "connected");

      await supabase.from("waiting_queue").delete().eq("member_id", memberId);

      return new Response(JSON.stringify({ success: true, message: "disconnected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "poll") {
      const [{ data: r1 }, { data: r2 }] = await Promise.all([
        supabase
          .from("rooms")
          .select("*")
          .eq("member1", memberId)
          .eq("status", "connected")
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("rooms")
          .select("*")
          .eq("member2", memberId)
          .eq("status", "connected")
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      const room = r1?.[0] || r2?.[0];
      return new Response(JSON.stringify({ success: true, room: room || null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "leave_queue") {
      await supabase.from("waiting_queue").delete().eq("member_id", memberId);
      return new Response(JSON.stringify({ success: true, message: "removed_from_queue" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, message: "Unknown type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
