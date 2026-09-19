import { createClient } from "npm:@supabase/supabase-js@2";

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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function userClient(token: string) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function sendPush(payload: Record<string, unknown>) {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify(payload),
  });
  const raw = await resp.text();
  let parsed: any = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch { /* ignore */ }
  return { ok: resp.ok && parsed?.success === true, reason: parsed?.reason ?? raw?.slice(0, 200) };
}

/**
 * Claim pending deliveries for a session and push them.
 * The claim is a single conditional UPDATE (pending -> sent), so a retry can
 * never notify the same recipient twice and never creates delivery rows.
 */
async function dispatchSession(sessionId: string) {
  const { data: session } = await admin
    .from("ready_to_chat_sessions")
    .select("id, sender_id, mode, status, expires_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session || session.status !== "active" || new Date(session.expires_at).getTime() <= Date.now()) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const { data: sender } = await admin
    .from("members").select("name").eq("id", session.sender_id).maybeSingle();
  const senderName = sender?.name || "Someone";

  const nowIso = new Date().toISOString();
  const { data: claimed, error: claimError } = await admin
    .from("ready_to_chat_deliveries")
    .update({ status: "sent", sent_at: nowIso })
    .eq("session_id", sessionId)
    .eq("status", "pending")
    .select("id, recipient_id, effective_mode");

  if (claimError || !claimed?.length) return { sent: 0, failed: 0, skipped: 0 };

  let sent = 0, failed = 0, skipped = 0;

  for (const d of claimed) {
    // TTL never exceeds the remaining server session time (max 900s).
    const remaining = Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000);
    const ttl = Math.max(0, Math.min(900, remaining));
    if (ttl <= 0) {
      await admin.from("ready_to_chat_deliveries")
        .update({ status: "expired", failure_reason: "session_expired" }).eq("id", d.id);
      skipped++;
      continue;
    }

    const modeLabel = d.effective_mode === "video"
      ? "is ready for a video chat"
      : d.effective_mode === "text"
        ? "is ready to chat"
        : "is ready to chat or video call";

    const result = await sendPush({
      user_id: d.recipient_id,
      title: `💬 ${senderName} ${modeLabel}`,
      body: "Tap to view their profile",
      notification_type: "ready_to_chat",
      ttl_seconds: ttl,
      data: {
        type: "ready_to_chat",
        screen: "/(tabs)/discover",
        channelId: "chat_invites",
        params: JSON.stringify({
          source: "ready_to_chat",
          sessionId: session.id,
          senderId: session.sender_id,
          mode: d.effective_mode,
          expiresAt: session.expires_at,
        }),
      },
    });

    if (result.ok) {
      sent++;
    } else {
      const noToken = /No push token|Notifications disabled/i.test(result.reason ?? "");
      await admin.from("ready_to_chat_deliveries")
        .update({ status: noToken ? "skipped" : "failed", failure_reason: result.reason ?? "push_failed" })
        .eq("id", d.id);
      if (noToken) skipped++; else failed++;
    }
  }

  return { sent, failed, skipped };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) return json({ success: false, reason: "unauthenticated" }, 401);

    const supabase = userClient(token);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return json({ success: false, reason: "unauthenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    // Any sender_id / recipient list supplied by the client is ignored on purpose.
    const action = typeof body?.action === "string" ? body.action : "";
    const rawSessionId = body?.sessionId ?? body?.session_id;
    const sessionId = typeof rawSessionId === "string" ? rawSessionId : null;
    const mode = typeof body?.mode === "string" ? body.mode : null;

    if (action === "limits") {
      const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const countedStatuses = ["pending", "sent", "opened"];
      const [outgoing, incomingHour, incomingDay] = await Promise.all([
        admin.from("ready_to_chat_sessions").select("id", { count: "exact", head: true })
          .eq("sender_id", userData.user.id).gt("created_at", sinceDay),
        admin.from("ready_to_chat_deliveries").select("id", { count: "exact", head: true })
          .eq("recipient_id", userData.user.id).in("status", countedStatuses).gt("created_at", sinceHour),
        admin.from("ready_to_chat_deliveries").select("id", { count: "exact", head: true })
          .eq("recipient_id", userData.user.id).in("status", countedStatuses).gt("created_at", sinceDay),
      ]);

      if (outgoing.error || incomingHour.error || incomingDay.error) {
        return json({ success: false, reason: "limits_unavailable" }, 500);
      }

      return json({
        success: true,
        outgoing_daily_remaining: Math.max(0, 3 - (outgoing.count ?? 0)),
        incoming_hourly_remaining: Math.max(0, 3 - (incomingHour.count ?? 0)),
        incoming_daily_remaining: Math.max(0, 10 - (incomingDay.count ?? 0)),
      });
    }

    if (action === "start") {
      if (!mode || !["text", "video", "both"].includes(mode)) {
        return json({ success: false, reason: "invalid_mode" }, 400);
      }
      const { data, error } = await supabase.rpc("start_ready_to_chat", { p_mode: mode });
      if (error) return json({ success: false, reason: error.message }, 400);
      if (!data?.success) return json(data, 200);

      const dispatch = await dispatchSession(data.session_id);
      return json({ ...data, delivery: dispatch });
    }

    if (action === "resolve") {
      if (!sessionId) return json({ success: false, reason: "invalid_session" }, 400);
      const { data, error } = await supabase.rpc("resolve_ready_to_chat", { p_session_id: sessionId });
      if (error) return json({ success: false, reason: error.message }, 400);
      return json(data);
    }

    if (action === "validate") {
      if (!sessionId || !mode) return json({ allowed: false, reason: "invalid_request" }, 400);
      const { data, error } = await supabase.rpc("validate_ready_to_chat_action", {
        p_session_id: sessionId,
        p_mode: mode,
      });
      if (error) return json({ allowed: false, reason: error.message }, 400);
      return json(data);
    }

    if (action === "cancel") {
      if (!sessionId) return json({ success: false, reason: "invalid_session" }, 400);
      const { data, error } = await supabase.rpc("cancel_ready_to_chat", { p_session_id: sessionId });
      if (error) return json({ success: false, reason: error.message }, 400);
      return json(data);
    }

    return json({ success: false, reason: "unknown_action" }, 400);
  } catch (err) {
    return json({ success: false, reason: String(err) }, 500);
  }
});
