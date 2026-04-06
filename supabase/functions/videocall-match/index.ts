import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { type, memberId, channelId, genderPreference, memberGender, partnerId, voiceMode } = await req.json();

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
        const { data: maleUsers } = await supabase
          .from("members")
          .select("id")
          .ilike("gender", "male")
          .eq("notify_enabled", true)
          .gt("last_active_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .limit(100);

        if (maleUsers && maleUsers.length > 0) {
          Promise.all(
            maleUsers.map((user) =>
              supabase.functions.invoke("send-push-notification", {
                body: {
                  user_id: user.id,
                  title: "🔥 A girl is looking for a video chat!",
                  body: "Hurry before she leaves — tap to join now!",
                  data: { deepLink: "/(tabs)/chat" },
                  notification_type: "female_searching",
                  cooldown_minutes: 60,
                },
              }),
            ),
          ).catch(console.error);
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
          .select("id, male_search_notify_mode, push_token")
          .eq("gender", "female")
          .eq("notify_enabled", true)
          .neq("male_search_notify_mode", "off");

        if (femaleUsers && femaleUsers.length > 0) {
          const everyUsers = femaleUsers.filter(
            (f) => f.male_search_notify_mode === "every" && !activeIds.has(f.id) && f.push_token,
          );
          const batchedUsers = femaleUsers.filter(
            (f) => f.male_search_notify_mode === "batched" && !activeIds.has(f.id),
          );

          if (everyUsers.length > 0) {
            Promise.all(
              everyUsers.map((user) =>
                supabase.functions.invoke("send-push-notification", {
                  body: {
                    user_id: user.id,
                    title: "💬 A guy is looking for a video chat!",
                    body: "Tap to join and start chatting now!",
                    data: { deepLink: "/(tabs)/chat" },
                    notification_type: "male_search_every",
                    cooldown_minutes: 5,
                  },
                }),
              ),
            ).catch(console.error);
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
