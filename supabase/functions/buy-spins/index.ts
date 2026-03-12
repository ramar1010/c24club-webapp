import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SPIN_PACKAGES = [
  { spins: 1, price_id: "price_1TA134A5n8uAZoY1Q9TshctL", price: "$0.99" },
  { spins: 2, price_id: "price_1TA13kA5n8uAZoY1Kqat8tE1", price: "$1.99" },
  { spins: 3, price_id: "price_1TA149A5n8uAZoY1h0iMZ8zI", price: "$2.50" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const { type, spins } = body;

    // CREATE_CHECKOUT: Create Stripe checkout for buying spins
    if (type === "create_checkout") {
      const authHeader = req.headers.get("Authorization")!;
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabaseClient.auth.getUser(token);
      const user = data.user;
      if (!user?.email) throw new Error("Not authenticated");

      const pkg = SPIN_PACKAGES.find((p) => p.spins === spins);
      if (!pkg) throw new Error("Invalid spin package");

      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      let customerId;
      if (customers.data.length > 0) customerId = customers.data[0].id;

      const origin = req.headers.get("origin") || "https://react-code-hug.lovable.app";

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{ price: pkg.price_id, quantity: 1 }],
        mode: "payment",
        success_url: `${origin}/profile?spin_purchased=${spins}`,
        cancel_url: `${origin}/profile`,
        metadata: { user_id: user.id, spins: String(spins) },
      });

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // VERIFY_PURCHASE: Add purchased spins to user's balance (called from success page)
    if (type === "verify_purchase") {
      const authHeader = req.headers.get("Authorization")!;
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabaseClient.auth.getUser(token);
      const user = data.user;
      if (!user?.id) throw new Error("Not authenticated");

      const spinCount = body.spins || 1;

      const { data: mm } = await supabaseAdmin
        .from("member_minutes")
        .select("purchased_spins")
        .eq("user_id", user.id)
        .maybeSingle();

      const current = mm?.purchased_spins ?? 0;

      await supabaseAdmin
        .from("member_minutes")
        .upsert(
          { user_id: user.id, purchased_spins: current + spinCount, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );

      return new Response(JSON.stringify({ success: true, purchased_spins: current + spinCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown type" }), {
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
