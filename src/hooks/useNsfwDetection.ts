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
}

/**
 * Uses nsfwjs to detect nudity on the remote video stream.
 * Blurs the video when nudity is detected.
 * Strikes persist in member_minutes.nsfw_strikes.
 * After `maxStrikes` at 80%+ nudity, triggers a ban.
 */
export function useNsfwDetection({
  remoteVideoRef,
  isConnected,
  userId,
  viewerUserId,
  checkIntervalMs = 5000,
  nudityThreshold = 0.8,
  maxStrikes = 5,
  strikeCooldownMs = 15000,
}: UseNsfwDetectionOptions) {
  const [isNsfwBlurred, setIsNsfwBlurred] = useState(false);
  const [nsfwStrikes, setNsfwStrikes] = useState(0);
  const [shouldBan, setShouldBan] = useState(false);
  const modelRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadingRef = useRef(false);
  const loadedUserIdRef = useRef<string | null>(null);
  const lastStrikeAtRef = useRef(0);
  const banTriggeredForUserRef = useRef<string | null>(null);

  const getValidatedTargetUserId = useCallback(() => {
    if (!userId || userId === "anonymous") return null;
    if (viewerUserId && userId === viewerUserId) return null;
    return userId;
  }, [userId, viewerUserId]);

  // Load persisted strikes whenever the monitored user changes
  useEffect(() => {
    const targetUserId = getValidatedTargetUserId();

    if (!targetUserId) {
      loadedUserIdRef.current = null;
      lastStrikeAtRef.current = 0;
      banTriggeredForUserRef.current = null;
      setNsfwStrikes(0);
      setShouldBan(false);
      setIsNsfwBlurred(false);
      return;
    }

    if (loadedUserIdRef.current !== targetUserId) {
      lastStrikeAtRef.current = 0;
      banTriggeredForUserRef.current = null;
      setNsfwStrikes(0);
      setShouldBan(false);
      setIsNsfwBlurred(false);
    }

    let isMounted = true;
    loadedUserIdRef.current = targetUserId;

    supabase
      .from("member_minutes")
      .select("nsfw_strikes")
      .eq("user_id", targetUserId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!isMounted || loadedUserIdRef.current !== targetUserId) return;
        if (error) {
          console.warn("[NSFW] Failed to load strikes:", error.message);
          return;
        }

        const rawValue = Number((data as any)?.nsfw_strikes ?? 0);
        const normalized = Number.isFinite(rawValue) ? Math.max(0, Math.floor(rawValue)) : 0;
        const strikes = Math.min(normalized, maxStrikes);

        setNsfwStrikes(strikes);
        setShouldBan(strikes >= maxStrikes);

        if (normalized > maxStrikes) {
          supabase
            .from("member_minutes")
            .update({ nsfw_strikes: maxStrikes } as any)
            .eq("user_id", targetUserId)
            .then(({ error: clampError }) => {
              if (clampError) {
                console.warn("[NSFW] Failed to clamp strikes:", clampError.message);
              }
            });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [getValidatedTargetUserId, maxStrikes]);

  // Load nsfwjs model dynamically
  useEffect(() => {
    if (loadingRef.current || modelRef.current) return;
    loadingRef.current = true;

    (async () => {
      try {
        const tf = await import("@tensorflow/tfjs");
        // Force CPU backend on desktop to avoid WebGL context conflicts
        try {
          await tf.setBackend("cpu");
          await tf.ready();
          console.log("[NSFW] TF backend:", tf.getBackend());
        } catch (backendErr) {
          console.warn("[NSFW] CPU backend failed, trying default:", backendErr);
          await tf.ready();
          console.log("[NSFW] TF fallback backend:", tf.getBackend());
        }
        const nsfwjs = await import("nsfwjs");
        const model = await nsfwjs.load();
        modelRef.current = model;
        console.log("[NSFW] Model loaded successfully");
      } catch (err) {
        console.error("[NSFW] Failed to load model:", err);
        loadingRef.current = false;
      }
    })();
  }, []);

  // Reset blur state when disconnected
  useEffect(() => {
    if (!isConnected) {
      setIsNsfwBlurred(false);
    }
  }, [isConnected]);

  // Persist a new strike count to the DB
  const persistStrike = useCallback(
    async (newCount: number) => {
      const targetUserId = getValidatedTargetUserId();
      if (!targetUserId) return;

      const safeCount = Math.min(maxStrikes, Math.max(0, Math.floor(newCount)));
      const { error } = await supabase
        .from("member_minutes")
        .update({ nsfw_strikes: safeCount } as any)
        .eq("user_id", targetUserId);

      if (error) {
        console.warn("[NSFW] Failed to persist strikes:", error.message);
      }
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

    let debugLogCount = 0;
    const interval = setInterval(async () => {
      const video = remoteVideoRef.current;
      const model = modelRef.current;

      if (debugLogCount < 3) {
        console.log(`[NSFW] Check — video: ${!!video}, model: ${!!model}, readyState: ${video?.readyState}, videoWidth: ${video?.videoWidth}, srcObject: ${!!video?.srcObject}`);
        debugLogCount++;
      }

      if (!video || !model || video.readyState < 2) return;

      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const predictions = await model.classify(canvas);

        const pornScore =
          predictions.find((p: any) => p.className === "Porn")?.probability ?? 0;
        const sexyScore =
          predictions.find((p: any) => p.className === "Sexy")?.probability ?? 0;
        const nudityScore = Math.max(pornScore, sexyScore);

        if (nudityScore >= nudityThreshold) {
          setIsNsfwBlurred(true);
          setNsfwStrikes((prev) => {
            if (prev >= maxStrikes) return maxStrikes;

            const now = Date.now();
            if (now - lastStrikeAtRef.current < strikeCooldownMs) {
              return prev;
            }

            lastStrikeAtRef.current = now;
            const next = Math.min(maxStrikes, prev + 1);

            console.log(
              `[NSFW] Strike ${next}/${maxStrikes} — nudity: ${(nudityScore * 100).toFixed(1)}%`
            );

            persistStrike(next);

            if (next >= maxStrikes && banTriggeredForUserRef.current !== targetUserId) {
              banTriggeredForUserRef.current = targetUserId;
              setShouldBan(true);
            }

            return next;
          });
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

  const resetStrikes = useCallback(async () => {
    lastStrikeAtRef.current = 0;
    banTriggeredForUserRef.current = null;
    setNsfwStrikes(0);
    setShouldBan(false);
    setIsNsfwBlurred(false);
    await persistStrike(0);
  }, [persistStrike]);

  return { isNsfwBlurred, nsfwStrikes, shouldBan, resetStrikes };
}
