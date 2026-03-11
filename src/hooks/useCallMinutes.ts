import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseCallMinutesOptions {
  userId: string;
  partnerId: string | null;
  isConnected: boolean;
}

interface CapInfo {
  cap: number;
  isVip: boolean;
}

export function useCallMinutes({ userId, partnerId, isConnected }: UseCallMinutesOptions) {
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [capReached, setCapReached] = useState(false);
  const [capInfo, setCapInfo] = useState<CapInfo | null>(null);
  const [showCapPopup, setShowCapPopup] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const lastReportedRef = useRef(0);
  const partnerIdRef = useRef(partnerId);
  const capReachedRef = useRef(false);

  // Keep refs in sync
  useEffect(() => {
    partnerIdRef.current = partnerId;
  }, [partnerId]);

  // Fetch initial balance
  useEffect(() => {
    if (!userId || userId === "anonymous") return;

    supabase.functions
      .invoke("earn-minutes", {
        body: { type: "get_balance", userId },
      })
      .then(({ data }) => {
        if (data?.success) {
          setTotalMinutes(data.totalMinutes);
        }
      });
  }, [userId]);

  // Reset when partner changes
  useEffect(() => {
    elapsedRef.current = 0;
    lastReportedRef.current = 0;
    setElapsedSeconds(0);
    setCapReached(false);
    capReachedRef.current = false;
    setShowCapPopup(false);
  }, [partnerId]);

  // Report earned minutes to the server
  const reportMinutes = useCallback(async (minutes: number) => {
    const pid = partnerIdRef.current;
    if (!pid || !userId || userId === "anonymous" || minutes <= 0) return;

    const { data } = await supabase.functions.invoke("earn-minutes", {
      body: {
        type: "earn",
        userId,
        partnerId: pid,
        minutesEarned: minutes,
      },
    });

    if (data?.success) {
      setTotalMinutes(data.totalMinutes);

      if (data.message === "cap_reached" && !capReachedRef.current) {
        capReachedRef.current = true;
        setCapReached(true);
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
    capReached,
    capInfo,
    showCapPopup,
    dismissCapPopup,
    flushMinutes,
    callDuration: elapsedRef,
  };
}
