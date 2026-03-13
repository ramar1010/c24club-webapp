import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("Not authenticated");

    const { action, giftCardId } = await req.json();

    if (action === "list") {
      // List available gift cards (grouped by brand + value, showing count)
      const { data: cards, error } = await supabaseAdmin
        .from("gift_cards")
        .select("id, brand, value_amount, minutes_cost, image_url, status")
        .eq("status", "available")
        .order("brand");

      if (error) throw error;

      // Group by brand + value_amount + minutes_cost
      const grouped: Record<string, { brand: string; value_amount: number; minutes_cost: number; image_url: string | null; count: number; sample_id: string }> = {};
      for (const card of cards || []) {
        const key = `${card.brand}-${card.value_amount}-${card.minutes_cost}`;
        if (!grouped[key]) {
          grouped[key] = {
            brand: card.brand,
            value_amount: card.value_amount,
            minutes_cost: card.minutes_cost,
            image_url: card.image_url,
            count: 0,
            sample_id: card.id,
          };
        }
        grouped[key].count++;
      }

      return new Response(JSON.stringify({ cards: Object.values(grouped) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "redeem") {
      if (!giftCardId) throw new Error("No gift card specified");

      // Get the gift card
      const { data: card, error: cardError } = await supabaseAdmin
        .from("gift_cards")
        .select("*")
        .eq("id", giftCardId)
        .eq("status", "available")
        .single();

      if (cardError || !card) throw new Error("Gift card not available");

      // Check user balance
      const { data: userMinutes } = await supabaseAdmin
        .from("member_minutes")
        .select("total_minutes")
        .eq("user_id", user.id)
        .single();

      if (!userMinutes || userMinutes.total_minutes < card.minutes_cost) {
        throw new Error("Not enough minutes");
      }

      // Deduct minutes
      await supabaseAdmin.rpc("atomic_increment_minutes", {
        p_user_id: user.id,
        p_amount: -card.minutes_cost,
      });

      // Mark card as claimed
      await supabaseAdmin
        .from("gift_cards")
        .update({
          status: "claimed",
          claimed_by: user.id,
          claimed_at: new Date().toISOString(),
        })
        .eq("id", giftCardId);

      // Record in member_redemptions
      await supabaseAdmin.from("member_redemptions").insert({
        user_id: user.id,
        reward_title: `${card.brand} $${card.value_amount} Gift Card`,
        reward_type: "giftcard",
        reward_rarity: "common",
        minutes_cost: card.minutes_cost,
        status: "completed",
        notes: `Code: ${card.code}`,
      });

      return new Response(JSON.stringify({
        success: true,
        code: card.code,
        brand: card.brand,
        value_amount: card.value_amount,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "my-cards") {
      const { data: cards, error } = await supabaseAdmin
        .from("gift_cards")
        .select("id, brand, value_amount, code, claimed_at")
        .eq("claimed_by", user.id)
        .eq("status", "claimed")
        .order("claimed_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ cards: cards || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
