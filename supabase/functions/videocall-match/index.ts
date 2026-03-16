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

    // JOIN: Try to find a match or add to queue
    if (type === "join") {
      // First remove any stale entries for this member
      await supabase
        .from("waiting_queue")
        .delete()
        .eq("member_id", memberId);

      // Check for pending direct call invites first
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

        // Check if partner is already in the waiting queue
        const { data: partnerInQueue } = await supabase
          .from("waiting_queue")
          .select("*")
          .eq("member_id", directPartnerId)
          .limit(1);

        if (partnerInQueue && partnerInQueue.length > 0) {
          const partner = partnerInQueue[0];

          // Remove partner from queue
          await supabase.from("waiting_queue").delete().eq("id", partner.id);

          // Mark invite as matched
          await supabase.from("direct_call_invites").update({ status: "matched" }).eq("id", invite.id);

          // Create a room
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
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        // Partner not in queue yet — fall through to add to queue, they'll be matched when partner joins
      }

      // Try to find a match based on gender preference
      let query = supabase
        .from("waiting_queue")
        .select("*")
        .neq("member_id", memberId)
        .order("created_at", { ascending: true })
        .limit(1);

      // Apply gender filter
      if (genderPreference === "Male" || genderPreference === "Female") {
        query = query.eq("member_gender", genderPreference);
      }

      let { data: matches } = await query;

      // If no gender-specific match, try any
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

        // Remove partner from queue
        await supabase
          .from("waiting_queue")
          .delete()
          .eq("id", partner.id);

        // Create a room
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
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

      // Fire match-notify in background (don't await — non-blocking)
      fetch(`${supabaseUrl}/functions/v1/match-notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ memberId, memberGender }),
      }).catch((err) => console.warn("match-notify fire failed:", err));

      return new Response(
        JSON.stringify({
          success: true,
          message: "added_to_queue",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DISCONNECT: End a call
    if (type === "disconnect") {
      await supabase
        .from("rooms")
        .update({
          status: "disconnected",
          disconnected_at: new Date().toISOString(),
        })
        .or(`and(member1.eq.${memberId}),and(member2.eq.${memberId})`)
        .eq("status", "connected");

      // Also remove from queue
      await supabase
        .from("waiting_queue")
        .delete()
        .eq("member_id", memberId);

      return new Response(
        JSON.stringify({
          success: true,
          message: "disconnected",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POLL: Check if a room was created for this member
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
      return new Response(
        JSON.stringify({ success: true, room: room || null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // LEAVE_QUEUE: Remove from queue without disconnecting a call
    if (type === "leave_queue") {
      await supabase
        .from("waiting_queue")
        .delete()
        .eq("member_id", memberId);

      return new Response(
        JSON.stringify({ success: true, message: "removed_from_queue" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, message: "Unknown type" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
