import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

function generateSessionId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface UseCallMinutesOptions {
  userId: string;
  partnerId: string | null;
  isConnected: boolean;
  voiceMode?: boolean;
}

interface CapInfo {
  cap: number;
  isVip: boolean;
}

interface FreezeInfo {
  isFrozen: boolean;
  earnRate: number;
}

export function useCallMinutes({ userId, partnerId, isConnected, voiceMode = false }: UseCallMinutesOptions) {
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [capReached, setCapReached] = useState(false);
  const [capInfo, setCapInfo] = useState<CapInfo | null>(null);
  const [showCapPopup, setShowCapPopup] = useState(false);
  const [freezeInfo, setFreezeInfo] = useState<FreezeInfo>({ isFrozen: false, earnRate: 10 });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const lastReportedRef = useRef(0);
  const partnerIdRef = useRef(partnerId);
  const capReachedRef = useRef(false);
  const sessionIdRef = useRef(generateSessionId());

  // Keep refs in sync
  useEffect(() => {
    partnerIdRef.current = partnerId;
  }, [partnerId]);

  // Fetch balance (initial + on-demand refresh)
  const fetchBalance = useCallback(() => {
    if (!userId || userId === "anonymous") return;

    supabase.functions
      .invoke("earn-minutes", {
        body: { type: "get_balance", userId },
      })
      .then(({ data }) => {
        if (data?.success) {
          setTotalMinutes(data.totalMinutes);
          setFreezeInfo({ isFrozen: data.isFrozen ?? false, earnRate: data.earnRate ?? 10 });
        }
      });
  }, [userId]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Reset when partner changes — new session
  useEffect(() => {
    elapsedRef.current = 0;
    lastReportedRef.current = 0;
    setElapsedSeconds(0);
    setCapReached(false);
    capReachedRef.current = false;
    setShowCapPopup(false);
    sessionIdRef.current = generateSessionId();
  }, [partnerId]);

  // Report earned minutes to the server
  const reportMinutes = useCallback(async (minutes: number) => {
    const pid = partnerIdRef.current;
    // Hard cap: never report more than 5 minutes at once (safety net against timer drift)
    const safeMinutes = Math.min(minutes, 5);
    if (!pid || !userId || userId === "anonymous" || safeMinutes <= 0) return;

    const { data } = await supabase.functions.invoke("earn-minutes", {
      body: {
        type: "earn",
        userId,
        partnerId: pid,
        minutesEarned: safeMinutes,
        sessionId: sessionIdRef.current,
      },
    });

    if (data?.success) {
      setTotalMinutes(data.totalMinutes);

      // For frozen users: only show popup when server explicitly says to (once ever)
      // For normal users: show popup on first cap_reached per partner
      if (data.message === "cap_reached" && !capReachedRef.current) {
        capReachedRef.current = true;
        setCapReached(true);
        setCapInfo({ cap: data.cap, isVip: data.isVip });
        // Only show the popup if server says so (frozen users: once ever; normal: first time)
        if (data.showCapPopup) {
          setShowCapPopup(true);
        }
      }

      // Server tells us to show the one-time cap popup (first time reaching total cap)
      if (data.showCapPopup && !data.message?.includes("cap_reached") && !capReachedRef.current) {
        setCapInfo({ cap: data.cap, isVip: data.isVip });
        setShowCapPopup(true);
      }
    }
  }, [userId]);

  // Timer: track elapsed seconds while connected
  useEffect(() => {
    if (isConnected && !capReachedRef.current) {
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsedSeconds(elapsedRef.current);

        // Report every 60 seconds (1 minute earned)
        const totalMinutesElapsed = Math.floor(elapsedRef.current / 60);
        if (totalMinutesElapsed > lastReportedRef.current) {
          const newMinutes = totalMinutesElapsed - lastReportedRef.current;
          lastReportedRef.current = totalMinutesElapsed;
          reportMinutes(newMinutes);
        }
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isConnected, reportMinutes]);

  // Report remaining minutes when disconnecting
  const flushMinutes = useCallback(async () => {
    const totalMinutesElapsed = Math.floor(elapsedRef.current / 60);
    const unreported = totalMinutesElapsed - lastReportedRef.current;
    if (unreported > 0) {
      lastReportedRef.current = totalMinutesElapsed;
      await reportMinutes(unreported);
    }
  }, [reportMinutes]);

  const dismissCapPopup = useCallback(() => {
    setShowCapPopup(false);
  }, []);

  return {
    totalMinutes,
    elapsedSeconds,
    capReached,
    capInfo,
    showCapPopup,
    dismissCapPopup,
    flushMinutes,
    freezeInfo,
    refreshBalance: fetchBalance,
  };
}
