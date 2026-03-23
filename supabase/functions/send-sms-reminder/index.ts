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
  { apiKey, apiSecret, from, to, text, action }: {
    apiKey: string; apiSecret: string; from: string; to: string; text: string; action: string;
  }
) {
  const normalizedTo = normalizePhoneNumber(to);
  let vonageData: any = null;
  let fetchError: string | null = null;

  try {
    const res = await fetch("https://rest.nexmo.com/sms/json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        api_secret: apiSecret,
        from,
        to: normalizedTo,
        text,
      }),
    });
    vonageData = await res.json();
  } catch (e) {
    fetchError = (e as Error).message;
  }

  const msg = vonageData?.messages?.[0];
  const logEntry = {
    action,
    phone_number: normalizedTo,
    message_text: text,
    vonage_status: msg?.status ?? (fetchError ? "fetch_error" : "unknown"),
    vonage_error_text: msg?.["error-text"] ?? fetchError ?? null,
    vonage_message_id: msg?.["message-id"] ?? null,
    vonage_network: msg?.network ?? null,
    vonage_remaining_balance: msg?.["remaining-balance"] ?? null,
    vonage_message_price: msg?.["message-price"] ?? null,
    raw_response: {
      request: { to: normalizedTo, from, action },
      response: vonageData ?? { error: fetchError },
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

  const VONAGE_API_KEY = Deno.env.get("VONAGE_API_KEY");
  const VONAGE_API_SECRET = Deno.env.get("VONAGE_API_SECRET");
  const VONAGE_FROM_NUMBER = Deno.env.get("VONAGE_FROM_NUMBER");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!VONAGE_API_KEY || !VONAGE_API_SECRET || !VONAGE_FROM_NUMBER) {
    return new Response(
      JSON.stringify({ error: "Vonage credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const normalizedFrom = normalizePhoneNumber(VONAGE_FROM_NUMBER);
  const smsArgs = { apiKey: VONAGE_API_KEY, apiSecret: VONAGE_API_SECRET, from: normalizedFrom };

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

      const allResults = [];
      for (const win of upcomingWindows) {
        // Get users who signed up for THIS specific slot
        const { data: signups } = await supabase
          .from("slot_signups")
          .select("user_id")
          .eq("window_id", win.id);

        const signedUpUserIds = (signups || []).map((s: any) => s.user_id);

        // Get opted-in users — filter to only those who signed up for this slot
        let optinsQuery = supabase
          .from("sms_reminder_optins")
          .select("phone_number, user_id")
          .eq("is_active", true);

        const { data: optins } = await optinsQuery;

        // Filter: only send to users who signed up for this slot, OR if no signups exist send to all (backward compat)
        const filteredOptins = signedUpUserIds.length > 0
          ? (optins || []).filter((o: any) => signedUpUserIds.includes(o.user_id))
          : optins || [];

        const message = `🎥 C24 Club: "${win.label || "Video Chat"}" session starts at ${win.start_time}! Hop on now for instant matches → https://c24club.com/videocall Reply STOP to unsubscribe.`;

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
        JSON.stringify({ success: true, windows: upcomingWindows.length, sent: allResults.length, results: allResults }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "send_reminders") {
      const { window_label, start_time, window_id } = body;

      // If window_id provided, only send to users who signed up for this slot
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
        // Legacy: send to all opted-in users
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

      const confirmMsg = `✅ You're subscribed to C24 Club session alerts! We'll text you before your selected sessions. Reply STOP to unsubscribe.`;
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
