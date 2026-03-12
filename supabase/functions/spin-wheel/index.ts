import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Chance Enhancer Rules:
 * NON-VIP: +30% per 200 mins, min 10%, max 65%, decays 50% after 1 missed day
 * VIP:     +50% per 100 mins, min 35%, max 85%, decays 40% after 2 missed days
 */
function calculateChanceEnhancer(
  currentCE: number,
  totalMinutes: number,
  ceCheckpoint: number,
  lastLoginAt: string | null,
  isVip: boolean
): { ce: number; newCheckpoint: number } {
  const minCE = isVip ? 35 : 10;
  const maxCE = isVip ? 85 : 65;
  const boostPer = isVip ? 50 : 30;
  const minutesInterval = isVip ? 100 : 200;
  const decayPercent = isVip ? 40 : 50;
  const graceDays = isVip ? 2 : 1;

  let ce = currentCE;

  // Apply decay based on missed login days
  if (lastLoginAt) {
    const lastLogin = new Date(lastLoginAt);
    const now = new Date();
    const diffMs = now.getTime() - lastLogin.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > graceDays) {
      const missedPeriods = diffDays - graceDays;
      for (let i = 0; i < missedPeriods; i++) {
        ce = ce * (1 - decayPercent / 100);
      }
    }
  }

  // Apply growth based on minutes earned since checkpoint
  let newCheckpoint = ceCheckpoint;
  const minutesSinceCheckpoint = totalMinutes - ceCheckpoint;
  if (minutesSinceCheckpoint >= minutesInterval) {
    const boosts = Math.floor(minutesSinceCheckpoint / minutesInterval);
    ce += boosts * boostPer;
    newCheckpoint = ceCheckpoint + boosts * minutesInterval;
  }

  // Clamp
  ce = Math.max(minCE, Math.min(maxCE, ce));

  return { ce: Math.round(ce * 100) / 100, newCheckpoint };
}

