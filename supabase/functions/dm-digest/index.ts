import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SENDER_DOMAIN = "notify.c24club.com";
const FROM_DOMAIN = "c24club.com";
const SITE_URL = "https://c24club.com";

function buildDigestHtml(
  member: any,
  senderNames: string[],
  unreadCount: number,
  messageSnippets: { sender: string; content: string }[]
): string {
  const senderText =
    senderNames.length > 2
      ? `${senderNames.slice(0, 2).join(", ")} and ${senderNames.length - 2} other${senderNames.length - 2 > 1 ? "s" : ""}`
      : senderNames.join(" and ");

  const snippetRows = messageSnippets
    .slice(0, 3)
    .map(
      (s) => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;">
          <p style="margin:0 0 4px;font-weight:600;font-size:14px;color:#1a1a2e;">${s.sender}</p>
          <p style="margin:0;font-size:13px;color:#666;line-height:1.4;max-width:380px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.content}</p>
        </td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background-color:#f7f9fb;font-family:Inter,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f9fb;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="padding:28px 24px 0;">
          <img src="https://ncpbiymnafxdfsvpxirb.supabase.co/storage/v1/object/public/email-assets/logo.png" alt="C24 Club" width="100" style="display:block;margin-bottom:20px;"/>
        </td></tr>

        <tr><td style="padding:0 24px;">
          <h1 style="font-size:20px;font-weight:bold;color:#1a1a2e;margin:0 0 8px;">💬 ${senderText} sent you a message</h1>
          <p style="font-size:14px;color:#666;margin:0 0 20px;">You have ${unreadCount} unread message${unreadCount > 1 ? "s" : ""} waiting for you.</p>
        </td></tr>

        ${snippetRows ? `
        <tr><td style="padding:0 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-radius:8px;overflow:hidden;margin-bottom:20px;">
            ${snippetRows}
          </table>
        </td></tr>
        ` : ""}

        <tr><td style="padding:0 24px 28px;" align="center">
          <a href="${SITE_URL}/messages" style="display:inline-block;padding:14px 32px;background-color:hsl(205,65%,45%);color:#ffffff;font-size:15px;font-weight:600;border-radius:8px;text-decoration:none;">
            See What They Said
          </a>
        </td></tr>
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#999999;text-align:center;">© ${new Date().getFullYear()} C24 Club</p>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get recent conversations (limited to avoid URL-too-long errors)
    const { data: allConvos, error: convoError } = await supabase
      .from("conversations")
      .select("id, participant_1, participant_2")
      .order("last_message_at", { ascending: false })
      .limit(200);

    if (convoError) {
      console.error("Error fetching conversations:", convoError);
      throw convoError;
    }
    if (!allConvos || allConvos.length === 0) {
      return new Response(
        JSON.stringify({ message: "No conversations found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Batch conversation IDs to avoid URL-too-long errors with .in()
    const BATCH_SIZE = 50;
    const allUnread: any[] = [];
    for (let i = 0; i < allConvos.length; i += BATCH_SIZE) {
      const batch = allConvos.slice(i, i + BATCH_SIZE).map((c: any) => c.id);
      const { data: batchMessages, error: batchErr } = await supabase
        .from("dm_messages")
        .select("id, conversation_id, sender_id, content, created_at")
        .in("conversation_id", batch)
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(500);

      if (batchErr) {
        console.error("Error fetching batch:", batchErr);
        continue;
      }
      if (batchMessages) allUnread.push(...batchMessages);
    }

    const unreadMessages = allUnread;

    if (unreadMessages.length === 0) {
      return new Response(
        JSON.stringify({ message: "No unread messages" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!unreadMessages || unreadMessages.length === 0) {
      return new Response(
        JSON.stringify({ message: "No unread messages" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${unreadMessages.length} unread messages across conversations`);

    // Build recipient -> unread info map with message snippets
    const recipientUnread: Record<
      string,
      {
        count: number;
        senderIds: Set<string>;
        snippets: { senderId: string; content: string }[];
      }
    > = {};

    for (const msg of unreadMessages) {
      const convo = allConvos.find((c: any) => c.id === msg.conversation_id);
      if (!convo) continue;

      const recipientId =
        convo.participant_1 === msg.sender_id
          ? convo.participant_2
          : convo.participant_1;

      if (!recipientUnread[recipientId]) {
        recipientUnread[recipientId] = { count: 0, senderIds: new Set(), snippets: [] };
      }
      recipientUnread[recipientId].count++;
      recipientUnread[recipientId].senderIds.add(msg.sender_id);
      if (recipientUnread[recipientId].snippets.length < 3) {
        recipientUnread[recipientId].snippets.push({
          senderId: msg.sender_id,
          content: (msg.content || "").slice(0, 80),
        });
      }
    }

    const recipientIds = Object.keys(recipientUnread);
    if (recipientIds.length === 0) {
      return new Response(
        JSON.stringify({ message: "No recipients to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`${recipientIds.length} recipients have unread messages`);

    // Get member emails
    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("id, email, name")
      .in("id", recipientIds)
      .not("email", "is", null);

    if (membersError) {
      console.error("Error fetching members:", membersError);
      throw membersError;
    }

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
      (senders || []).map((s: any) => [s.id, s.name || "Someone"])
    );

    // Get suppressed emails
    const { data: suppressedList } = await supabase
      .from("suppressed_emails")
      .select("email");
    const suppressedSet = new Set((suppressedList || []).map((s: any) => s.email));

    let emailsSent = 0;

    // Build map of recipient -> latest unread message id (for dedup key)
    const recipientLatestMsgId: Record<string, string> = {};
    for (const msg of unreadMessages) {
      const convo = allConvos.find((c: any) => c.id === msg.conversation_id);
      if (!convo) continue;
      const recipientId =
        convo.participant_1 === msg.sender_id ? convo.participant_2 : convo.participant_1;
      // unreadMessages are ordered DESC by created_at, so first hit is latest
      if (!recipientLatestMsgId[recipientId]) {
        recipientLatestMsgId[recipientId] = msg.id;
      }
    }

    for (const member of members) {
      if (suppressedSet.has(member.email)) continue;

      const info = recipientUnread[member.id];
      if (!info) continue;

      const senderNames = [...info.senderIds]
        .map((id) => senderNameMap.get(id) || "Someone")
        .slice(0, 3);

      const senderText =
        senderNames.length > 2
          ? `${senderNames.slice(0, 2).join(", ")} and others`
          : senderNames.join(" and ");

      // Personalized subject with sender name(s)
      const subject =
        senderNames.length === 1
          ? `${senderNames[0]} sent you a message 💬`
          : `${senderText} sent you ${info.count} messages 💬`;

      const messageSnippets = info.snippets.map((s) => ({
        sender: senderNameMap.get(s.senderId) || "Someone",
        content: s.content,
      }));

      const html = buildDigestHtml(member, senderNames, info.count, messageSnippets);

      // Enqueue email via pgmq
      try {
        const latestMsgId = recipientLatestMsgId[member.id];
        const dmMessageId = `dm-digest-${member.id}-${latestMsgId}`;

        // Skip if a digest covering this latest unread message was already sent/queued
        const { data: alreadySent } = await supabase
          .from("email_send_log")
          .select("id")
          .eq("message_id", dmMessageId)
          .limit(1);

        if (alreadySent && alreadySent.length > 0) {
          continue;
        }

        await supabase.from("email_send_log").insert({
          message_id: dmMessageId,
          template_name: "unread_dm_digest",
          recipient_email: member.email,
          status: "pending",
        });

        await supabase.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            idempotency_key: messageId,
            message_id: dmMessageId,
            to: member.email,
            from: `C24Club <support@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject,
            html,
            text: `${senderText} sent you a message on C24Club. You have ${info.count} unread message${info.count > 1 ? "s" : ""}. Read them at ${SITE_URL}/messages`,
            purpose: "transactional",
            unsubscribe_token: crypto.randomUUID(),
            label: "unread_dm_digest",
            queued_at: new Date().toISOString(),
            idempotency_key: dmMessageId,
          },
        });
        emailsSent++;
      } catch (e) {
        console.error(`Failed to enqueue email for ${member.id}:`, e);
      }
    }

    console.log(`Digest emails enqueued for ${emailsSent} users`);

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
