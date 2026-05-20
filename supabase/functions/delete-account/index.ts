import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const respond = (body: object) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return respond({ success: false, error: "Delete service is not configured" });
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${supabaseServiceKey}` } },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ success: false, error: "Missing Authorization header" });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

    if (authError || !user?.id) {
      return respond({ success: false, error: "Not authenticated: " + (authError?.message ?? "no user") });
    }

    console.log(`[delete-account] Deleting user: ${user.id}`);

    const { error: rpcError } = await adminClient.rpc("delete_user_account_data", {
      target_user_id: user.id,
    });

    if (rpcError) {
      console.error("[delete-account] RPC error:", rpcError.message);
      return respond({ success: false, error: `Failed to delete user data: ${rpcError.message}` });
    }

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(user.id, false);

    if (deleteUserError) {
      console.error("[delete-account] Auth delete error:", deleteUserError.message);
      return respond({ success: false, error: `Failed to delete auth user: ${deleteUserError.message}` });
    }

    return respond({ success: true, message: "Account deleted successfully" });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[delete-account] Error:", msg);
    return respond({ success: false, error: msg });
  }
});
