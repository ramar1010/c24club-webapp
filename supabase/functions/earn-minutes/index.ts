import { createClient } from "npm:@supabase/supabase-js@2";
import { getAuthenticatedUserId, hasRole, unauthorized, forbidden } from "../_shared/auth.ts";

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

  // If below threshold, never frozen
  if (mm.total_minutes < threshold) {
    return { isFrozen: false, earnRate: mm.is_vip ? 30 : 10 };
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
    const authedUserId = await getAuthenticatedUserId(req);
    if (!authedUserId) return unauthorized(corsHeaders);

    const body = await req.json();
    const { type, partnerId, minutesEarned, targetUserId, minutes, mode, elapsedSeconds, sessionId, voiceMode } = body;
    // Always use the authenticated user id for user-scoped operations.
    // Admin actions (admin_add_minutes, admin_ad_points) get a role check below.
    const userId = authedUserId;

    if (type === "admin_add_minutes" || type === "admin_ad_points") {
      const isAdmin = await hasRole(authedUserId, "admin");
      if (!isAdmin) return forbidden(corsHeaders);
    }

    // GET_BALANCE: Return current minutes + ad points + VIP status + freeze status
    if (type === "get_balance") {
      const { data } = await supabase
        .from("member_minutes")
        .select("total_minutes, is_vip, cap_popup_shown, ad_points, is_frozen, freeze_free_until, vip_tier, gifted_minutes, recharge_minutes, call_earned_minutes")
        .eq("user_id", userId)
        .maybeSingle();

      // Also check freeze dynamically
      const freezeInfo = await checkFreezeStatus(supabase, userId);

      return new Response(
        JSON.stringify({
          success: true,
          totalMinutes: data?.total_minutes ?? 0,
          giftedMinutes: data?.gifted_minutes ?? 0,
          rechargeMinutes: data?.recharge_minutes ?? 0,
          callEarnedMinutes: data?.call_earned_minutes ?? 0,
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

    // CLAIM_WELCOME_BONUS: Award first-call welcome bonus (50 / 25 / 10)
    if (type === "claim_welcome_bonus") {
      if (!userId) {
        return new Response(
          JSON.stringify({ success: false, message: "Missing userId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data, error } = await supabase.rpc("claim_welcome_bonus", { p_user_id: userId });
      if (error) {
        return new Response(
          JSON.stringify({ success: false, message: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify(data ?? { success: false }),
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

      // Native direct calls use the invite UUID as their session ID. Some app
      // versions send the authenticated user's own ID as partnerId, so resolve
      // the actual counterpart from the server-owned invite before logging or
      // settling the call. Never trust a client-supplied counterpart when the
      // invite gives us an authoritative one.
      let resolvedPartnerId = partnerId;
      let isDirectCall = false;
      if (sessionId) {
        const { data: directInvite } = await supabase
          .from("direct_call_invites")
          .select("inviter_id, invitee_id")
          .eq("id", sessionId)
          .maybeSingle();

        if (directInvite?.inviter_id === userId) {
          resolvedPartnerId = directInvite.invitee_id;
          isDirectCall = true;
        } else if (directInvite?.invitee_id === userId) {
          resolvedPartnerId = directInvite.inviter_id;
          isDirectCall = true;
        }
      }

      if (!resolvedPartnerId || resolvedPartnerId === userId) {
        return new Response(
          JSON.stringify({ success: false, message: "Unable to resolve call partner" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Resolve verified roles up front. The payer is ALWAYS the male
      // participant and the earner is ALWAYS the female participant — never
      // assume the authenticated reporter is one or the other.
      const { data: participantRows, error: participantsError } = await supabase
        .from("members")
        .select("id, gender")
        .in("id", [userId, resolvedPartnerId]);

      if (participantsError) {
        console.error("[earn-minutes] participants_lookup_failed", {
          authUserId: authedUserId,
          userId,
          partnerId,
          resolvedPartnerId,
          sessionId: sessionId ?? null,
          dbErrorCode: participantsError.code ?? null,
          dbErrorMessage: participantsError.message ?? null,
          dbErrorDetails: participantsError.details ?? null,
        });
        return new Response(
          JSON.stringify({
            success: false,
            message: "participants_lookup_failed",
            reason: "participants_lookup_failed",
            errorCode: "PARTICIPANTS_LOOKUP_FAILED",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const genderOf = (id: string) =>
        participantRows
          ?.find((m: { id: string }) => m.id === id)
          ?.gender?.toLowerCase() ?? null;

      const reporterGender = genderOf(userId);
      const partnerGender = genderOf(resolvedPartnerId);

      let payerId: string | null = null;
      let earnerId: string | null = null;
      if (reporterGender === "male" && partnerGender === "female") {
        payerId = userId;
        earnerId = resolvedPartnerId;
      } else if (reporterGender === "female" && partnerGender === "male") {
        payerId = resolvedPartnerId;
        earnerId = userId;
      }

      const isPrivateBilling = isDirectCall && !!payerId && !!earnerId;

      // Look up the PAYER's recharge balance (never the caller's) before any
      // cap decision. Errors and missing rows must never be treated as zero.
      let payerRechargeBefore = 0;
      if (isPrivateBilling) {
        const { data: payerRow, error: payerError } = await supabase
          .from("member_minutes")
          .select("recharge_minutes")
          .eq("user_id", payerId)
          .maybeSingle();

        if (payerError) {
          console.error("[earn-minutes] payer_balance_lookup_failed", {
            authUserId: authedUserId,
            payerId,
            earnerId,
            targetUserId: targetUserId ?? null,
            partnerId,
            resolvedPartnerId,
            sessionId: sessionId ?? null,
            requestedMinutes: minutesEarned,
            dbErrorCode: payerError.code ?? null,
            dbErrorMessage: payerError.message ?? null,
            dbErrorDetails: payerError.details ?? null,
          });
          return new Response(
            JSON.stringify({
              success: false,
              message: "payer_balance_lookup_failed",
              reason: "payer_balance_lookup_failed",
              errorCode: "PAYER_BALANCE_LOOKUP_FAILED",
              payerId,
              earnerId,
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!payerRow) {
          console.error("[earn-minutes] payer_balance_row_missing", {
            authUserId: authedUserId,
            payerId,
            earnerId,
            targetUserId: targetUserId ?? null,
            partnerId,
            resolvedPartnerId,
            sessionId: sessionId ?? null,
            requestedMinutes: minutesEarned,
          });
          return new Response(
            JSON.stringify({
              success: false,
              message: "payer_balance_row_missing",
              reason: "payer_balance_row_missing",
              errorCode: "PAYER_BALANCE_ROW_MISSING",
              payerId,
              earnerId,
            }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        payerRechargeBefore = Number(payerRow.recharge_minutes) || 0;
        console.log("[earn-minutes] private_call_payer_balance", {
          authUserId: authedUserId,
          payerId,
          earnerId,
          sessionId: sessionId ?? null,
          requestedMinutes: minutesEarned,
          payerRechargeBefore,
        });
      }

      const { data: memberData } = await supabase
        .from("member_minutes")
         .select("total_minutes, is_vip, cap_popup_shown, frozen_cap_popup_shown, ad_points, gifted_minutes, recharge_minutes, call_earned_minutes")
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
      if (isPrivateBilling) {
        // Paid private calls are limited ONLY by the payer's purchased balance.
        // Freeze/voice/VIP chat caps must never throttle cash earnings.
        cap = Math.max(payerRechargeBefore, minutesEarned);
      } else if (freezeInfo.isFrozen) {
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
        .eq("partner_id", resolvedPartnerId)
        .eq("session_date", trackingSessionId)
        .maybeSingle();

      const alreadyEarned = logData?.minutes_earned ?? 0;
      const remaining = Math.max(0, cap - alreadyEarned);
      const actualEarned = Math.min(minutesEarned, remaining);

      // Private calls: cap_reached is ONLY valid when the payer row was found
      // and its real recharge balance is exhausted.
      if (isPrivateBilling && payerRechargeBefore <= 0) {
        console.log("[earn-minutes] payer_balance_zero", {
          authUserId: authedUserId,
          payerId,
          earnerId,
          sessionId: sessionId ?? null,
          requestedMinutes: minutesEarned,
          payerRechargeBefore,
        });
        return new Response(
          JSON.stringify({
            success: true,
            message: "cap_reached",
            reason: "payer_balance_zero",
            errorCode: "PAYER_BALANCE_ZERO",
            payerId,
            earnerId,
            payerRechargeBefore,
            payerRechargeAfter: payerRechargeBefore,
            earned: 0,
            cap,
            isVip,
            isFrozen: freezeInfo.isFrozen,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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
            partner_id: resolvedPartnerId,
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

      let updatedGiftedMinutes = memberData?.gifted_minutes ?? 0;
      let remainingRechargeMinutes = memberData?.recharge_minutes ?? 0;
      let updatedCallEarnedMinutes = memberData?.call_earned_minutes ?? 0;
      let privateBillingResult: Record<string, unknown> | null = null;
      // Only paid Discover/direct (private) calls settle against the MALE
      // payer's refill balance and count toward "earned calls". Random roulette
      // chats stay free and only credit chat minutes (total_minutes).
      if (isPrivateBilling) {
          const { data: spendResult, error: spendError } = await supabase.rpc("spend_recharge_minutes", {
            p_user_id: payerId,
            p_amount: safeCapped,
          });

          const spendRow = Array.isArray(spendResult) ? spendResult[0] : spendResult;

          if (spendError || !spendRow) {
            console.error("[earn-minutes] private_billing_failed", {
              authUserId: authedUserId,
              payerId,
              earnerId,
              targetUserId: targetUserId ?? null,
              partnerId,
              resolvedPartnerId,
              sessionId: sessionId ?? null,
              requestedMinutes: minutesEarned,
              chargeMinutes: safeCapped,
              payerRechargeBefore,
              dbErrorCode: spendError?.code ?? null,
              dbErrorMessage: spendError?.message ?? null,
              dbErrorDetails: spendError?.details ?? null,
            });
            return new Response(
              JSON.stringify({
                success: false,
                message: spendError ? "private_billing_failed" : "private_billing_no_rows",
                reason: spendError ? "private_billing_failed" : "private_billing_no_rows",
                errorCode: spendError ? "PRIVATE_BILLING_FAILED" : "PRIVATE_BILLING_NO_ROWS",
                payerId,
                earnerId,
                payerRechargeBefore,
              }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const spent = spendRow.spent ?? 0;
          const payerRemaining = spendRow.payer_remaining ?? spendRow.remaining ?? Math.max(0, payerRechargeBefore - spent);
          remainingRechargeMinutes = payerRemaining;

          let creditedGiftedMinutes = 0;
          if (spent > 0) {
            // Discover call minutes pay a much higher rate than gift/bounty
            // minutes. We store everything in the same $0.01 cashable unit,
            // so credit spent * (call_rate / base_rate) gifted minutes.
            const { data: rateRow } = await supabase
              .from("cashout_settings")
              .select("rate_per_minute, call_rate_per_minute")
              .limit(1)
              .maybeSingle();
            const baseRate = Number(rateRow?.rate_per_minute) || 0.01;
            const callRate = Number(rateRow?.call_rate_per_minute) || 0.2;
            const multiplier = Math.max(1, Math.round(callRate / baseRate));
            const payout = spent * multiplier;

            const { error: payoutError } = await supabase.rpc("atomic_increment_member_balances", {
              p_user_id: earnerId,
              p_total_amount: 0,
              p_gifted_amount: payout,
            });
            if (payoutError) throw payoutError;

            creditedGiftedMinutes = payout;

            const { data: earnerRow } = await supabase
              .from("member_minutes")
              .select("call_earned_minutes")
              .eq("user_id", earnerId)
              .maybeSingle();

            const { error: callEarnedError } = await supabase
              .from("member_minutes")
              .update({
                call_earned_minutes: (earnerRow?.call_earned_minutes ?? 0) + spent,
              })
              .eq("user_id", earnerId);
            if (callEarnedError) throw callEarnedError;
          }

          // Return the EARNER's balances (not automatically the caller's).
          const { data: earnerBalances } = await supabase
            .from("member_minutes")
            .select("total_minutes, gifted_minutes, call_earned_minutes, recharge_minutes")
            .eq("user_id", earnerId)
            .maybeSingle();

          updatedGiftedMinutes = earnerBalances?.gifted_minutes ?? updatedGiftedMinutes;
          updatedCallEarnedMinutes = earnerBalances?.call_earned_minutes ?? updatedCallEarnedMinutes;

          privateBillingResult = {
            payerId,
            earnerId,
            payerRechargeBefore,
            payerRechargeAfter: payerRemaining,
            spent,
            remaining: payerRemaining,
            creditedCallMinutes: spent,
            creditedGiftedMinutes,
          };

          console.log("[earn-minutes] private_billing_settled", {
            authUserId: authedUserId,
            payerId,
            earnerId,
            targetUserId: targetUserId ?? null,
            partnerId,
            resolvedPartnerId,
            sessionId: sessionId ?? null,
            requestedMinutes: minutesEarned,
            chargeMinutes: safeCapped,
            payerRechargeBefore,
            payerRechargeAfter: payerRemaining,
            spent,
            creditedGiftedMinutes,
          });
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
          callEarnedMinutes: updatedCallEarnedMinutes,
          rechargeMinutes: remainingRechargeMinutes,
          totalEarnedWithPartner: newTotalWithPartner,
          cap,
          isVip,
          isFrozen: freezeInfo.isFrozen,
          ...(privateBillingResult ?? {}),
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
