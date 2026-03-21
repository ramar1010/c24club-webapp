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
    const { type, userId, wagerAmount } = await req.json();

    // GET_SETTINGS: Return wager configuration
    if (type === "get_settings") {
      const { data: settings } = await supabase
        .from("wager_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      return new Response(
        JSON.stringify({ success: true, settings: settings || null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET_STATUS: Return user's daily/weekly wager counts and balance
    if (type === "get_status") {
      if (!userId) {
        return new Response(
          JSON.stringify({ success: false, message: "Not authenticated" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: settings } = await supabase
        .from("wager_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      const today = new Date().toISOString().split("T")[0];
      const { data: todayWagers } = await supabase
        .from("minute_wagers")
        .select("id")
        .eq("user_id", userId)
        .gte("created_at", today + "T00:00:00Z")
        .lte("created_at", today + "T23:59:59Z");

      // Week start (Monday)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - mondayOffset);
      weekStart.setHours(0, 0, 0, 0);

      const { data: weekWagers } = await supabase
        .from("minute_wagers")
        .select("id")
        .eq("user_id", userId)
        .gte("created_at", weekStart.toISOString());

      const { data: mm } = await supabase
        .from("member_minutes")
        .select("total_minutes, gifted_minutes")
        .eq("user_id", userId)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          success: true,
          daily_count: todayWagers?.length ?? 0,
          weekly_count: weekWagers?.length ?? 0,
          max_daily: settings?.max_daily_wagers ?? 3,
          max_weekly: settings?.max_weekly_wagers ?? 10,
          total_minutes: mm?.total_minutes ?? 0,
          gifted_minutes: mm?.gifted_minutes ?? 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET_HISTORY: Return user's wager history
    if (type === "get_history") {
      if (!userId) {
        return new Response(
          JSON.stringify({ success: false, message: "Not authenticated" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data } = await supabase
        .from("minute_wagers")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      return new Response(
        JSON.stringify({ success: true, history: data || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // WAGER: Execute a wager
    if (type === "wager") {
      if (!userId) {
        return new Response(
          JSON.stringify({ success: false, message: "Not authenticated" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const amount = parseInt(wagerAmount, 10);
      if (!amount || isNaN(amount) || amount <= 0) {
        return new Response(
          JSON.stringify({ success: false, message: "Invalid wager amount" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch settings
      const { data: settings } = await supabase
        .from("wager_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (!settings) {
        return new Response(
          JSON.stringify({ success: false, message: "Wager system not configured" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate wager bounds
      if (amount < settings.min_wager_minutes || amount > settings.max_wager_minutes) {
        return new Response(
          JSON.stringify({ success: false, message: `Wager must be between ${settings.min_wager_minutes} and ${settings.max_wager_minutes} minutes` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check daily cap
      const today = new Date().toISOString().split("T")[0];
      const { data: todayWagers } = await supabase
        .from("minute_wagers")
        .select("id")
        .eq("user_id", userId)
        .gte("created_at", today + "T00:00:00Z")
        .lte("created_at", today + "T23:59:59Z");

      if ((todayWagers?.length ?? 0) >= settings.max_daily_wagers) {
        return new Response(
          JSON.stringify({ success: false, message: "daily_cap", max: settings.max_daily_wagers }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check weekly cap
      const now = new Date();
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - mondayOffset);
      weekStart.setHours(0, 0, 0, 0);

      const { data: weekWagers } = await supabase
        .from("minute_wagers")
        .select("id")
        .eq("user_id", userId)
        .gte("created_at", weekStart.toISOString());

      if ((weekWagers?.length ?? 0) >= settings.max_weekly_wagers) {
        return new Response(
          JSON.stringify({ success: false, message: "weekly_cap", max: settings.max_weekly_wagers }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch cashout rate from settings
      const { data: cashoutSettings } = await supabase
        .from("cashout_settings")
        .select("rate_per_minute")
        .limit(1)
        .maybeSingle();
      const ratePerMinute = Number(cashoutSettings?.rate_per_minute ?? 0.12);

      // Check user has enough minutes (must be from earned minutes, not gifted)
      const { data: mm } = await supabase
        .from("member_minutes")
        .select("total_minutes, gifted_minutes")
        .eq("user_id", userId)
        .maybeSingle();

      const totalMinutes = mm?.total_minutes ?? 0;
      const giftedMinutes = mm?.gifted_minutes ?? 0;
      const earnedMinutes = totalMinutes - giftedMinutes;

      if (earnedMinutes < amount) {
        return new Response(
          JSON.stringify({ success: false, message: "insufficient_minutes", available: earnedMinutes }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Determine outcome using weighted random
      const jackpotChance = Number(settings.jackpot_chance_percent);
      const doubleChance = Number(settings.double_chance_percent);
      const cashChance = Number(settings.cash_win_chance_percent);
      // loseChance is the remainder

      const roll = Math.random() * 100;
      let outcome: string;
      let prizeType: string;
      let prizeAmount: number;

      if (roll < jackpotChance) {
        // JACKPOT — $200 cash added to gifted_minutes
        outcome = "jackpot";
        prizeType = "cash";
        prizeAmount = Number(settings.jackpot_amount);
      } else if (roll < jackpotChance + doubleChance) {
        // DOUBLE — 2x minutes back
        outcome = "double";
        prizeType = "minutes";
        prizeAmount = amount * 2;
      } else if (roll < jackpotChance + doubleChance + cashChance) {
        // CASH WIN — wager value converted to cash at DB rate, added to gifted_minutes
        outcome = "cash_win";
        prizeType = "cash";
        prizeAmount = parseFloat((amount * ratePerMinute).toFixed(2));
      } else {
        // LOSE — lose the wagered minutes
        outcome = "lose";
        prizeType = "none";
        prizeAmount = 0;
      }

      // Apply the outcome atomically
      if (outcome === "jackpot") {
        // Deduct wager from total, add jackpot cash value to gifted_minutes
        const jackpotMinutes = Math.floor(Number(settings.jackpot_amount) / ratePerMinute);
        await supabase.from("member_minutes").update({
          total_minutes: totalMinutes - amount + jackpotMinutes,
          gifted_minutes: giftedMinutes + jackpotMinutes,
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);
      } else if (outcome === "double") {
        // Deduct wager, add back double (net gain = wager amount)
        await supabase.from("member_minutes").update({
          total_minutes: totalMinutes - amount + (amount * 2),
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);
      } else if (outcome === "cash_win") {
        // Deduct wager from total, convert to gifted_minutes at DB rate
        const cashMinutes = amount; // same amount but now cashable
        await supabase.from("member_minutes").update({
          total_minutes: totalMinutes, // net zero on total (deduct wager, add back as gifted)
          gifted_minutes: giftedMinutes + cashMinutes,
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);
      } else {
        // LOSE — deduct wagered minutes
        await supabase.from("member_minutes").update({
          total_minutes: Math.max(0, totalMinutes - amount),
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);
      }

      // Record the wager
      const { data: wagerRow } = await supabase.from("minute_wagers").insert({
        user_id: userId,
        wager_amount: amount,
        outcome,
        prize_type: prizeType,
        prize_amount: prizeAmount,
      }).select("id").single();

      // Auto-create pending payout for jackpot wins
      if (outcome === "jackpot" && wagerRow) {
        await supabase.from("jackpot_payouts").insert({
          user_id: userId,
          wager_id: wagerRow.id,
          jackpot_amount: Number(settings.jackpot_amount),
          minutes_credited: Math.floor(Number(settings.jackpot_amount) / ratePerMinute),
          status: "pending",
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          outcome,
          prize_type: prizeType,
          prize_amount: prizeAmount,
          wager_amount: amount,
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
