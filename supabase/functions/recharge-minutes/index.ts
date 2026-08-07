import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export const RECHARGE_PACKS = {
  "20": { price_id: "price_1U12e2A5n8uAZoY1rMo8dP1u", minutes: 20, cents: 699 },
  "60": { price_id: "price_1U12eWA5n8uAZoY1qsuLh8fi", minutes: 60, cents: 1799 },
  "150": { price_id: "price_1U12eoA5n8uAZoY1qaUrgQ3v", minutes: 150, cents: 3499 },
} as const;

const APP_ORIGIN = "https://c24club.com";

/** Native IAP SKUs → pack key. Accepts the many shapes the mobile app may send. */
function resolvePackKey(raw: string | undefined | null): "20" | "60" | "150" | null {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  const m = s.match(/(20|60|150)/);
  if (!m) return null;
  return m[1] as "20" | "60" | "150";
}

async function sha256Hex(input: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Validate an Apple / Google receipt. Mirrors iap-purchases behaviour. */
async function verifyNativeReceipt(platform: string, purchaseToken: string) {
  if (!purchaseToken) throw new Error("Missing purchaseToken");
  if (platform === "ios") {
    const secret = Deno.env.get("IOS_SHARED_SECRET");
    if (!secret) {
      console.warn("[recharge-minutes] IOS_SHARED_SECRET not set — skipping Apple verification");
      return true;
    }
    const callApple = async (url: string) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "receipt-data": purchaseToken,
          password: secret,
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
    console.warn("[recharge-minutes] Google verification not configured — skipping");
    return true;
  }
  throw new Error("Unknown platform");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: authData } = await supabaseClient.auth.getUser(token);
    const user = authData.user;
    if (!user?.email) throw new Error("Not authenticated");

    const body = await req.json().catch(() => ({}));
    const { action, pack, session_id, sku, purchaseToken, platform, transactionId } = body as any;

    const isTestMode = Deno.env.get("STRIPE_TEST_MODE") === "true";
    const stripeKey = isTestMode ? Deno.env.get("STRIPE_SECRET_KEY_TEST")! : Deno.env.get("STRIPE_SECRET_KEY")!;

    if (action === "balance") {
      const { data } = await supabaseAdmin
        .from("member_minutes")
        .select("recharge_minutes")
        .eq("user_id", user.id)
        .maybeSingle();
      return new Response(JSON.stringify({ success: true, rechargeMinutes: data?.recharge_minutes ?? 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create-checkout") {
      const selected = RECHARGE_PACKS[String(pack) as keyof typeof RECHARGE_PACKS];
      if (!selected) throw new Error("Invalid pack");

      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

      const { data: purchase, error: purchaseError } = await supabaseAdmin
        .from("recharge_purchases")
        .insert({
          user_id: user.id,
          pack_key: String(pack),
          minutes: selected.minutes,
          price_cents: selected.cents,
          status: "pending",
        })
        .select("id")
        .single();
      if (purchaseError) throw new Error("Failed to create purchase record");

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{ price: selected.price_id, quantity: 1 }],
        mode: "payment",
        success_url: `${APP_ORIGIN}/recharge-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${APP_ORIGIN}/recharge-success?cancelled=true`,
        metadata: {
          purchase_id: purchase.id,
          user_id: user.id,
          minutes: String(selected.minutes),
        },
      });

      await supabaseAdmin
        .from("recharge_purchases")
        .update({ stripe_session_id: session.id })
        .eq("id", purchase.id);

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      // ── Native in-app purchase (iOS / Android) ──────────────────────────
      if (!session_id) {
        const packKey = resolvePackKey(sku ?? pack);
        if (!packKey) throw new Error("Invalid or missing sku");
        const selected = RECHARGE_PACKS[packKey];

        await verifyNativeReceipt(String(platform ?? "").toLowerCase(), purchaseToken);

        // Idempotency: reuse the unique stripe_session_id index with an iap: key
        const txKey = String(transactionId ?? purchaseToken ?? "").slice(0, 4096);
        const idempotencyKey = `iap:${platform ?? "native"}:${packKey}:${(await sha256Hex(txKey)).slice(0, 40)}`;

        const { data: existing } = await supabaseAdmin
          .from("recharge_purchases")
          .select("id, status")
          .eq("stripe_session_id", idempotencyKey)
          .maybeSingle();

        if (existing) {
          const { data: current } = await supabaseAdmin
            .from("member_minutes")
            .select("recharge_minutes")
            .eq("user_id", user.id)
            .maybeSingle();
          return new Response(
            JSON.stringify({
              success: true,
              already_processed: true,
              minutes: selected.minutes,
              rechargeMinutes: current?.recharge_minutes ?? 0,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const { error: insertError } = await supabaseAdmin.from("recharge_purchases").insert({
          user_id: user.id,
          pack_key: packKey,
          minutes: selected.minutes,
          price_cents: selected.cents,
          status: "completed",
          stripe_session_id: idempotencyKey,
        });
        if (insertError) {
          // Unique violation = another concurrent verify already credited it
          if ((insertError as any).code === "23505") {
            return new Response(
              JSON.stringify({ success: true, already_processed: true, minutes: selected.minutes }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
          throw new Error("Failed to record purchase");
        }

        const { data: newBalance } = await supabaseAdmin.rpc("add_recharge_minutes", {
          p_user_id: user.id,
          p_amount: selected.minutes,
        });

        return new Response(
          JSON.stringify({
            success: true,
            minutes: selected.minutes,
            rechargeMinutes: newBalance ?? selected.minutes,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // ── Stripe Checkout (web) ───────────────────────────────────────────
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      const session = await stripe.checkout.sessions.retrieve(session_id);

      if (session.payment_status !== "paid") {
        return new Response(JSON.stringify({ success: false, reason: "not_paid" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const purchaseId = session.metadata?.purchase_id;
      const minutes = parseInt(session.metadata?.minutes || "0", 10);
      if (!purchaseId || minutes <= 0) throw new Error("Invalid session metadata");

      const { data: purchase } = await supabaseAdmin
        .from("recharge_purchases")
        .select("id, user_id, status")
        .eq("id", purchaseId)
        .maybeSingle();
      if (!purchase) throw new Error("Purchase not found");

      if (purchase.status === "completed") {
        return new Response(JSON.stringify({ success: true, already_processed: true, minutes }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark completed first (unique guard) so a double-verify can't double-credit
      const { data: claimed } = await supabaseAdmin
        .from("recharge_purchases")
        .update({ status: "completed" })
        .eq("id", purchaseId)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      if (!claimed) {
        return new Response(JSON.stringify({ success: true, already_processed: true, minutes }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: newBalance } = await supabaseAdmin.rpc("add_recharge_minutes", {
        p_user_id: purchase.user_id,
        p_amount: minutes,
      });

      return new Response(JSON.stringify({ success: true, minutes, rechargeMinutes: newBalance ?? minutes }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unknown action");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
