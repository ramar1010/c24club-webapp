import { useEffect, useState, useRef } from "react";

/**
 * Returns `isBlurred = true` for the first 5 seconds after each new connection.
 * Resets when disconnected or when partnerId changes.
 */
export function usePreBlur(isConnected: boolean, partnerId: string | null, durationMs = 5000) {
  const [isBlurred, setIsBlurred] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPartnerRef = useRef<string | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!isConnected || !partnerId) {
      setIsBlurred(false);
      lastPartnerRef.current = null;
      return;
    }

    // New partner connected
    if (partnerId !== lastPartnerRef.current) {
      lastPartnerRef.current = partnerId;
      setIsBlurred(true);

      timerRef.current = setTimeout(() => {
        setIsBlurred(false);
        timerRef.current = null;
      }, durationMs);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isConnected, partnerId, durationMs]);

  return { isBlurred };
}
