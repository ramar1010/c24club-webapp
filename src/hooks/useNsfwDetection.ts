import { useEffect, useRef, useState, RefObject, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseNsfwDetectionOptions {
  remoteVideoRef: RefObject<HTMLVideoElement>;
  isConnected: boolean;
  userId: string;
  viewerUserId?: string;
  checkIntervalMs?: number;
  nudityThreshold?: number;
  maxStrikes?: number;
  strikeCooldownMs?: number;
  persistAcrossPartners?: boolean;
}

export function useNsfwDetection({
  remoteVideoRef,
  isConnected,
  userId,
  viewerUserId,
  checkIntervalMs = 3000,
  nudityThreshold = 0.75,
  maxStrikes = 3,
  strikeCooldownMs = 10000,
  persistAcrossPartners = true,
}: UseNsfwDetectionOptions) {
  const [isNsfwBlurred, setIsNsfwBlurred] = useState(false);
  const [nsfwStrikes, setNsfwStrikes] = useState(0);
  const [showConfirmPrompt, setShowConfirmPrompt] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const modelRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadingRef = useRef(false);
  const loadedUserIdRef = useRef<string | null>(null);
  const lastStrikeAtRef = useRef(0);
  const strikesRef = useRef(0);
  const lastValidTargetRef = useRef<string | null>(null);
  const pendingBanUserIdRef = useRef<string | null>(null);
  const viewerIdentity = viewerUserId && viewerUserId !== "anonymous" ? viewerUserId : authUserId;

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (isMounted) {
        setAuthUserId(data.user?.id ?? null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUserId(session?.user?.id ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const getValidatedTargetUserId = useCallback(() => {
    if (!userId || userId === "anonymous") return null;
    if (viewerIdentity && userId === viewerIdentity) return null;
    lastValidTargetRef.current = userId;
    return userId;
  }, [userId, viewerIdentity]);

  const getActionTargetUserId = useCallback(() => {
    return pendingBanUserIdRef.current || getValidatedTargetUserId() || lastValidTargetRef.current;
  }, [getValidatedTargetUserId]);

  // Load persisted strikes when monitored user changes
  useEffect(() => {
    const targetUserId = getValidatedTargetUserId();
    if (!targetUserId) {
      loadedUserIdRef.current = null;
      lastValidTargetRef.current = null;
      pendingBanUserIdRef.current = null;
      setShowConfirmPrompt(false);
      if (!persistAcrossPartners) {
        lastStrikeAtRef.current = 0;
        strikesRef.current = 0;
        setNsfwStrikes(0);
      }
      setIsNsfwBlurred(false);
      return;
    }

    if (loadedUserIdRef.current !== targetUserId && !persistAcrossPartners) {
      lastStrikeAtRef.current = 0;
      strikesRef.current = 0;
      pendingBanUserIdRef.current = null;
      setNsfwStrikes(0);
      setShowConfirmPrompt(false);
      setIsNsfwBlurred(false);
    }

    loadedUserIdRef.current = targetUserId;
    let isMounted = true;

    supabase
      .from("member_minutes")
      .select("nsfw_strikes")
      .eq("user_id", targetUserId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!isMounted || loadedUserIdRef.current !== targetUserId) return;
        if (error) return;

        const raw = Number((data as any)?.nsfw_strikes ?? 0);
        const strikes = Math.min(Math.max(0, Math.floor(raw)), maxStrikes);
        strikesRef.current = strikes;
        setNsfwStrikes(strikes);

        if (strikes >= maxStrikes) {
          pendingBanUserIdRef.current = targetUserId;
          setShowConfirmPrompt(true);
        } else if (pendingBanUserIdRef.current === targetUserId) {
          pendingBanUserIdRef.current = null;
        }
      });

    return () => {
      isMounted = false;
    };
  }, [getValidatedTargetUserId, maxStrikes, persistAcrossPartners]);

  // Load nsfwjs model
  useEffect(() => {
    if (loadingRef.current || modelRef.current) return;
    loadingRef.current = true;

    (async () => {
      try {
        const tf = await import("@tensorflow/tfjs");
        try {
          await tf.setBackend("cpu");
          await tf.ready();
        } catch {
          await tf.ready();
        }
        const nsfwjs = await import("nsfwjs");
        modelRef.current = await nsfwjs.load();
        console.log("[NSFW] Model loaded");
      } catch (err) {
        console.error("[NSFW] Failed to load model:", err);
        loadingRef.current = false;
      }
    })();
  }, []);

  // Reset blur when disconnected
  useEffect(() => {
    if (!isConnected) setIsNsfwBlurred(false);
  }, [isConnected]);

  // Persist strikes to DB
  const persistStrike = useCallback(
    async (newCount: number, targetUserIdOverride?: string | null) => {
      const targetUserId =
        targetUserIdOverride ||
        pendingBanUserIdRef.current ||
        getValidatedTargetUserId() ||
        lastValidTargetRef.current;

      if (!targetUserId) return;

      const safeCount = Math.min(maxStrikes, Math.max(0, Math.floor(newCount)));
      await supabase
        .from("member_minutes")
        .update({ nsfw_strikes: safeCount } as any)
        .eq("user_id", targetUserId);
    },
    [getValidatedTargetUserId, maxStrikes]
  );

  // Periodic detection
  useEffect(() => {
    if (!isConnected) return;
    const targetUserId = getValidatedTargetUserId();
    if (!targetUserId) {
      setIsNsfwBlurred(false);
      return;
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
      canvasRef.current.width = 224;
      canvasRef.current.height = 224;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const interval = setInterval(async () => {
      const video = remoteVideoRef.current;
      const model = modelRef.current;
      if (!video || !model || video.readyState < 2) return;

      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const predictions = await model.classify(canvas);
        const pornScore = predictions.find((p: any) => p.className === "Porn")?.probability ?? 0;
        const hentaiScore = predictions.find((p: any) => p.className === "Hentai")?.probability ?? 0;
        const sexyScore = predictions.find((p: any) => p.className === "Sexy")?.probability ?? 0;
        // Only Porn and Hentai trigger bans; Sexy alone has too many false positives
        const nudityScore = Math.max(pornScore, hentaiScore);

        if (nudityScore >= nudityThreshold) {
          setIsNsfwBlurred(true);
          lastValidTargetRef.current = targetUserId;

          const now = Date.now();
          if (strikesRef.current < maxStrikes && now - lastStrikeAtRef.current >= strikeCooldownMs) {
            lastStrikeAtRef.current = now;
            const next = Math.min(maxStrikes, strikesRef.current + 1);
            strikesRef.current = next;
            setNsfwStrikes(next);
            console.log(`[NSFW] Strike ${next}/${maxStrikes} — nudity: ${(nudityScore * 100).toFixed(1)}%`);
            void persistStrike(next, targetUserId);

            if (next >= maxStrikes) {
              pendingBanUserIdRef.current = targetUserId;
              console.log("[NSFW] Showing confirm prompt for:", targetUserId);
              setShowConfirmPrompt(true);
            }
          }
        } else {
          setIsNsfwBlurred(false);
        }
      } catch (err) {
        console.warn("[NSFW] Classification error:", err);
      }
    }, checkIntervalMs);

    return () => clearInterval(interval);
  }, [
    isConnected,
    checkIntervalMs,
    nudityThreshold,
    maxStrikes,
    strikeCooldownMs,
    remoteVideoRef,
    persistStrike,
    getValidatedTargetUserId,
  ]);

  // Called when user clicks "Yes" — ban the target
  const confirmBan = useCallback(async () => {
    const targetUserId = getActionTargetUserId();
    if (!targetUserId) {
      console.error("[NSFW] No valid target user ID for ban");
      return;
    }

    const currentAuthUserId = viewerIdentity || (await supabase.auth.getUser()).data.user?.id || null;
    if (currentAuthUserId && targetUserId === currentAuthUserId) {
      console.warn("[NSFW] Refusing to ban current user; clearing stale NSFW target:", targetUserId);
      pendingBanUserIdRef.current = null;
      lastValidTargetRef.current = null;
      strikesRef.current = 0;
      setNsfwStrikes(0);
      setShowConfirmPrompt(false);
      setIsNsfwBlurred(false);
      return;
    }

    console.log("[NSFW] Banning user:", targetUserId);

    try {
      const { data, error } = await supabase.functions.invoke("nsfw-ban", { body: { targetUserId, banSource: "videocall" } });
      if (error) throw error;

      console.log("[NSFW] Ban request sent successfully", data);
      setShowConfirmPrompt(false);
      strikesRef.current = 0;
      setNsfwStrikes(0);
      setIsNsfwBlurred(false);
      pendingBanUserIdRef.current = null;
      lastValidTargetRef.current = null;
    } catch (err) {
      console.error("[NSFW] Ban failed:", err);
    }
  }, [getActionTargetUserId, viewerIdentity]);

  // Called when user clicks "No" — reset all strikes
  const dismissStrikes = useCallback(async () => {
    const targetUserId = getActionTargetUserId();
    lastStrikeAtRef.current = 0;
    strikesRef.current = 0;
    setNsfwStrikes(0);
    setShowConfirmPrompt(false);
    setIsNsfwBlurred(false);
    pendingBanUserIdRef.current = null;
    await persistStrike(0, targetUserId);
  }, [getActionTargetUserId, persistStrike]);

  return { isNsfwBlurred, nsfwStrikes, showConfirmPrompt, confirmBan, dismissStrikes };
}
