import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find all unread messages grouped by recipient
    const { data: unreadMessages, error: msgError } = await supabase
      .from("dm_messages")
      .select("id, conversation_id, sender_id, content, created_at")
      .is("read_at", null)
      .order("created_at", { ascending: false });

    if (msgError) throw msgError;
    if (!unreadMessages || unreadMessages.length === 0) {
      return new Response(
        JSON.stringify({ message: "No unread messages" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group by conversation to find recipients
    const convoIds = [...new Set(unreadMessages.map((m: any) => m.conversation_id))];

    const { data: convos } = await supabase
      .from("conversations")
      .select("id, participant_1, participant_2")
      .in("id", convoIds);

    if (!convos) {
      return new Response(
        JSON.stringify({ message: "No conversations found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build recipient -> unread info map
    const recipientUnread: Record<string, { count: number; senderIds: Set<string> }> = {};

    for (const msg of unreadMessages) {
      const convo = convos.find((c: any) => c.id === msg.conversation_id);
      if (!convo) continue;

      // Recipient is the participant who is NOT the sender
      const recipientId =
        convo.participant_1 === msg.sender_id
          ? convo.participant_2
          : convo.participant_1;

      if (!recipientUnread[recipientId]) {
        recipientUnread[recipientId] = { count: 0, senderIds: new Set() };
      }
      recipientUnread[recipientId].count++;
      recipientUnread[recipientId].senderIds.add(msg.sender_id);
    }

    const recipientIds = Object.keys(recipientUnread);
    if (recipientIds.length === 0) {
      return new Response(
        JSON.stringify({ message: "No recipients to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get member emails
    const { data: members } = await supabase
      .from("members")
      .select("id, email, name")
      .in("id", recipientIds)
      .not("email", "is", null);

    if (!members || members.length === 0) {
      return new Response(
        JSON.stringify({ message: "No members with emails" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get sender names for personalization
    const allSenderIds = [
      ...new Set(
        Object.values(recipientUnread).flatMap((r) => [...r.senderIds])
      ),
    ];
    const { data: senders } = await supabase
      .from("members")
      .select("id, name")
      .in("id", allSenderIds);

    const senderNameMap = new Map(
      (senders || []).map((s: any) => [s.id, s.name])
    );

    // Check for active email template
    const { data: template } = await supabase
      .from("email_templates")
      .select("subject, body")
      .eq("template_key", "unread_dm_digest")
      .eq("is_active", true)
      .single();

    let emailsSent = 0;

    for (const member of members) {
      const info = recipientUnread[member.id];
      if (!info) continue;

      const senderNames = [...info.senderIds]
        .map((id) => senderNameMap.get(id) || "Someone")
        .slice(0, 3);

      const senderText =
        senderNames.length > 2
          ? `${senderNames.slice(0, 2).join(", ")} and others`
          : senderNames.join(" and ");

      const subject =
        template?.subject?.replace("{{count}}", String(info.count)) ||
        `You have ${info.count} unread message${info.count > 1 ? "s" : ""} on C24CLUB`;

      const body =
        template?.body
          ?.replace("{{name}}", member.name || "there")
          ?.replace("{{count}}", String(info.count))
          ?.replace("{{senders}}", senderText) ||
        `Hey ${member.name || "there"}! You have ${info.count} unread message${info.count > 1 ? "s" : ""} from ${senderText}. Check them out on C24CLUB!`;

      // Enqueue email via pgmq
      try {
        const dmMessageId = `dm-digest-${member.id}-${new Date().toISOString().slice(0, 13)}`;
        await supabase.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            run_id: crypto.randomUUID(),
            message_id: dmMessageId,
            to: member.email,
            from: `C24Club <support@c24club.com>`,
            sender_domain: "c24club.com",
            subject,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <h2 style="color:#1a1a2e;">💬 ${subject}</h2>
              <p style="color:#333;font-size:16px;line-height:1.6;">${body}</p>
              <a href="https://c24club.lovable.app/messages" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#3b82f6;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">
                Read Messages
              </a>
              <p style="color:#999;font-size:12px;margin-top:30px;">C24CLUB</p>
            </div>`,
            text: body,
            purpose: "transactional",
            label: "unread_dm_digest",
            queued_at: new Date().toISOString(),
            idempotency_key: `dm-digest-${member.id}-${new Date().toISOString().slice(0, 13)}`,
          },
        });
        emailsSent++;
      } catch (e) {
        console.error(`Failed to enqueue email for ${member.id}:`, e);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Digest emails enqueued for ${emailsSent} users`,
        recipients: emailsSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("DM digest error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
