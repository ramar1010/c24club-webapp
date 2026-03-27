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

    const [phHour, phMin] = settings.power_hour_start.split(":").map(Number);
    const powerHourDate = new Date(now);
    powerHourDate.setUTCHours(phHour, phMin, 0, 0);

    const minutesUntil = (powerHourDate.getTime() - now.getTime()) / 60_000;

    let reminderType: "1hour" | "10min" | null = null;
    if (minutesUntil > 55 && minutesUntil <= 65) {
      reminderType = "1hour";
    } else if (minutesUntil > 5 && minutesUntil <= 15) {
      reminderType = "10min";
    }

    // Allow manual override via request body
    let forceTestEmail: string | null = null;
    let reqBody: any = null;
    try {
      reqBody = await req.json();
    } catch {
      // No body or not JSON
    }
    if (reqBody?.reminder_type === "1hour" || reqBody?.reminder_type === "10min") {
      reminderType = reqBody.reminder_type;
    }
    if (reqBody?.test_email) {
      forceTestEmail = reqBody.test_email;
    }

    if (!reminderType) {
      console.log(`Not in a reminder window. Minutes until power hour: ${minutesUntil.toFixed(1)}`);
      return new Response(JSON.stringify({ skipped: true, reason: "not_in_window", minutesUntil: Math.round(minutesUntil) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Check if we already sent this reminder today (skip for test emails)
    const dedupeKey = `power_hour_${reminderType}_${todayStr}`;
    if (!forceTestEmail) {
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
    }

    // 4. Get ALL members with emails AND gender
    // If test_email is set, only fetch that one member
    let membersQuery = supabase
      .from("members")
      .select("id, name, email, gender")
      .not("email", "is", null);

    if (forceTestEmail) {
      membersQuery = membersQuery.ilike("email", forceTestEmail);
    }

    const { data: members, error: memErr } = await membersQuery.limit(2000);

    if (memErr) throw memErr;
    if (!members || members.length === 0) {
      console.log("No matching members found.", forceTestEmail ? `Test email: ${forceTestEmail}` : "");
      console.log("No members with emails found.");
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Count members by gender for social proof numbers
    // When testing a single email, we need real counts from all members
    let maleCount = 0;
    let femaleCount = 0;
    if (forceTestEmail) {
      const { count: mc } = await supabase.from("members").select("*", { count: "exact", head: true }).eq("gender", "male");
      const { count: fc } = await supabase.from("members").select("*", { count: "exact", head: true }).eq("gender", "female");
      maleCount = mc || 0;
      femaleCount = fc || 0;
    } else {
      maleCount = members.filter(m => m.gender === "male").length;
      femaleCount = members.filter(m => m.gender === "female").length;
    }
    const randomBoost = () => Math.floor(Math.random() * 6) + 3;
    const femalesForMales = Math.min(femaleCount + randomBoost(), 25);
    const malesForFemales = Math.min(maleCount + randomBoost(), 30);

    // 6. Check suppressed emails
    const { data: suppressed } = await supabase
      .from("suppressed_emails")
      .select("email");

    const suppressedSet = new Set((suppressed || []).map((s: { email: string }) => s.email.toLowerCase()));

    // Format the power hour time for display
    const displayHour = phHour > 12 ? phHour - 12 : phHour === 0 ? 12 : phHour;
    const amPm = phHour >= 12 ? "PM" : "AM";
    const powerHourDisplay = `${displayHour}:${String(phMin).padStart(2, "0")} ${amPm} UTC`;
    const timeLabel = reminderType === "1hour" ? "1 hour" : "5 mins";

    let enqueued = 0;

    // Log the dedup marker first (skip for test emails)
    if (!forceTestEmail) {
      await supabase.from("email_send_log").insert({
        template_name: `power_hour_${reminderType}`,
        recipient_email: "system@dedup",
        status: "sent",
        message_id: dedupeKey,
        metadata: { type: "dedup_marker" },
      });
    }

    const joinLink = "https://c24club.com/videocall?from=power_hour";

    const buildHtml = (userName: string, headline: string, bodyText: string, ctaText: string) => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f7f9fb;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f9fb;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 32px;text-align:center;">
          <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">${headline}</h1>
        </td></tr>
        <tr><td style="padding:32px 28px;">
          <p style="margin:0 0 16px;font-size:15px;color:#1a1a2e;line-height:1.6;">Hey ${userName}! 👋</p>
          <p style="margin:0 0 24px;font-size:14px;color:#4a4a68;line-height:1.7;">${bodyText}</p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px;">
            <a href="${joinLink}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:8px;">${ctaText}</a>
          </td></tr></table>
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">Power Hour starts at ${powerHourDisplay}</p>
        </td></tr>
        <tr><td style="background-color:#f9fafb;padding:16px 28px;text-align:center;border-top:1px solid #f0f0f5;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">— C24 Club</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    for (const member of members) {
      if (!member.email || suppressedSet.has(member.email.toLowerCase())) {
        continue;
      }

      const userName = member.name || "there";
      const isFemale = member.gender === "female";

      let subject: string;
      let headline: string;
      let bodyText: string;
      let ctaText: string;

      if (isFemale) {
        subject = reminderType === "1hour"
          ? `⚡ ${malesForFemales} guys are logging in soon — chat & earn in ${timeLabel}!`
          : `🔥 ${malesForFemales} guys are logging in NOW — chat & earn in ${timeLabel}!`;
        headline = `⚡ Your session starts in ${timeLabel}!`;
        bodyText = `<strong>${malesForFemales} male users</strong> have opted to join your upcoming video call session in ${timeLabel}!<br><br>Chat &amp; meet new guys and get rewards for every minute you chat — or get gifted by them! 🎁<br><br>The more you chat, the more you earn. This is the busiest session of the day!`;
        ctaText = "Join & Start Earning 💰";
      } else {
        subject = reminderType === "1hour"
          ? `⚡ ${femalesForMales} girls are joining your scheduled video call in ${timeLabel}!`
          : `🔥 ${femalesForMales} girls are joining your scheduled video call in ${timeLabel}!`;
        headline = `🔥 Your session starts in ${timeLabel}!`;
        bodyText = `<strong>${femalesForMales} girls</strong> are joining your upcoming video call session in ${timeLabel}! 👀<br><br>Will they show up? Only time will tell — log in and wait!<br><br>This is the busiest time on C24 Club — the best chance to meet new people and have great conversations.`;
        ctaText = "Join Now 🚀";
      }

      const messageId = forceTestEmail
        ? `power_hour_test_${member.id}_${Date.now()}`
        : `power_hour_${reminderType}_${member.id}_${todayStr}`;

      const htmlContent = buildHtml(userName, headline, bodyText, ctaText);
      const plainText = `Hey ${userName}! Power Hour starts in ${timeLabel}. Join now: ${joinLink}`;

      const emailPayload = {
        run_id: crypto.randomUUID(),
        to: member.email,
        from: `C24Club <support@c24club.com>`,
        subject,
        html: htmlContent,
        text: plainText,
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
        metadata: { user_id: member.id, gender: member.gender || "unknown" },
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