import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RetentionState = "waiting" | "connected_male" | "idle";

interface ProgressRow {
  current_cents: number;
  day_qualifying_seconds: number;
  day_completed: boolean;
  last_activity_at: string;
  total_lifetime_cents: number;
}

const TICK_SECONDS = 10; // batch updates every 10s for efficiency

export function useFemaleRetentionBar(opts: {
  enabled: boolean;
  userId: string;
  state: RetentionState;
}) {
  const { enabled, userId, state } = opts;
  const [progress, setProgress] = useState<ProgressRow | null>(null);
  const [loading, setLoading] = useState(true);
  const accumulatedRef = useRef(0);
  const lastTickRef = useRef<number>(Date.now());

  // Initial fetch
  const refresh = useCallback(async () => {
    if (!enabled || !userId || userId === "anonymous") return;
    const { data } = await supabase
      .from("female_retention_progress")
      .select("current_cents, day_qualifying_seconds, day_completed, last_activity_at, total_lifetime_cents")
      .eq("user_id", userId)
      .maybeSingle();
    setProgress(
      data ?? {
        current_cents: 0,
        day_qualifying_seconds: 0,
        day_completed: false,
        last_activity_at: new Date().toISOString(),
        total_lifetime_cents: 0,
      },
    );
    setLoading(false);
  }, [enabled, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Tick: accumulate seconds and flush every TICK_SECONDS
  useEffect(() => {
    if (!enabled || !userId || userId === "anonymous") return;
    if (state === "idle") {
      lastTickRef.current = Date.now();
      accumulatedRef.current = 0;
      return;
    }

    lastTickRef.current = Date.now();
    const interval = setInterval(async () => {
      const now = Date.now();
      const delta = Math.min(60, Math.round((now - lastTickRef.current) / 1000));
      lastTickRef.current = now;
      if (delta <= 0) return;

      accumulatedRef.current += delta;
      if (accumulatedRef.current < TICK_SECONDS) return;

      const secondsToFlush = accumulatedRef.current;
      accumulatedRef.current = 0;

      const { data, error } = await supabase.rpc("add_female_retention_seconds", {
        p_seconds: secondsToFlush,
        p_state: state,
      });
      if (error) return;
      const result = data as any;
      if (result?.success) {
        setProgress((prev) => ({
          current_cents: result.current_cents,
          day_qualifying_seconds: result.day_qualifying_seconds,
          day_completed: result.day_completed,
          last_activity_at: new Date().toISOString(),
          total_lifetime_cents: prev?.total_lifetime_cents ?? 0,
        }));
      }
    }, TICK_SECONDS * 1000);

    return () => clearInterval(interval);
  }, [enabled, userId, state]);

  const cashout = useCallback(
    async (cents: number, paypalEmail: string) => {
      const { data, error } = await supabase.rpc("request_female_retention_cashout", {
        p_cents: cents,
        p_paypal_email: paypalEmail,
      });
      if (error) return { success: false, error: error.message };
      const result = data as any;
      if (result?.success) {
        await refresh();
      }
      return result;
    },
    [refresh],
  );

  return { progress, loading, cashout, refresh };
}
