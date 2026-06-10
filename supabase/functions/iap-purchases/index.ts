import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MINUTE_MAP: Record<string, number> = {
  c24_gift_100_minutes: 100,
  c24_gift_400_minutes: 400,
  c24_gift_600_minutes: 600,
  c24_gift_1000_minutes: 1000,
  "100minutes": 100,
  "400minutes": 400,
  "600minutes": 600,
  "1000minutes": 1000,
};

const SENDER_BONUS_MAP: Record<string, number> = {
  c24_gift_100_minutes: 0,
  c24_gift_400_minutes: 100,
  c24_gift_600_minutes: 150,
  c24_gift_1000_minutes: 250,
  "100minutes": 0,
  "400minutes": 100,
  "600minutes": 150,
  "1000minutes": 250,
};

const CASH_VALUE_MAP: Record<string, number> = {
  c24_gift_100_minutes: 1.0,
  c24_gift_400_minutes: 4.0,
  c24_gift_600_minutes: 6.0,
  c24_gift_1000_minutes: 10.0,
  "100minutes": 1.0,
  "400minutes": 4.0,
  "600minutes": 6.0,
  "1000minutes": 10.0,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);
    if (authError || !user?.id) throw new Error("Not authenticated");

    const body = await req.json();
    const { action: rawAction, purchaseToken, platform } = body;
    const action = rawAction?.toLowerCase();
    // Always normalize SKU to lowercase so iOS SKUs like "100minutes" match
    const sku = body.sku?.toLowerCase();

    console.log(`[iap-purchases] action=${action} sku=${sku} platform=${platform}`);

    const verifyReceipt = async () => {
      if (!purchaseToken) throw new Error("Missing purchaseToken");
      const IOS_SHARED_SECRET = Deno.env.get("IOS_SHARED_SECRET");
      if (platform === "ios") {
        if (!IOS_SHARED_SECRET) {
          console.warn("IOS_SHARED_SECRET not set — skipping Apple verification.");
          return true;
        }
        const callApple = async (url: string) => {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              "receipt-data": purchaseToken,
              password: IOS_SHARED_SECRET,
              "exclude-old-transactions": true,
            }),
          });
          return res.json();
        };
        let result = await callApple("https://buy.itunes.apple.com/verifyReceipt");
        if (result.status === 21007) result = await callApple("https://sandbox.itunes.apple.com/verifyReceipt");
        if (result.status !== 0) throw new Error(`Apple verification failed: status ${result.status}`);
        return true;
      }
      if (platform === "android") {
        console.warn("GOOGLE verification not configured — skipping.");
        return true;
      }
      throw new Error("Unknown platform");
    };

    // ── verify-subscription ──────────────────────────────────────────────
    if (action === "verify-subscription" || action === "restore-subscription" || action === "restore_subscription") {
      if (!sku) throw new Error("Missing sku");
      await verifyReceipt();
      const tier = sku === "c24_premium_vip" || sku === "premiumvip" ? "premium" : "basic";
      const { error } = await supabaseAdmin
        .from("member_minutes")
        .upsert({ user_id: user.id, is_vip: true, vip_tier: tier }, { onConflict: "user_id" });
      if (error) throw error;

      // KPI: log to vip_purchase_intents so the admin analytics dashboard
      // shows native (iOS / Android) purchases alongside Stripe web purchases.
      // Skip pure restores so they don't inflate "new purchase" counts.
      if (action === "verify-subscription") {
        const sourceFromBody = typeof body.source === "string" && body.source.trim().length > 0
          ? body.source.trim()
          : (platform === "ios" ? "ios_native_vip" : platform === "android" ? "android_native_vip" : "native_vip");
        try {
          await supabaseAdmin.from("vip_purchase_intents").insert({
            user_id: user.id,
            source: sourceFromBody,
            price_id: sku,
            tier,
            completed: true,
            completed_at: new Date().toISOString(),
          });
        } catch (logErr) {
          console.error("[iap-purchases] failed to log vip_purchase_intents:", logErr);
        }
      }

      return new Response(JSON.stringify({ success: true, tier }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── verify-gift ──────────────────────────────────────────────────────
    if (action === "verify-gift") {
      if (!sku) throw new Error("Missing sku");
      const { recipient_id } = body;
      if (!recipient_id) throw new Error("Missing recipient_id");

      const minutesToGift = MINUTE_MAP[sku];
      const senderBonus = SENDER_BONUS_MAP[sku] ?? 0;
      const cashValue = CASH_VALUE_MAP[sku] ?? 0;
      if (!minutesToGift) throw new Error(`Unknown product sku: ${sku}`);

      await verifyReceipt();

      const { data: recipientData } = await supabaseAdmin
        .from("member_minutes")
        .select("gifted_minutes")
        .eq("user_id", recipient_id)
        .maybeSingle();
      if (recipientData) {
        await supabaseAdmin
          .from("member_minutes")
          .update({ gifted_minutes: (recipientData.gifted_minutes ?? 0) + minutesToGift })
          .eq("user_id", recipient_id);
      }

      await supabaseAdmin
        .from("gift_transactions")
        .insert({
          sender_id: user.id,
          recipient_id,
          minutes: minutesToGift,
          cash_value: cashValue,
          status: "completed",
        });

      if (senderBonus > 0) {
        const { data: senderData } = await supabaseAdmin
          .from("member_minutes")
          .select("minutes")
          .eq("user_id", user.id)
          .maybeSingle();
        if (senderData) {
          await supabaseAdmin
            .from("member_minutes")
            .update({ minutes: (senderData.minutes ?? 0) + senderBonus })
            .eq("user_id", user.id);
        }
      }

      return new Response(JSON.stringify({ success: true, minutes_gifted: minutesToGift, sender_bonus: senderBonus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── verify-unfreeze ──────────────────────────────────────────────────
    if (action === "verify-unfreeze") {
      if (sku !== "c24_minute_unfreeze" && sku !== "unfreeze_minutes")
        throw new Error(`Invalid SKU for unfreeze: ${sku}`);
      await verifyReceipt();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      const { error } = await supabaseAdmin
        .from("member_minutes")
        .update({ is_frozen: false, frozen_at: null, freeze_free_until: sevenDaysFromNow.toISOString() })
        .eq("user_id", user.id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── verify-unban ─────────────────────────────────────────────────────
    if (action === "verify-unban") {
      if (sku !== "c24_unban_10" && sku !== "unbanme") throw new Error(`Invalid SKU for unban: ${sku}`);
      await verifyReceipt();
      const { error } = await supabaseAdmin
        .from("user_bans")
        .update({ is_active: false, unbanned_at: new Date().toISOString(), unban_payment_session: purchaseToken })
        .eq("user_id", user.id)
        .eq("is_active", true);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, unbanned: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── vip-unfreeze ─────────────────────────────────────────────────────
    if (action === "vip-unfreeze") {
      const { data: minutes, error: fetchError } = await supabaseAdmin
        .from("member_minutes")
        .select("is_vip, admin_granted_vip, vip_unfreezes_used")
        .eq("user_id", user.id)
        .maybeSingle();
      if (fetchError) throw fetchError;
      if (!minutes?.is_vip && !minutes?.admin_granted_vip) throw new Error("User is not VIP");
      const { error } = await supabaseAdmin
        .from("member_minutes")
        .update({ is_frozen: false, frozen_at: null, vip_unfreezes_used: (minutes.vip_unfreezes_used || 0) + 1 })
        .eq("user_id", user.id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── verify-minutes ───────────────────────────────────────────────────
    if (action === "verify-minutes") {
      if (!sku) throw new Error("Missing sku");
      const minutesToAdd = MINUTE_MAP[sku];
      if (!minutesToAdd) throw new Error(`Unknown product sku: ${sku}`);
      await verifyReceipt();
      const { data: current } = await supabaseAdmin
        .from("member_minutes")
        .select("minutes")
        .eq("user_id", user.id)
        .maybeSingle();
      const { error } = await supabaseAdmin
        .from("member_minutes")
        .upsert({ user_id: user.id, minutes: (current?.minutes ?? 0) + minutesToAdd }, { onConflict: "user_id" });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, minutes_added: minutesToAdd }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: any) {
    console.error("iap-purchases error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
