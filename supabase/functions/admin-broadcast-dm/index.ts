import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getAuthenticatedUserId, hasRole, unauthorized, forbidden } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// realsubify@gmail.com — all broadcasts are sent from this admin account
const OWNER_ID = "6f8bb0e2-a36a-4bc0-920f-312c340f7921";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Filters = {
  gender?: "all" | "female" | "male";
  activity?: "all" | "24h" | "7d" | "30d" | "inactive30";
  vip?: "all" | "vip" | "nonvip";
  discoverable_only?: boolean;
  exclude_test?: boolean;
  limit?: number;
  test_email?: string | null;
};

const ACTIVITY_HOURS: Record<string, number> = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };

async function resolveRecipients(supabase: any, f: Filters) {
  if (f.test_email) {
    const { data } = await supabase
      .from("members")
      .select("id, name, gender, last_active_at")
      .ilike("email", f.test_email)
      .limit(1);
    return data ?? [];
  }

  const pageSize = 1000;
  let from = 0;
  const all: any[] = [];
  const max = Math.min(Math.max(f.limit ?? 5000, 1), 20000);

  while (all.length < max) {
    let q = supabase
      .from("members")
      .select("id, name, gender, last_active_at, is_test_account, is_discoverable")
      .order("last_active_at", { ascending: false, nullsFirst: false })
      .range(from, from + pageSize - 1);

    if (f.gender && f.gender !== "all") q = q.ilike("gender", f.gender);
    if (f.discoverable_only) q = q.eq("is_discoverable", true);
    if (f.exclude_test !== false) q = q.or("is_test_account.is.null,is_test_account.eq.false");

    if (f.activity && f.activity !== "all") {
      if (f.activity === "inactive30") {
        const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
        q = q.lt("last_active_at", cutoff);
      } else {
        const cutoff = new Date(Date.now() - ACTIVITY_HOURS[f.activity] * 3600000).toISOString();
        q = q.gte("last_active_at", cutoff);
      }
    }

    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  let rows = all.filter((m) => m.id !== OWNER_ID);

  if (f.vip && f.vip !== "all") {
    const ids = rows.map((r) => r.id);
    const vipIds = new Set<string>();
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const { data: mm } = await supabase
        .from("member_minutes")
        .select("user_id, is_vip")
        .in("user_id", chunk)
        .eq("is_vip", true);
      (mm ?? []).forEach((r: any) => vipIds.add(r.user_id));
    }
    rows = rows.filter((r) => (f.vip === "vip" ? vipIds.has(r.id) : !vipIds.has(r.id)));
  }

  return rows.slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const userId = await getAuthenticatedUserId(req);
  if (!userId) return unauthorized(corsHeaders);
  if (!(await hasRole(userId, "admin"))) return forbidden(corsHeaders);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    const payload = await req.json().catch(() => ({}));
    const mode: "preview" | "send" = payload?.mode === "send" ? "send" : "preview";
    const filters: Filters = payload?.filters ?? {};
    const message: string = String(payload?.message ?? "").trim();
    const pushTitle: string = String(payload?.push_title ?? "New message from C24Club").slice(0, 80);
    const sendPush: boolean = payload?.send_push !== false;

    const recipients = await resolveRecipients(supabase, filters);

    if (mode === "preview") {
      return json({
        success: true,
        count: recipients.length,
        sample: recipients.slice(0, 10).map((r: any) => ({
          id: r.id,
          name: r.name,
          gender: r.gender,
          last_active_at: r.last_active_at,
        })),
      });
    }

    if (!message || message.length < 2) return json({ success: false, error: "Message is required" }, 400);
    if (message.length > 2000) return json({ success: false, error: "Message too long (max 2000)" }, 400);
    if (recipients.length === 0) return json({ success: false, error: "No recipients match those filters" }, 400);

    const nowIso = new Date().toISOString();
    let sent = 0;
    let failed = 0;

    for (const r of recipients) {
      try {
        let conversationId: string | null = null;
        const { data: convo } = await supabase
          .from("conversations")
          .select("id")
          .or(
            `and(participant_1.eq.${OWNER_ID},participant_2.eq.${r.id}),and(participant_1.eq.${r.id},participant_2.eq.${OWNER_ID})`,
          )
          .maybeSingle();

        if (convo?.id) {
          conversationId = convo.id;
        } else {
          const { data: created } = await supabase
            .from("conversations")
            .insert({ participant_1: OWNER_ID, participant_2: r.id })
            .select("id")
            .single();
          conversationId = created?.id ?? null;
        }
        if (!conversationId) {
          failed++;
          continue;
        }

        const personalized = message.replace(/\{name\}/gi, r.name || "there");

        const { error: insErr } = await supabase.from("dm_messages").insert({
          conversation_id: conversationId,
          sender_id: OWNER_ID,
          content: personalized,
        });
        if (insErr) throw insErr;

        await supabase.from("conversations").update({ last_message_at: nowIso }).eq("id", conversationId);

        if (sendPush) {
          fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({
              user_id: r.id,
              title: pushTitle,
              body: personalized.slice(0, 140),
              data: { type: "admin_announcement", screen: "/messages" },
              notification_type: "admin_announcement",
              force_send: true,
            }),
          }).catch(() => {});
        }

        sent++;
      } catch (e: any) {
        console.error("[admin-broadcast-dm] recipient failed", r.id, e?.message ?? e);
        failed++;
      }
    }

    console.log("[admin-broadcast-dm] done", { total: recipients.length, sent, failed });
    return json({ success: true, total: recipients.length, sent, failed });
  } catch (err: any) {
    console.error("[admin-broadcast-dm] error", err?.message ?? err);
    return json({ success: false, error: err?.message ?? String(err) }, 500);
  }
});