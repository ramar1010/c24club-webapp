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
    const { action, rewardId, shipping, sessionId } = await req.json();

    // ACTION: create-redemption — initiate a redemption
    if (action === "create-redemption") {
      // Get reward details
      const { data: reward, error: rErr } = await supabase
        .from("rewards")
        .select("*")
        .eq("id", rewardId)
        .single();
      if (rErr || !reward) {
        return new Response(JSON.stringify({ error: "Reward not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check user has enough minutes
      const { data: memberData } = await supabase
        .from("member_minutes")
        .select("total_minutes")
        .eq("user_id", user.id)
        .maybeSingle();
      const totalMinutes = memberData?.total_minutes ?? 0;
      if (totalMinutes < reward.minutes_cost) {
        return new Response(JSON.stringify({ error: "Not enough minutes" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Deduct minutes
      await supabase
        .from("member_minutes")
        .update({
          total_minutes: totalMinutes - reward.minutes_cost,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      // Create redemption record
      const { data: redemption, error: insertErr } = await supabase
        .from("member_redemptions")
        .insert({
          user_id: user.id,
          reward_id: reward.id,
          reward_title: reward.title,
          reward_image_url: reward.image_url,
          reward_rarity: reward.rarity,
          reward_type: reward.delivery === "digital" ? "giftcard" : "product",
          minutes_cost: reward.minutes_cost,
          status: "pending_shipping",
          shipping_name: shipping?.firstName && shipping?.lastName
            ? `${shipping.firstName} ${shipping.lastName}`
            : null,
          shipping_address: shipping?.address || null,
          shipping_city: shipping?.city || null,
          shipping_state: shipping?.state || null,
          shipping_zip: shipping?.zip || null,
          shipping_country: shipping?.country || null,
          notes: shipping?.notes || null,
        })
        .select()
        .single();

      if (insertErr) {
        // Refund minutes on failure
        await supabase
          .from("member_minutes")
          .update({
            total_minutes: totalMinutes,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);
        throw insertErr;
      }

      const shippingFee = Number(reward.shipping_fee) || 0;

      // If shipping fee > 0, create Stripe checkout session
      if (shippingFee > 0) {
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
          apiVersion: "2025-08-27.basil",
        });

        const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
        const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          customer_email: customerId ? undefined : user.email!,
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: `Shipping Fee - ${reward.title}`,
                },
                unit_amount: Math.round(shippingFee * 100),
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          metadata: {
            redemption_id: redemption.id,
          },
          success_url: `${req.headers.get("origin")}/my-rewards?payment=success`,
          cancel_url: `${req.headers.get("origin")}/store?payment=canceled`,
        });

        // Update redemption with payment session
        await supabase
          .from("member_redemptions")
          .update({ status: "pending_payment", notes: `stripe_session:${session.id}` })
          .eq("id", redemption.id);

        return new Response(
          JSON.stringify({ success: true, requiresPayment: true, checkoutUrl: session.url, redemptionId: redemption.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // No shipping fee — mark as processing
      await supabase
        .from("member_redemptions")
        .update({ status: "processing" })
        .eq("id", redemption.id);

      return new Response(
        JSON.stringify({ success: true, requiresPayment: false, redemptionId: redemption.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
