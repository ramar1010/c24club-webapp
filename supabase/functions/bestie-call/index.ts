import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { action, ...body } = await req.json();

    // --- ACCEPT INVITE (no auth required — called right after signup) ---
    if (action === "accept_invite") {
      const { invite_code, user_id } = body;
      if (!invite_code || !user_id) {
        return new Response(JSON.stringify({ error: "Missing invite_code or user_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: pair, error: findErr } = await supabase
        .from("bestie_pairs")
        .select("id, inviter_id, invitee_id")
        .eq("invite_code", invite_code)
        .is("invitee_id", null)
        .eq("status", "pending")
        .maybeSingle();

      if (findErr || !pair) {
        return new Response(JSON.stringify({ error: "Invalid or already used invite" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent self-pairing
      if (pair.inviter_id === user_id) {
        return new Response(JSON.stringify({ error: "Cannot accept your own invite" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateErr } = await supabase
        .from("bestie_pairs")
        .update({ invitee_id: user_id, status: "active" })
        .eq("id", pair.id);

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true, pair_id: pair.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- All other actions require authentication ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- LOG CALL TIME ---
    if (action === "log_time") {
      const { pair_id, seconds_to_add } = body;

      const { data: pair } = await supabase
        .from("bestie_pairs")
        .select("*")
        .eq("id", pair_id)
        .eq("status", "active")
        .single();

      if (!pair || (pair.inviter_id !== user.id && pair.invitee_id !== user.id)) {
        return new Response(JSON.stringify({ error: "Invalid pair" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const dayNumber = (pair.days_completed || 0) + 1;
      if (dayNumber > 3) {
        return new Response(JSON.stringify({ error: "Challenge already completed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("bestie_daily_logs")
        .select("*")
        .eq("pair_id", pair_id)
        .eq("day_number", dayNumber)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("bestie_daily_logs")
          .update({
            total_seconds: existing.total_seconds + (seconds_to_add || 30),
            call_date: today,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("bestie_daily_logs").insert({
          pair_id,
          day_number: dayNumber,
          total_seconds: seconds_to_add || 30,
          call_date: today,
        });
      }

      return new Response(JSON.stringify({ ok: true, day_number: dayNumber }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- SAVE SCREENSHOT PATH ---
    if (action === "save_screenshot") {
      const { pair_id, day_number, screenshot_path, role } = body;

      const column = role === "inviter" ? "inviter_screenshot_url" : "invitee_screenshot_url";

      await supabase
        .from("bestie_daily_logs")
        .update({ [column]: screenshot_path })
        .eq("pair_id", pair_id)
        .eq("day_number", day_number);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- COMPLETE DAY ---
    if (action === "verify_day") {
      const { pair_id, day_number } = body;

      await supabase
        .from("bestie_daily_logs")
        .update({ verified: true })
        .eq("pair_id", pair_id)
        .eq("day_number", day_number);

      const newDaysCompleted = day_number;
      const updateData: any = { days_completed: newDaysCompleted };
      if (newDaysCompleted >= 3) {
        updateData.status = "completed";
        updateData.completed_at = new Date().toISOString();
      }

      await supabase
        .from("bestie_pairs")
        .update(updateData)
        .eq("id", pair_id);

      return new Response(JSON.stringify({ ok: true, days_completed: newDaysCompleted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
