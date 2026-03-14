import { useEffect, useRef, useState, RefObject, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseNsfwDetectionOptions {
  remoteVideoRef: RefObject<HTMLVideoElement>;
  isConnected: boolean;
  userId: string;
  checkIntervalMs?: number;
  nudityThreshold?: number;
  maxStrikes?: number;
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
  checkIntervalMs = 5000,
  nudityThreshold = 0.8,
  maxStrikes = 5,
}: UseNsfwDetectionOptions) {
  const [isNsfwBlurred, setIsNsfwBlurred] = useState(false);
  const [nsfwStrikes, setNsfwStrikes] = useState(0);
  const [shouldBan, setShouldBan] = useState(false);
  const modelRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadingRef = useRef(false);
  const loadedUserIdRef = useRef<string | null>(null);

  // Load persisted strikes whenever the monitored user changes
  useEffect(() => {
    if (!userId || userId === "anonymous") {
      loadedUserIdRef.current = null;
      setNsfwStrikes(0);
      setShouldBan(false);
      setIsNsfwBlurred(false);
      return;
    }

    if (loadedUserIdRef.current !== userId) {
      setNsfwStrikes(0);
      setShouldBan(false);
      setIsNsfwBlurred(false);
    }

    let isMounted = true;
    loadedUserIdRef.current = userId;

    supabase
      .from("member_minutes")
      .select("nsfw_strikes")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!isMounted || loadedUserIdRef.current !== userId) return;
        if (error) {
          console.warn("[NSFW] Failed to load strikes:", error.message);
          return;
        }

        const strikesValue = Number((data as any)?.nsfw_strikes ?? 0);
        const strikes = Number.isFinite(strikesValue) ? strikesValue : 0;
        setNsfwStrikes(strikes);
        setShouldBan(strikes >= maxStrikes);
      });

    return () => {
      isMounted = false;
    };
  }, [userId, maxStrikes]);

  // Load nsfwjs model dynamically
  useEffect(() => {
    if (loadingRef.current || modelRef.current) return;
    loadingRef.current = true;

    (async () => {
      try {
        const tf = await import("@tensorflow/tfjs");
        await tf.ready();
        const nsfwjs = await import("nsfwjs");
        const model = await nsfwjs.load();
        modelRef.current = model;
        console.log("[NSFW] Model loaded");
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
      if (!userId || userId === "anonymous") return;
      const { error } = await supabase
        .from("member_minutes")
        .update({ nsfw_strikes: newCount } as any)
        .eq("user_id", userId);

      if (error) {
        console.warn("[NSFW] Failed to persist strikes:", error.message);
      }
    },
    [userId]
  );

  // Periodic detection
  useEffect(() => {
    if (!isConnected) return;

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

        const pornScore =
          predictions.find((p: any) => p.className === "Porn")?.probability ?? 0;
        const sexyScore =
          predictions.find((p: any) => p.className === "Sexy")?.probability ?? 0;
        const nudityScore = Math.max(pornScore, sexyScore);

        if (nudityScore >= nudityThreshold) {
          setIsNsfwBlurred(true);
          setNsfwStrikes((prev) => {
            const next = prev + 1;
            console.log(
              `[NSFW] Strike ${next}/${maxStrikes} — nudity: ${(nudityScore * 100).toFixed(1)}%`
            );
            persistStrike(next);
            if (next >= maxStrikes) {
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
    remoteVideoRef,
    persistStrike,
  ]);

  const resetStrikes = useCallback(async () => {
    setNsfwStrikes(0);
    setShouldBan(false);
    setIsNsfwBlurred(false);
    await persistStrike(0);
  }, [persistStrike]);

  return { isNsfwBlurred, nsfwStrikes, shouldBan, resetStrikes };
}
