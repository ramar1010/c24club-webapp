import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { type, userId, partnerId, minutesEarned, targetUserId, minutes, mode } = await req.json();

    // GET_BALANCE: Return current minutes + VIP status
    if (type === "get_balance") {
      const { data } = await supabase
        .from("member_minutes")
        .select("total_minutes, is_vip, cap_popup_shown")
        .eq("user_id", userId)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          success: true,
          totalMinutes: data?.total_minutes ?? 0,
          isVip: data?.is_vip ?? false,
          capPopupShown: data?.cap_popup_shown ?? false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // EARN: Record minutes earned from a call
    if (type === "earn") {
      if (!userId || !partnerId || !minutesEarned || minutesEarned <= 0) {
        return new Response(
          JSON.stringify({ success: false, message: "Invalid parameters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get VIP status
      const { data: memberData } = await supabase
        .from("member_minutes")
        .select("total_minutes, is_vip, cap_popup_shown")
        .eq("user_id", userId)
        .maybeSingle();

      const isVip = memberData?.is_vip ?? false;
      const capPopupAlreadyShown = memberData?.cap_popup_shown ?? false;
      const cap = isVip ? 30 : 10;

      // Get current minutes earned with this partner today
      const today = new Date().toISOString().split("T")[0];
      const { data: logData } = await supabase
        .from("call_minutes_log")
        .select("minutes_earned")
        .eq("user_id", userId)
        .eq("partner_id", partnerId)
        .eq("session_date", today)
        .maybeSingle();

      const alreadyEarned = logData?.minutes_earned ?? 0;
      const remaining = Math.max(0, cap - alreadyEarned);
      const actualEarned = Math.min(minutesEarned, remaining);

      if (actualEarned <= 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: "cap_reached",
            cap,
            isVip,
            earned: 0,
            totalEarnedWithPartner: alreadyEarned,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Upsert call_minutes_log
      await supabase
        .from("call_minutes_log")
        .upsert(
          {
            user_id: userId,
            partner_id: partnerId,
            session_date: today,
            minutes_earned: alreadyEarned + actualEarned,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,partner_id,session_date" }
        );

      // Upsert member_minutes
      const currentTotal = memberData?.total_minutes ?? 0;
      const newTotal = currentTotal + actualEarned;
      const shouldShowCapPopup = newTotal >= cap && !capPopupAlreadyShown;

      await supabase
        .from("member_minutes")
        .upsert(
          {
            user_id: userId,
            total_minutes: newTotal,
            updated_at: new Date().toISOString(),
            ...(shouldShowCapPopup ? { cap_popup_shown: true } : {}),
          },
          { onConflict: "user_id" }
        );

      const newTotalWithPartner = alreadyEarned + actualEarned;
      const partnerCapReached = newTotalWithPartner >= cap;

      return new Response(
        JSON.stringify({
          success: true,
          message: partnerCapReached ? "cap_reached" : "earned",
          earned: actualEarned,
          totalMinutes: newTotal,
          totalEarnedWithPartner: newTotalWithPartner,
          cap,
          isVip,
          showCapPopup: shouldShowCapPopup,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CHECK_CAP: Check remaining minutes with a specific partner
    if (type === "check_cap") {
      const { data: memberData } = await supabase
        .from("member_minutes")
        .select("is_vip")
        .eq("user_id", userId)
        .maybeSingle();

      const isVip = memberData?.is_vip ?? false;
      const cap = isVip ? 30 : 10;

      const today = new Date().toISOString().split("T")[0];
      const { data: logData } = await supabase
        .from("call_minutes_log")
        .select("minutes_earned")
        .eq("user_id", userId)
        .eq("partner_id", partnerId)
        .eq("session_date", today)
        .maybeSingle();

      const alreadyEarned = logData?.minutes_earned ?? 0;

      return new Response(
        JSON.stringify({
          success: true,
          alreadyEarned,
          remaining: Math.max(0, cap - alreadyEarned),
          cap,
          isVip,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ADMIN_ADD_MINUTES: Manually add/set minutes for a user (admin only)
    if (type === "admin_add_minutes") {
      const actualTargetUserId = targetUserId || userId;
      const actualMinutes = minutes ?? minutesEarned ?? 0;

      const { data: existing } = await supabase
        .from("member_minutes")
        .select("total_minutes")
        .eq("user_id", actualTargetUserId)
        .maybeSingle();

      const currentTotal = existing?.total_minutes ?? 0;
      const newTotal = mode === "set" ? actualMinutes : currentTotal + actualMinutes;

      await supabase
        .from("member_minutes")
        .upsert(
          {
            user_id: actualTargetUserId,
            total_minutes: Math.max(0, newTotal),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      return new Response(
        JSON.stringify({
          success: true,
          previousMinutes: currentTotal,
          newMinutes: Math.max(0, newTotal),
        }),
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
