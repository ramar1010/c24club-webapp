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

  const respond = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return respond({ success: false, error: "Delete service is not configured" }, 500);
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${serviceKey}` } },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ success: false, error: "Missing Authorization header" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user?.id) {
      return respond({ success: false, error: "Not authenticated" }, 401);
    }

    // Verify caller is an admin (query user_roles directly to avoid enum-cast issues)
    const { data: adminRow, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) {
      console.error("[admin-delete-account] Admin role check failed:", roleError.message);
      return respond({ success: false, error: `Admin check failed: ${roleError.message}` }, 500);
    }
    if (!adminRow) {
      return respond({ success: false, error: "Forbidden: admin role required" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const targetIds: string[] = Array.isArray(body?.user_ids)
      ? body.user_ids
      : body?.user_id
        ? [body.user_id]
        : [];

    if (targetIds.length === 0) {
      return respond({ success: false, error: "user_id or user_ids required" }, 400);
    }

    console.log(`[admin-delete-account] Admin ${user.id} deleting ${targetIds.length} account(s)`);

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const targetId of targetIds) {
      try {
        const { error: rpcError } = await adminClient.rpc("delete_user_account_data", {
          target_user_id: targetId,
        });
        if (rpcError) {
          console.error(`[admin-delete-account] Data cleanup failed for ${targetId}:`, rpcError.message);
          results.push({ id: targetId, success: false, error: `data: ${rpcError.message}` });
          continue;
        }

        const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(targetId, false);
        if (deleteUserError && !/not found/i.test(deleteUserError.message)) {
          console.error(`[admin-delete-account] Auth delete failed for ${targetId}:`, deleteUserError.message);
          results.push({ id: targetId, success: false, error: `auth: ${deleteUserError.message}` });
          continue;
        }

        results.push({ id: targetId, success: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[admin-delete-account] Unexpected failure for ${targetId}:`, msg);
        results.push({ id: targetId, success: false, error: msg });
      }
    }

    const allOk = results.every((r) => r.success);
    return respond({ success: allOk, results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return respond({ success: false, error: msg }, 500);
  }
});
