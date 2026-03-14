import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AnchorSettings {
  power_rate_cash: number;
  power_rate_time: number;
  chill_reward_time: number;
  max_anchor_cap: number;
}

interface AnchorReward {
  id: string;
  title: string;
  image_url: string | null;
  rarity: string;
}

export interface AnchorPayout {
  id: string;
  amount: number;
  status: string;
  paypal_email: string | null;
  created_at: string;
  updated_at: string;
}

export type AnchorStatus = "loading" | "not_eligible" | "idle" | "active" | "queued" | "slots_full";
export type AnchorMode = "chill" | "power";

const VERIFY_WORDS = ["sunshine", "butterfly", "rainbow", "dolphin", "mountain", "galaxy", "crystal", "meadow", "horizon", "thunder", "blossom", "cascade", "eclipse", "harbor", "lantern", "orchid", "phoenix", "radiance", "sapphire", "velvet"];

export function useAnchorEarning({
  userId,
  isOnCall,
  partnerGender,
}: {
  userId: string;
  isOnCall: boolean;
  partnerGender?: string | null;
}) {
  const [status, setStatus] = useState<AnchorStatus>("loading");
  const [mode, setMode] = useState<AnchorMode>("chill");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [thresholdSeconds, setThresholdSeconds] = useState(45 * 60);
  const [cashBalance, setCashBalance] = useState(0);
  const [queuePosition, setQueuePosition] = useState(0);
  const [settings, setSettings] = useState<AnchorSettings | null>(null);
  const [rewardEarned, setRewardEarned] = useState<AnchorReward | null>(null);
  const [cashEarned, setCashEarned] = useState<number>(0);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [verificationWord, setVerificationWord] = useState("");
  const [payouts, setPayouts] = useState<AnchorPayout[]>([]);

  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localElapsedRef = useRef(0);
  const isActiveRef = useRef(false);

  // Check status on mount
  const checkStatus = useCallback(async () => {
    if (!userId || userId === "anonymous") {
      setStatus("not_eligible");
      return;
    }

    const { data } = await supabase.functions.invoke("anchor-earning", {
      body: { type: "get_status", userId },
    });

    if (!data?.success) {
      setStatus("not_eligible");
      return;
    }

    if (!data.eligible) {
      setStatus("not_eligible");
      return;
    }

    if (data.settings) setSettings(data.settings);
    setMode(data.currentMode);

    if (data.status === "active") {
      setStatus("active");
      isActiveRef.current = true;
      setElapsedSeconds(data.session?.elapsed_seconds ?? 0);
      localElapsedRef.current = data.session?.elapsed_seconds ?? 0;
      setCashBalance(Number(data.session?.cash_balance ?? 0));
      setThresholdSeconds(
        data.currentMode === "power"
          ? (data.settings?.power_rate_time ?? 30) * 60
          : (data.settings?.chill_reward_time ?? 45) * 60
      );
    } else if (data.status === "queued") {
      setStatus("queued");
      setQueuePosition(data.queuePosition);
    } else {
      setStatus(data.slotsAvailable ? "idle" : "slots_full");
    }
  }, [userId]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Join anchor earning
  const joinAnchor = useCallback(async () => {
    const { data } = await supabase.functions.invoke("anchor-earning", {
      body: { type: "join", userId },
    });

    if (data?.success) {
      if (data.status === "active") {
        setStatus("active");
        isActiveRef.current = true;
        setElapsedSeconds(data.session?.elapsed_seconds ?? 0);
        localElapsedRef.current = data.session?.elapsed_seconds ?? 0;
        setCashBalance(Number(data.session?.cash_balance ?? 0));
        setMode(data.currentMode);
      } else if (data.status === "queued") {
        setStatus("queued");
        setQueuePosition(data.queuePosition);
      }
    }
  }, [userId]);

  // Leave anchor earning
  const leaveAnchor = useCallback(async () => {
    isActiveRef.current = false;
    await supabase.functions.invoke("anchor-earning", {
      body: { type: "leave", userId },
    });
    setStatus("idle");
  }, [userId]);

  // Tick - report progress to server
  const tick = useCallback(async () => {
    if (!isActiveRef.current) return;

    const { data } = await supabase.functions.invoke("anchor-earning", {
      body: {
        type: "tick",
        userId,
        secondsToAdd: 30,
        partnerGender: partnerGender || null,
      },
    });

    if (data?.success) {
      if (data.verification_required) {
        // Pause timer and show challenge
        isActiveRef.current = false;
        setVerificationRequired(true);
        setVerificationWord(VERIFY_WORDS[Math.floor(Math.random() * VERIFY_WORDS.length)]);
        return;
      }
      setElapsedSeconds(data.elapsed_seconds);
      localElapsedRef.current = data.elapsed_seconds;
      setMode(data.currentMode);
      setCashBalance(Number(data.cash_balance));
      setThresholdSeconds(data.threshold_seconds);

      if (data.reward_earned) {
        setRewardEarned(data.reward_earned);
      }
      if (data.cash_earned > 0) {
        setCashEarned(data.cash_earned);
      }
    } else if (data?.message === "no_active_session") {
      isActiveRef.current = false;
      setStatus("idle");
    }
  }, [userId, partnerGender]);

  // Local timer that increments every second for smooth UI, reports to server every 30s
  useEffect(() => {
    if (status === "active" && isOnCall) {
      isActiveRef.current = true;

      tickIntervalRef.current = setInterval(() => {
        localElapsedRef.current += 1;
        setElapsedSeconds(localElapsedRef.current);

        // Report to server every 30 seconds
        if (localElapsedRef.current % 30 === 0) {
          tick();
        }
      }, 1000);
    } else {
      isActiveRef.current = false;
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    }

    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [status, isOnCall, tick]);

  // Poll queue position
  useEffect(() => {
    if (status !== "queued") return;

    const interval = setInterval(async () => {
      const { data } = await supabase.functions.invoke("anchor-earning", {
        body: { type: "get_status", userId },
      });

      if (data?.status === "active") {
        setStatus("active");
        isActiveRef.current = true;
        setElapsedSeconds(data.session?.elapsed_seconds ?? 0);
        localElapsedRef.current = data.session?.elapsed_seconds ?? 0;
        setCashBalance(Number(data.session?.cash_balance ?? 0));
        setMode(data.currentMode);
      } else if (data?.status === "queued") {
        setQueuePosition(data.queuePosition);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [status, userId]);

  // Cashout
  const cashout = useCallback(async (paypalEmail: string) => {
    const { data } = await supabase.functions.invoke("anchor-earning", {
      body: { type: "cashout", userId, paypalEmail },
    });

    if (data?.success) {
      setCashBalance(0);
      return data.amount;
    }
    throw new Error(data?.message || "Cashout failed");
  }, [userId]);

  const dismissReward = useCallback(() => setRewardEarned(null), []);
  const dismissCashEarned = useCallback(() => setCashEarned(0), []);

  // Submit verification
  const submitVerification = useCallback(async (input: string) => {
    if (input.toLowerCase().trim() !== verificationWord.toLowerCase()) {
      return false;
    }
    const { data } = await supabase.functions.invoke("anchor-earning", {
      body: { type: "verify", userId },
    });
    if (data?.success) {
      setVerificationRequired(false);
      setVerificationWord("");
      isActiveRef.current = true;
    }
    return !!data?.success;
  }, [userId, verificationWord]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isActiveRef.current) {
        supabase.functions.invoke("anchor-earning", {
          body: { type: "leave", userId },
        });
      }
    };
  }, [userId]);

  return {
    status,
    mode,
    elapsedSeconds,
    thresholdSeconds,
    cashBalance,
    queuePosition,
    settings,
    rewardEarned,
    cashEarned,
    verificationRequired,
    verificationWord,
    joinAnchor,
    leaveAnchor,
    cashout,
    dismissReward,
    dismissCashEarned,
    submitVerification,
    checkStatus,
  };
}
