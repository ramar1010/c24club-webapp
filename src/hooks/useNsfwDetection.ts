import { useEffect, useRef, useState, RefObject, useCallback } from "react";
import * as nsfwjs from "nsfwjs";
import * as tf from "@tensorflow/tfjs";

interface UseNsfwDetectionOptions {
  remoteVideoRef: RefObject<HTMLVideoElement>;
  isConnected: boolean;
  checkIntervalMs?: number;
  nudityThreshold?: number;
  maxStrikes?: number;
}

/**
 * Uses nsfwjs to detect nudity on the remote video stream.
 * Blurs the video when nudity is detected.
 * After `maxStrikes` detections at 80%+ nudity, triggers a ban.
 */
export function useNsfwDetection({
  remoteVideoRef,
  isConnected,
  checkIntervalMs = 5000,
  nudityThreshold = 0.8,
  maxStrikes = 5,
}: UseNsfwDetectionOptions) {
  const [isNsfwBlurred, setIsNsfwBlurred] = useState(false);
  const [nsfwStrikes, setNsfwStrikes] = useState(0);
  const [shouldBan, setShouldBan] = useState(false);
  const modelRef = useRef<nsfwjs.NSFWJS | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadingRef = useRef(false);

  // Load model once
  useEffect(() => {
    if (loadingRef.current || modelRef.current) return;
    loadingRef.current = true;

    // Use mobilenet v2 mid for balance of speed/accuracy
    tf.ready().then(() => {
      return nsfwjs.load();
    }).then((model) => {
      modelRef.current = model;
      console.log("[NSFW] Model loaded");
    }).catch((err) => {
      console.error("[NSFW] Failed to load model:", err);
      loadingRef.current = false;
    });
  }, []);

  // Reset state when disconnected
  useEffect(() => {
    if (!isConnected) {
      setIsNsfwBlurred(false);
    }
  }, [isConnected]);

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

        // Check for Porn or Sexy classes
        const pornScore = predictions.find((p) => p.className === "Porn")?.probability ?? 0;
        const sexyScore = predictions.find((p) => p.className === "Sexy")?.probability ?? 0;
        const nudityScore = Math.max(pornScore, sexyScore);

        if (nudityScore >= nudityThreshold) {
          setIsNsfwBlurred(true);
          setNsfwStrikes((prev) => {
            const next = prev + 1;
            console.log(`[NSFW] Strike ${next}/${maxStrikes} — nudity: ${(nudityScore * 100).toFixed(1)}%`);
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
  }, [isConnected, checkIntervalMs, nudityThreshold, maxStrikes, remoteVideoRef]);

  const resetStrikes = useCallback(() => {
    setNsfwStrikes(0);
    setShouldBan(false);
    setIsNsfwBlurred(false);
  }, []);

  return { isNsfwBlurred, nsfwStrikes, shouldBan, resetStrikes };
}
