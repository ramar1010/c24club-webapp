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
    const { type, memberId, channelId, genderPreference, memberGender, partnerId } = await req.json();

    // JOIN: Try to find a match or add to queue
    if (type === "join") {
      // First remove any stale entries for this member
      await supabase
        .from("waiting_queue")
        .delete()
        .eq("member_id", memberId);

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
      });

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
