import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  try {
    const { action, ...body } = await req.json();

    // === generate_code: create a unique referral code for the user ===
    if (action === "generate_code") {
      const anonClient = createClient(supabaseUrl, anonKey);
      const { data: { user } } = await anonClient.auth.getUser(token);
      if (!user) throw new Error("Not authenticated");

      const adminClient = createClient(supabaseUrl, serviceKey);

      // Check if user already has a code
      const { data: existing } = await adminClient
        .from("referral_codes")
        .select("code")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ code: existing.code }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate unique 8-char code
      const code = user.id.slice(0, 4).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();

      const { error } = await adminClient.from("referral_codes").insert({
        user_id: user.id,
        code,
      });
      if (error) throw error;

      return new Response(JSON.stringify({ code }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === track_signup: called when a new user signs up with a referral code ===
    if (action === "track_signup") {
      const { referral_code, new_user_id } = body;
      if (!referral_code || !new_user_id) throw new Error("Missing fields");

      const adminClient = createClient(supabaseUrl, serviceKey);

      // Find the referral code
      const { data: codeData } = await adminClient
        .from("referral_codes")
        .select("id, user_id")
        .eq("code", referral_code.toUpperCase())
        .maybeSingle();

      if (!codeData) {
        return new Response(JSON.stringify({ error: "Invalid referral code" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      // Don't allow self-referral
      if (codeData.user_id === new_user_id) {
        return new Response(JSON.stringify({ error: "Cannot refer yourself" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      // Get settings for reward amount
      const { data: settings } = await adminClient
        .from("referral_settings")
        .select("reward_per_referral")
        .limit(1)
        .maybeSingle();

      const { error } = await adminClient.from("referral_tracking").insert({
        referrer_id: codeData.user_id,
        referred_user_id: new_user_id,
        referral_code_id: codeData.id,
        status: "signed_up",
        reward_amount: settings?.reward_per_referral ?? 5,
      });

      if (error && error.code !== "23505") throw error; // ignore duplicate

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === check_engagement: called periodically to check if referred users have engaged ===
    if (action === "check_engagement") {
      const adminClient = createClient(supabaseUrl, serviceKey);

      // Get engagement threshold
      const { data: settings } = await adminClient
        .from("referral_settings")
        .select("engagement_threshold_minutes")
        .limit(1)
        .maybeSingle();
      const threshold = settings?.engagement_threshold_minutes ?? 10;

      // Get all signed_up referrals
      const { data: pending } = await adminClient
        .from("referral_tracking")
        .select("id, referred_user_id")
        .eq("status", "signed_up");

      if (!pending?.length) {
        return new Response(JSON.stringify({ updated: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let updated = 0;
      for (const ref of pending) {
        const { data: minutes } = await adminClient
          .from("member_minutes")
          .select("total_minutes")
          .eq("user_id", ref.referred_user_id)
          .maybeSingle();

        if (minutes && minutes.total_minutes >= threshold) {
          await adminClient
            .from("referral_tracking")
            .update({
              status: "engaged",
              engaged_at: new Date().toISOString(),
            })
            .eq("id", ref.id);
          updated++;
        }
      }

      return new Response(JSON.stringify({ updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === my_referrals: get user's referral stats ===
    if (action === "my_referrals") {
      const anonClient = createClient(supabaseUrl, anonKey);
      const { data: { user } } = await anonClient.auth.getUser(token);
      if (!user) throw new Error("Not authenticated");

      const adminClient = createClient(supabaseUrl, serviceKey);

      const { data: code } = await adminClient
        .from("referral_codes")
        .select("code")
        .eq("user_id", user.id)
        .maybeSingle();

      const { data: referrals } = await adminClient
        .from("referral_tracking")
        .select("status, reward_amount, reward_paid, created_at")
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false });

      const totalEarned = (referrals || [])
        .filter((r: any) => r.status === "engaged" && r.reward_paid)
        .reduce((sum: number, r: any) => sum + Number(r.reward_amount), 0);

      const pendingEarnings = (referrals || [])
        .filter((r: any) => r.status === "engaged" && !r.reward_paid)
        .reduce((sum: number, r: any) => sum + Number(r.reward_amount), 0);

      return new Response(
        JSON.stringify({
          code: code?.code ?? null,
          referrals: referrals || [],
          totalEarned,
          pendingEarnings,
          totalReferrals: referrals?.length ?? 0,
          engagedCount: referrals?.filter((r: any) => r.status === "engaged").length ?? 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === admin_get_all: admin view ===
    if (action === "admin_get_all") {
      const anonClient = createClient(supabaseUrl, anonKey);
      const { data: { user } } = await anonClient.auth.getUser(token);
      if (!user) throw new Error("Not authenticated");

      const adminClient = createClient(supabaseUrl, serviceKey);

      // Verify admin
      const { data: isAdmin } = await adminClient.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("Not authorized");

      const { data: tracking } = await adminClient
        .from("referral_tracking")
        .select("*, referral_codes(code, user_id)")
        .order("created_at", { ascending: false });

      const { data: settings } = await adminClient
        .from("referral_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      return new Response(
        JSON.stringify({ tracking: tracking || [], settings }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === admin_update_settings ===
    if (action === "admin_update_settings") {
      const anonClient = createClient(supabaseUrl, anonKey);
      const { data: { user } } = await anonClient.auth.getUser(token);
      if (!user) throw new Error("Not authenticated");

      const adminClient = createClient(supabaseUrl, serviceKey);
      const { data: isAdmin } = await adminClient.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("Not authorized");

      const { reward_per_referral, engagement_threshold_minutes } = body;

      // Update first row
      const { data: existing } = await adminClient
        .from("referral_settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        await adminClient.from("referral_settings").update({
          reward_per_referral,
          engagement_threshold_minutes,
        }).eq("id", existing.id);
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === admin_pay_referral ===
    if (action === "admin_pay_referral") {
      const anonClient = createClient(supabaseUrl, anonKey);
      const { data: { user } } = await anonClient.auth.getUser(token);
      if (!user) throw new Error("Not authenticated");

      const adminClient = createClient(supabaseUrl, serviceKey);
      const { data: isAdmin } = await adminClient.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("Not authorized");

      const { tracking_id } = body;
      await adminClient
        .from("referral_tracking")
        .update({ reward_paid: true })
        .eq("id", tracking_id);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
