import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SENDER_DOMAIN = "c24club.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { inviteId, inviterId, inviteeId } = await req.json();
    if (!inviterId || !inviteeId) {
      return new Response(JSON.stringify({ error: "inviterId and inviteeId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get both users' info
    const [{ data: inviter }, { data: invitee }] = await Promise.all([
      supabase.from("members").select("name, image_url").eq("id", inviterId).maybeSingle(),
      supabase.from("members").select("name, email, gender").eq("id", inviteeId).maybeSingle(),
    ]);

    if (!invitee?.email) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerName = inviter?.name || "Someone";
    const userName = invitee.name || "there";
    const isFemale = invitee.gender === "female";

    // --- Auto-send a missed-call DM ---
    try {
      // Find existing conversation between the two users
      const { data: existingConvo } = await supabase
        .from("conversations")
        .select("id")
        .or(
          `and(participant_1.eq.${inviterId},participant_2.eq.${inviteeId}),and(participant_1.eq.${inviteeId},participant_2.eq.${inviterId})`
        )
        .maybeSingle();

      let convoId = existingConvo?.id;

      // Create conversation if it doesn't exist
      if (!convoId) {
        const { data: newConvo } = await supabase
          .from("conversations")
          .insert({ participant_1: inviterId, participant_2: inviteeId })
          .select("id")
          .single();
        convoId = newConvo?.id;
      }

      if (convoId) {
        await supabase.from("dm_messages").insert({
          conversation_id: convoId,
          sender_id: inviterId,
          content: `📹 ${callerName} tried to video chat with you!`,
        });

        // Update last_message_at
        await supabase
          .from("conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", convoId);

        console.log(`📹 Missed call DM sent in conversation ${convoId}`);
      }
    } catch (dmErr) {
      console.error("Failed to send missed-call DM:", dmErr);
      // Don't block the email flow
    }

    // Check suppression
    const { data: suppressed } = await supabase
      .from("suppressed_emails")
      .select("id")
      .eq("email", invitee.email)
      .maybeSingle();

    if (suppressed) {
      return new Response(JSON.stringify({ skipped: true, reason: "suppressed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let subject: string;
    let rawBody: string;

    if (isFemale) {
      // Cash-focused messaging for female users
      subject = `💰 You missed a cash video call from ${callerName}!`;
      rawBody = `Hey ${userName},\n\n${callerName} tried to video chat with you — and that's money you left on the table! 💸\n\nEvery private call earns you real cash. The longer you chat, the more you make.\n\n👉 https://c24club.com/discover\n\nDon't let the next payout slip away — check their profile and connect!\n\n— The C24Club Team`;
    } else {
      // Load template from DB for non-female users
      const { data: template } = await supabase
        .from("email_templates")
        .select("subject, body")
        .eq("template_key", "missed_video_call")
        .eq("is_active", true)
        .maybeSingle();

      if (!template) {
        return new Response(JSON.stringify({ skipped: true, reason: "template_disabled" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      subject = template.subject
        .replace(/\{\{caller_name\}\}/g, callerName)
        .replace(/\{\{user_name\}\}/g, userName);

      rawBody = template.body
        .replace(/\{\{caller_name\}\}/g, callerName)
        .replace(/\{\{user_name\}\}/g, userName);
    }

    // Rewrite staging URLs to production
    rawBody = rawBody.replace(/https?:\/\/[a-z0-9-]+\.lovable\.app/g, "https://c24club.com");

    // Convert plain-text newlines to HTML paragraphs, turning URLs into buttons
    const ctaLabel = isFemale ? "See Who's Paying 💰" : "View Profile on Discover";
    const bodyHtml = rawBody
      .split(/\n\n+/)
      .map((p: string) => {
        // Detect lines with a standalone URL (e.g. "👉 https://...")
        const urlMatch = p.match(/👉\s*(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          const url = urlMatch[1];
          return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
            <tr><td align="center">
              <a href="${url}" target="_blank" style="display:inline-block;background-color:#6366f1;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;text-align:center;">${ctaLabel}</a>
            </td></tr>
          </table>`;
        }
        return `<p style="margin:0 0 16px;line-height:1.6;color:#333333;font-size:15px;">${p.replace(/\n/g, "<br/>")}</p>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background-color:#f7f9fb;font-family:Inter,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f9fb;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:32px 28px;">
          <img src="https://ncpbiymnafxdfsvpxirb.supabase.co/storage/v1/object/public/email-assets/logo.png" alt="C24 Club" width="120" style="display:block;margin-bottom:24px;"/>
          ${bodyHtml}
        </td></tr>
      </table>
      <p style="margin:24px 0 0;font-size:12px;color:#999999;text-align:center;">© ${new Date().getFullYear()} C24 Club</p>
    </td></tr>
  </table>
</body>
</html>`;

    // Deduplicate: max 1 missed-call email per inviter→invitee pair per hour
    const dedupeKey = `missed-call-${inviterId}-${inviteeId}-${new Date().toISOString().slice(0, 13)}`;
    const { data: alreadySent } = await supabase
      .from("email_send_log")
      .select("id")
      .eq("message_id", dedupeKey)
      .maybeSingle();

    if (alreadySent) {
      return new Response(JSON.stringify({ skipped: true, reason: "already_sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log pending
    await supabase.from("email_send_log").insert({
      message_id: dedupeKey,
      template_name: "missed_video_call",
      recipient_email: invitee.email,
      status: "pending",
    });

    // Enqueue
    const { error: enqueueError } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        run_id: crypto.randomUUID(),
        message_id: dedupeKey,
        to: invitee.email,
        from: `C24Club <support@${SENDER_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text: html.replace(/<[^>]*>/g, ""),
        purpose: "transactional",
        label: "missed_video_call",
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      console.error("Failed to enqueue missed call email:", enqueueError);
      return new Response(JSON.stringify({ error: "Failed to enqueue" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`📹 Missed call email enqueued for ${invitee.email} (caller: ${callerName})`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("missed-call-email error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
