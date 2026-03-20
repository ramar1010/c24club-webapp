import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const { type, userId } = body;

    // Get anchor settings
    const { data: settings } = await supabase
      .from("anchor_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!settings) {
      return new Response(
        JSON.stringify({ success: false, message: "Anchor settings not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Stale session cleanup: auto-pause sessions not updated in 30+ minutes ---
    const staleThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: staleSessions } = await supabase
      .from("anchor_sessions")
      .select("id, user_id")
      .eq("status", "active")
      .lt("updated_at", staleThreshold);

    if (staleSessions && staleSessions.length > 0) {
      console.log(`[ANCHOR] Cleaning ${staleSessions.length} stale sessions`);
      for (const stale of staleSessions) {
        await supabase
          .from("anchor_sessions")
          .update({ status: "paused", updated_at: new Date().toISOString() })
          .eq("id", stale.id);
      }

      // Promote queued users for freed slots
      const { count: activeAfterClean } = await supabase
        .from("anchor_sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");

      const freeSlots = settings.max_anchor_cap - (activeAfterClean ?? 0);
      if (freeSlots > 0) {
        const { data: queued } = await supabase
          .from("anchor_queue")
          .select("*")
          .order("created_at", { ascending: true })
          .limit(freeSlots);

        if (queued) {
          for (const q of queued) {
            const { data: paused } = await supabase
              .from("anchor_sessions")
              .select("id")
              .eq("user_id", q.user_id)
              .eq("status", "paused")
              .maybeSingle();

            if (paused) {
              await supabase.from("anchor_sessions").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", paused.id);
            } else {
              await supabase.from("anchor_sessions").insert({ user_id: q.user_id, status: "active", current_mode: "active", elapsed_seconds: 0, cash_balance: 0 });
            }
            await supabase.from("anchor_queue").delete().eq("user_id", q.user_id);
          }
        }
      }
    }

    // --- Auto-promote queued users into free slots on EVERY request ---
    const { count: currentActiveCount } = await supabase
      .from("anchor_sessions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    const availableSlots = settings.max_anchor_cap - (currentActiveCount ?? 0);
    if (availableSlots > 0) {
      const { data: queuedUsers } = await supabase
        .from("anchor_queue")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(availableSlots);

      if (queuedUsers && queuedUsers.length > 0) {
        console.log(`[ANCHOR] Auto-promoting ${queuedUsers.length} queued users into ${availableSlots} free slots`);
        for (const q of queuedUsers) {
          const { data: pausedSession } = await supabase
            .from("anchor_sessions")
            .select("id")
            .eq("user_id", q.user_id)
            .eq("status", "paused")
            .maybeSingle();

          if (pausedSession) {
            await supabase.from("anchor_sessions").update({
              status: "active",
              updated_at: new Date().toISOString(),
            }).eq("id", pausedSession.id);
          } else {
            await supabase.from("anchor_sessions").insert({
              user_id: q.user_id,
              status: "active",
              current_mode: "idle",
              elapsed_seconds: 0,
              cash_balance: 0,
            });
          }
          await supabase.from("anchor_queue").delete().eq("user_id", q.user_id);
        }
      }
    }

    // GET_STATUS: Check if user is eligible, active, or queued
    if (type === "get_status") {
      const { data: member } = await supabase
        .from("members")
        .select("gender")
        .eq("id", userId)
        .maybeSingle();

      if (!member || member.gender?.toLowerCase() !== "female") {
        return new Response(
          JSON.stringify({ success: true, eligible: false, reason: "not_female" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: session } = await supabase
        .from("anchor_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (session) {
        return new Response(
          JSON.stringify({
            success: true,
            eligible: true,
            status: "active",
            session,
            settings: {
              active_rate_cash: Number(settings.active_rate_cash),
              active_rate_time: settings.active_rate_time,
              idle_rate_cash: Number(settings.idle_rate_cash),
              idle_rate_time: settings.idle_rate_time,
              max_anchor_cap: settings.max_anchor_cap,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: queueEntry } = await supabase
        .from("anchor_queue")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      const { count: activeCount } = await supabase
        .from("anchor_sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");

      const slotsAvailable = (activeCount ?? 0) < settings.max_anchor_cap;

      let queuePosition = 0;
      if (queueEntry) {
        const { count: ahead } = await supabase
          .from("anchor_queue")
          .select("id", { count: "exact", head: true })
          .lt("created_at", queueEntry.created_at);
        queuePosition = (ahead ?? 0) + 1;
      }

      return new Response(
        JSON.stringify({
          success: true,
          eligible: true,
          status: queueEntry ? "queued" : "idle",
          slotsAvailable,
          activeCount: activeCount ?? 0,
          maxCap: settings.max_anchor_cap,
          queuePosition,
          settings: {
            active_rate_cash: Number(settings.active_rate_cash),
            active_rate_time: settings.active_rate_time,
            idle_rate_cash: Number(settings.idle_rate_cash),
            idle_rate_time: settings.idle_rate_time,
            max_anchor_cap: settings.max_anchor_cap,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // JOIN: Try to join anchor earning (or enter queue)
    if (type === "join") {
      const { data: member } = await supabase
        .from("members")
        .select("gender")
        .eq("id", userId)
        .maybeSingle();

      if (!member || member.gender?.toLowerCase() !== "female") {
        return new Response(
          JSON.stringify({ success: false, message: "not_eligible" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { count: activeCount } = await supabase
        .from("anchor_sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");

      if ((activeCount ?? 0) < settings.max_anchor_cap) {
        await supabase.from("anchor_queue").delete().eq("user_id", userId);

        const { data: pausedSession } = await supabase
          .from("anchor_sessions")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "paused")
          .maybeSingle();

        if (pausedSession) {
          await supabase
            .from("anchor_sessions")
            .update({
              status: "active",
              last_verified_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", pausedSession.id);

          return new Response(
            JSON.stringify({
              success: true,
              status: "active",
              session: { ...pausedSession, status: "active" },
              settings: {
                active_rate_cash: Number(settings.active_rate_cash),
                active_rate_time: settings.active_rate_time,
                idle_rate_cash: Number(settings.idle_rate_cash),
                idle_rate_time: settings.idle_rate_time,
                max_anchor_cap: settings.max_anchor_cap,
              },
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await supabase.from("anchor_sessions").delete().eq("user_id", userId);

        const { data: session } = await supabase
          .from("anchor_sessions")
          .insert({
            user_id: userId,
            status: "active",
            current_mode: "idle",
            elapsed_seconds: 0,
            cash_balance: 0,
          })
          .select()
          .single();

        return new Response(
          JSON.stringify({
            success: true,
            status: "active",
            session,
            settings: {
              active_rate_cash: Number(settings.active_rate_cash),
              active_rate_time: settings.active_rate_time,
              idle_rate_cash: Number(settings.idle_rate_cash),
              idle_rate_time: settings.idle_rate_time,
              max_anchor_cap: settings.max_anchor_cap,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Slots full — add to queue
      const { data: existing } = await supabase
        .from("anchor_queue")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!existing) {
        await supabase.from("anchor_queue").insert({ user_id: userId });
      }

      const { count: ahead } = await supabase
        .from("anchor_queue")
        .select("id", { count: "exact", head: true })
        .lte("created_at", new Date().toISOString());

      return new Response(
        JSON.stringify({
          success: true,
          status: "queued",
          queuePosition: ahead ?? 1,
          maxCap: settings.max_anchor_cap,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // VERIFY: User completed the typing challenge
    if (type === "verify") {
      const { data: session } = await supabase
        .from("anchor_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (!session) {
        return new Response(
          JSON.stringify({ success: false, message: "no_active_session" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("anchor_sessions")
        .update({ last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", session.id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TICK: Report elapsed time progress (called every ~30s from client)
    if (type === "tick") {
      const { secondsToAdd, partnerGender, isOnCall } = body;

      // Determine if this is an "active" tick (on call with a male) or "idle" tick
      const onCallWithMale = isOnCall === true && partnerGender && partnerGender.toLowerCase() === "male";

      // If on call with a female, don't earn at all
      if (isOnCall === true && partnerGender && partnerGender.toLowerCase() !== "male") {
        return new Response(
          JSON.stringify({ success: true, message: "partner_not_male", earned: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: session } = await supabase
        .from("anchor_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (!session) {
        return new Response(
          JSON.stringify({ success: false, message: "no_active_session" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if verification is needed (every 15 minutes)
      const VERIFY_INTERVAL_MS = 15 * 60 * 1000;
      const lastVerified = session.last_verified_at ? new Date(session.last_verified_at).getTime() : new Date(session.created_at).getTime();
      const now = Date.now();
      
      // Pick the right rate based on whether on call with a guy
      const rateCash = onCallWithMale ? Number(settings.active_rate_cash) : Number(settings.idle_rate_cash);
      const rateTime = onCallWithMale ? settings.active_rate_time : settings.idle_rate_time;
      const thresholdSeconds = rateTime * 60;
      const earningMode = onCallWithMale ? "active" : "idle";

      if (now - lastVerified >= VERIFY_INTERVAL_MS) {
        return new Response(
          JSON.stringify({
            success: true,
            verification_required: true,
            elapsed_seconds: session.elapsed_seconds,
            earningMode,
            cash_balance: Number(session.cash_balance),
            threshold_seconds: thresholdSeconds,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newElapsed = session.elapsed_seconds + (secondsToAdd || 30);
      let cashEarned = 0;
      let newCashBalance = Number(session.cash_balance);
      let resetElapsed = newElapsed;

      // Cash earning: check if threshold reached
      if (newElapsed >= thresholdSeconds) {
        cashEarned = rateCash;
        newCashBalance += cashEarned;
        resetElapsed = newElapsed - thresholdSeconds; // carry over remainder

        // Log earning
        await supabase.from("anchor_earnings").insert({
          user_id: userId,
          earning_type: earningMode === "active" ? "cash_active" : "cash_idle",
          amount: cashEarned,
          status: "credited",
        });
      }

      // Update session
      await supabase
        .from("anchor_sessions")
        .update({
          elapsed_seconds: resetElapsed,
          current_mode: earningMode,
          cash_balance: newCashBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id);

      return new Response(
        JSON.stringify({
          success: true,
          elapsed_seconds: resetElapsed,
          earningMode,
          cash_balance: newCashBalance,
          cash_earned: cashEarned,
          threshold_seconds: thresholdSeconds,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // LEAVE: Leave anchor earning
    if (type === "leave") {
      await supabase
        .from("anchor_sessions")
        .update({ status: "paused", updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("status", "active");

      await supabase.from("anchor_queue").delete().eq("user_id", userId);

      // Promote next in queue
      const { data: nextInQueue } = await supabase
        .from("anchor_queue")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextInQueue) {
        const { data: pausedSession } = await supabase
          .from("anchor_sessions")
          .select("*")
          .eq("user_id", nextInQueue.user_id)
          .eq("status", "paused")
          .maybeSingle();

        if (pausedSession) {
          await supabase
            .from("anchor_sessions")
            .update({ status: "active", updated_at: new Date().toISOString() })
            .eq("id", pausedSession.id);
        } else {
          await supabase.from("anchor_sessions").insert({
            user_id: nextInQueue.user_id,
            status: "active",
            current_mode: "idle",
            elapsed_seconds: 0,
            cash_balance: 0,
          });
        }

        await supabase.from("anchor_queue").delete().eq("user_id", nextInQueue.user_id);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // RESUME: Resume a paused session
    if (type === "resume") {
      const { count: activeCount } = await supabase
        .from("anchor_sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");

      if ((activeCount ?? 0) >= settings.max_anchor_cap) {
        const { data: existing } = await supabase
          .from("anchor_queue")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();
        if (!existing) {
          await supabase.from("anchor_queue").insert({ user_id: userId });
        }
        return new Response(
          JSON.stringify({ success: true, status: "queued" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: session } = await supabase
        .from("anchor_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "paused")
        .maybeSingle();

      if (session) {
        await supabase
          .from("anchor_sessions")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("id", session.id);

        return new Response(
          JSON.stringify({ success: true, status: "active", session: { ...session, status: "active" } }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: newSession } = await supabase
        .from("anchor_sessions")
        .insert({
          user_id: userId,
          status: "active",
          current_mode: "idle",
          elapsed_seconds: 0,
          cash_balance: 0,
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({ success: true, status: "active", session: newSession }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // CASHOUT: Request PayPal cashout
    if (type === "cashout") {
      const { paypalEmail } = body;

      const { data: session } = await supabase
        .from("anchor_sessions")
        .select("cash_balance")
        .eq("user_id", userId)
        .in("status", ["active", "paused"])
        .maybeSingle();

      const balance = Number(session?.cash_balance ?? 0);
      if (balance <= 0) {
        return new Response(
          JSON.stringify({ success: false, message: "No balance to cash out" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase.from("anchor_payouts").insert({
        user_id: userId,
        amount: balance,
        paypal_email: paypalEmail,
        status: "pending",
      });

      await supabase
        .from("anchor_sessions")
        .update({ cash_balance: 0, updated_at: new Date().toISOString() })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true, amount: balance }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET_EARNINGS: Get earnings history
    if (type === "get_earnings") {
      const { data: earnings } = await supabase
        .from("anchor_earnings")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      const { data: payouts } = await supabase
        .from("anchor_payouts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      return new Response(
        JSON.stringify({ success: true, earnings: earnings ?? [], payouts: payouts ?? [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ADMIN: Clear slots and promote queued users
    if (type === "admin_clear_slots") {
      const { sessionId } = body;

      if (sessionId) {
        await supabase.from("anchor_sessions").delete().eq("id", sessionId);
      } else {
        await supabase.from("anchor_sessions").delete().eq("status", "active");
      }

      const { count: activeAfter } = await supabase
        .from("anchor_sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");

      const freeSlots = settings.max_anchor_cap - (activeAfter ?? 0);
      let promoted = 0;

      if (freeSlots > 0) {
        const { data: queued } = await supabase
          .from("anchor_queue")
          .select("*")
          .order("created_at", { ascending: true })
          .limit(freeSlots);

        if (queued) {
          for (const q of queued) {
            const { data: paused } = await supabase
              .from("anchor_sessions")
              .select("id")
              .eq("user_id", q.user_id)
              .eq("status", "paused")
              .maybeSingle();

            if (paused) {
              await supabase.from("anchor_sessions").update({
                status: "active",
                updated_at: new Date().toISOString(),
              }).eq("id", paused.id);
            } else {
              await supabase.from("anchor_sessions").insert({
                user_id: q.user_id,
                status: "active",
                current_mode: "idle",
                elapsed_seconds: 0,
                cash_balance: 0,
              });
            }
            await supabase.from("anchor_queue").delete().eq("user_id", q.user_id);
            promoted++;
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, cleared: true, promoted, activeAfter: (activeAfter ?? 0) + promoted }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ADMIN: Get all active sessions and queue
    if (type === "admin_get_all") {
      const { data: sessions } = await supabase
        .from("anchor_sessions")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: queue } = await supabase
        .from("anchor_queue")
        .select("*")
        .order("created_at", { ascending: true });

      const { data: payouts } = await supabase
        .from("anchor_payouts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      return new Response(
        JSON.stringify({ success: true, sessions: sessions ?? [], queue: queue ?? [], payouts: payouts ?? [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, message: "Unknown type" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
