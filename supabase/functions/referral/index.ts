import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const emptyReferralState = {
  code: null,
  referrals: [],
  totalEarned: 0,
  pendingEarnings: 0,
  totalReferrals: 0,
  engagedCount: 0,
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

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: authHeader
      ? {
          headers: {
            Authorization: authHeader,
          },
        }
      : undefined,
  });

  const getAuthenticatedUserId = async () => {
    if (!authHeader.startsWith("Bearer ") || !token) {
      return null;
    }

    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (!claimsError && claimsData?.claims?.sub) {
      return claimsData.claims.sub;
    }

    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      console.error("[referral] auth failed", {
        claimsError: claimsError?.message,
        userError: userError?.message,
      });
      return null;
    }

    return userData.user.id;
  };

  try {
    const { action, ...body } = await req.json();

    // === generate_code: create a unique referral code for the user ===
    if (action === "generate_code") {
      const userId = await getAuthenticatedUserId();
      if (!userId) {
        return json({ error: "Not authenticated" }, 401);
      }

      const { data: existing } = await adminClient
        .from("referral_codes")
        .select("code")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        return json({ code: existing.code });
      }

      const code = userId.slice(0, 4).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();

      const { error } = await adminClient.from("referral_codes").insert({
        user_id: userId,
        code,
      });
      if (error) throw error;

      return json({ code });
    }

    // === track_signup: called when a new user signs up with a referral code ===
    if (action === "track_signup") {
      const { referral_code, new_user_id } = body;
      if (!referral_code || !new_user_id) throw new Error("Missing fields");

      const { data: codeData } = await adminClient
        .from("referral_codes")
        .select("id, user_id")
        .eq("code", referral_code.toUpperCase())
        .maybeSingle();

      if (!codeData) {
        return json({ error: "Invalid referral code" }, 400);
      }

      if (codeData.user_id === new_user_id) {
        return json({ error: "Cannot refer yourself" }, 400);
      }

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

      if (error && error.code !== "23505") throw error;

      return json({ ok: true });
    }

    // === check_engagement: called periodically to check if referred users have engaged ===
    if (action === "check_engagement") {
      const { data: settings } = await adminClient
        .from("referral_settings")
        .select("engagement_threshold_minutes")
        .limit(1)
        .maybeSingle();
      const threshold = settings?.engagement_threshold_minutes ?? 10;

      const { data: pending } = await adminClient
        .from("referral_tracking")
        .select("id, referred_user_id")
        .eq("status", "signed_up");

      if (!pending?.length) {
        return json({ updated: 0 });
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

      return json({ updated });
    }

    // === my_referrals: get user's referral stats ===
    if (action === "my_referrals") {
      const userId = await getAuthenticatedUserId();
      if (!userId) {
        return json(emptyReferralState);
      }

      const { data: code } = await adminClient
        .from("referral_codes")
        .select("code")
        .eq("user_id", userId)
        .maybeSingle();

      const { data: referrals } = await adminClient
        .from("referral_tracking")
        .select("status, reward_amount, reward_paid, created_at")
        .eq("referrer_id", userId)
        .order("created_at", { ascending: false });

      const totalEarned = (referrals || [])
        .filter((r: any) => r.status === "engaged" && r.reward_paid)
        .reduce((sum: number, r: any) => sum + Number(r.reward_amount), 0);

      const pendingEarnings = (referrals || [])
        .filter((r: any) => r.status === "engaged" && !r.reward_paid)
        .reduce((sum: number, r: any) => sum + Number(r.reward_amount), 0);

      return json({
        code: code?.code ?? null,
        referrals: referrals || [],
        totalEarned,
        pendingEarnings,
        totalReferrals: referrals?.length ?? 0,
        engagedCount: referrals?.filter((r: any) => r.status === "engaged").length ?? 0,
      });
    }

    // === admin_get_all: admin view ===
    if (action === "admin_get_all") {
      const userId = await getAuthenticatedUserId();
      if (!userId) {
        return json({ error: "Not authenticated" }, 401);
      }

      const { data: isAdmin } = await adminClient.rpc("has_role", {
        _user_id: userId,
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

      return json({ tracking: tracking || [], settings });
    }

    // === admin_update_settings ===
    if (action === "admin_update_settings") {
      const userId = await getAuthenticatedUserId();
      if (!userId) {
        return json({ error: "Not authenticated" }, 401);
      }

      const { data: isAdmin } = await adminClient.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("Not authorized");

      const { reward_per_referral, engagement_threshold_minutes } = body;

      const { data: existing } = await adminClient
        .from("referral_settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        await adminClient
          .from("referral_settings")
          .update({
            reward_per_referral,
            engagement_threshold_minutes,
          })
          .eq("id", existing.id);
      }

      return json({ ok: true });
    }

    // === admin_pay_referral ===
    if (action === "admin_pay_referral") {
      const userId = await getAuthenticatedUserId();
      if (!userId) {
        return json({ error: "Not authenticated" }, 401);
      }

      const { data: isAdmin } = await adminClient.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("Not authorized");

      const { tracking_id } = body;
      await adminClient
        .from("referral_tracking")
        .update({ reward_paid: true })
        .eq("id", tracking_id);

      return json({ ok: true });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err: any) {
    return json({ error: err.message }, 400);
  }
});
