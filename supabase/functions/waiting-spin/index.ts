import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Prize table: amount in cents, base odds (out of 10000)
const PRIZES = [
  { cents: 10, baseOdds: 800 },    // $0.10 — 8%
  { cents: 50, baseOdds: 100 },    // $0.50 — 1%
  { cents: 500, baseOdds: 10 },    // $5.00 — 0.1%
  { cents: 1000, baseOdds: 3 },    // $10.00 — 0.03%
  { cents: 2500, baseOdds: 1 },    // $25.00 — 0.01%
  { cents: 5000, baseOdds: 0.5 },  // $50.00 — 0.005%
];

// Max boost multiplier: 2x after 3+ min waiting
const MAX_BOOST = 2.0;
const BOOST_PER_30S = 0.1667; // reaches 2x at ~180s

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { waitSeconds } = await req.json();
    const userId = user.id;

    // Check if feature is enabled
    const { data: settings } = await supabase
      .from("lucky_spin_settings")
      .select("*")
      .limit(1)
      .single();

    if (!settings?.is_enabled) {
      return new Response(
        JSON.stringify({ success: true, won: false, reason: "disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is actually in the waiting queue
    const { data: inQueue } = await supabase
      .from("waiting_queue")
      .select("id")
      .eq("member_id", userId)
      .limit(1);

    if (!inQueue || inQueue.length === 0) {
      return new Response(
        JSON.stringify({ success: true, won: false, reason: "not_in_queue" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check daily cap
    const today = new Date().toISOString().split("T")[0];
    const { data: dailyEarnings } = await supabase
      .from("waiting_spin_earnings")
      .select("amount_cents")
      .eq("user_id", userId)
      .eq("spin_date", today)
      .single();

    const earnedToday = dailyEarnings?.amount_cents ?? 0;
    const dailyCap = settings.daily_cap_cents;

    if (earnedToday >= dailyCap) {
      return new Response(
        JSON.stringify({ success: true, won: false, reason: "cap_reached" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate boost based on wait time
    const clampedWait = Math.min(waitSeconds ?? 0, 180);
    const boost = 1 + (clampedWait / 30) * BOOST_PER_30S;
    const finalBoost = Math.min(boost, MAX_BOOST);

    // Roll for prizes
    const roll = Math.random() * 10000;
    let cumulative = 0;
    let wonCents = 0;

    for (const prize of PRIZES) {
      cumulative += prize.baseOdds * finalBoost;
      if (roll < cumulative) {
        wonCents = prize.cents;
        break;
      }
    }

    // Don't exceed daily cap
    if (wonCents > 0 && earnedToday + wonCents > dailyCap) {
      wonCents = 0;
    }

    if (wonCents > 0) {
      // Upsert daily earnings
      await supabase.from("waiting_spin_earnings").upsert(
        {
          user_id: userId,
          spin_date: today,
          amount_cents: earnedToday + wonCents,
        },
        { onConflict: "user_id,spin_date" }
      );

      // Credit gifted_minutes: convert cents to minutes at $0.02/min rate
      const minutesToCredit = Math.floor(wonCents / 2);
      if (minutesToCredit > 0) {
        await supabase.rpc("atomic_increment_minutes", {
          p_user_id: userId,
          p_amount: minutesToCredit,
        });

        // Also increment gifted_minutes for cashout eligibility
        const { data: mm } = await supabase
          .from("member_minutes")
          .select("gifted_minutes")
          .eq("user_id", userId)
          .single();

        await supabase
          .from("member_minutes")
          .update({ gifted_minutes: (mm?.gifted_minutes ?? 0) + minutesToCredit })
          .eq("user_id", userId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          won: true,
          amount_cents: wonCents,
          amount_display: `$${(wonCents / 100).toFixed(2)}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, won: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
