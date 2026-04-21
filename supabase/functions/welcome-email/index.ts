import { createClient } from "npm:@supabase/supabase-js@2";
import { sendResendEmail } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SITE_URL = "https://c24club.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load welcome template
    const { data: template } = await supabase
      .from("email_templates")
      .select("*")
      .eq("template_key", "welcome")
      .eq("is_active", true)
      .maybeSingle();

    if (!template) {
      console.log("Welcome email template not found or disabled, skipping.");
      return new Response(JSON.stringify({ skipped: true, reason: "template disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get member info
    const { data: member } = await supabase
      .from("members").select("name, email").eq("id", userId).single();

    if (!member?.email) {
      console.log("Member email not found for welcome email, skipping.");
      return new Response(JSON.stringify({ skipped: true, reason: "no email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstName = (member.name || "").split(" ")[0] || "there";

    // Personalized subject with user's name
    const subject = `You're in, ${firstName}! Here's how to start earning 💰`;

    const rawBody = template.body.replace(/\{\{user_name\}\}/g, member.name);

    // Wrap in styled HTML email layout
    const body = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f7f9fb;font-family:Inter,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f9fb;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;padding:32px 28px;max-width:480px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td>
          <img src="https://ncpbiymnafxdfsvpxirb.supabase.co/storage/v1/object/public/email-assets/logo.png" alt="C24 Club" width="120" style="margin-bottom:24px;" />
          <h1 style="font-size:22px;font-weight:bold;color:#1a1a2e;margin:0 0 20px;">Welcome to C24Club! 🎉</h1>
          <div style="font-size:14px;color:#55575d;line-height:1.8;">
            ${rawBody.includes('<') ? rawBody : rawBody.replace(/\n/g, '<br/>')}
          </div>
          <a href="${SITE_URL}/videocall" style="display:inline-block;margin-top:24px;padding:14px 24px;background-color:hsl(205,65%,45%);color:#ffffff;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;">
            Start Earning Now
          </a>
          <p style="font-size:12px;color:#999999;margin:30px 0 0;">C24CLUB</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const messageId = crypto.randomUUID();

    // Send via Resend
    try {
      const resendResult = await sendResendEmail({ to: member.email, subject, html: body });
      await supabase.from("email_send_log").insert({
        message_id: messageId, template_name: "welcome",
        recipient_email: member.email, status: "sent",
      });
      console.log(`📧 Welcome email sent via Resend for ${member.email} (id: ${resendResult.id})`);
    } catch (sendErr) {
      console.error("Failed to send welcome email via Resend", sendErr);
      await supabase.from("email_send_log").insert({
        message_id: messageId, template_name: "welcome",
        recipient_email: member.email, status: "failed",
        error_message: sendErr instanceof Error ? sendErr.message : String(sendErr),
      });
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: `Welcome email sent to ${member.email}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
