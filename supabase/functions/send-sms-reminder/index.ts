import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizePhoneNumber(input: string) {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+") && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }

  throw new Error(`Invalid phone number format: ${input}`);
}

async function sendSmsAndLog(
  supabase: any,
  { apiKey, from, to, text, action }: {
    apiKey: string; from: string; to: string; text: string; action: string;
  }
) {
  const normalizedTo = normalizePhoneNumber(to);
  let telnyxData: any = null;
  let fetchError: string | null = null;

  try {
    const res = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: normalizedTo,
        text,
        type: "SMS",
      }),
    });
    telnyxData = await res.json();
  } catch (e) {
    fetchError = (e as Error).message;
  }

  const msgData = telnyxData?.data;
  const logEntry = {
    action,
    phone_number: normalizedTo,
    message_text: text,
    vonage_status: msgData?.to?.[0]?.status ?? (fetchError ? "fetch_error" : telnyxData?.errors ? "api_error" : "unknown"),
    vonage_error_text: telnyxData?.errors?.[0]?.detail ?? fetchError ?? null,
    vonage_message_id: msgData?.id ?? null,
    vonage_network: msgData?.to?.[0]?.carrier ?? null,
    vonage_remaining_balance: null,
    vonage_message_price: msgData?.cost?.amount ?? null,
    raw_response: {
      request: { to: normalizedTo, from, action },
      response: telnyxData ?? { error: fetchError },
    },
  };

  try {
    await supabase.from("sms_delivery_log").insert(logEntry);
  } catch (logErr) {
    console.error("Failed to write SMS log:", logErr);
  }

  console.log(`SMS [${action}] to ${normalizedTo}: status=${logEntry.vonage_status}, error=${logEntry.vonage_error_text}`);

  return {
    status: logEntry.vonage_status,
    error: logEntry.vonage_error_text,
    phone: normalizedTo,
    messageId: logEntry.vonage_message_id,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const TELNYX_API_KEY = Deno.env.get("TELNYX_API_KEY");
  const TELNYX_FROM_NUMBER = Deno.env.get("TELNYX_FROM_NUMBER");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!TELNYX_API_KEY || !TELNYX_FROM_NUMBER) {
    return new Response(
      JSON.stringify({ error: "Telnyx credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const normalizedFrom = normalizePhoneNumber(TELNYX_FROM_NUMBER);
  const smsArgs = { apiKey: TELNYX_API_KEY, from: normalizedFrom };

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "auto_remind") {
      const now = new Date();
      const dayOfWeek = now.getUTCDay();
      const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

      const { data: windows, error: winErr } = await supabase
        .from("call_windows")
        .select("*")
        .eq("is_active", true)
        .eq("day_of_week", dayOfWeek);

      if (winErr) throw winErr;

      const upcomingWindows = (windows || []).filter((w: any) => {
        const [h, m] = w.start_time.split(":").map(Number);
        const diff = h * 60 + m - currentMinutes;
        return diff >= 0 && diff <= 5;
      });

      if (upcomingWindows.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "No upcoming windows in the next 5 min", sent: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Collect opted-in user IDs across all windows
      const allResults: any[] = [];
      const emailResults: any[] = [];

      for (const win of upcomingWindows) {
        const { data: signups } = await supabase
          .from("slot_signups")
          .select("user_id")
          .eq("window_id", win.id);

        const signedUpUserIds = (signups || []).map((s: any) => s.user_id);

        const { data: optins } = await supabase
          .from("sms_reminder_optins")
          .select("phone_number, user_id")
          .eq("is_active", true);

        const filteredOptins = signedUpUserIds.length > 0
          ? (optins || []).filter((o: any) => signedUpUserIds.includes(o.user_id))
          : optins || [];

        const message = `🎥 C24 Club: "${win.label || "Video Chat"}" session starts at ${win.start_time}! Hop on now for instant matches → https://c24club.com/videocall Reply STOP to unsubscribe.`;

        // --- Email reminders for opted-in users ---
        const userIds = filteredOptins.map((o: any) => o.user_id).filter(Boolean);
        if (userIds.length > 0) {
          const { data: members } = await supabase
            .from("members")
            .select("id, name, email, gender")
            .in("id", userIds)
            .not("email", "is", null);

          const { data: suppressed } = await supabase
            .from("suppressed_emails")
            .select("email");
          const suppressedSet = new Set((suppressed || []).map((s: any) => s.email.toLowerCase()));

          const todayStr = new Date().toISOString().split("T")[0];
          const dedupeKey = `window_remind_${win.id}_${todayStr}`;

          // Check dedup
          const { data: alreadySent } = await supabase
            .from("email_send_log")
            .select("id")
            .eq("message_id", dedupeKey)
            .limit(1);

          if (!alreadySent || alreadySent.length === 0) {
            // Mark dedup
            await supabase.from("email_send_log").insert({
              template_name: "window_reminder",
              recipient_email: "system@dedup",
              status: "sent",
              message_id: dedupeKey,
              metadata: { type: "dedup_marker", window_id: win.id },
            });

            const joinLink = "https://c24club.lovable.app/videocall?from=window_reminder";

            // Gender counts for social proof
            const maleCount = (members || []).filter((m: any) => m.gender === "male").length;
            const femaleCount = (members || []).filter((m: any) => m.gender === "female").length;
            const randomBoost = () => Math.floor(Math.random() * 6) + 3;
            const femalesForMales = Math.min(femaleCount + randomBoost(), 25);
            const malesForFemales = Math.min(maleCount + randomBoost(), 30);

            // Format display time
            const [startH, startM] = win.start_time.split(":").map(Number);
            const displayHour = startH > 12 ? startH - 12 : startH === 0 ? 12 : startH;
            const amPm = startH >= 12 ? "PM" : "AM";
            const displayTime = `${displayHour}:${String(startM).padStart(2, "0")} ${amPm} UTC`;

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
          <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">Session starts at ${displayTime}</p>
        </td></tr>
        <tr><td style="background-color:#f9fafb;padding:16px 28px;text-align:center;border-top:1px solid #f0f0f5;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">— C24 Club</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

            for (const member of (members || [])) {
              if (!member.email || suppressedSet.has(member.email.toLowerCase())) continue;

              const userName = member.name || "there";
              const isFemale = member.gender === "female";

              let subject: string;
              let headline: string;
              let bodyText: string;
              let ctaText: string;

              if (isFemale) {
                subject = `⚡ ${malesForFemales} guys are logging in soon — chat & earn!`;
                headline = `⚡ Your session starts soon!`;
                bodyText = `<strong>${malesForFemales} male users</strong> have opted to join your upcoming video call session!<br><br>Chat &amp; meet new guys and get rewards for every minute you chat — or get gifted by them! 🎁<br><br>The more you chat, the more you earn. This is the busiest session of the day!`;
                ctaText = "Join & Start Earning 💰";
              } else {
                subject = `⚡ ${femalesForMales} girls are joining your scheduled video call soon!`;
                headline = `🔥 Your session starts soon!`;
                bodyText = `<strong>${femalesForMales} girls</strong> are joining your upcoming video call session! 👀<br><br>Will they show up? Only time will tell — log in and wait!<br><br>This is the busiest time on C24 Club — the best chance to meet new people and have great conversations.`;
                ctaText = "Join Now 🚀";
              }

              const htmlContent = buildHtml(userName, headline, bodyText, ctaText);
              const plainText = `Hey ${userName}! Session starts soon at ${displayTime}. Join now: ${joinLink}`;
              const messageId = `window_remind_${win.id}_${member.id}_${todayStr}`;

              const { error: enqErr } = await supabase.rpc("enqueue_email", {
                queue_name: "transactional_emails",
                payload: {
                  idempotency_key: messageId,
                  to: member.email,
                  from: "C24Club <support@c24club.com>",
                  subject,
                  html: htmlContent,
                  text: plainText,
                  purpose: "transactional",
                  label: "window_reminder",
                  sender_domain: "notify.c24club.com",
                  message_id: messageId,
                  queued_at: new Date().toISOString(),
                },
              });

              if (!enqErr) {
                await supabase.from("email_send_log").insert({
                  template_name: "window_reminder",
                  recipient_email: member.email,
                  status: "pending",
                  message_id: messageId,
                  metadata: { user_id: member.id, gender: member.gender || "unknown", window_id: win.id },
                });
                emailResults.push({ email: member.email, window: win.label });
              } else {
                console.error(`Email enqueue failed for ${member.email}:`, enqErr.message);
              }
            }
          }
        }

        // --- SMS reminders (kept for when SMS is ready) ---
        for (const optin of filteredOptins) {
          const result = await sendSmsAndLog(supabase, {
            ...smsArgs,
            to: optin.phone_number,
            text: message,
            action: "auto_remind",
          });
          allResults.push({ phone: result.phone, window: win.label, ...result });
        }
      }

      return new Response(
        JSON.stringify({ success: true, windows: upcomingWindows.length, smsSent: allResults.length, emailsSent: emailResults.length, smsResults: allResults, emailResults }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "send_reminders") {
      const { window_label, start_time, window_id } = body;

      let targetOptins: any[] = [];

      if (window_id) {
        const { data: signups } = await supabase
          .from("slot_signups")
          .select("user_id")
          .eq("window_id", window_id);

        const signedUpUserIds = (signups || []).map((s: any) => s.user_id);

        const { data: optins, error: optErr } = await supabase
          .from("sms_reminder_optins")
          .select("phone_number, user_id")
          .eq("is_active", true);

        if (optErr) throw optErr;

        targetOptins = signedUpUserIds.length > 0
          ? (optins || []).filter((o: any) => signedUpUserIds.includes(o.user_id))
          : optins || [];
      } else {
        const { data: optins, error: optErr } = await supabase
          .from("sms_reminder_optins")
          .select("phone_number")
          .eq("is_active", true);

        if (optErr) throw optErr;
        targetOptins = optins || [];
      }

      const message = `🎥 C24 Club: "${window_label || "Video Chat"}" session starts at ${start_time}! Hop on now for instant matches. Reply STOP to unsubscribe.`;

      const results = [];
      for (const optin of targetOptins) {
        const result = await sendSmsAndLog(supabase, {
          ...smsArgs,
          to: optin.phone_number,
          text: message,
          action: "send_reminders",
        });
        results.push({ phone: result.phone, ...result });
      }

      return new Response(
        JSON.stringify({ success: true, sent: results.length, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "send_campaign") {
      const { campaign_id } = body;

      const { data: campaign, error: campErr } = await supabase
        .from("sms_campaigns")
        .select("*")
        .eq("id", campaign_id)
        .single();
      if (campErr || !campaign) throw new Error("Campaign not found");

      const { data: optins, error: optErr } = await supabase
        .from("sms_reminder_optins")
        .select("phone_number, user_id")
        .eq("is_active", true);
      if (optErr) throw optErr;
      if (!optins || optins.length === 0) throw new Error("No opted-in users");

      const userIds = optins.map((o: any) => o.user_id);
      const { data: members } = await supabase
        .from("members")
        .select("id, gender")
        .in("id", userIds);
      const genderMap: Record<string, string> = {};
      if (members) {
        for (const m of members) {
          genderMap[m.id] = m.gender || "unknown";
        }
      }

      const trackingBaseUrl = `${SUPABASE_URL}/functions/v1/track-sms-click`;

      const results = [];
      for (const optin of optins) {
        const trackingCode = crypto.randomUUID();

        await supabase.from("sms_campaign_sends").insert({
          campaign_id: campaign.id,
          tracking_code: trackingCode,
          phone_number: optin.phone_number,
          recipient_gender: genderMap[optin.user_id] || "unknown",
        });

        const trackingUrl = `${trackingBaseUrl}?code=${trackingCode}`;
        const messageText = campaign.message_template.includes("{{link}}")
          ? campaign.message_template.replace("{{link}}", trackingUrl)
          : `${campaign.message_template} ${trackingUrl}`;

        const result = await sendSmsAndLog(supabase, {
          ...smsArgs,
          to: optin.phone_number,
          text: messageText,
          action: `campaign:${campaign.name}`,
        });
        results.push(result);
      }

      return new Response(
        JSON.stringify({ success: true, sent: results.length, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "optin") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { phone_number } = body;
      const cleanNumber = normalizePhoneNumber(phone_number);

      const { error: upsertErr } = await supabase
        .from("sms_reminder_optins")
        .upsert(
          { user_id: user.id, phone_number: cleanNumber, is_active: true },
          { onConflict: "user_id" }
        );

      if (upsertErr) throw upsertErr;

      const confirmMsg = `C24 Club: Thanks for subscribing to session reminders! Reply HELP for help. Message frequency may vary. Msg&data rates may apply. Consent is not a condition of purchase. Reply STOP to opt out.`;
      await sendSmsAndLog(supabase, {
        ...smsArgs,
        to: cleanNumber,
        text: confirmMsg,
        action: "optin_confirm",
      });

      return new Response(
        JSON.stringify({ success: true, normalized_phone_number: cleanNumber }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "optout") {
      const authHeader = req.headers.get("authorization");
      const token = authHeader?.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token || "");
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("sms_reminder_optins")
        .update({ is_active: false })
        .eq("user_id", user.id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-sms-reminder error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
