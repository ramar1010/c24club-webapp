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
    // Power hour / scheduled call reminder emails are disabled
    return new Response(JSON.stringify({ skipped: true, reason: "power-hour emails disabled" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Allow manual override via request body
    let forceTestEmail: string | null = null;
    let forceReminderType: string | null = null;
    let reqBody: any = null;
    try {
      reqBody = await req.json();
    } catch {
      // No body or not JSON
    }
    if (reqBody?.test_email) {
      forceTestEmail = reqBody.test_email;
    }
    if (reqBody?.reminder_type === "1hour" || reqBody?.reminder_type === "10min") {
      forceReminderType = reqBody.reminder_type;
    }

    // 1. Get today's call windows
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const jsDow = now.getUTCDay(); // 0=Sun

    const { data: windows, error: winErr } = await supabase
      .from("call_windows")
      .select("id, start_time, end_time, label")
      .eq("day_of_week", jsDow)
      .eq("is_active", true);

    if (winErr) throw winErr;
    if (!windows || windows.length === 0) {
      console.log(`No active call windows for day_of_week=${jsDow}`);
      return new Response(JSON.stringify({ skipped: true, reason: "no_windows" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. For each window, check if we're in a reminder period
    interface ReminderTarget {
      windowId: string;
      reminderType: "1hour" | "10min";
      startTime: string;
      displayTime: string;
    }

    const reminders: ReminderTarget[] = [];

    for (const win of windows) {
      const [h, m] = win.start_time.split(":").map(Number);
      const windowStart = new Date(now);
      windowStart.setUTCHours(h, m, 0, 0);

      // If window start already passed today but end wraps to next day, it's still today's window
      // but we only care about upcoming starts
      const minutesUntil = (windowStart.getTime() - now.getTime()) / 60_000;

      let reminderType: "1hour" | "10min" | null = null;

      if (forceTestEmail && forceReminderType) {
        // For test emails, use the forced reminder type for the first window
        reminderType = forceReminderType as "1hour" | "10min";
      } else if (minutesUntil > 55 && minutesUntil <= 65) {
        reminderType = "1hour";
      } else if (minutesUntil > 5 && minutesUntil <= 15) {
        reminderType = "10min";
      }

      if (reminderType) {
        const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
        const amPm = h >= 12 ? "PM" : "AM";
        const displayTime = `${displayHour}:${String(m).padStart(2, "0")} ${amPm} UTC`;

        reminders.push({
          windowId: win.id,
          reminderType,
          startTime: win.start_time,
          displayTime,
        });
      }

      // For test emails, only use first window
      if (forceTestEmail && reminderType) break;
    }

    if (reminders.length === 0 && !forceTestEmail) {
      const windowTimes = windows.map(w => w.start_time).join(", ");
      console.log(`Not in any reminder window. Windows today: ${windowTimes}`);
      return new Response(JSON.stringify({ skipped: true, reason: "not_in_window", windows: windowTimes }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For test emails with no matching window, use first window with forced type
    if (forceTestEmail && reminders.length === 0) {
      const win = windows[0];
      const [h, m] = win.start_time.split(":").map(Number);
      const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const amPm = h >= 12 ? "PM" : "AM";
      reminders.push({
        windowId: win.id,
        reminderType: (forceReminderType as "1hour" | "10min") || "10min",
        startTime: win.start_time,
        displayTime: `${displayHour}:${String(m).padStart(2, "0")} ${amPm} UTC`,
      });
    }

    // 3. For each reminder, check dedup and send
    let totalEnqueued = 0;
    const results: any[] = [];

    for (const reminder of reminders) {
      const dedupeKey = `power_hour_${reminder.reminderType}_${reminder.windowId}_${todayStr}`;

      // Check if already sent (skip for test emails)
      if (!forceTestEmail) {
        const { data: alreadySent } = await supabase
          .from("email_send_log")
          .select("id")
          .eq("message_id", dedupeKey)
          .limit(1);

        if (alreadySent && alreadySent.length > 0) {
          console.log(`Already sent ${reminder.reminderType} for window ${reminder.startTime} today.`);
          results.push({ window: reminder.startTime, reminderType: reminder.reminderType, skipped: true });
          continue;
        }
      }

      // 4. Get members
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
        console.log("No members with emails found.");
        results.push({ window: reminder.startTime, reminderType: reminder.reminderType, sent: 0 });
        continue;
      }

      // 5. Gender counts for social proof
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

      // 6. Suppressed emails
      const { data: suppressed } = await supabase
        .from("suppressed_emails")
        .select("email");
      const suppressedSet = new Set((suppressed || []).map((s: { email: string }) => s.email.toLowerCase()));

      const timeLabel = reminder.reminderType === "1hour" ? "1 hour" : "5 mins";
      const joinLink = "https://c24club.com/videocall?from=power_hour";

      // Log dedup marker (skip for test emails)
      if (!forceTestEmail) {
        await supabase.from("email_send_log").insert({
          template_name: `power_hour_${reminder.reminderType}`,
          recipient_email: "system@dedup",
          status: "sent",
          message_id: dedupeKey,
          metadata: { type: "dedup_marker", window_id: reminder.windowId },
        });
      }

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
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">Session starts at ${reminder.displayTime}</p>
        </td></tr>
        <tr><td style="background-color:#f9fafb;padding:16px 28px;text-align:center;border-top:1px solid #f0f0f5;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">— C24 Club</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      let enqueued = 0;

      for (const member of members) {
        if (!member.email || suppressedSet.has(member.email.toLowerCase())) continue;

        const userName = member.name || "there";
        const isFemale = member.gender === "female";

        let subject: string;
        let headline: string;
        let bodyText: string;
        let ctaText: string;

        if (isFemale) {
          subject = reminder.reminderType === "1hour"
            ? `⚡ ${malesForFemales} guys are logging in soon — chat & earn in ${timeLabel}!`
            : `🔥 ${malesForFemales} guys are logging in NOW — chat & earn in ${timeLabel}!`;
          headline = `⚡ Your session starts in ${timeLabel}!`;
          bodyText = `<strong>${malesForFemales} male users</strong> have opted to join your upcoming video call session in ${timeLabel}!<br><br>Chat &amp; meet new guys and get rewards for every minute you chat — or get gifted by them! 🎁<br><br>The more you chat, the more you earn. This is the busiest session of the day!`;
          ctaText = "Join & Start Earning 💰";
        } else {
          subject = reminder.reminderType === "1hour"
            ? `⚡ ${femalesForMales} girls are joining your scheduled video call in ${timeLabel}!`
            : `🔥 ${femalesForMales} girls are joining your scheduled video call in ${timeLabel}!`;
          headline = `🔥 Your session starts in ${timeLabel}!`;
          bodyText = `<strong>${femalesForMales} girls</strong> are joining your upcoming video call session in ${timeLabel}! 👀<br><br>Will they show up? Only time will tell — log in and wait!<br><br>This is the busiest time on C24 Club — the best chance to meet new people and have great conversations.`;
          ctaText = "Join Now 🚀";
        }

        const messageId = forceTestEmail
          ? `power_hour_test_${member.id}_${Date.now()}`
          : `power_hour_${reminder.reminderType}_${reminder.windowId}_${member.id}_${todayStr}`;

        const htmlContent = buildHtml(userName, headline, bodyText, ctaText);
        const plainText = `Hey ${userName}! Session starts in ${timeLabel}. Join now: ${joinLink}`;

        const emailPayload = {
          idempotency_key: messageId,
          to: member.email,
          from: `C24Club <support@c24club.com>`,
          subject,
          html: htmlContent,
          text: plainText,
          purpose: "transactional",
          unsubscribe_token: messageId,
          label: `power_hour_${reminder.reminderType}`,
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

        await supabase.from("email_send_log").insert({
          template_name: `power_hour_${reminder.reminderType}`,
          recipient_email: member.email,
          status: "pending",
          message_id: messageId,
          metadata: { user_id: member.id, gender: member.gender || "unknown", window_id: reminder.windowId },
        });

        enqueued++;
      }

      console.log(`Power hour ${reminder.reminderType} for window ${reminder.startTime}: ${enqueued} emails enqueued`);
      totalEnqueued += enqueued;
      results.push({ window: reminder.startTime, reminderType: reminder.reminderType, sent: enqueued });
    }

    return new Response(JSON.stringify({ totalSent: totalEnqueued, results }), {
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
