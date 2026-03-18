import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GIFT_TIERS = {
  "100": {
    price_id: "price_1TA0FzA5n8uAZoY1b3jUsE4G",
    minutes: 100,
    cents: 199,
    sender_bonus: 0,
  },
  "400": {
    price_id: "price_1TA0GjA5n8uAZoY1rrg7cW9q",
    minutes: 400,
    cents: 499,
    sender_bonus: 100,
  },
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
    if (!user?.email) throw new Error("Not authenticated");

    const { action, tier, recipient_id, session_id } = await req.json();

    if (action === "create-checkout") {
      const giftTier = GIFT_TIERS[tier as keyof typeof GIFT_TIERS];
      if (!giftTier) throw new Error("Invalid gift tier");
      if (!recipient_id) throw new Error("No recipient specified");
      if (recipient_id === user.id) throw new Error("Cannot gift yourself");

      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2025-08-27.basil",
      });

      // Check for existing Stripe customer
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      let customerId;
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }

      // Create gift transaction record
      const { data: gift, error: giftError } = await supabaseAdmin
        .from("gift_transactions")
        .insert({
          sender_id: user.id,
          recipient_id,
          minutes_amount: giftTier.minutes,
          price_cents: giftTier.cents,
          status: "pending",
        })
        .select("id")
        .single();

      if (giftError) throw new Error("Failed to create gift record");

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{ price: giftTier.price_id, quantity: 1 }],
        mode: "payment",
        success_url: `${req.headers.get("origin")}/videocall?gift=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.get("origin")}/videocall?gift=cancelled`,
        metadata: {
          gift_id: gift.id,
          recipient_id,
          minutes_amount: String(giftTier.minutes),
          sender_bonus: String(giftTier.sender_bonus),
        },
      });

      // Store session ID
      await supabaseAdmin
        .from("gift_transactions")
        .update({ stripe_session_id: session.id })
        .eq("id", gift.id);

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      if (!session_id) throw new Error("No session ID");

      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2025-08-27.basil",
      });

      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session.payment_status !== "paid") {
        return new Response(JSON.stringify({ success: false, reason: "not_paid" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const giftId = session.metadata?.gift_id;
      if (!giftId) throw new Error("No gift ID in session");

      // Check if already processed
      const { data: gift } = await supabaseAdmin
        .from("gift_transactions")
        .select("*")
        .eq("id", giftId)
        .single();

      if (!gift) throw new Error("Gift not found");
      if (gift.status === "completed") {
        return new Response(JSON.stringify({ success: true, already_processed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const minutesAmount = parseInt(session.metadata?.minutes_amount || "0");
      const senderBonus = parseInt(session.metadata?.sender_bonus || "0");
      const recipientId = session.metadata?.recipient_id;

      // Credit recipient minutes
      const { data: recipientMinutes } = await supabaseAdmin
        .from("member_minutes")
        .select("total_minutes")
        .eq("user_id", recipientId)
        .single();

      if (recipientMinutes) {
        await supabaseAdmin
          .from("member_minutes")
          .update({ total_minutes: recipientMinutes.total_minutes + minutesAmount })
          .eq("user_id", recipientId);
      }

      // Credit sender bonus if applicable
      if (senderBonus > 0) {
        const { data: senderMinutes } = await supabaseAdmin
          .from("member_minutes")
          .select("total_minutes")
          .eq("user_id", gift.sender_id)
          .single();

        if (senderMinutes) {
          await supabaseAdmin
            .from("member_minutes")
            .update({ total_minutes: senderMinutes.total_minutes + senderBonus })
            .eq("user_id", gift.sender_id);
        }
      }

      // Mark gift as completed
      await supabaseAdmin
        .from("gift_transactions")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", giftId);

      return new Response(JSON.stringify({ success: true, minutes_gifted: minutesAmount, sender_bonus: senderBonus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "gift-from-balance") {
      if (!recipient_id) throw new Error("No recipient specified");
      if (recipient_id === user.id) throw new Error("Cannot gift yourself");
      const { minutes_amount, reward_id } = await req.json().catch(() => ({}));

      // Parse from original body
      const body = { action, tier, recipient_id, session_id, ...({ minutes_amount, reward_id } as any) };
      const giftMinutes = body.minutes_amount;
      const giftRewardId = body.reward_id;

      if (!giftMinutes || giftMinutes < 10) throw new Error("Minimum gift is 10 minutes");
      if (giftMinutes > 500) throw new Error("Maximum gift is 500 minutes");

      // Check sender balance
      const { data: senderMinutes } = await supabaseAdmin
        .from("member_minutes")
        .select("total_minutes")
        .eq("user_id", user.id)
        .single();

      if (!senderMinutes || senderMinutes.total_minutes < giftMinutes) {
        throw new Error("Insufficient minutes balance");
      }

      // Deduct from sender
      await supabaseAdmin
        .from("member_minutes")
        .update({ total_minutes: senderMinutes.total_minutes - giftMinutes })
        .eq("user_id", user.id);

      // Credit recipient
      const { data: recipientMins } = await supabaseAdmin
        .from("member_minutes")
        .select("total_minutes")
        .eq("user_id", recipient_id)
        .single();

      if (recipientMins) {
        await supabaseAdmin
          .from("member_minutes")
          .update({ total_minutes: recipientMins.total_minutes + giftMinutes })
          .eq("user_id", recipient_id);
      }

      // Record transaction
      await supabaseAdmin.from("gift_transactions").insert({
        sender_id: user.id,
        recipient_id,
        minutes_amount: giftMinutes,
        price_cents: 0,
        status: "completed",
      });

      return new Response(JSON.stringify({ success: true, minutes_gifted: giftMinutes }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
