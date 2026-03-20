import { createClient } from "npm:@supabase/supabase-js@2";

function getWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun
  const diff = now.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), diff));
  return monday.toISOString().split("T")[0];
}

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

    // --- Stale session cleanup: auto-pause sessions not updated in 5+ minutes ---
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
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
    }

    // --- Auto-promote queued users into free slots ---
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

    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const settingsPayload = {
      active_rate_cash: Number(settings.active_rate_cash),
      active_rate_time: settings.active_rate_time,
      idle_rate_cash: Number(settings.idle_rate_cash),
      idle_rate_time: settings.idle_rate_time,
      max_anchor_cap: settings.max_anchor_cap,
    };

    // ─── GET_STATUS ───
    if (type === "get_status") {
      const { data: member } = await supabase
        .from("members")
        .select("gender")
        .eq("id", userId)
        .maybeSingle();

      if (!member || member.gender?.toLowerCase() !== "female") {
        return json({ success: true, eligible: false, reason: "not_female" });
      }

      const { data: session } = await supabase
        .from("anchor_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (session) {
        return json({
          success: true,
          eligible: true,
          status: "active",
          session,
          settings: settingsPayload,
        });
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

      return json({
        success: true,
        eligible: true,
        status: queueEntry ? "queued" : "idle",
        slotsAvailable,
        activeCount: activeCount ?? 0,
        maxCap: settings.max_anchor_cap,
        queuePosition,
        settings: settingsPayload,
      });
    }

    // ─── JOIN ───
    if (type === "join") {
      const { data: member } = await supabase
        .from("members")
        .select("gender")
        .eq("id", userId)
        .maybeSingle();

      if (!member || member.gender?.toLowerCase() !== "female") {
        return json({ success: false, message: "not_eligible" }, 403);
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

          return json({
            success: true,
            status: "active",
            session: { ...pausedSession, status: "active" },
            settings: settingsPayload,
          });
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

        return json({
          success: true,
          status: "active",
          session,
          settings: settingsPayload,
        });
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

      return json({
        success: true,
        status: "queued",
        queuePosition: ahead ?? 1,
        maxCap: settings.max_anchor_cap,
      });
    }

    // ─── VERIFY ───
    if (type === "verify") {
      const { data: session } = await supabase
        .from("anchor_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (!session) {
        return json({ success: false, message: "no_active_session" });
      }

      await supabase
        .from("anchor_sessions")
        .update({ last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", session.id);

      return json({ success: true });
    }

    // ─── TICK: Per-minute rate crediting (called every ~60s) ───
    if (type === "tick") {
      const { partnerGender, isOnCall } = body;

      const onCallWithMale = isOnCall === true && partnerGender && partnerGender.toLowerCase() === "male";

      // If on call with a female, don't earn at all
      if (isOnCall === true && partnerGender && partnerGender.toLowerCase() !== "male") {
        return json({ success: true, message: "partner_not_male", earned: false, cash_earned: 0 });
      }

      const { data: session } = await supabase
        .from("anchor_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (!session) {
        return json({ success: false, message: "no_active_session" });
      }

      // Check if verification is needed (every 15 minutes)
      const VERIFY_INTERVAL_MS = 15 * 60 * 1000;
      const lastVerified = session.last_verified_at
        ? new Date(session.last_verified_at).getTime()
        : new Date(session.created_at).getTime();
      const now = Date.now();

      const earningMode = onCallWithMale ? "active" : "idle";

      if (now - lastVerified >= VERIFY_INTERVAL_MS) {
        return json({
          success: true,
          verification_required: true,
          earningMode,
          cash_balance: Number(session.cash_balance),
        });
      }

      // Calculate how many minutes elapsed since last update (server-side)
      const lastUpdate = new Date(session.updated_at).getTime();
      const elapsedMs = now - lastUpdate;
      const elapsedMinutes = Math.floor(elapsedMs / 60_000);

      // Cap at 5 minutes to prevent abuse from stale tabs
      const creditMinutes = Math.min(elapsedMinutes, 5);

      // Per-minute rate: rate_cash / rate_time gives cash per minute
      const rateCash = onCallWithMale ? Number(settings.active_rate_cash) : Number(settings.idle_rate_cash);
      const rateTime = onCallWithMale ? settings.active_rate_time : settings.idle_rate_time;
      const cashPerMinute = rateCash / rateTime;

      const cashEarned = creditMinutes > 0 ? Number((cashPerMinute * creditMinutes).toFixed(4)) : 0;
      const newCashBalance = Number(session.cash_balance) + cashEarned;

      // Update session
      await supabase
        .from("anchor_sessions")
        .update({
          current_mode: earningMode,
          cash_balance: newCashBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id);

      // Log earning if any
      if (cashEarned > 0) {
        await supabase.from("anchor_earnings").insert({
          user_id: userId,
          earning_type: earningMode === "active" ? "cash_active" : "cash_idle",
          amount: cashEarned,
          status: "credited",
        });
      }

      return json({
        success: true,
        earningMode,
        cash_balance: newCashBalance,
        cash_earned: cashEarned,
        credited_minutes: creditMinutes,
        rate_per_minute: cashPerMinute,
      });
    }

    // ─── LEAVE ───
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

      return json({ success: true });
    }

    // ─── RESUME ───
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
        return json({ success: true, status: "queued" });
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

        return json({ success: true, status: "active", session: { ...session, status: "active" } });
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

      return json({ success: true, status: "active", session: newSession });
    }

    // ─── CASHOUT ───
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
        return json({ success: false, message: "No balance to cash out" }, 400);
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

      return json({ success: true, amount: balance });
    }

    // ─── GET_EARNINGS ───
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

      return json({ success: true, earnings: earnings ?? [], payouts: payouts ?? [] });
    }

    // ─── ADMIN: Clear slots ───
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

      return json({ success: true, cleared: true, promoted, activeAfter: (activeAfter ?? 0) + promoted });
    }

    // ─── ADMIN: Get all ───
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

      return json({ success: true, sessions: sessions ?? [], queue: queue ?? [], payouts: payouts ?? [] });
    }

    // ─── TRACK_DIRECT_CALL: Record a direct call partner for challenge progress ───
    if (type === "track_direct_call") {
      const { partnerId } = body;
      if (!userId || !partnerId) {
        return json({ success: false, message: "userId and partnerId required" }, 400);
      }

      // Check the user is female
      const { data: member } = await supabase
        .from("members")
        .select("gender")
        .eq("id", userId)
        .maybeSingle();

      if (!member || member.gender?.toLowerCase() !== "female") {
        return json({ success: true, tracked: false, reason: "not_female" });
      }

      // Check partner is male
      const { data: partner } = await supabase
        .from("members")
        .select("gender")
        .eq("id", partnerId)
        .maybeSingle();

      if (!partner || partner.gender?.toLowerCase() !== "male") {
        return json({ success: true, tracked: false, reason: "partner_not_male" });
      }

      // Get active challenges
      const { data: activeChallenges } = await supabase
        .from("anchor_challenges")
        .select("*")
        .eq("is_active", true);

      if (!activeChallenges || activeChallenges.length === 0) {
        return json({ success: true, tracked: false, reason: "no_active_challenges" });
      }

      const weekStart = getWeekStart();
      const results: any[] = [];

      for (const challenge of activeChallenges) {
        // Only process direct-call type challenges (videochat and private_call)
        if (!["videochat", "private_call"].includes(challenge.challenge_type)) continue;

        // Get or create progress row
        const { data: existing } = await supabase
          .from("anchor_challenge_progress")
          .select("*")
          .eq("user_id", userId)
          .eq("challenge_id", challenge.id)
          .eq("week_start", weekStart)
          .maybeSingle();

        if (existing?.rewarded) {
          results.push({ challenge_id: challenge.id, status: "already_rewarded" });
          continue;
        }

        const currentPartners: string[] = existing?.unique_partners ?? [];
        if (currentPartners.includes(partnerId)) {
          results.push({ challenge_id: challenge.id, status: "partner_already_counted", progress: currentPartners.length, target: challenge.target_count });
          continue;
        }

        const updatedPartners = [...currentPartners, partnerId];
        const completed = updatedPartners.length >= challenge.target_count;

        if (existing) {
          await supabase
            .from("anchor_challenge_progress")
            .update({
              unique_partners: updatedPartners,
              completed_at: completed ? new Date().toISOString() : null,
              rewarded: completed,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          await supabase
            .from("anchor_challenge_progress")
            .insert({
              user_id: userId,
              challenge_id: challenge.id,
              unique_partners: updatedPartners,
              week_start: weekStart,
              completed_at: completed ? new Date().toISOString() : null,
              rewarded: completed,
            });
        }

        // Auto-reward if completed
        if (completed) {
          // Credit cash balance to anchor session
          const { data: session } = await supabase
            .from("anchor_sessions")
            .select("cash_balance")
            .eq("user_id", userId)
            .in("status", ["active", "paused"])
            .maybeSingle();

          if (session) {
            const newBalance = Number(session.cash_balance) + Number(challenge.reward_amount);
            await supabase
              .from("anchor_sessions")
              .update({ cash_balance: newBalance, updated_at: new Date().toISOString() })
              .eq("user_id", userId);
          }

          // Log earning
          await supabase.from("anchor_earnings").insert({
            user_id: userId,
            earning_type: "challenge_bonus",
            amount: Number(challenge.reward_amount),
            reward_title: challenge.title,
            status: "credited",
          });
        }

        results.push({
          challenge_id: challenge.id,
          title: challenge.title,
          status: completed ? "completed_and_rewarded" : "progress_updated",
          progress: updatedPartners.length,
          target: challenge.target_count,
          reward: completed ? Number(challenge.reward_amount) : 0,
        });
      }

      return json({ success: true, tracked: true, results });
    }

    // ─── GET_CHALLENGE_PROGRESS: Fetch user's current challenge progress ───
    if (type === "get_challenge_progress") {
      if (!userId) return json({ success: false, message: "userId required" }, 400);

      const weekStart = getWeekStart();
      const { data: progress } = await supabase
        .from("anchor_challenge_progress")
        .select("*")
        .eq("user_id", userId)
        .eq("week_start", weekStart);

      return json({ success: true, progress: progress ?? [] });
    }

    return json({ success: false, message: "Unknown type" }, 400);
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
