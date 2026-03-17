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

    const subject = template.subject;
    const body = template.body.replace(/\{\{user_name\}\}/g, member.name);

    const messageId = crypto.randomUUID();

    // Log pending before enqueue
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: "welcome",
      recipient_email: member.email,
      status: "pending",
    });

    // Enqueue to transactional_emails queue
    const { error: enqueueError } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        run_id: crypto.randomUUID(),
        message_id: messageId,
        to: member.email,
        from: `C24Club <support@c24club.com>`,
        sender_domain: "c24club.com",
        subject,
        html: body,
        text: body.replace(/<[^>]*>/g, ""),
        purpose: "transactional",
        label: "welcome",
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      console.error("Failed to enqueue welcome email", { error: enqueueError });
      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: "welcome",
        recipient_email: member.email,
        status: "failed",
        error_message: "Failed to enqueue email",
      });
      return new Response(JSON.stringify({ error: "Failed to enqueue email" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`📧 Welcome email enqueued for ${member.email}`);

    return new Response(
      JSON.stringify({ success: true, message: `Welcome email queued for ${member.email}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
