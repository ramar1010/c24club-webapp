import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UseWelcomeBonusOptions {
  userId: string;
  isConnected: boolean;
  elapsedSeconds: number;
  onAwarded?: (bonus: number, callNumber: number) => void;
}

/**
 * Awards a first-call welcome bonus (50 / 25 / 10 minutes) once a connected
 * call passes 30 seconds. Only fires once per call session and stops trying
 * once the user has exhausted all 3 bonuses.
 */
export function useWelcomeBonus({ userId, isConnected, elapsedSeconds, onAwarded }: UseWelcomeBonusOptions) {
  const claimedThisCallRef = useRef(false);
  const exhaustedRef = useRef(false);

  // Reset per-call flag when call ends / new call starts
  useEffect(() => {
    if (!isConnected) {
      claimedThisCallRef.current = false;
    }
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected) return;
    if (!userId || userId === "anonymous") return;
    if (claimedThisCallRef.current || exhaustedRef.current) return;
    if (elapsedSeconds < 30) return;

    claimedThisCallRef.current = true;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("earn-minutes", {
          body: { type: "claim_welcome_bonus", userId },
        });
        if (data?.success && data.bonus > 0) {
          toast.success(`🎉 +${data.bonus} Welcome Bonus!`, {
            description:
              data.callNumber === 1
                ? "Your first call! Keep chatting to earn more 💖"
                : data.callNumber === 2
                ? "Bonus #2 unlocked — one more left!"
                : "Final welcome bonus claimed 🎁",
            duration: 6000,
          });
          onAwarded?.(data.bonus, data.callNumber);
        } else if (data?.reason === "exhausted") {
          exhaustedRef.current = true;
        }
      } catch {
        // Silent — don't disrupt the call
      }
    })();
  }, [isConnected, elapsedSeconds, userId, onAwarded]);
}