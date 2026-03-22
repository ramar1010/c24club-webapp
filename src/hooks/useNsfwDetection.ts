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
  checkIntervalMs = 5000,
  nudityThreshold = 0.85,
  maxStrikes = 3,
  strikeCooldownMs = 30000,
}: UseNsfwDetectionOptions) {
  const [isNsfwBlurred, setIsNsfwBlurred] = useState(false);
  const [nsfwStrikes, setNsfwStrikes] = useState(0);
  const [showConfirmPrompt, setShowConfirmPrompt] = useState(false);
  const modelRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadingRef = useRef(false);
  const loadedUserIdRef = useRef<string | null>(null);
  const lastStrikeAtRef = useRef(0);

  const getValidatedTargetUserId = useCallback(() => {
    if (!userId || userId === "anonymous") return null;
    if (viewerUserId && userId === viewerUserId) return null;
    return userId;
  }, [userId, viewerUserId]);

  // Load persisted strikes when monitored user changes
  useEffect(() => {
    const targetUserId = getValidatedTargetUserId();
    if (!targetUserId) {
      loadedUserIdRef.current = null;
      lastStrikeAtRef.current = 0;
      setNsfwStrikes(0);
      setShowConfirmPrompt(false);
      setIsNsfwBlurred(false);
      return;
    }
    if (loadedUserIdRef.current !== targetUserId) {
      lastStrikeAtRef.current = 0;
      setNsfwStrikes(0);
      setShowConfirmPrompt(false);
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
        if (error) return;
        const raw = Number((data as any)?.nsfw_strikes ?? 0);
        const strikes = Math.min(Math.max(0, Math.floor(raw)), maxStrikes);
        setNsfwStrikes(strikes);
        if (strikes >= maxStrikes) setShowConfirmPrompt(true);
      });

    return () => { isMounted = false; };
  }, [getValidatedTargetUserId, maxStrikes]);

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
  const persistStrike = useCallback(async (newCount: number) => {
    const targetUserId = getValidatedTargetUserId();
    if (!targetUserId) return;
    const safeCount = Math.min(maxStrikes, Math.max(0, Math.floor(newCount)));
    await supabase
      .from("member_minutes")
      .update({ nsfw_strikes: safeCount } as any)
      .eq("user_id", targetUserId);
  }, [getValidatedTargetUserId, maxStrikes]);

  // Periodic detection
  useEffect(() => {
    if (!isConnected) return;
    const targetUserId = getValidatedTargetUserId();
    if (!targetUserId) { setIsNsfwBlurred(false); return; }

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
        const nudityScore = Math.max(pornScore, hentaiScore);

        if (nudityScore >= nudityThreshold) {
          setIsNsfwBlurred(true);
          setNsfwStrikes((prev) => {
            if (prev >= maxStrikes) return maxStrikes;
            const now = Date.now();
            if (now - lastStrikeAtRef.current < strikeCooldownMs) return prev;
            lastStrikeAtRef.current = now;
            const next = Math.min(maxStrikes, prev + 1);
            console.log(`[NSFW] Strike ${next}/${maxStrikes} — nudity: ${(nudityScore * 100).toFixed(1)}%`);
            persistStrike(next);
            if (next >= maxStrikes) setShowConfirmPrompt(true);
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
  }, [isConnected, checkIntervalMs, nudityThreshold, maxStrikes, strikeCooldownMs, remoteVideoRef, persistStrike, getValidatedTargetUserId]);

  // Called when user clicks "Yes" — ban the target
  const confirmBan = useCallback(async () => {
    const targetUserId = getValidatedTargetUserId();
    if (!targetUserId) return;
    try {
      await supabase.functions.invoke("nsfw-ban", { body: { targetUserId } });
    } catch (err) {
      console.error("[NSFW] Ban failed:", err);
    }
    setShowConfirmPrompt(false);
    setNsfwStrikes(0);
    setIsNsfwBlurred(false);
  }, [getValidatedTargetUserId]);

  // Called when user clicks "No" — reset all strikes
  const dismissStrikes = useCallback(async () => {
    lastStrikeAtRef.current = 0;
    setNsfwStrikes(0);
    setShowConfirmPrompt(false);
    setIsNsfwBlurred(false);
    await persistStrike(0);
  }, [persistStrike]);

  return { isNsfwBlurred, nsfwStrikes, showConfirmPrompt, confirmBan, dismissStrikes };
}
