import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Ad points tiers based on call duration
// Premium VIP gets 2x ad points
function computeAdPoints(elapsedSeconds: number, isPremiumVip: boolean): number {
  let points = 0;
  if (elapsedSeconds >= 300) points = 4;
  else if (elapsedSeconds >= 120) points = 2;
  else if (elapsedSeconds >= 30) points = 1;
  
  // Premium VIP: 30s=2, 2min=4, 5min=6 (which is base * 2 capped differently)
  if (isPremiumVip && points > 0) {
    if (elapsedSeconds >= 300) return 6;
    if (elapsedSeconds >= 120) return 4;
    return 2;
  }
  return points;
}

// Check if user should be frozen
async function checkFreezeStatus(supabase: any, userId: string) {
  const { data: mm } = await supabase
    .from("member_minutes")
    .select("total_minutes, is_vip, is_frozen, freeze_free_until, vip_tier")
    .eq("user_id", userId)
    .maybeSingle();

  if (!mm) return { isFrozen: false, earnRate: 10 };

  const { data: settings } = await supabase
    .from("freeze_settings")
    .select("minute_threshold, frozen_earn_rate")
    .limit(1)
    .maybeSingle();

  const threshold = settings?.minute_threshold ?? 400;
  const frozenRate = settings?.frozen_earn_rate ?? 2;

  // VIP users are never frozen
  if (mm.is_vip) {
    return { isFrozen: false, earnRate: 30 };
  }

  // If below threshold, never frozen
  if (mm.total_minutes < threshold) {
    return { isFrozen: false, earnRate: 10 };
  }

  // If freeze_free_until is in the future, not frozen
  if (mm.freeze_free_until && new Date(mm.freeze_free_until) > new Date()) {
    return { isFrozen: false, earnRate: mm.is_vip ? 30 : 10 };
  }

  // Check if user completed a challenge in the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: approvedChallenges } = await supabase
    .from("challenge_submissions")
    .select("id, created_at")
    .eq("user_id", userId)
    .eq("status", "approved")
    .gte("created_at", sevenDaysAgo.toISOString())
    .order("created_at", { ascending: false });

  const challengeCount = approvedChallenges?.length ?? 0;

  if (challengeCount > 0) {
    // Calculate freeze-free period: 7 days per completed challenge
    const freezeFreeDays = challengeCount * 7;
    const earliestChallenge = approvedChallenges[approvedChallenges.length - 1].created_at;
    const freezeFreeUntil = new Date(earliestChallenge);
    freezeFreeUntil.setDate(freezeFreeUntil.getDate() + freezeFreeDays);

    if (freezeFreeUntil > new Date()) {
      // Update freeze_free_until in DB
      await supabase
        .from("member_minutes")
        .update({ is_frozen: false, freeze_free_until: freezeFreeUntil.toISOString() })
        .eq("user_id", userId);

      return { isFrozen: false, earnRate: mm.is_vip ? 30 : 10 };
    }
  }

  // User is frozen - update DB if not already
  if (!mm.is_frozen) {
    await supabase
      .from("member_minutes")
      .update({ is_frozen: true, frozen_at: new Date().toISOString() })
      .eq("user_id", userId);
  }

  return { isFrozen: true, earnRate: frozenRate };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const { type, userId, partnerId, minutesEarned, targetUserId, minutes, mode, elapsedSeconds, sessionId, voiceMode } = body;

    // GET_BALANCE: Return current minutes + ad points + VIP status + freeze status
    if (type === "get_balance") {
      const { data } = await supabase
        .from("member_minutes")
        .select("total_minutes, is_vip, cap_popup_shown, ad_points, is_frozen, freeze_free_until, vip_tier, gifted_minutes")
        .eq("user_id", userId)
        .maybeSingle();

      // Also check freeze dynamically
      const freezeInfo = await checkFreezeStatus(supabase, userId);

      return new Response(
        JSON.stringify({
          success: true,
          totalMinutes: data?.total_minutes ?? 0,
          giftedMinutes: data?.gifted_minutes ?? 0,
          adPoints: data?.ad_points ?? 0,
          isVip: data?.is_vip ?? false,
          vipTier: data?.vip_tier ?? null,
          capPopupShown: data?.cap_popup_shown ?? false,
          isFrozen: freezeInfo.isFrozen,
          earnRate: freezeInfo.earnRate,
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

      const { data: memberData } = await supabase
        .from("member_minutes")
         .select("total_minutes, is_vip, cap_popup_shown, frozen_cap_popup_shown, ad_points, gifted_minutes")
         .eq("user_id", userId)
         .maybeSingle();

       const isVip = memberData?.is_vip ?? false;
       const capPopupAlreadyShown = memberData?.cap_popup_shown ?? false;
       const frozenCapPopupAlreadyShown = memberData?.frozen_cap_popup_shown ?? false;

      // Check freeze status to determine earn cap
      const freezeInfo = await checkFreezeStatus(supabase, userId);
      // Voice mode females earn at reduced rate (5 min cap instead of 10)
      const voiceModeCap = 5;
      let cap: number;
      if (freezeInfo.isFrozen) {
        cap = freezeInfo.earnRate;
      } else if (voiceMode) {
        cap = voiceModeCap;
      } else {
        cap = isVip ? 30 : 10;
      }

      // Use sessionId to track cap per-session (not per-day)
      // If no sessionId provided, fall back to date-based tracking
      const trackingSessionId = sessionId || new Date().toISOString().split("T")[0];
      
      const { data: logData } = await supabase
        .from("call_minutes_log")
        .select("minutes_earned")
        .eq("user_id", userId)
        .eq("partner_id", partnerId)
        .eq("session_date", trackingSessionId)
        .maybeSingle();

      const alreadyEarned = logData?.minutes_earned ?? 0;
      const remaining = Math.max(0, cap - alreadyEarned);
      const actualEarned = Math.min(minutesEarned, remaining);

      if (actualEarned <= 0) {
        const currentTotal = memberData?.total_minutes ?? 0;
        // For frozen users, only show cap popup once ever
        let showFrozenPopup = false;
        if (freezeInfo.isFrozen && !frozenCapPopupAlreadyShown) {
          showFrozenPopup = true;
          await supabase
            .from("member_minutes")
            .update({ frozen_cap_popup_shown: true })
            .eq("user_id", userId);
        }
        return new Response(
          JSON.stringify({
            success: true,
            message: "cap_reached",
            cap,
            isVip,
            isFrozen: freezeInfo.isFrozen,
            earned: 0,
            totalMinutes: currentTotal,
            totalEarnedWithPartner: alreadyEarned,
            showCapPopup: showFrozenPopup,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Hard server-side cap: never allow more than 30 minutes in a single request
      const safeCapped = Math.min(actualEarned, 30);

      await supabase
        .from("call_minutes_log")
        .upsert(
          {
            user_id: userId,
            partner_id: partnerId,
            session_date: trackingSessionId,
            minutes_earned: alreadyEarned + safeCapped,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,partner_id,session_date" }
        );

      // Use atomic increment to prevent read-then-write race conditions
      const { data: newTotalResult } = await supabase.rpc("atomic_increment_minutes", {
        p_user_id: userId,
        p_amount: safeCapped,
      });

      // Female users: only increment gifted_minutes (cash-eligible) if they
      // hold an ACTIVE anchor earning slot — queued females earn normal
      // reward minutes but no cash until promoted.
      const { data: genderCheck } = await supabase
        .from("members")
        .select("gender")
        .eq("id", userId)
        .maybeSingle();

      let updatedGiftedMinutes = memberData?.gifted_minutes ?? 0;
      if (genderCheck?.gender?.toLowerCase() === "female") {
        // Check partner gender — females don't earn cashable minutes from other females
        const { data: partnerGenderCheck } = await supabase
          .from("members")
          .select("gender")
          .eq("id", partnerId)
          .maybeSingle();

        const partnerIsFemale = partnerGenderCheck?.gender?.toLowerCase() === "female";

        if (!partnerIsFemale) {
          const { data: activeSession } = await supabase
            .from("anchor_sessions")
            .select("id")
            .eq("user_id", userId)
            .eq("status", "active")
            .maybeSingle();

          if (activeSession) {
            updatedGiftedMinutes += safeCapped;
            await supabase
              .from("member_minutes")
              .update({ gifted_minutes: updatedGiftedMinutes })
              .eq("user_id", userId);
          }
        }
      }

      const newTotal = newTotalResult ?? (memberData?.total_minutes ?? 0) + safeCapped;
      const capPopupAlreadyShownNow = memberData?.cap_popup_shown ?? false;
      let shouldShowCapPopup = false;

      if (freezeInfo.isFrozen) {
        // Frozen users: only show cap popup once ever
        if (!frozenCapPopupAlreadyShown) {
          shouldShowCapPopup = true;
          await supabase
            .from("member_minutes")
            .update({ frozen_cap_popup_shown: true })
            .eq("user_id", userId);
        }
      } else {
        // Normal/VIP users: show once when total reaches cap
        shouldShowCapPopup = newTotal >= cap && !capPopupAlreadyShownNow;
        if (shouldShowCapPopup) {
          await supabase
            .from("member_minutes")
            .update({ cap_popup_shown: true })
            .eq("user_id", userId);
        }
      }

      const newTotalWithPartner = alreadyEarned + safeCapped;
      const partnerCapReached = newTotalWithPartner >= cap;

      return new Response(
        JSON.stringify({
          success: true,
          message: partnerCapReached ? "cap_reached" : "earned",
          earned: safeCapped,
          totalMinutes: newTotal,
          giftedMinutes: updatedGiftedMinutes,
          totalEarnedWithPartner: newTotalWithPartner,
          cap,
          isVip,
          isFrozen: freezeInfo.isFrozen,
          showCapPopup: shouldShowCapPopup,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // EARN_AD_POINTS: Award ad points based on call duration
    if (type === "earn_ad_points") {
      if (!userId || !elapsedSeconds || elapsedSeconds <= 0) {
        return new Response(
          JSON.stringify({ success: true, adPointsEarned: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user is premium VIP for 2x ad points
      const { data: vipData } = await supabase
        .from("member_minutes")
        .select("ad_points, is_vip, vip_tier")
        .eq("user_id", userId)
        .maybeSingle();
      const isPremiumVip = vipData?.is_vip && vipData?.vip_tier === "premium";
      const pointsToAward = computeAdPoints(elapsedSeconds, isPremiumVip);
      if (pointsToAward <= 0) {
        return new Response(
          JSON.stringify({ success: true, adPointsEarned: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const currentAdPoints = vipData?.ad_points ?? 0;
      const newAdPoints = currentAdPoints + pointsToAward;

      await supabase
        .from("member_minutes")
        .upsert(
          {
            user_id: userId,
            ad_points: newAdPoints,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      return new Response(
        JSON.stringify({
          success: true,
          adPointsEarned: pointsToAward,
          totalAdPoints: newAdPoints,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SPEND_AD_POINTS: Deduct ad points when posting a promo
    if (type === "spend_ad_points") {
      const { points } = body;
      if (!userId || !points || points <= 0) {
        return new Response(
          JSON.stringify({ success: false, message: "Invalid parameters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: memberData } = await supabase
        .from("member_minutes")
        .select("ad_points")
        .eq("user_id", userId)
        .maybeSingle();

      const currentAdPoints = memberData?.ad_points ?? 0;
      if (currentAdPoints < points) {
        return new Response(
          JSON.stringify({ success: false, message: "Insufficient ad points" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("member_minutes")
        .update({ ad_points: currentAdPoints - points, updated_at: new Date().toISOString() })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true, totalAdPoints: currentAdPoints - points }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ADMIN_AD_POINTS: Add or set ad points for a user (admin)
    if (type === "admin_ad_points") {
      const { targetUserId, points, mode } = body;
      const actualUserId = targetUserId || userId;

      const { data: existing } = await supabase
        .from("member_minutes")
        .select("ad_points")
        .eq("user_id", actualUserId)
        .maybeSingle();

      const current = existing?.ad_points ?? 0;
      const newPoints = mode === "set" ? Math.max(0, points) : Math.max(0, current + points);

      await supabase
        .from("member_minutes")
        .upsert(
          { user_id: actualUserId, ad_points: newPoints, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );

      return new Response(
        JSON.stringify({ success: true, previousAdPoints: current, totalAdPoints: newPoints }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CHECK_CAP
    if (type === "check_cap") {
      const { data: memberData } = await supabase
        .from("member_minutes")
        .select("is_vip")
        .eq("user_id", userId)
        .maybeSingle();

      const isVip = memberData?.is_vip ?? false;
      const freezeInfo = await checkFreezeStatus(supabase, userId);
      let cap: number;
      if (freezeInfo.isFrozen) {
        cap = freezeInfo.earnRate;
      } else if (voiceMode) {
        cap = 5;
      } else {
        cap = isVip ? 30 : 10;
      }

      const trackingId = sessionId || new Date().toISOString().split("T")[0];
      const { data: logData } = await supabase
        .from("call_minutes_log")
        .select("minutes_earned")
        .eq("user_id", userId)
        .eq("partner_id", partnerId)
        .eq("session_date", trackingId)
        .maybeSingle();

      const alreadyEarned = logData?.minutes_earned ?? 0;

      return new Response(
        JSON.stringify({
          success: true,
          alreadyEarned,
          remaining: Math.max(0, cap - alreadyEarned),
          cap,
          isVip,
          isFrozen: freezeInfo.isFrozen,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DEDUCT: Remove minutes (e.g., spin-to-win loss penalty)
    if (type === "deduct") {
      const { amount } = body;
      if (!userId || !amount || amount <= 0) {
        return new Response(
          JSON.stringify({ success: false, message: "Invalid parameters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: existing } = await supabase
        .from("member_minutes")
        .select("total_minutes, gifted_minutes")
        .eq("user_id", userId)
        .maybeSingle();

      const currentTotal = existing?.total_minutes ?? 0;
      const currentGifted = existing?.gifted_minutes ?? 0;
      const newTotal = Math.max(0, currentTotal - amount);
      const newGifted = Math.min(Math.max(0, currentGifted - amount), newTotal);

      await supabase
        .from("member_minutes")
        .update({ total_minutes: newTotal, gifted_minutes: newGifted, updated_at: new Date().toISOString() })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true, previousMinutes: currentTotal, newMinutes: newTotal }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ADMIN_ADD_MINUTES
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
