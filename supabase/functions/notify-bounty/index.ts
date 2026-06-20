import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { bounty_earning_id } = await req.json().catch(() => ({}));
    if (!bounty_earning_id || typeof bounty_earning_id !== "string") {
      return json({ success: false, reason: "Missing bounty_earning_id" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { data: bounty, error: bountyError } = await supabase
      .from("bounty_earnings")
      .select("id, female_id, male_id, amount_minutes, amount_cents, source, created_at, clawed_back")
      .eq("id", bounty_earning_id)
      .maybeSingle();

    if (bountyError) throw bountyError;
    if (!bounty) return json({ success: false, reason: "Bounty not found" }, 404);
    if (bounty.clawed_back) return json({ success: false, skipped: true, reason: "Bounty clawed back" });

    const minutes = Number(bounty.amount_minutes ?? bounty.amount_cents ?? 0);
    if (!bounty.female_id || !minutes) {
      return json({ success: false, reason: "Bounty missing recipient or amount" }, 400);
    }

    const source = String(bounty.source ?? "bounty").toLowerCase();
    const cash = (minutes * 0.01).toFixed(2);
    const shortId = String(bounty.id).slice(0, 8).toUpperCase();
    const title = source === "streak" ? "🔥 Bounty streak bonus!" : "🎉 Bounty awarded!";
    const body = source === "streak"
      ? `You earned a ${minutes}-minute ($${cash}) bounty streak bonus. Cashable in your Profile.`
      : `You earned ${minutes} minutes ($${cash}) from a ${source === "premium" ? "Premium VIP" : "Basic VIP"} signup. Cashable in your Profile.`;
    const dmContent = `💰 ${body} Check your Profile → Bounty History. Reward ID: ${shortId}`;

    let conversationId: string | null = null;
    const { data: existingConversation } = await supabase
      .from("conversations")
      .select("id")
      .or(`and(participant_1.eq.${OWNER_ID},participant_2.eq.${bounty.female_id}),and(participant_1.eq.${bounty.female_id},participant_2.eq.${OWNER_ID})`)
      .maybeSingle();

    if (existingConversation?.id) {
      conversationId = existingConversation.id;
    } else {
      const { data: createdConversation, error: createConversationError } = await supabase
        .from("conversations")
        .insert({ participant_1: OWNER_ID, participant_2: bounty.female_id })
        .select("id")
        .single();
      if (createConversationError) throw createConversationError;
      conversationId = createdConversation?.id ?? null;
    }

    if (conversationId) {
      const { data: duplicateDm } = await supabase
        .from("dm_messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("sender_id", OWNER_ID)
        .ilike("content", `%Reward ID: ${shortId}%`)
        .maybeSingle();

      if (!duplicateDm?.id) {
        const { error: dmError } = await supabase.from("dm_messages").insert({
          conversation_id: conversationId,
          sender_id: OWNER_ID,
          content: dmContent,
        });
        if (dmError) throw dmError;
      }

      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversationId);
    }

    const notificationType = `bounty_awarded:${bounty.id}`;
    const { data: previousPush } = await supabase
      .from("push_notification_log")
      .select("last_sent_at")
      .eq("user_id", bounty.female_id)
      .eq("notification_type", notificationType)
      .maybeSingle();

    let pushResult: Record<string, unknown> = { skipped: true, reason: "Already sent" };
    if (!previousPush?.last_sent_at) {
      const pushResp = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({
          user_id: bounty.female_id,
          title,
          body,
          data: { type: "bounty_awarded", screen: "/profile", bounty_earning_id: bounty.id },
          notification_type: notificationType,
          force_send: true,
        }),
      });
      pushResult = await pushResp.json().catch(() => ({}));
    }

    console.log("[notify-bounty] sent", { bounty_earning_id, female_id: bounty.female_id, pushResult });
    return json({ success: true, push: pushResult });
  } catch (err: any) {
    console.error("[notify-bounty] error", err?.message ?? err);
    return json({ success: false, reason: err?.message ?? String(err) }, 500);
  }
});