function weightedRandom(prizes: any[], chanceEnhancer: number): any {
  // Chance enhancer boosts higher-value prizes by shifting weight
  // CE acts as a percentage boost to non-lowest-value prizes
  const enhancerMultiplier = 1 + chanceEnhancer / 100;

  const adjustedPrizes = prizes.map((p) => {
    // Boost prizes that aren't the lowest amount
    const isHighValue = Number(p.amount) > 1 || p.prize_type === "vip_week" || p.prize_type === "gift_card";
    const weight = isHighValue
      ? Number(p.chance_percent) * enhancerMultiplier
      : Number(p.chance_percent);
    return { ...p, adjustedWeight: weight };
  });

  const totalWeight = adjustedPrizes.reduce((sum, p) => sum + p.adjustedWeight, 0);
  let rand = Math.random() * totalWeight;
  for (const prize of adjustedPrizes) {
    rand -= prize.adjustedWeight;
    if (rand <= 0) return prize;
  }
  return prizes[prizes.length - 1];
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
    const { type, userId } = body;

    // GET_PRIZES: Return active prizes for the wheel
    if (type === "get_prizes") {
      const { data: prizes } = await supabase
        .from("spin_prizes")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      return new Response(
        JSON.stringify({ success: true, prizes: prizes || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET_CHANCE_ENHANCER: Return current CE for a user
    if (type === "get_chance_enhancer") {
      if (!userId) {
        return new Response(
          JSON.stringify({ success: false, message: "Not authenticated" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: mm } = await supabase
        .from("member_minutes")
        .select("chance_enhancer, last_login_at, ce_minutes_checkpoint, total_minutes, is_vip")
        .eq("user_id", userId)
        .maybeSingle();

      if (!mm) {
        return new Response(
          JSON.stringify({ success: true, chance_enhancer: 10, is_vip: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { ce } = calculateChanceEnhancer(
        mm.chance_enhancer ?? 10,
        mm.total_minutes ?? 0,
        mm.ce_minutes_checkpoint ?? 0,
        mm.last_login_at,
        mm.is_vip ?? false
      );

      return new Response(
        JSON.stringify({ success: true, chance_enhancer: ce, is_vip: mm.is_vip }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // UPDATE_LOGIN: Track daily login for CE decay calculation
    if (type === "update_login") {
      if (!userId) {
        return new Response(
          JSON.stringify({ success: false, message: "Not authenticated" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: mm } = await supabase
        .from("member_minutes")
        .select("chance_enhancer, last_login_at, ce_minutes_checkpoint, total_minutes, is_vip")
        .eq("user_id", userId)
        .maybeSingle();

      const currentCE = mm?.chance_enhancer ?? 10;
      const isVip = mm?.is_vip ?? false;
      const totalMinutes = mm?.total_minutes ?? 0;
      const checkpoint = mm?.ce_minutes_checkpoint ?? 0;

      const { ce, newCheckpoint } = calculateChanceEnhancer(
        currentCE, totalMinutes, checkpoint, mm?.last_login_at, isVip
      );

      await supabase
        .from("member_minutes")
        .upsert(
          {
            user_id: userId,
            chance_enhancer: ce,
            last_login_at: new Date().toISOString(),
            ce_minutes_checkpoint: newCheckpoint,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      return new Response(
        JSON.stringify({ success: true, chance_enhancer: ce }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SPIN: Execute a spin
    if (type === "spin") {
      if (!userId) {
        return new Response(
          JSON.stringify({ success: false, message: "Not authenticated" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get user data including CE and VIP status
      const { data: mm } = await supabase
        .from("member_minutes")
        .select("purchased_spins, chance_enhancer, last_login_at, ce_minutes_checkpoint, total_minutes, is_vip, vip_tier")
        .eq("user_id", userId)
        .maybeSingle();

      const purchasedSpins = mm?.purchased_spins ?? 0;
      const usePurchased = body.use_purchased === true;
      const isPremiumVip = mm?.is_vip && mm?.vip_tier === "premium";

      if (usePurchased) {
        if (purchasedSpins <= 0) {
          return new Response(
            JSON.stringify({ success: false, message: "no_purchased_spins" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        const today = new Date().toISOString().split("T")[0];
        const { data: todaySpins } = await supabase
          .from("spin_results")
          .select("id")
          .eq("user_id", userId)
          .gte("created_at", today + "T00:00:00Z")
          .lte("created_at", today + "T23:59:59Z");

        if (todaySpins && todaySpins.length > 0 && !usePurchased) {
          return new Response(
            JSON.stringify({ success: false, message: "already_spun_today", purchasedSpins }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Get active prizes
      const { data: allPrizes } = await supabase
        .from("spin_prizes")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (!allPrizes || allPrizes.length === 0) {
        return new Response(
          JSON.stringify({ success: false, message: "No prizes available" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Filter prizes by rarity based on VIP status
      // Non-VIP: common + rare only; Premium VIP: common + rare + legendary
      const prizes = isPremiumVip
        ? allPrizes
        : allPrizes.filter((p: any) => p.rarity !== "legendary");

      // Calculate current CE
      const { ce, newCheckpoint } = calculateChanceEnhancer(
        mm?.chance_enhancer ?? 10,
        mm?.total_minutes ?? 0,
        mm?.ce_minutes_checkpoint ?? 0,
        mm?.last_login_at,
        mm?.is_vip ?? false
      );

      // Pick a prize using CE-boosted weights
      const won = weightedRandom(prizes, ce);

      // Award the prize
      let awarded = true;
      const amount = Number(won.amount);

      if (won.prize_type === "ad_points") {
        const current = mm?.ad_points ?? 0;
        await supabase.from("member_minutes").upsert(
          { user_id: userId, ad_points: current + amount, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      } else if (won.prize_type === "bonus_minutes") {
        const current = mm?.total_minutes ?? 0;
        await supabase.from("member_minutes").upsert(
          { user_id: userId, total_minutes: current + amount, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      } else if (won.prize_type === "unfreeze") {
        const days = amount;
        const until = new Date();
        until.setDate(until.getDate() + days);
        await supabase.from("member_minutes").upsert(
          {
            user_id: userId,
            is_frozen: false,
            freeze_free_until: until.toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      }

      // Deduct purchased spin if used
      if (usePurchased) {
        await supabase
          .from("member_minutes")
          .update({
            purchased_spins: purchasedSpins - 1,
            chance_enhancer: ce,
            ce_minutes_checkpoint: newCheckpoint,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
      } else {
        // Update CE state
        await supabase
          .from("member_minutes")
          .upsert(
            {
              user_id: userId,
              chance_enhancer: ce,
              ce_minutes_checkpoint: newCheckpoint,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );
      }

      // Record the spin result
      await supabase.from("spin_results").insert({
        user_id: userId,
        prize_id: won.id,
        prize_type: won.prize_type,
        prize_label: won.label,
        prize_amount: amount,
        awarded,
      });

      return new Response(
        JSON.stringify({
          success: true,
          prize: {
            id: won.id,
            prize_type: won.prize_type,
            label: won.label,
            amount,
          },
          chance_enhancer: ce,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET_HISTORY: Get user's spin history
    if (type === "get_history") {
      const { data } = await supabase
        .from("spin_results")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      return new Response(
        JSON.stringify({ success: true, history: data || [] }),
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
