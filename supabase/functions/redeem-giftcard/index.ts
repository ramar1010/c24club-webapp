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

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { action, giftCardId } = await req.json();

    // List action doesn't require authentication
    if (action === "list") {
      const { data: cards, error } = await supabaseAdmin
        .from("gift_cards")
        .select("id, brand, value_amount, minutes_cost, image_url, status")
        .eq("status", "available")
        .order("brand");

      if (error) throw error;

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

    // All other actions require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    if (action === "redeem") {
      if (!giftCardId) throw new Error("No gift card specified");

      const { data: card, error: cardError } = await supabaseAdmin
        .from("gift_cards")
        .select("*")
        .eq("id", giftCardId)
        .eq("status", "available")
        .single();

      if (cardError || !card) throw new Error("Gift card not available");

      const { data: userMinutes } = await supabaseAdmin
        .from("member_minutes")
        .select("total_minutes")
        .eq("user_id", userId)
        .single();

      if (!userMinutes || userMinutes.total_minutes < card.minutes_cost) {
        throw new Error("Not enough minutes");
      }

      await supabaseAdmin.rpc("atomic_increment_minutes", {
        p_user_id: userId,
        p_amount: -card.minutes_cost,
      });

      await supabaseAdmin
        .from("gift_cards")
        .update({
          status: "claimed",
          claimed_by: userId,
          claimed_at: new Date().toISOString(),
        })
        .eq("id", giftCardId);

      await supabaseAdmin.from("member_redemptions").insert({
        user_id: userId,
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
        .eq("claimed_by", userId)
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
