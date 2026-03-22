import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { resetIfStaleWeek, stampWeek } from "@/lib/weekUtils";
import { toast } from "sonner";

interface SpeedConnectConfig {
  challengeId: string;
  slug: string;
  targetPeople: number;
  timeLimitMinutes: number;
}

interface UseSpeedConnectOptions {
  userId: string | undefined;
  currentPartnerId: string | null;
  isConnected: boolean;
  challengeConfig: SpeedConnectConfig | null;
}

export function useSpeedConnectChallenge({ userId, currentPartnerId, isConnected, challengeConfig }: UseSpeedConnectOptions) {
  const queryClient = useQueryClient();
  const [uniqueCount, setUniqueCount] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [completed, setCompleted] = useState(false);
  const partnersRef = useRef<Set<string>>(new Set());
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const submittedRef = useRef(false);

  // Load state from localStorage on mount
  useEffect(() => {
    if (!challengeConfig) return;
    const key = `speed_connect_${challengeConfig.slug}`;
    // Reset if we're in a new week
    if (resetIfStaleWeek(key)) return;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const elapsed = (Date.now() - parsed.startTime) / 1000 / 60;
        if (elapsed < challengeConfig.timeLimitMinutes) {
          partnersRef.current = new Set(parsed.partners);
          startTimeRef.current = parsed.startTime;
          setUniqueCount(parsed.partners.length);
          setIsActive(true);
        } else {
          // Expired — clear
          localStorage.removeItem(key);
        }
      } catch { /* ignore */ }
    }
  }, [challengeConfig]);

  // Timer countdown
  useEffect(() => {
    if (!isActive || !startTimeRef.current || !challengeConfig) return;
    
    const tick = () => {
      const elapsed = (Date.now() - startTimeRef.current!) / 1000;
      const totalSeconds = challengeConfig.timeLimitMinutes * 60;
      const remaining = Math.max(0, totalSeconds - elapsed);
      setTimeLeft(Math.ceil(remaining));
      
      if (remaining <= 0) {
        // Time's up — reset
        setIsActive(false);
        partnersRef.current.clear();
        startTimeRef.current = null;
        setUniqueCount(0);
        localStorage.removeItem(`speed_connect_${challengeConfig.slug}`);
        toast.error("⏰ Time's up! Challenge reset.");
      }
    };
    
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive, challengeConfig]);

  // Track new partners
  useEffect(() => {
    if (!isActive || !currentPartnerId || !isConnected || !challengeConfig || completed || submittedRef.current) return;
    
    if (!partnersRef.current.has(currentPartnerId)) {
      partnersRef.current.add(currentPartnerId);
      const count = partnersRef.current.size;
      setUniqueCount(count);
      
      // Save to localStorage
      localStorage.setItem(`speed_connect_${challengeConfig.slug}`, JSON.stringify({
        startTime: startTimeRef.current,
        partners: Array.from(partnersRef.current),
      }));
      
      // Check completion
      if (count >= challengeConfig.targetPeople) {
        setCompleted(true);
        autoSubmit(challengeConfig);
      }
    }
  }, [currentPartnerId, isConnected, isActive, challengeConfig, completed]);

  const autoSubmit = useCallback(async (config: SpeedConnectConfig) => {
    if (!userId || submittedRef.current) return;
    submittedRef.current = true;
    
    const { error } = await supabase.from("challenge_submissions").insert({
      user_id: userId,
      challenge_id: config.challengeId,
      proof_text: `Auto-completed: Connected to ${config.targetPeople} unique people within ${config.timeLimitMinutes} minutes.`,
      status: "pending",
    });
    
    if (!error) {
      toast.success("🎉 Speed Connect Challenge completed! Submitted for review.");
      localStorage.removeItem(`speed_connect_${config.slug}`);
      queryClient.invalidateQueries({ queryKey: ["my_challenge_submissions"] });
      queryClient.invalidateQueries({ queryKey: ["challenge_submissions_carousel"] });
    }
  }, [userId, queryClient]);

  const startChallenge = useCallback(() => {
    if (!challengeConfig) return;
    partnersRef.current.clear();
    startTimeRef.current = Date.now();
    setUniqueCount(0);
    setIsActive(true);
    setCompleted(false);
    submittedRef.current = false;
    
    localStorage.setItem(`speed_connect_${challengeConfig.slug}`, JSON.stringify({
      startTime: Date.now(),
      partners: [],
    }));
    
    toast.success(`⚡ ${challengeConfig.slug} activated!`, {
      description: `Connect to ${challengeConfig.targetPeople} people in ${challengeConfig.timeLimitMinutes} min!`,
    });
  }, [challengeConfig]);

  return { uniqueCount, isActive, completed, timeLeft, startChallenge };
}
