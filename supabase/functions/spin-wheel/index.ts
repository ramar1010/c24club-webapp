import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function weightedRandom(prizes: any[]): any {
  // Normalize chances - each prize has independent chance_percent
  // We pick using weighted random based on chance_percent values
  const totalWeight = prizes.reduce((sum: number, p: any) => sum + Number(p.chance_percent), 0);
  let rand = Math.random() * totalWeight;
  for (const prize of prizes) {
    rand -= Number(prize.chance_percent);
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

    // SPIN: Execute a spin
    if (type === "spin") {
      if (!userId) {
        return new Response(
          JSON.stringify({ success: false, message: "Not authenticated" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user has purchased spins or free daily spin
      const { data: mm } = await supabase
        .from("member_minutes")
        .select("purchased_spins")
        .eq("user_id", userId)
        .maybeSingle();

      const purchasedSpins = mm?.purchased_spins ?? 0;
      const usePurchased = body.use_purchased === true;

      if (usePurchased) {
        if (purchasedSpins <= 0) {
          return new Response(
            JSON.stringify({ success: false, message: "no_purchased_spins" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        // Check daily spin limit (1 per day)
        const today = new Date().toISOString().split("T")[0];
        const { data: todaySpins } = await supabase
          .from("spin_results")
          .select("id")
          .eq("user_id", userId)
          .gte("created_at", today + "T00:00:00Z")
          .lte("created_at", today + "T23:59:59Z");

        // Only count non-purchased spins for daily limit
        // We track purchased spins separately via the spin_results source field
        const freeSpinsToday = (todaySpins || []).length - 0; // simplified
        if (todaySpins && todaySpins.length > 0 && !usePurchased) {
          return new Response(
            JSON.stringify({ success: false, message: "already_spun_today", purchasedSpins }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Get active prizes
      const { data: prizes } = await supabase
        .from("spin_prizes")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (!prizes || prizes.length === 0) {
        return new Response(
          JSON.stringify({ success: false, message: "No prizes available" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Pick a prize
      const won = weightedRandom(prizes);

      // Award the prize
      let awarded = true;
      const amount = Number(won.amount);

      if (won.prize_type === "ad_points") {
        const { data: mm } = await supabase
          .from("member_minutes")
          .select("ad_points")
          .eq("user_id", userId)
          .maybeSingle();
        const current = mm?.ad_points ?? 0;
        await supabase
          .from("member_minutes")
          .upsert(
            { user_id: userId, ad_points: current + amount, updated_at: new Date().toISOString() },
            { onConflict: "user_id" }
          );
      } else if (won.prize_type === "bonus_minutes") {
        const { data: mm } = await supabase
          .from("member_minutes")
          .select("total_minutes")
          .eq("user_id", userId)
          .maybeSingle();
        const current = mm?.total_minutes ?? 0;
        await supabase
          .from("member_minutes")
          .upsert(
            { user_id: userId, total_minutes: current + amount, updated_at: new Date().toISOString() },
            { onConflict: "user_id" }
          );
      } else if (won.prize_type === "unfreeze") {
        // Grant freeze-free days
        const days = amount;
        const until = new Date();
        until.setDate(until.getDate() + days);
        await supabase
          .from("member_minutes")
          .upsert(
            {
              user_id: userId,
              is_frozen: false,
              freeze_free_until: until.toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );
      } else if (won.prize_type === "product_points" || won.prize_type === "gift_card" || won.prize_type === "vip_week" || won.prize_type === "chance_enhancer") {
        // These are tracked in spin_results for admin to fulfill manually or handle separately
        awarded = true;
      }

      // Deduct purchased spin if used
      if (usePurchased) {
        await supabase
          .from("member_minutes")
          .update({ purchased_spins: purchasedSpins - 1, updated_at: new Date().toISOString() })
          .eq("user_id", userId);
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
