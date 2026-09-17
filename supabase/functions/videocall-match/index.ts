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

      // ── Matching with male↔male suppression ──
      // Guys matching guys is the #1 reason new male users bounce. We only allow a
      // male↔male pairing once the queued male has been waiting a while, so the
      // room never feels dead but the default experience stays opposite-gender.
      const MM_MIN_WAIT_SECONDS = 45;
      const myGender = (memberGender ?? "").toLowerCase();
      const oppositeGender = myGender === "female" ? "male" : "female";

      const pickFromQueue = async (gender: string | null) => {
        let q = supabase
          .from("waiting_queue")
          .select("*")
          .neq("member_id", memberId)
          .order("created_at", { ascending: true })
          .limit(1);
        if (gender) q = q.ilike("member_gender", gender);
        const { data } = await q;
        return data && data.length > 0 ? data[0] : null;
      };

      let partnerRow: any = null;

      // 1) Honour an explicit VIP gender preference first.
      if (genderPreference === "Male" || genderPreference === "Female") {
        partnerRow = await pickFromQueue(genderPreference);
      }

      // 2) Default: prefer the opposite gender.
      if (!partnerRow) {
        partnerRow = await pickFromQueue(oppositeGender);
      }

      // 3) Same-gender fallback — suppressed for male↔male unless the queued guy
      //    has already waited MM_MIN_WAIT_SECONDS.
      if (!partnerRow) {
        const sameGenderRow = await pickFromQueue(null);
        if (sameGenderRow) {
          const rowGender = (sameGenderRow.member_gender ?? "").toLowerCase();
          const isMaleMale = myGender === "male" && rowGender === "male";
          const waitedSeconds = sameGenderRow.created_at
            ? (Date.now() - new Date(sameGenderRow.created_at).getTime()) / 1000
            : 0;
          if (!isMaleMale || waitedSeconds >= MM_MIN_WAIT_SECONDS) {
            partnerRow = sameGenderRow;
          } else {
            console.log(JSON.stringify({
              tag: "mm_suppressed",
              joiner: memberId,
              queued: sameGenderRow.member_id,
              waited_seconds: Math.round(waitedSeconds),
            }));
          }
        }
      }

      const matches = partnerRow ? [partnerRow] : [];

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

      // 🔔 Push fan-outs disabled: "searching" pushes (female_searching,
      // male_search_every, batched male-search counts, match-notify) were
      // re-engaging users while the app is closed. Queue insert above is kept
      // so in-app matching still works.
      console.log(JSON.stringify({ tag: "searching_pushes_disabled", joiner: memberId, memberGender }));

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
