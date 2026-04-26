import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MINUTE_MAP: Record<string, number> = {
  c24_gift_100_minutes: 100,
  c24_gift_400_minutes: 400,
  c24_gift_600_minutes: 600,
  c24_gift_1000_minutes: 1000,
};

const SENDER_BONUS_MAP: Record<string, number> = {
  c24_gift_100_minutes: 0,
  c24_gift_400_minutes: 100,
  c24_gift_600_minutes: 150,
  c24_gift_1000_minutes: 250,
};

const CASH_VALUE_MAP: Record<string, number> = {
  c24_gift_100_minutes: 1.0,
  c24_gift_400_minutes: 4.0,
  c24_gift_600_minutes: 6.0,
  c24_gift_1000_minutes: 10.0,
};

/**
 * Resolve the VIP tier from any incoming SKU.
 * Anything containing "premium" → premium, otherwise basic.
 * This protects against minor SKU naming differences (e.g. `c24club_premium_vip`
 * vs `c24_premium_vip`) that previously caused premium buyers to be saved as basic.
 */
const resolveVipTier = (sku: string): "basic" | "premium" => {
  const normalized = (sku || "").toLowerCase();
  if (normalized.includes("premium")) return "premium";
  return "basic";
};

const tokenHash = (token?: string): string | null => {
  if (!token || typeof token !== "string") return null;
  return token.length <= 12 ? token : `…${token.slice(-12)}`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl) throw new Error("SUPABASE_URL env var is missing");
    if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY env var is missing");

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
    const { action, sku, purchaseToken, platform } = body;

    const verifyReceipt = async (): Promise<boolean> => {
      if (!purchaseToken) throw new Error("Missing purchaseToken");

      if (platform === "ios") {
        const IOS_SHARED_SECRET = Deno.env.get("IOS_SHARED_SECRET");
        if (!IOS_SHARED_SECRET) {
          console.warn("IOS_SHARED_SECRET not set — skipping Apple verification (stub).");
          return true;
        }
        const verifyUrl = "https://buy.itunes.apple.com/verifyReceipt";
        const sandboxUrl = "https://sandbox.itunes.apple.com/verifyReceipt";
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
          return await res.json();
        };
        let result = await callApple(verifyUrl);
        if (result.status === 21007) result = await callApple(sandboxUrl);
        if (result.status !== 0) throw new Error(`Apple verification failed: status ${result.status}`);
        return true;
      }

      if (platform === "android") {
        const GOOGLE_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
        if (!GOOGLE_KEY) {
          console.warn("GOOGLE_SERVICE_ACCOUNT_KEY not set — skipping Google verification (stub).");
          return true;
        }
        return true;
      }

      throw new Error("Unknown platform");
    };

    if (action === "verify-subscription") {
      if (!sku) throw new Error("Missing sku");
      await verifyReceipt();
      const tier = resolveVipTier(sku);
      const now = new Date();
      const expiresAt =
        tier === "premium"
          ? new Date(now.setMonth(now.getMonth() + 1)).toISOString()
          : new Date(now.setDate(now.getDate() + 7)).toISOString();
      const { error: updateError } = await supabaseAdmin
        .from("member_minutes")
        .upsert({ user_id: user.id, is_vip: true, vip_tier: tier, subscription_end: expiresAt }, { onConflict: "user_id" });
      if (updateError) throw updateError;
      await supabaseAdmin.from("iap_purchases").insert({
        user_id: user.id,
        platform: platform ?? "unknown",
        sku,
        action,
        vip_tier: tier,
        purchase_token_hash: tokenHash(purchaseToken),
      });
      console.log(`[iap-purchases] subscription ok user=${user.id} sku=${sku} tier=${tier}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify-minutes") {
      if (!sku) throw new Error("Missing sku");
      const minutesToAdd = MINUTE_MAP[sku];
      if (!minutesToAdd) throw new Error(`Unknown product sku: ${sku}`);
      await verifyReceipt();
      const { data: current, error: fetchError } = await supabaseAdmin
        .from("member_minutes")
        .select("total_minutes")
        .eq("user_id", user.id)
        .maybeSingle();
      if (fetchError) throw fetchError;
      const existingMinutes = current?.total_minutes ?? 0;
      const { error: updateError } = await supabaseAdmin
        .from("member_minutes")
        .upsert({ user_id: user.id, total_minutes: existingMinutes + minutesToAdd }, { onConflict: "user_id" });
      if (updateError) throw updateError;
      await supabaseAdmin.from("iap_purchases").insert({
        user_id: user.id,
        platform: platform ?? "unknown",
        sku,
        action,
        minutes_added: minutesToAdd,
        purchase_token_hash: tokenHash(purchaseToken),
      });
      return new Response(JSON.stringify({ success: true, minutes_added: minutesToAdd }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify-gift") {
      if (!sku) throw new Error("Missing sku");
      const { recipient_id } = body;
      if (!recipient_id) throw new Error("Missing recipient_id");
      const minutesToGift = MINUTE_MAP[sku];
      const senderBonus = SENDER_BONUS_MAP[sku] ?? 0;
      const cashValue = CASH_VALUE_MAP[sku] ?? 0;
      if (!minutesToGift) throw new Error(`Unknown product sku: ${sku}`);

      await verifyReceipt();

      const { data: recipientData, error: recipientFetchError } = await supabaseAdmin
        .from("member_minutes")
        .select("gifted_minutes")
        .eq("user_id", recipient_id)
        .maybeSingle();
      if (recipientFetchError) throw recipientFetchError;

      if (recipientData) {
        const existingGifted = recipientData.gifted_minutes ?? 0;
        const { error: recipientUpdateError } = await supabaseAdmin
          .from("member_minutes")
          .update({ gifted_minutes: existingGifted + minutesToGift })
          .eq("user_id", recipient_id);
        if (recipientUpdateError) throw recipientUpdateError;
      }

      const { error: giftTxError } = await supabaseAdmin
        .from("gift_transactions")
        .insert({ sender_id: user.id, recipient_id, minutes_amount: minutesToGift, price_cents: Math.round(cashValue * 100), status: "completed" });
      if (giftTxError) console.warn("[verify-gift] gift_transactions insert error:", giftTxError.message);

      if (senderBonus > 0) {
        const { data: senderData } = await supabaseAdmin
          .from("member_minutes")
          .select("total_minutes")
          .eq("user_id", user.id)
          .maybeSingle();
        if (senderData) {
          await supabaseAdmin
            .from("member_minutes")
            .update({ total_minutes: (senderData.total_minutes ?? 0) + senderBonus })
            .eq("user_id", user.id);
        }
      }

      await supabaseAdmin.from("iap_purchases").insert({
        user_id: user.id,
        platform: platform ?? "unknown",
        sku,
        action,
        minutes_added: minutesToGift,
        recipient_id,
        purchase_token_hash: tokenHash(purchaseToken),
      });

      return new Response(JSON.stringify({ success: true, minutes_gifted: minutesToGift, sender_bonus: senderBonus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify-unfreeze") {
      await verifyReceipt();
      const freezeFreeUntil = new Date();
      freezeFreeUntil.setDate(freezeFreeUntil.getDate() + 7);

      const { error: updateError } = await supabaseAdmin
        .from("member_minutes")
        .update({
          is_frozen: false,
          frozen_at: null,
          freeze_free_until: freezeFreeUntil.toISOString(),
          frozen_cap_popup_shown: false,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (updateError) throw updateError;
      await supabaseAdmin.from("iap_purchases").insert({
        user_id: user.id,
        platform: platform ?? "unknown",
        sku: sku ?? "c24_unfreeze",
        action,
        purchase_token_hash: tokenHash(purchaseToken),
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: any) {
    console.error("Error in iap-purchases function:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
