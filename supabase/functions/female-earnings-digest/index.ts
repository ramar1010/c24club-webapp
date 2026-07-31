import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OWNER_ID = "6f8bb0e2-a36a-4bc0-920f-312c340f7921";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  let testEmail: string | null = null;
  try {
    const payload = await req.json().catch(() => ({}));
    testEmail = payload?.test_email ?? null;
  } catch (_) { /* no body */ }

  try {
    const { data: allRows, error } = await supabase.rpc("get_female_earnings_digest");
    if (error) throw error;

    let rows = allRows ?? [];
    if (testEmail) {
      const { data: target } = await supabase
        .from("members")
        .select("id, name")
        .ilike("email", testEmail)
        .maybeSingle();
      if (!target?.id) return json({ success: false, error: `No member found for ${testEmail}` }, 404);
      const existing = rows.find((r: any) => r.female_id === target.id);
      rows = [existing ?? {
        female_id: target.id,
        female_name: target.name ?? "there",
        yesterday_minutes: 0,
        cashable_minutes: 0,
        near_limit_count: 0,
        near_limit_names: [],
      }];
    }

    const today = new Date().toISOString().slice(0, 10);
    let sent = 0;
    let skipped = 0;

    for (const row of rows ?? []) {
      const femaleId: string = row.female_id;
      const name: string = row.female_name || "there";
      const earned = Number(row.yesterday_minutes ?? 0);
      const cashable = Number(row.cashable_minutes ?? 0);
      const nearCount = Number(row.near_limit_count ?? 0);
      const names: string[] = row.near_limit_names ?? [];

      const notificationType = `earnings_digest:${today}`;
      const { data: alreadySent } = testEmail ? { data: null } : await supabase
        .from("push_notification_log")
        .select("last_sent_at")
        .eq("user_id", femaleId)
        .eq("notification_type", notificationType)
        .maybeSingle();
      if (alreadySent?.last_sent_at) {
        skipped++;
        continue;
      }

      const lines: string[] = [`💰 Your daily earnings update, ${name}:`];
      if (earned > 0) {
        lines.push(`• You earned ${earned} minutes ($${(earned * 0.01).toFixed(2)}) in the last 24 hours.`);
      }
      if (cashable > 0) {
        lines.push(`• Cashable balance: ${cashable} minutes ($${(cashable * 0.01).toFixed(2)}) — cash out anytime in your Profile.`);
      }
      if (nearCount > 0) {
        const who = names.slice(0, 3).join(", ");
        lines.push(
          `• ${nearCount} guy${nearCount > 1 ? "s are" : " is"} almost out of free messages${who ? ` (${who})` : ""}. After 3 messages they must buy VIP to keep talking to you — and you get paid when they do.`
        );
        lines.push(`• Reply to them today. A single reply is often all it takes.`);
      }
      lines.push(`Tip: Guide → https://c24club.com/how-to-guide`);
      const dmContent = lines.join("\n");

      let conversationId: string | null = null;
      const { data: convo } = await supabase
        .from("conversations")
        .select("id")
        .or(`and(participant_1.eq.${OWNER_ID},participant_2.eq.${femaleId}),and(participant_1.eq.${femaleId},participant_2.eq.${OWNER_ID})`)
        .maybeSingle();

      if (convo?.id) {
        conversationId = convo.id;
      } else {
        const { data: created } = await supabase
          .from("conversations")
          .insert({ participant_1: OWNER_ID, participant_2: femaleId })
          .select("id")
          .single();
        conversationId = created?.id ?? null;
      }

      if (conversationId) {
        await supabase.from("dm_messages").insert({
          conversation_id: conversationId,
          sender_id: OWNER_ID,
          content: dmContent,
        });
        await supabase
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conversationId);
      }

      const pushBody = nearCount > 0
        ? `${nearCount} guy${nearCount > 1 ? "s are" : " is"} 1 message away from having to buy VIP. Reply and get paid.`
        : `You earned $${(earned * 0.01).toFixed(2)} yesterday. Keep chatting to earn more.`;

      await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({
          user_id: femaleId,
          title: "💸 Your daily earnings update",
          body: pushBody,
          data: { type: "earnings_digest", screen: "/messages" },
          notification_type: notificationType,
          force_send: true,
        }),
      }).catch((e) => console.error("[female-earnings-digest] push failed", e?.message));

      sent++;
    }

    console.log("[female-earnings-digest] done", { candidates: rows?.length ?? 0, sent, skipped });
    return json({ success: true, candidates: rows?.length ?? 0, sent, skipped });
  } catch (err: any) {
    console.error("[female-earnings-digest] error", err?.message ?? err);
    return json({ success: false, error: err?.message ?? String(err) }, 500);
  }
});
