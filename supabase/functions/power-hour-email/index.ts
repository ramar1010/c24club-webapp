import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // 1. Fetch the power_hour_reminder template
    const { data: template, error: tplErr } = await supabase
      .from("email_templates")
      .select("*")
      .eq("template_key", "power_hour_reminder")
      .eq("is_active", true)
      .single();

    if (tplErr || !template) {
      console.log("Template not found or inactive, skipping.");
      return new Response(JSON.stringify({ skipped: true, reason: "template_inactive" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get all female members with emails
    const { data: females, error: memErr } = await supabase
      .from("members")
      .select("id, name, email")
      .eq("gender", "Female")
      .not("email", "is", null);

    if (memErr) throw memErr;
    if (!females || females.length === 0) {
      console.log("No female members found.");
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Check suppressed emails
    const { data: suppressed } = await supabase
      .from("suppressed_emails")
      .select("email");

    const suppressedSet = new Set((suppressed || []).map((s: { email: string }) => s.email.toLowerCase()));

    let enqueued = 0;

    for (const member of females) {
      if (!member.email || suppressedSet.has(member.email.toLowerCase())) {
        continue;
      }

      const userName = member.name || "there";
      const subject = template.subject.replace(/\{\{user_name\}\}/g, userName);
      const body = template.body.replace(/\{\{user_name\}\}/g, userName);

      const messageId = `power_hour_${member.id}_${new Date().toISOString().split("T")[0]}`;

      const emailPayload = {
        run_id: "",
        to: member.email,
        from: `C24Club <noreply@notify.c24club.com>`,
        subject,
        html: body.replace(/\n/g, "<br>"),
        purpose: "transactional",
        label: "power_hour_reminder",
        sender_domain: "notify.c24club.com",
        message_id: messageId,
        queued_at: new Date().toISOString(),
      };

      const { error: enqErr } = await supabase.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: emailPayload,
      });

      if (enqErr) {
        console.error(`Failed to enqueue for ${member.email}:`, enqErr.message);
        continue;
      }

      // Log it
      await supabase.from("email_send_log").insert({
        template_name: "power_hour_reminder",
        recipient_email: member.email,
        status: "pending",
        message_id: messageId,
        metadata: { user_id: member.id },
      });

      enqueued++;
    }

    console.log(`Power hour emails enqueued: ${enqueued}`);

    return new Response(JSON.stringify({ sent: enqueued }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Power hour email error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
