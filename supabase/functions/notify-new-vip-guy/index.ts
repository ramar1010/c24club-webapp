import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: Record<string, unknown>, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_RECIPIENTS = 30;
const UUID_RE = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { male_id } = await req.json().catch(() => ({}));
    if (typeof male_id !== "string" || !UUID_RE.test(male_id)) return json({ success: false, reason: "invalid_request" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(url, key, { auth: { persistSession: false } });

    // Never trust the caller: the window must exist, be fresh, and not yet nudged.
    const { data: win } = await sb.from("late_bounty_windows")
      .select("male_id, vip_started_at, nudge_sent_at, awarded_at, expires_at")
      .eq("male_id", male_id).maybeSingle();
    if (!win) return json({ success: false, reason: "no_window" }, 404);
    if (win.nudge_sent_at || win.awarded_at) return json({ success: true, skipped: "already_sent" });
    if (Date.now() - new Date(win.vip_started_at).getTime() > 10 * 60 * 1000) return json({ success: true, skipped: "stale" });

    // Claim the nudge atomically
    const { data: claimed } = await sb.from("late_bounty_windows")
      .update({ nudge_sent_at: new Date().toISOString() })
      .eq("male_id", male_id).is("nudge_sent_at", null).select("male_id");
    if (!claimed?.length) return json({ success: true, skipped: "already_sent" });

    const { data: guy } = await sb.from("members").select("id, name").eq("id", male_id).maybeSingle();
    const guyName = (guy?.name || "A new guy").toString().split(" ")[0].slice(0, 24);

    // Recently active girls (24h)
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: girls } = await sb.from("members").select("id")
      .ilike("gender", "female").gte("last_active_at", since)
      .order("last_active_at", { ascending: false }).limit(200);
    let ids = (girls ?? []).map((g: any) => g.id as string);

    if (ids.length) {
      const [{ data: bans }, { data: blocks }, { data: recent }] = await Promise.all([
        sb.from("user_bans").select("user_id").eq("is_active", true).in("user_id", ids),
        sb.from("blocked_users").select("blocker_id, blocked_id")
          .or(`blocker_id.eq.${male_id},blocked_id.eq.${male_id}`),
        sb.from("push_notification_log").select("user_id")
          .like("notification_type", "new_vip_guy:%")
          .gte("last_sent_at", new Date(Date.now() - 3600 * 1000).toISOString())
          .in("user_id", ids),
      ]);
      const excluded = new Set<string>([
        ...(bans ?? []).map((b: any) => b.user_id),
        ...(blocks ?? []).flatMap((b: any) => [b.blocker_id, b.blocked_id]),
        ...(recent ?? []).map((r: any) => r.user_id),
      ]);
      ids = ids.filter((id) => !excluded.has(id)).slice(0, MAX_RECIPIENTS);
    }

    const title = "👑 New VIP guy just joined!";
    const body = `${guyName} just went VIP. Chat back and forth with him in the next 7 days to earn his bounty!`;
    let sent = 0;
    await Promise.all(ids.map(async (uid) => {
      try {
        const r = await fetch(`${url}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            user_id: uid, title, body,
            data: { type: "new_vip_guy", screen: "/discover", userId: male_id, url: `https://c24club.com/discover?dm=${male_id}` },
            url: `https://c24club.com/discover?dm=${male_id}`,
            notification_type: `new_vip_guy:${male_id}`,
            force_send: true,
          }),
        });
        if (r.ok) sent++;
      } catch (_) { /* ignore single failure */ }
    }));

    await sb.from("group_chat_messages").insert({
      user_id: null,
      is_system: true,
      body: `👑 ${guyName} just went VIP and isn't linked with anyone yet — DM him on Discover within 7 days and get a back-and-forth going to earn his bounty!`,
    });

    console.log("[notify-new-vip-guy]", { male_id, recipients: ids.length, sent });
    return json({ success: true, recipients: ids.length, sent });
  } catch (e: any) {
    console.error("[notify-new-vip-guy] error", e?.message ?? e);
    return json({ success: false, reason: "internal_error" }, 500);
  }
});
