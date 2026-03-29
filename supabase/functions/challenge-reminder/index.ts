import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REMINDER_AFTER_DAYS = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find pending submissions older than REMINDER_AFTER_DAYS that haven't been reminded
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - REMINDER_AFTER_DAYS);

    const { data: pendingSubmissions, error: fetchErr } = await supabase
      .from("challenge_submissions")
      .select("id, user_id, created_at, challenge_id, weekly_challenges(title)")
      .eq("status", "pending")
      .lt("created_at", cutoffDate.toISOString())
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchErr) {
      console.error("Failed to fetch pending submissions:", fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pendingSubmissions || pendingSubmissions.length === 0) {
      console.log("No pending submissions need reminders.");
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check which submissions already had a reminder sent (via email_send_log)
    const submissionIds = pendingSubmissions.map((s: any) => s.id);
    const { data: existingReminders } = await supabase
      .from("email_send_log")
      .select("metadata")
      .eq("template_name", "challenge_pending_reminder")
      .in("metadata->>submission_id", submissionIds);

    const alreadyReminded = new Set(
      (existingReminders || []).map((r: any) => r.metadata?.submission_id)
    );

    // Get unique user IDs for member lookup
    const unremindered = pendingSubmissions.filter((s: any) => !alreadyReminded.has(s.id));
    if (unremindered.length === 0) {
      console.log("All pending submissions already reminded.");
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = [...new Set(unremindered.map((s: any) => s.user_id))];
    const { data: members } = await supabase
      .from("members").select("id, name, email").in("id", userIds);

    // Check suppression list
    const emails = (members || []).map((m: any) => m.email).filter(Boolean);
    const { data: suppressedList } = await supabase
      .from("suppressed_emails").select("email").in("email", emails);
    const suppressedSet = new Set((suppressedList || []).map((s: any) => s.email));

    const memberMap = new Map((members || []).map((m: any) => [m.id, m]));

    let sentCount = 0;

    for (const submission of unremindered) {
      const member = memberMap.get(submission.user_id);
      if (!member?.email || suppressedSet.has(member.email)) continue;

      const userName = member.name || "there";
      const challengeTitle = (submission as any).weekly_challenges?.title || "a Weekly Challenge";
      const daysPending = Math.floor((Date.now() - new Date(submission.created_at).getTime()) / (1000 * 60 * 60 * 24));

      const subject = `⏳ Your Challenge Submission is Still Pending`;
      const body = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f7f9fb;font-family:Inter,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f9fb;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;padding:32px 28px;max-width:480px;">
        <tr><td>
          <img src="https://ncpbiymnafxdfsvpxirb.supabase.co/storage/v1/object/public/email-assets/logo.png" alt="C24 Club" width="120" style="margin-bottom:24px;" />
          <h1 style="font-size:22px;font-weight:bold;color:#1a1a2e;margin:0 0 20px;">Hang Tight! ⏳</h1>
          <p style="font-size:14px;color:#55575d;line-height:1.8;margin:0 0 16px;">
            Hey ${userName},
          </p>
          <p style="font-size:14px;color:#55575d;line-height:1.8;margin:0 0 16px;">
            Your submission for <strong style="color:#1a1a2e;">${challengeTitle}</strong> has been pending for <strong>${daysPending} day${daysPending !== 1 ? "s" : ""}</strong>. Our team is reviewing it and you'll hear back soon!
          </p>
          <p style="font-size:14px;color:#55575d;line-height:1.8;margin:0 0 24px;">
            In the meantime, keep chatting and earning minutes! 💪
          </p>
          <a href="https://c24club.com/videocall" style="display:inline-block;padding:14px 24px;background-color:hsl(205,65%,45%);color:#ffffff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;">
            START A CALL
          </a>
          <p style="font-size:12px;color:#999999;margin:30px 0 0;">C24CLUB</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      const messageId = `challenge-reminder-${submission.id}-${Date.now()}`;

      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: "challenge_pending_reminder",
        recipient_email: member.email,
        status: "pending",
        metadata: { submission_id: submission.id },
      });

      const { error: enqueueError } = await supabase.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          run_id: crypto.randomUUID(),
          message_id: messageId,
          to: member.email,
          from: "C24Club <support@c24club.com>",
          sender_domain: "c24club.com",
          subject,
          html: body,
          text: body.replace(/<[^>]*>/g, ""),
          purpose: "transactional",
          label: "challenge_pending_reminder",
          queued_at: new Date().toISOString(),
        },
      });

      if (enqueueError) {
        console.error(`Failed to enqueue reminder for submission ${submission.id}:`, enqueueError);
        continue;
      }

      sentCount++;
      console.log(`📧 Reminder enqueued for ${member.email} (submission ${submission.id})`);
    }

    console.log(`✅ Challenge reminders complete: ${sentCount} emails enqueued`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
