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
function serviceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

/**
 * True when the request comes from trusted backend code: a database trigger / cron job
 * carrying the private `x-internal-secret` header, or a caller using the service-role key.
 */
export async function isInternalCall(req: Request): Promise<boolean> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (serviceKey && bearer && bearer === serviceKey) return true;
  const secret = req.headers.get("x-internal-secret");
  if (!secret) return false;
  try {
    const { data, error } = await serviceClient().rpc("verify_internal_secret", { p_secret: secret });
    return !error && data === true;
  } catch {
    return false;
  }
}

/** Internal backend call OR a signed-in admin. */
export async function isInternalOrAdmin(req: Request): Promise<boolean> {
  if (await isInternalCall(req)) return true;
  const uid = await getAuthenticatedUserId(req);
  return !!uid && (await hasRole(uid, "admin"));
}

/** Only allow redirects back to our own domains. */
const ALLOWED_ORIGINS = [
  "https://c24club.com",
  "https://www.c24club.com",
  "https://c24club.lovable.app",
];
export function safeOrigin(candidate: string | null | undefined): string {
  const fallback = "https://c24club.com";
  if (!candidate) return fallback;
  try {
    const u = new URL(candidate);
    const o = u.origin;
    if (ALLOWED_ORIGINS.includes(o)) return o;
    if (/^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(o) || /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/.test(o)) return o;
    if (/^http:\/\/localhost(:\d+)?$/.test(o)) return o;
  } catch { /* ignore */ }
  return fallback;
}

/** Escape a value before inserting it into HTML email markup. */
export function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Mask an email address for logs. */
export function maskEmail(e: unknown): string {
  const s = String(e ?? "");
  const [u, d] = s.split("@");
  if (!d) return "***";
  return `${u.slice(0, 1)}***@${d}`;
}

/** Mask a phone number for logs. */
export function maskPhone(p: unknown): string {
  const s = String(p ?? "");
  return s.length > 4 ? `***${s.slice(-4)}` : "***";
}

/** True if the two members shared a random-match room or direct call in the last `hours` hours. */
export async function wereRecentlyConnected(a: string, b: string, hours = 2): Promise<boolean> {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!a || !b || a === b || !re.test(a) || !re.test(b)) return false;
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const db = serviceClient();
  const { data: room } = await db.from("rooms").select("id")
    .or(`and(member1.eq.${a},member2.eq.${b}),and(member1.eq.${b},member2.eq.${a})`)
    .gte("created_at", since).limit(1).maybeSingle();
  if (room) return true;
  const { data: invite } = await db.from("direct_call_invites").select("id")
    .or(`and(inviter_id.eq.${a},invitee_id.eq.${b}),and(inviter_id.eq.${b},invitee_id.eq.${a})`)
    .gte("created_at", since).limit(1).maybeSingle();
  return !!invite;
}
