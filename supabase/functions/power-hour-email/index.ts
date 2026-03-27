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

    // 1. Read anchor_settings for power hour times
    const { data: settings } = await supabase
      .from("anchor_settings")
      .select("power_hour_start, power_hour_end")
      .limit(1)
      .single();

    if (!settings) {
      console.log("No anchor settings found, skipping.");
      return new Response(JSON.stringify({ skipped: true, reason: "no_settings" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Determine which reminder window we're in (1hr or 10min before)
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Parse power_hour_start (HH:MM or HH:MM:SS format) into today's date
    const [phHour, phMin] = settings.power_hour_start.split(":").map(Number);
    const powerHourDate = new Date(now);
    powerHourDate.setUTCHours(phHour, phMin, 0, 0);

    const minutesUntil = (powerHourDate.getTime() - now.getTime()) / 60_000;

    // Determine reminder type based on how far away power hour is
    // Allow a 5-minute window for cron timing flexibility
    let reminderType: "1hour" | "10min" | null = null;
    if (minutesUntil > 55 && minutesUntil <= 65) {
      reminderType = "1hour";
    } else if (minutesUntil > 5 && minutesUntil <= 15) {
      reminderType = "10min";
    }

    // Also allow manual override via request body
    try {
      const body = await req.json();
      if (body?.reminder_type === "1hour" || body?.reminder_type === "10min") {
        reminderType = body.reminder_type;
      }
    } catch {
      // No body or not JSON — use auto-detected timing
    }

    if (!reminderType) {
      console.log(`Not in a reminder window. Minutes until power hour: ${minutesUntil.toFixed(1)}`);
      return new Response(JSON.stringify({ skipped: true, reason: "not_in_window", minutesUntil: Math.round(minutesUntil) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Check if we already sent this reminder today
    const dedupeKey = `power_hour_${reminderType}_${todayStr}`;
    const { data: alreadySent } = await supabase
      .from("email_send_log")
      .select("id")
      .eq("message_id", dedupeKey)
      .limit(1);

    if (alreadySent && alreadySent.length > 0) {
      console.log(`Already sent ${reminderType} reminder today.`);
      return new Response(JSON.stringify({ skipped: true, reason: "already_sent", reminderType }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Fetch the right template
    const templateKey = reminderType === "1hour" ? "power_hour_1h" : "power_hour_10m";
    const fallbackKey = "power_hour_reminder";

    let template: any = null;
    const { data: specificTpl } = await supabase
      .from("email_templates")
      .select("*")
      .eq("template_key", templateKey)
      .eq("is_active", true)
      .single();

    if (specificTpl) {
      template = specificTpl;
    } else {
      // Fall back to the general template
      const { data: fallbackTpl } = await supabase
        .from("email_templates")
        .select("*")
        .eq("template_key", fallbackKey)
        .eq("is_active", true)
        .single();
      template = fallbackTpl;
    }

    if (!template) {
      console.log("No active template found, skipping.");
      return new Response(JSON.stringify({ skipped: true, reason: "template_inactive" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Get ALL members with emails (not just females)
    const { data: members, error: memErr } = await supabase
      .from("members")
      .select("id, name, email")
      .not("email", "is", null);

    if (memErr) throw memErr;
    if (!members || members.length === 0) {
      console.log("No members with emails found.");
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Check suppressed emails
    const { data: suppressed } = await supabase
      .from("suppressed_emails")
      .select("email");

    const suppressedSet = new Set((suppressed || []).map((s: { email: string }) => s.email.toLowerCase()));

    // Format the power hour time for display in emails
    const displayHour = phHour > 12 ? phHour - 12 : phHour === 0 ? 12 : phHour;
    const amPm = phHour >= 12 ? "PM" : "AM";
    const powerHourDisplay = `${displayHour}:${String(phMin).padStart(2, "0")} ${amPm} UTC`;

    let enqueued = 0;

    // Log the dedup marker first
    await supabase.from("email_send_log").insert({
      template_name: `power_hour_${reminderType}`,
      recipient_email: "system@dedup",
      status: "sent",
      message_id: dedupeKey,
      metadata: { type: "dedup_marker" },
    });

    for (const member of members) {
      if (!member.email || suppressedSet.has(member.email.toLowerCase())) {
        continue;
      }

      const userName = member.name || "there";
      const joinLink = "https://c24club.lovable.app/videocall?from=power_hour";
      const subject = template.subject
        .replace(/\{\{user_name\}\}/g, userName)
        .replace(/\{\{power_hour_time\}\}/g, powerHourDisplay)
        .replace(/\{\{join_link\}\}/g, joinLink);
      const body = template.body
        .replace(/\{\{user_name\}\}/g, userName)
        .replace(/\{\{power_hour_time\}\}/g, powerHourDisplay)
        .replace(/\{\{join_link\}\}/g, joinLink);

      const messageId = `power_hour_${reminderType}_${member.id}_${todayStr}`;

      const htmlContent = body.replace(/\n/g, "<br>");
      const emailPayload = {
        run_id: crypto.randomUUID(),
        to: member.email,
        from: `C24Club <support@c24club.com>`,
        subject,
        html: htmlContent,
        text: body.replace(/<[^>]*>/g, ""),
        purpose: "transactional",
        label: `power_hour_${reminderType}`,
        sender_domain: "c24club.com",
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

      await supabase.from("email_send_log").insert({
        template_name: `power_hour_${reminderType}`,
        recipient_email: member.email,
        status: "pending",
        message_id: messageId,
        metadata: { user_id: member.id },
      });

      enqueued++;
    }

    console.log(`Power hour ${reminderType} emails enqueued: ${enqueued}`);

    return new Response(JSON.stringify({ sent: enqueued, reminderType }), {
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
