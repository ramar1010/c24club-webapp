import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Verify the request's JWT and return the authenticated user id.
 * Returns null if the request is unauthenticated or the token is invalid.
 * Use this in every user-scoped edge function. NEVER trust a userId from the body.
 */
export async function getAuthenticatedUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const anonClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

  // Prefer signing-key claim verification (cheaper, no network round trip beyond JWKS)
  try {
    const { data: claimsData, error } = await (anonClient.auth as any).getClaims?.(token) ?? {};
    if (!error && claimsData?.claims?.sub) return claimsData.claims.sub as string;
  } catch {
    /* fall through to getUser */
  }

  const { data, error } = await anonClient.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

/**
 * Returns true if the given user id holds the requested role.
 * Uses the service-role client + has_role() RPC.
 */
export async function hasRole(
  userId: string,
  role: "admin" | "moderator",
): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("has_role", { _user_id: userId, _role: role });
  if (error) return false;
  return data === true;
}

export function unauthorized(corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function forbidden(corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify({ success: false, message: "Forbidden" }), {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}