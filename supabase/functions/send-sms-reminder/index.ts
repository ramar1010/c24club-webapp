import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

  try {
    const body = await req.json();
    const { action } = body;

    // Action: auto_remind — cron-triggered: find windows starting in the next 5 min and blast SMS
    if (action === "auto_remind") {
      const now = new Date();
      const dayOfWeek = now.getUTCDay(); // 0=Sun
      const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

      // Fetch today's active windows
      const { data: windows, error: winErr } = await supabase
        .from("call_windows")
        .select("*")
        .eq("is_active", true)
        .eq("day_of_week", dayOfWeek);

      if (winErr) throw winErr;

      // Find windows starting within the next 5 minutes
      const upcomingWindows = (windows || []).filter((w) => {
        const [h, m] = w.start_time.split(":").map(Number);
        const windowMinutes = h * 60 + m;
        const diff = windowMinutes - currentMinutes;
        return diff >= 0 && diff <= 5;
      });

      if (upcomingWindows.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "No upcoming windows in the next 5 min", sent: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: optins, error: optErr } = await supabase
        .from("sms_reminder_optins")
        .select("phone_number")
        .eq("is_active", true);

      if (optErr) throw optErr;

      const allResults = [];
      for (const win of upcomingWindows) {
        const message = `🎥 C24 Club: "${win.label || "Video Chat"}" session starts at ${win.start_time}! Hop on now for instant matches → https://c24club.lovable.app/videocall Reply STOP to unsubscribe.`;

        for (const optin of optins || []) {
          try {
            const res = await fetch("https://rest.nexmo.com/sms/json", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                api_key: VONAGE_API_KEY,
                api_secret: VONAGE_API_SECRET,
                from: VONAGE_FROM_NUMBER,
                to: optin.phone_number.replace(/\D/g, ""),
                text: message,
              }),
            });
            const data = await res.json();
            allResults.push({ phone: optin.phone_number, window: win.label, status: data.messages?.[0]?.status || "unknown" });
          } catch (e) {
            allResults.push({ phone: optin.phone_number, window: win.label, status: "error", error: (e as Error).message });
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, windows: upcomingWindows.length, sent: allResults.length, results: allResults }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: send_reminders — manual blast SMS to all opted-in users about an upcoming window
    if (action === "send_reminders") {
      const { window_label, start_time } = body;

      const { data: optins, error: optErr } = await supabase
        .from("sms_reminder_optins")
        .select("phone_number")
        .eq("is_active", true);

      if (optErr) throw optErr;

      const message = `🎥 C24 Club: "${window_label || "Video Chat"}" session starts at ${start_time}! Hop on now for instant matches. Reply STOP to unsubscribe.`;

      const results = [];
      for (const optin of optins || []) {
        try {
          const res = await fetch("https://rest.nexmo.com/sms/json", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: VONAGE_API_KEY,
              api_secret: VONAGE_API_SECRET,
              from: VONAGE_FROM_NUMBER,
              to: optin.phone_number.replace(/\D/g, ""),
              text: message,
            }),
          });
          const data = await res.json();
          results.push({ phone: optin.phone_number, status: data.messages?.[0]?.status || "unknown" });
        } catch (e) {
          results.push({ phone: optin.phone_number, status: "error", error: (e as Error).message });
        }
      }

      return new Response(
        JSON.stringify({ success: true, sent: results.length, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: optin — user opts in for SMS reminders
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
      if (!phone_number || phone_number.replace(/\D/g, "").length < 10) {
        return new Response(JSON.stringify({ error: "Invalid phone number" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const cleanNumber = phone_number.replace(/\D/g, "");

      const { error: upsertErr } = await supabase
        .from("sms_reminder_optins")
        .upsert(
          { user_id: user.id, phone_number: cleanNumber, is_active: true },
          { onConflict: "user_id" }
        );

      if (upsertErr) throw upsertErr;

      // Send confirmation SMS immediately
      try {
        const confirmMsg = `✅ You're subscribed to C24 Club session alerts! We'll text you before each live video chat window. Reply STOP to unsubscribe.`;
        const smsRes = await fetch("https://rest.nexmo.com/sms/json", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: VONAGE_API_KEY,
            api_secret: VONAGE_API_SECRET,
            from: VONAGE_FROM_NUMBER,
            to: cleanNumber,
            text: confirmMsg,
          }),
        });
        const smsData = await smsRes.json();
        console.log("Confirmation SMS result:", JSON.stringify(smsData));
      } catch (smsErr) {
        console.error("Failed to send confirmation SMS:", smsErr);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: optout
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
