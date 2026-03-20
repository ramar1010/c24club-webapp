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

    // Authenticate user
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

    const { action, ...body } = await req.json();

    // --- LOG CALL TIME ---
    // Called periodically during a bestie call to track duration
    if (action === "log_time") {
      const { pair_id, seconds_to_add } = body;

      // Verify user is part of this pair
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

      // Upsert daily log
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
    // Admin or auto: mark a day as verified & bump days_completed
    if (action === "verify_day") {
      const { pair_id, day_number } = body;

      await supabase
        .from("bestie_daily_logs")
        .update({ verified: true })
        .eq("pair_id", pair_id)
        .eq("day_number", day_number);

      // Check if all 3 days are done
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
