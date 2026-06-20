import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const VIP_TIERS: Record<string, string> = {
  "prod_U8FATJpBAXNSXy": "basic",
  "prod_U8FBD9R49k8Kvd": "premium",
};

const log = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-BOUNTY-WEBHOOK] ${step}${d}`);
};

const OWNER_ID = "6f8bb0e2-a36a-4bc0-920f-312c340f7921";

async function sendBountyNotifications(
  supabase: any,
  args: { femaleId: string; minutes: number; streakAwarded: boolean; tier: string }
) {
  const { femaleId, minutes, streakAwarded, tier } = args;
  const cash = (minutes * 0.01).toFixed(2);
  const tierLabel = tier === "premium" ? "Premium VIP" : "Basic VIP";
  const title = "🎉 Bounty awarded!";
  const body = streakAwarded
    ? `You earned ${minutes} minutes ($${cash}) + a 500-min streak bonus from a ${tierLabel} signup!`
    : `You earned ${minutes} minutes ($${cash}) from a ${tierLabel} signup. Cashable in your Profile.`;

  // 1) System DM from owner
  try {
    let convId: string | null = null;
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .or(
        `and(participant_1.eq.${OWNER_ID},participant_2.eq.${femaleId}),and(participant_1.eq.${femaleId},participant_2.eq.${OWNER_ID})`
      )
      .maybeSingle();
    if (existing?.id) {
      convId = existing.id;
    } else {
      const { data: created } = await supabase
        .from("conversations")
        .insert({ participant_1: OWNER_ID, participant_2: femaleId })
        .select("id")
        .single();
      convId = created?.id ?? null;
    }
    if (convId) {
      await supabase.from("dm_messages").insert({
        conversation_id: convId,
        sender_id: OWNER_ID,
        content: `💰 ${body} Check your Profile → Bounty History.`,
      });
    }
  } catch (err: any) {
    log("DM insert error", { message: err?.message });
  }

  // 2) Push notification
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resp = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        user_id: femaleId,
        title,
        body,
        data: { type: "bounty_awarded", screen: "/profile" },
        notification_type: "bounty_awarded",
        force_send: true,
      }),
    });
    const result = await resp.json().catch(() => ({}));
    log("Bounty push", { femaleId, result });
  } catch (err: any) {
    log("Push error", { message: err?.message });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY missing");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET missing");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const sig = req.headers.get("stripe-signature");
    if (!sig) return new Response("No signature", { status: 400 });

    const body = await req.text();
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
    } catch (err: any) {
      log("Signature verification failed", { error: err.message });
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    log("Event received", { type: event.type, id: event.id });

    // Resolve a customer-id -> email -> male user; works for both events
    const resolveMaleId = async (customerId: string): Promise<string | null> => {
      const customer = await stripe.customers.retrieve(customerId);
      const email = (customer as any)?.email;
      if (!email) return null;
      const { data: member } = await supabase
        .from("members").select("id").eq("email", email).maybeSingle();
      return member?.id ?? null;
    };

    const handleSubscription = async (sub: Stripe.Subscription, isRenewal: boolean) => {
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const maleId = await resolveMaleId(customerId);
      if (!maleId) { log("No member for customer", { customerId }); return; }

      const productId = sub.items.data[0]?.price?.product as string;
      const vipTier = VIP_TIERS[productId] || "basic";

      // Ensure VIP flag is set immediately (in case check-subscription hasn't run)
      await supabase.from("member_minutes").upsert({
        user_id: maleId,
        is_vip: true,
        vip_tier: vipTier,
        stripe_customer_id: customerId,
      }, { onConflict: "user_id" });

      const { data: bountyResult } = await supabase.rpc("award_bounty_for_subscription", {
        p_male_id: maleId,
        p_tier: vipTier,
        p_stripe_subscription_id: sub.id,
        p_is_renewal: isRenewal,
      });
      log("Bounty rpc", { maleId, vipTier, isRenewal, bountyResult });

      // Real-time bounty notification: push + system DM to the female
      try {
        const br: any = bountyResult;
        if (br?.success && br?.female_id && br?.minutes) {
          await sendBountyNotifications(supabase, {
            femaleId: br.female_id,
            minutes: br.minutes,
            streakAwarded: br.streak_count === 3,
            tier: vipTier,
          });
        }
      } catch (notifyErr: any) {
        log("Bounty notification error", { message: notifyErr?.message });
      }
    };

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || !session.subscription) break;
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const sub = await stripe.subscriptions.retrieve(subId);
        await handleSubscription(sub, false);
        break;
      }
      case "customer.subscription.created": {
        await handleSubscription(event.data.object as Stripe.Subscription, false);
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        // Only treat renewals (billing_reason = subscription_cycle) as renewals
        if (invoice.billing_reason === "subscription_cycle" && (invoice as any).subscription) {
          const subId = (invoice as any).subscription as string;
          const sub = await stripe.subscriptions.retrieve(subId);
          await handleSubscription(sub, true);
        }
        break;
      }
      default:
        log("Ignored event", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    log("ERROR", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});