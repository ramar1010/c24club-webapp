import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify admin caller
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAnon.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabase
      .from("user_roles").select("role")
      .eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { submissionId, challengeTitle, rewardText } = await req.json();
    if (!submissionId) {
      return new Response(JSON.stringify({ error: "submissionId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch submission + member
    const { data: submission } = await supabase
      .from("challenge_submissions").select("user_id").eq("id", submissionId).single();
    if (!submission) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: member } = await supabase
      .from("members").select("name, email").eq("id", submission.user_id).single();
    if (!member?.email) {
      return new Response(JSON.stringify({ skipped: true, reason: "no email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check suppression
    const { data: suppressed } = await supabase
      .from("suppressed_emails").select("id").eq("email", member.email).maybeSingle();
    if (suppressed) {
      return new Response(JSON.stringify({ skipped: true, reason: "suppressed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userName = member.name || "there";
    const subject = `🎉 Your Challenge Has Been Approved!`;
    const body = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f7f9fb;font-family:Inter,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f9fb;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;padding:32px 28px;max-width:480px;">
        <tr><td>
          <img src="https://ncpbiymnafxdfsvpxirb.supabase.co/storage/v1/object/public/email-assets/logo.png" alt="C24 Club" width="120" style="margin-bottom:24px;" />
          <h1 style="font-size:22px;font-weight:bold;color:#1a1a2e;margin:0 0 20px;">Challenge Approved! 🎉</h1>
          <p style="font-size:14px;color:#55575d;line-height:1.8;margin:0 0 16px;">
            Hey ${userName},
          </p>
          <p style="font-size:14px;color:#55575d;line-height:1.8;margin:0 0 16px;">
            Great news! Your submission for <strong style="color:#1a1a2e;">${challengeTitle || "a Weekly Challenge"}</strong> has been reviewed and <strong style="color:#16a34a;">approved</strong>! 🏆
          </p>
          <p style="font-size:14px;color:#55575d;line-height:1.8;margin:0 0 24px;">
            Your reward of <strong style="color:#1a1a2e;">${rewardText || "your prize"}</strong> has been credited to your account.
          </p>
          <a href="https://c24club.com/videocall" style="display:inline-block;padding:14px 24px;background-color:hsl(205,65%,45%);color:#ffffff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;">
            VIEW YOUR REWARDS
          </a>
          <p style="font-size:12px;color:#999999;margin:30px 0 0;">C24CLUB</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const messageId = `challenge-approved-${submissionId}-${Date.now()}`;

    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: "challenge_approved",
      recipient_email: member.email,
      status: "pending",
      metadata: { submission_id: submissionId },
    });

    const { error: enqueueError } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        idempotency_key: messageId,
        message_id: messageId,
        to: member.email,
        from: "C24Club <support@c24club.com>",
        sender_domain: "notify.c24club.com",
        subject,
        html: body,
        text: body.replace(/<[^>]*>/g, ""),
        purpose: "transactional",
        unsubscribe_token: crypto.randomUUID(),
        label: "challenge_approved",
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      console.error("Failed to enqueue challenge approved email", enqueueError);
      return new Response(JSON.stringify({ error: "Failed to enqueue email" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`📧 Challenge approved email enqueued for ${member.email}`);

    return new Response(
      JSON.stringify({ success: true, message: `Email queued for ${member.email}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
