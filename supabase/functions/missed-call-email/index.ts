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
      supabase.from("members").select("name, email").eq("id", inviteeId).maybeSingle(),
    ]);

    if (!invitee?.email) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerName = inviter?.name || "Someone";
    const userName = invitee.name || "there";

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

    // Load template
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

    const subject = template.subject
      .replace(/\{\{caller_name\}\}/g, callerName)
      .replace(/\{\{user_name\}\}/g, userName);

    const html = template.body
      .replace(/\{\{caller_name\}\}/g, callerName)
      .replace(/\{\{user_name\}\}/g, userName);

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
