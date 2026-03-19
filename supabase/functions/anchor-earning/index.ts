import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getCurrentMode(settings: any): "chill" | "power" {
  // If chill hours are disabled, always return power
  if (settings.chill_disabled) return "power";

  // Get current Eastern Time (handles EST/EDT automatically)
  const now = new Date();
  const eastern = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const currentHour = eastern.getHours();
  const currentMinute = eastern.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const [phStartH, phStartM] = (settings.power_hour_start || "19:00").split(":").map(Number);
  const [phEndH, phEndM] = (settings.power_hour_end || "00:00").split(":").map(Number);
  const powerStart = phStartH * 60 + phStartM;
  const powerEnd = phEndH * 60 + phEndM;

  // Handle wrap-around (e.g., 19:00 - 00:00)
  if (powerEnd <= powerStart) {
    // Power hours wrap past midnight
    if (currentTime >= powerStart || currentTime < powerEnd) return "power";
  } else {
    if (currentTime >= powerStart && currentTime < powerEnd) return "power";
  }
  return "chill";
}

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

    const currentMode = getCurrentMode(settings);

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
              await supabase.from("anchor_sessions").insert({ user_id: q.user_id, status: "active", current_mode: currentMode, elapsed_seconds: 0, cash_balance: 0 });
            }
            await supabase.from("anchor_queue").delete().eq("user_id", q.user_id);
          }
        }
      }
    }

    // Force-update all active sessions to "power" mode when chill is disabled
    if (settings.chill_disabled) {
      await supabase
        .from("anchor_sessions")
        .update({ current_mode: "power", updated_at: new Date().toISOString() })
        .eq("status", "active")
        .neq("current_mode", "power");
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
              current_mode: currentMode,
              updated_at: new Date().toISOString(),
            }).eq("id", pausedSession.id);
          } else {
            await supabase.from("anchor_sessions").insert({
              user_id: q.user_id,
              status: "active",
              current_mode: currentMode,
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
      // Check if user is female
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

      // Check if user has an active session
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
            currentMode,
            settings: {
              power_rate_cash: settings.power_rate_cash,
              power_rate_time: settings.power_rate_time,
              chill_reward_time: settings.chill_reward_time,
              max_anchor_cap: settings.max_anchor_cap,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check queue position
      const { data: queueEntry } = await supabase
        .from("anchor_queue")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      // Count active sessions
      const { count: activeCount } = await supabase
        .from("anchor_sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");

      const slotsAvailable = (activeCount ?? 0) < settings.max_anchor_cap;

      // Get queue position
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
          currentMode,
          settings: {
            power_rate_cash: settings.power_rate_cash,
            power_rate_time: settings.power_rate_time,
            chill_reward_time: settings.chill_reward_time,
            max_anchor_cap: settings.max_anchor_cap,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // JOIN: Try to join anchor earning (or enter queue)
    if (type === "join") {
      // Verify female
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

      // Count active
      const { count: activeCount } = await supabase
        .from("anchor_sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");

      if ((activeCount ?? 0) < settings.max_anchor_cap) {
        // Clean up queue entry
        await supabase.from("anchor_queue").delete().eq("user_id", userId);

        // Check for existing paused session to resume (preserves cash_balance)
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
              current_mode: currentMode,
              last_verified_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", pausedSession.id);

          return new Response(
            JSON.stringify({
              success: true,
              status: "active",
              session: { ...pausedSession, status: "active", current_mode: currentMode },
              currentMode,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // No paused session — clean up and create new
        await supabase.from("anchor_sessions").delete().eq("user_id", userId);

        // Create active session
        const { data: session } = await supabase
          .from("anchor_sessions")
          .insert({
            user_id: userId,
            status: "active",
            current_mode: currentMode,
            elapsed_seconds: 0,
            cash_balance: 0,
          })
          .select()
          .single();

        return new Response(
          JSON.stringify({ success: true, status: "active", session, currentMode }),
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
      const { secondsToAdd, partnerGender } = body;

      // Verify partner is male (only earn while chatting with males)
      if (partnerGender && partnerGender.toLowerCase() !== "male") {
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
      if (now - lastVerified >= VERIFY_INTERVAL_MS) {
        return new Response(
          JSON.stringify({ success: true, verification_required: true, elapsed_seconds: session.elapsed_seconds, currentMode, cash_balance: Number(session.cash_balance), threshold_seconds: currentMode === "power" ? settings.power_rate_time * 60 : settings.chill_reward_time * 60 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newElapsed = session.elapsed_seconds + (secondsToAdd || 30);
      const mode = currentMode;

      let rewardEarned = null;
      let cashEarned = 0;
      let newCashBalance = Number(session.cash_balance);
      let resetElapsed = newElapsed;

      if (mode === "power") {
        // Cash earning: check if threshold reached
        const thresholdSeconds = settings.power_rate_time * 60;
        if (newElapsed >= thresholdSeconds) {
          cashEarned = Number(settings.power_rate_cash);
          newCashBalance += cashEarned;
          resetElapsed = newElapsed - thresholdSeconds; // carry over remainder

          // Log earning
          await supabase.from("anchor_earnings").insert({
            user_id: userId,
            earning_type: "cash",
            amount: cashEarned,
            status: "credited",
          });
        }
      } else {
        // Chill hours: mystery reward
        const thresholdSeconds = settings.chill_reward_time * 60;
        if (newElapsed >= thresholdSeconds) {
          // Pick a random common or rare reward
          const { data: rewards } = await supabase
            .from("rewards")
            .select("id, title, image_url, rarity, minutes_cost")
            .eq("visible", true)
            .in("rarity", ["common", "rare"])
            .limit(50);

          if (rewards && rewards.length > 0) {
            const randomReward = rewards[Math.floor(Math.random() * rewards.length)];
            rewardEarned = randomReward;

            // Create a redemption for the anchor user
            await supabase.from("member_redemptions").insert({
              user_id: userId,
              reward_id: randomReward.id,
              reward_title: randomReward.title,
              reward_image_url: randomReward.image_url,
              reward_rarity: randomReward.rarity,
              reward_type: "product",
              minutes_cost: 0,
              status: "processing",
            });

            // Log earning
            await supabase.from("anchor_earnings").insert({
              user_id: userId,
              earning_type: "mystery_reward",
              amount: 0,
              reward_id: randomReward.id,
              reward_title: randomReward.title,
              status: "awarded",
            });
          }

          resetElapsed = newElapsed - thresholdSeconds;
        }
      }

      // Update session
      await supabase
        .from("anchor_sessions")
        .update({
          elapsed_seconds: resetElapsed,
          current_mode: mode,
          cash_balance: newCashBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id);

      return new Response(
        JSON.stringify({
          success: true,
          elapsed_seconds: resetElapsed,
          currentMode: mode,
          cash_balance: newCashBalance,
          reward_earned: rewardEarned,
          cash_earned: cashEarned,
          threshold_seconds:
            mode === "power"
              ? settings.power_rate_time * 60
              : settings.chill_reward_time * 60,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // LEAVE: Leave anchor earning
    if (type === "leave") {
      // Save progress (don't delete session, just deactivate to preserve elapsed)
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
        // Check for paused session to resume
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
            current_mode: currentMode,
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
        // Add to queue instead
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
          .update({ status: "active", current_mode: currentMode, updated_at: new Date().toISOString() })
          .eq("id", session.id);

        return new Response(
          JSON.stringify({ success: true, status: "active", session: { ...session, status: "active" }, currentMode }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // No paused session, create new
      const { data: newSession } = await supabase
        .from("anchor_sessions")
        .insert({
          user_id: userId,
          status: "active",
          current_mode: currentMode,
          elapsed_seconds: 0,
          cash_balance: 0,
        })
        .select()
        .single();

      return new Response(
        JSON.stringify({ success: true, status: "active", session: newSession, currentMode }),
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

      // Create payout request
      await supabase.from("anchor_payouts").insert({
        user_id: userId,
        amount: balance,
        paypal_email: paypalEmail,
        status: "pending",
      });

      // Reset cash balance
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
      const { sessionId } = body; // optional: clear single slot

      if (sessionId) {
        // Clear a single session
        await supabase.from("anchor_sessions").delete().eq("id", sessionId);
      } else {
        // Clear all active sessions
        await supabase.from("anchor_sessions").delete().eq("status", "active");
      }

      // Now promote queued users into freed slots
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
            // Check for paused session to resume
            const { data: paused } = await supabase
              .from("anchor_sessions")
              .select("id")
              .eq("user_id", q.user_id)
              .eq("status", "paused")
              .maybeSingle();

            if (paused) {
              await supabase.from("anchor_sessions").update({
                status: "active",
                current_mode: currentMode,
                updated_at: new Date().toISOString(),
              }).eq("id", paused.id);
            } else {
              await supabase.from("anchor_sessions").insert({
                user_id: q.user_id,
                status: "active",
                current_mode: currentMode,
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
