import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

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

  // Authenticate user
  const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
  const authHeader = req.headers.get("Authorization")!;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabaseAnon.auth.getUser(token);
  if (!user) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { action, rewardId, shipping, paypalEmail } = await req.json();

    // ─── Shared helpers ───
    const getReward = async (id: string) => {
      const { data, error } = await supabase.from("rewards").select("*").eq("id", id).single();
      if (error || !data) throw new Error("Reward not found");
      return data;
    };

    const checkDuplicateAddress = async (shipping: any) => {
      if (!shipping?.address || shipping.address.trim() === "") return;
      const normalizedAddress = shipping.address.trim().toLowerCase();
      const normalizedCity = (shipping.city || "").trim().toLowerCase();
      const normalizedZip = (shipping.zip || "").trim().toLowerCase();
      const normalizedCountry = (shipping.country || "").trim().toLowerCase();

      const { data: existingAddresses } = await supabase
        .from("member_redemptions")
        .select("id, user_id, shipping_address, shipping_city, shipping_zip, shipping_country")
        .neq("user_id", user!.id)
        .not("shipping_address", "is", null);

      if (existingAddresses && existingAddresses.length > 0) {
        const duplicate = existingAddresses.find((r) => {
          return (r.shipping_address || "").trim().toLowerCase() === normalizedAddress &&
            (r.shipping_city || "").trim().toLowerCase() === normalizedCity &&
            (r.shipping_zip || "").trim().toLowerCase() === normalizedZip &&
            (r.shipping_country || "").trim().toLowerCase() === normalizedCountry;
        });
        if (duplicate) {
          throw new Error("Address Taken — this shipping address is already registered to another account.");
        }
      }
    };

    const getVipStatus = async () => {
      const { data } = await supabase.from("member_minutes").select("is_vip, vip_tier").eq("user_id", user!.id).maybeSingle();
      return { isVip: data?.is_vip ?? false, vipTier: data?.vip_tier ?? null };
    };

    const createStripeCheckout = async (shippingFee: number, rewardTitle: string, redemptionId: string) => {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
      const customers = await stripe.customers.list({ email: user!.email!, limit: 1 });
      const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user!.email!,
        line_items: [{
          price_data: { currency: "usd", product_data: { name: `Shipping Fee - ${rewardTitle}` }, unit_amount: Math.round(shippingFee * 100) },
          quantity: 1,
        }],
        mode: "payment",
        metadata: { redemption_id: redemptionId },
        success_url: `${req.headers.get("origin")}/my-rewards?payment=success`,
        cancel_url: `${req.headers.get("origin")}/store?payment=canceled`,
      });

      await supabase.from("member_redemptions").update({ status: "pending_payment", notes: `stripe_session:${session.id}` }).eq("id", redemptionId);
      return session;
    };

    // ─── ACTION: cashout-legendary (Premium VIP wins legendary & chooses cash) ───
    if (action === "cashout-legendary") {
      const reward = await getReward(rewardId);
      
      if (reward.rarity !== "legendary") {
        throw new Error("Only legendary items can be cashed out");
      }
      
      const cashoutValue = Number(reward.cashout_value) || 0;
      if (cashoutValue <= 0) {
        throw new Error("This item has no cashout value");
      }

      const { isVip, vipTier } = await getVipStatus();
      if (!isVip || vipTier !== "premium") {
        throw new Error("Only Premium VIP members can cash out legendary items");
      }

      // Deduct minutes (and proportionally reduce gifted_minutes)
      const { data: memberData } = await supabase.from("member_minutes").select("total_minutes, gifted_minutes").eq("user_id", user.id).maybeSingle();
      const totalMinutes = memberData?.total_minutes ?? 0;
      const giftedMins = (memberData as any)?.gifted_minutes ?? 0;
      if (totalMinutes < reward.minutes_cost) {
        throw new Error("Not enough minutes");
      }
      const newGifted = Math.max(0, giftedMins - reward.minutes_cost);
      await supabase.from("member_minutes").update({ total_minutes: totalMinutes - reward.minutes_cost, gifted_minutes: Math.min(newGifted, totalMinutes - reward.minutes_cost), updated_at: new Date().toISOString() }).eq("user_id", user.id);

      // Create redemption with cashout info
      const { error: insertErr } = await supabase.from("member_redemptions").insert({
        user_id: user.id,
        reward_id: reward.id,
        reward_title: reward.title,
        reward_image_url: reward.image_url,
        reward_rarity: "legendary",
        reward_type: reward.delivery === "digital" ? "giftcard" : "product",
        minutes_cost: reward.minutes_cost,
        status: "processing",
        cashout_amount: cashoutValue,
        cashout_paypal: paypalEmail || null,
        cashout_status: "pending",
        notes: `Legendary cashout: $${cashoutValue.toFixed(2)}${paypalEmail ? ` → ${paypalEmail}` : ""}`,
      });

      if (insertErr) {
        // Refund minutes
        await supabase.from("member_minutes").update({ total_minutes: totalMinutes, updated_at: new Date().toISOString() }).eq("user_id", user.id);
        throw insertErr;
      }

      // Reset the cashout value on the reward to $0
      await supabase.from("rewards").update({ cashout_value: 0 }).eq("id", reward.id);

      return new Response(JSON.stringify({ success: true, cashoutAmount: cashoutValue }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ACTION: create-redemption (standard, costs minutes) ───
    if (action === "create-redemption") {
      const reward = await getReward(rewardId);
      await checkDuplicateAddress(shipping);

      // Check user has enough minutes
      const { data: memberData } = await supabase.from("member_minutes").select("total_minutes").eq("user_id", user.id).maybeSingle();
      const totalMinutes = memberData?.total_minutes ?? 0;
      if (totalMinutes < reward.minutes_cost) {
        return new Response(JSON.stringify({ error: "Not enough minutes" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Deduct minutes
      await supabase.from("member_minutes").update({ total_minutes: totalMinutes - reward.minutes_cost, updated_at: new Date().toISOString() }).eq("user_id", user.id);

      // Create redemption
      const { data: redemption, error: insertErr } = await supabase.from("member_redemptions").insert({
        user_id: user.id, reward_id: reward.id, reward_title: reward.title, reward_image_url: reward.image_url,
        reward_rarity: reward.rarity, reward_type: reward.delivery === "digital" ? "giftcard" : "product",
        minutes_cost: reward.minutes_cost, status: "pending_shipping",
        shipping_name: shipping?.firstName && shipping?.lastName ? `${shipping.firstName} ${shipping.lastName}` : null,
        shipping_address: shipping?.address || null, shipping_city: shipping?.city || null,
        shipping_state: shipping?.state || null, shipping_zip: shipping?.zip || null,
        shipping_country: shipping?.country || null, notes: shipping?.notes || null,
      }).select().single();

      if (insertErr) {
        await supabase.from("member_minutes").update({ total_minutes: totalMinutes, updated_at: new Date().toISOString() }).eq("user_id", user.id);
        throw insertErr;
      }

      let shippingFee = Number(reward.shipping_fee) || 0;
      const { isVip, vipTier } = await getVipStatus();
      if (isVip && vipTier === "premium") shippingFee = 0;

      if (shippingFee > 0) {
        const session = await createStripeCheckout(shippingFee, reward.title, redemption.id);
        return new Response(JSON.stringify({ success: true, requiresPayment: true, checkoutUrl: session.url, redemptionId: redemption.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabase.from("member_redemptions").update({ status: "processing" }).eq("id", redemption.id);
      return new Response(JSON.stringify({ success: true, requiresPayment: false, redemptionId: redemption.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── ACTION: create-free-redemption (link clicks reward, no minutes cost) ───
    if (action === "create-free-redemption") {
      const reward = await getReward(rewardId);
      await checkDuplicateAddress(shipping);

      // Verify user actually has unclaimed link-click rewards
      const { data: userPromos } = await supabase.from("promos").select("id").eq("member_id", user.id);
      if (!userPromos || userPromos.length === 0) {
        return new Response(JSON.stringify({ error: "No promos found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const promoIds = userPromos.map((p) => p.id);
      const { data: clickData } = await supabase.from("promo_analytics").select("id").in("promo_id", promoIds).eq("link_clicked", true);
      const totalClicks = clickData?.length ?? 0;

      const { data: claimedData } = await supabase.from("member_redemptions").select("id").eq("user_id", user.id).eq("reward_type", "promo_link_clicks");
      const claimed = claimedData?.length ?? 0;

      const THRESHOLD = 200;
      const available = Math.floor(totalClicks / THRESHOLD) - claimed;
      if (available <= 0) {
        return new Response(JSON.stringify({ error: "Not enough link clicks to claim a reward" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Create redemption — no minutes deducted
      const { data: redemption, error: insertErr } = await supabase.from("member_redemptions").insert({
        user_id: user.id, reward_id: reward.id, reward_title: reward.title, reward_image_url: reward.image_url,
        reward_rarity: reward.rarity, reward_type: "promo_link_clicks",
        minutes_cost: 0, status: "pending_shipping",
        shipping_name: shipping?.firstName && shipping?.lastName ? `${shipping.firstName} ${shipping.lastName}` : null,
        shipping_address: shipping?.address || null, shipping_city: shipping?.city || null,
        shipping_state: shipping?.state || null, shipping_zip: shipping?.zip || null,
        shipping_country: shipping?.country || null, notes: shipping?.notes ? `${shipping.notes} | Link clicks reward` : "Link clicks reward",
      }).select().single();

      if (insertErr) throw insertErr;

      let shippingFee = Number(reward.shipping_fee) || 0;
      const { isVip, vipTier } = await getVipStatus();
      if (isVip && vipTier === "premium") shippingFee = 0;

      if (shippingFee > 0) {
        const session = await createStripeCheckout(shippingFee, reward.title, redemption.id);
        return new Response(JSON.stringify({ success: true, requiresPayment: true, checkoutUrl: session.url, redemptionId: redemption.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabase.from("member_redemptions").update({ status: "processing" }).eq("id", redemption.id);
      return new Response(JSON.stringify({ success: true, requiresPayment: false, redemptionId: redemption.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── ACTION: redeem-instant (spins or ad points, no shipping) ───
    if (action === "redeem-instant") {
      const reward = await getReward(rewardId);
      
      const rewardType = reward.type;
      if (rewardType !== "Spins" && rewardType !== "Ad Points") {
        throw new Error("This reward type cannot be redeemed instantly");
      }

      const grantAmount = reward.grant_amount || 0;
      if (grantAmount <= 0) {
        throw new Error("This reward has no grant amount configured");
      }

      // Check user has enough minutes
      const { data: memberData } = await supabase.from("member_minutes").select("total_minutes, purchased_spins, ad_points").eq("user_id", user.id).maybeSingle();
      const totalMinutes = memberData?.total_minutes ?? 0;
      if (totalMinutes < reward.minutes_cost) {
        return new Response(JSON.stringify({ error: "Not enough minutes" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Deduct minutes and credit spins or ad points
      const updatePayload: Record<string, any> = {
        total_minutes: totalMinutes - reward.minutes_cost,
        updated_at: new Date().toISOString(),
      };

      if (rewardType === "Spins") {
        updatePayload.purchased_spins = (memberData?.purchased_spins ?? 0) + grantAmount;
      } else {
        updatePayload.ad_points = (memberData?.ad_points ?? 0) + grantAmount;
      }

      const { error: updateErr } = await supabase.from("member_minutes").update(updatePayload).eq("user_id", user.id);
      if (updateErr) throw updateErr;

      // Create redemption record
      const { error: insertErr } = await supabase.from("member_redemptions").insert({
        user_id: user.id,
        reward_id: reward.id,
        reward_title: reward.title,
        reward_image_url: reward.image_url,
        reward_rarity: reward.rarity,
        reward_type: rewardType === "Spins" ? "spins" : "ad_points",
        minutes_cost: reward.minutes_cost,
        status: "completed",
        notes: `Instant: +${grantAmount} ${rewardType === "Spins" ? "spins" : "ad points"}`,
      });

      if (insertErr) {
        // Refund on failure
        const refundPayload: Record<string, any> = { total_minutes: totalMinutes, updated_at: new Date().toISOString() };
        if (rewardType === "Spins") refundPayload.purchased_spins = memberData?.purchased_spins ?? 0;
        else refundPayload.ad_points = memberData?.ad_points ?? 0;
        await supabase.from("member_minutes").update(refundPayload).eq("user_id", user.id);
        throw insertErr;
      }

      return new Response(JSON.stringify({ success: true, grantAmount, grantType: rewardType }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
