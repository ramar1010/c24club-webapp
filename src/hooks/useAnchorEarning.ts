import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AnchorSettings {
  active_rate_cash: number;
  active_rate_time: number;
  idle_rate_cash: number;
  idle_rate_time: number;
  max_anchor_cap: number;
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
export type EarningMode = "active" | "idle";

const VERIFY_WORDS = ["sunshine", "butterfly", "rainbow", "dolphin", "mountain", "galaxy", "crystal", "meadow", "horizon", "thunder", "blossom", "cascade", "eclipse", "harbor", "lantern", "orchid", "phoenix", "radiance", "sapphire", "velvet"];

export function useAnchorEarning({
  userId,
  isOnCall,
  isStarted = false,
  partnerGender,
}: {
  userId: string;
  isOnCall: boolean;
  isStarted?: boolean;
  partnerGender?: string | null;
}) {
  const [status, setStatus] = useState<AnchorStatus>("loading");
  const [earningMode, setEarningMode] = useState<EarningMode>("idle");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [cashBalance, setCashBalance] = useState(0);
  const [queuePosition, setQueuePosition] = useState(0);
  const [settings, setSettings] = useState<AnchorSettings | null>(null);
  const [cashEarned, setCashEarned] = useState<number>(0);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [verificationWord, setVerificationWord] = useState("");
  const [payouts, setPayouts] = useState<AnchorPayout[]>([]);

  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef(false);

  const onCallWithMale = isOnCall && partnerGender?.toLowerCase() === "male";

  // Check status on mount
  const checkStatus = useCallback(async () => {
    if (!userId || userId === "anonymous") {
      setStatus("not_eligible");
      return;
    }

    const { data } = await supabase.functions.invoke("anchor-earning", {
      body: { type: "get_status", userId },
    });

    if (!data?.success || !data.eligible) {
      setStatus("not_eligible");
      return;
    }

    if (data.settings) {
      setSettings(data.settings);
      setSettingsLoaded(true);
    }

    if (data.status === "active") {
      setStatus("active");
      isActiveRef.current = true;
      setCashBalance(Number(data.session?.cash_balance ?? 0));
      const mode: EarningMode = data.session?.current_mode === "active" ? "active" : "idle";
      setEarningMode(mode);
    } else if (data.status === "queued") {
      setStatus("queued");
      setQueuePosition(data.queuePosition);
    } else {
      setStatus(data.slotsAvailable ? "idle" : "slots_full");
    }
  }, [userId]);

  // Fetch payout history
  const fetchPayouts = useCallback(async () => {
    if (!userId || userId === "anonymous") return;
    const { data } = await supabase.functions.invoke("anchor-earning", {
      body: { type: "get_earnings", userId },
    });
    if (data?.success) {
      setPayouts(data.payouts ?? []);
    }
  }, [userId]);

  useEffect(() => {
    checkStatus();
    fetchPayouts();
  }, [checkStatus, fetchPayouts]);

  // Join anchor earning
  const joinAnchor = useCallback(async () => {
    const { data } = await supabase.functions.invoke("anchor-earning", {
      body: { type: "join", userId },
    });

    if (data?.success) {
      if (data.status === "active") {
        setStatus("active");
        isActiveRef.current = true;
        setCashBalance(Number(data.session?.cash_balance ?? 0));
        setEarningMode("idle");
        if (data.settings) {
          setSettings(data.settings);
          setSettingsLoaded(true);
        }
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

  // Tick — report to server every 60s, server credits per-minute rate
  const tick = useCallback(async () => {
    if (!isActiveRef.current) return;

    const { data } = await supabase.functions.invoke("anchor-earning", {
      body: {
        type: "tick",
        userId,
        partnerGender: partnerGender || null,
        isOnCall,
      },
    });

    if (data?.success) {
      if (data.verification_required) {
        isActiveRef.current = false;
        setVerificationRequired(true);
        setVerificationWord(VERIFY_WORDS[Math.floor(Math.random() * VERIFY_WORDS.length)]);
        return;
      }
      const newMode: EarningMode = data.earningMode || "idle";
      setEarningMode(newMode);
      setCashBalance(Number(data.cash_balance) || 0);

      if (data.cash_earned > 0) {
        setCashEarned(data.cash_earned);
      }
    } else if (data?.message === "no_active_session") {
      isActiveRef.current = false;
      setStatus("idle");
    }
  }, [userId, partnerGender, isOnCall]);

  // Timer: tick every 60s when status is "active"
  useEffect(() => {
    if (status === "active") {
      isActiveRef.current = true;

      // Immediate first tick
      tick();

      tickIntervalRef.current = setInterval(() => {
        tick();
      }, 60_000); // every 60 seconds = 1 minute
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
  }, [status, tick]);

  // Update earning mode locally when call state changes (for UI responsiveness)
  useEffect(() => {
    if (status !== "active") return;
    const newMode: EarningMode = onCallWithMale ? "active" : "idle";
    setEarningMode(newMode);
  }, [onCallWithMale, status]);

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
        setCashBalance(Number(data.session?.cash_balance ?? 0));
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
      fetchPayouts();
      return data.amount;
    }
    throw new Error(data?.message || "Cashout failed");
  }, [userId, fetchPayouts]);

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
    earningMode,
    cashBalance,
    queuePosition,
    settings,
    settingsLoaded,
    cashEarned,
    verificationRequired,
    verificationWord,
    payouts,
    joinAnchor,
    leaveAnchor,
    cashout,
    dismissCashEarned,
    submitVerification,
    checkStatus,
    fetchPayouts,
  };
}
