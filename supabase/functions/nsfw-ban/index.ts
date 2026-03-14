import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller is authenticated
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const { targetUserId } = await req.json();
    if (!targetUserId || typeof targetUserId !== "string") {
      throw new Error("Missing targetUserId");
    }

    // Prevent banning yourself
    if (targetUserId === user.id) {
      throw new Error("Cannot ban yourself");
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Look up the target user's last known IP
    const { data: memberData } = await adminClient
      .from("members")
      .select("last_ip")
      .eq("id", targetUserId)
      .maybeSingle();
    const targetIp = memberData?.last_ip || null;

    // Check for existing active ban
    const { data: existingBan } = await adminClient
      .from("user_bans")
      .select("id")
      .eq("user_id", targetUserId)
      .eq("is_active", true)
      .maybeSingle();

    if (existingBan) {
      return new Response(JSON.stringify({ success: true, alreadyBanned: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: banError } = await adminClient.from("user_bans").insert({
      user_id: targetUserId,
      reason: "Nudity detected on camera (automated)",
      ban_type: "standard",
      is_active: true,
      ip_address: targetIp,
    });

    if (banError) throw banError;

    // Reset strikes
    await adminClient
      .from("member_minutes")
      .update({ nsfw_strikes: 0 })
      .eq("user_id", targetUserId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
