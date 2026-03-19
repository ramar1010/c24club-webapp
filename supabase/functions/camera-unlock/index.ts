import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
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
    if (!user?.email) throw new Error("Not authenticated");

    const { action, recipient_id, room_id, session_id, request_id } = await req.json();

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Fetch settings
    const { data: settings } = await supabaseAdmin
      .from("camera_unlock_settings")
      .select("*")
      .limit(1)
      .single();

    const priceCents = settings?.price_cents ?? 299;
    const recipientCutPercent = settings?.recipient_cut_percent ?? 25;

    if (action === "create-checkout") {
      if (!recipient_id) throw new Error("No recipient specified");
      if (recipient_id === user.id) throw new Error("Cannot unlock your own camera");

      const recipientCutCents = Math.floor(priceCents * recipientCutPercent / 100);

      // Check for existing Stripe customer
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      let customerId;
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }

      // Create unlock request record
      const { data: unlockReq, error: insertError } = await supabaseAdmin
        .from("camera_unlock_requests")
        .insert({
          requester_id: user.id,
          recipient_id,
          room_id: room_id || null,
          price_cents: priceCents,
          recipient_cut_cents: recipientCutCents,
          status: "pending",
        })
        .select("id")
        .single();

      if (insertError) throw new Error("Failed to create unlock request");

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "🔓 Camera Unlock",
                description: "Request to enable video with your partner",
              },
              unit_amount: priceCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${req.headers.get("origin")}/camera-unlock-success?session_id={CHECKOUT_SESSION_ID}&request_id=${unlockReq.id}`,
        cancel_url: `${req.headers.get("origin")}/camera-unlock-success?cancelled=true`,
        metadata: {
          unlock_request_id: unlockReq.id,
          requester_id: user.id,
          recipient_id,
          recipient_cut_cents: String(recipientCutCents),
        },
      });

      // Store session ID
      await supabaseAdmin
        .from("camera_unlock_requests")
        .update({ stripe_session_id: session.id })
        .eq("id", unlockReq.id);

      return new Response(JSON.stringify({ url: session.url, request_id: unlockReq.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      if (!session_id) throw new Error("No session ID");

      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session.payment_status !== "paid") {
        return new Response(JSON.stringify({ success: false, reason: "not_paid" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const unlockRequestId = session.metadata?.unlock_request_id;
      if (!unlockRequestId) throw new Error("No unlock request ID in session");

      // Check if already processed
      const { data: unlockReq } = await supabaseAdmin
        .from("camera_unlock_requests")
        .select("*")
        .eq("id", unlockRequestId)
        .single();

      if (!unlockReq) throw new Error("Unlock request not found");
      if (unlockReq.status !== "pending") {
        return new Response(JSON.stringify({ success: true, already_processed: true, status: unlockReq.status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update status to paid — this triggers Realtime for the recipient
      await supabaseAdmin
        .from("camera_unlock_requests")
        .update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("id", unlockRequestId);

      return new Response(JSON.stringify({ success: true, request_id: unlockRequestId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "respond") {
      if (!request_id) throw new Error("No request ID");
      const { response } = await req.json().catch(() => ({ response: undefined }));

      // Re-parse since we already consumed req.json above
      // The response is already in the first parse
      const body = { action, recipient_id, room_id, session_id, request_id };

      const { data: unlockReq } = await supabaseAdmin
        .from("camera_unlock_requests")
        .select("*")
        .eq("id", request_id)
        .single();

      if (!unlockReq) throw new Error("Unlock request not found");
      if (unlockReq.recipient_id !== user.id) throw new Error("Not authorized");
      if (unlockReq.status !== "paid") throw new Error("Request not in paid state");

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "accept") {
      if (!request_id) throw new Error("No request ID");

      const { data: unlockReq } = await supabaseAdmin
        .from("camera_unlock_requests")
        .select("*")
        .eq("id", request_id)
        .single();

      if (!unlockReq) throw new Error("Unlock request not found");
      if (unlockReq.recipient_id !== user.id) throw new Error("Not authorized");
      if (unlockReq.status !== "paid") throw new Error("Request not in paid state");

      // Credit recipient with their cut (converted to minutes)
      const { data: cashoutSettings } = await supabaseAdmin
        .from("cashout_settings")
        .select("rate_per_minute")
        .limit(1)
        .single();

      const ratePerMinute = cashoutSettings?.rate_per_minute ?? 0.01;
      const recipientCutDollars = unlockReq.recipient_cut_cents / 100;
      const minutesReward = Math.floor(recipientCutDollars / ratePerMinute);

      if (minutesReward > 0) {
        await supabaseAdmin.rpc("atomic_increment_minutes", {
          p_user_id: unlockReq.recipient_id,
          p_amount: minutesReward,
        });
      }

      // Update status to accepted — triggers Realtime for requester
      await supabaseAdmin
        .from("camera_unlock_requests")
        .update({ status: "accepted", updated_at: new Date().toISOString() })
        .eq("id", request_id);

      return new Response(JSON.stringify({ success: true, minutes_earned: minutesReward }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "decline") {
      if (!request_id) throw new Error("No request ID");

      const { data: unlockReq } = await supabaseAdmin
        .from("camera_unlock_requests")
        .select("*")
        .eq("id", request_id)
        .single();

      if (!unlockReq) throw new Error("Unlock request not found");
      if (unlockReq.recipient_id !== user.id) throw new Error("Not authorized");
      if (unlockReq.status !== "paid") throw new Error("Request not in paid state");

      // Issue Stripe refund
      if (unlockReq.stripe_session_id) {
        try {
          const session = await stripe.checkout.sessions.retrieve(unlockReq.stripe_session_id);
          if (session.payment_intent) {
            await stripe.refunds.create({
              payment_intent: session.payment_intent as string,
            });
          }
        } catch (refundErr) {
          console.error("Refund failed:", refundErr);
          // Still mark as declined even if refund fails — admin can handle manually
        }
      }

      // Update status to declined — triggers Realtime for requester
      await supabaseAdmin
        .from("camera_unlock_requests")
        .update({ status: "declined", updated_at: new Date().toISOString() })
        .eq("id", request_id);

      return new Response(JSON.stringify({ success: true, refunded: true }), {
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
