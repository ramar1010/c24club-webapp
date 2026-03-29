import { useEffect, useRef, useState, RefObject } from "react";

interface UseBlackScreenDetectionOptions {
  remoteVideoRef: RefObject<HTMLVideoElement>;
  localStreamRef: RefObject<MediaStream | null>;
  isConnected: boolean;
  checkIntervalMs?: number;
  brightnessThreshold?: number;
  consecutiveChecks?: number;
}

/**
 * Detects if the partner's video is a black screen (camera off / covered).
 * When detected, disables the local video track so the partner also sees black.
 */
export function useBlackScreenDetection({
  remoteVideoRef,
  localStreamRef,
  isConnected,
  checkIntervalMs = 5000,
  brightnessThreshold = 10,
  consecutiveChecks = 2,
}: UseBlackScreenDetectionOptions) {
  const [partnerBlackScreen, setPartnerBlackScreen] = useState(false);
  const blackCountRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isConnected) {
      blackCountRef.current = 0;
      setPartnerBlackScreen(false);
      return;
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
      canvasRef.current.width = 64;
      canvasRef.current.height = 48;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const interval = setInterval(() => {
      const video = remoteVideoRef.current;
      if (!video || video.readyState < 2) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;

      let totalBrightness = 0;
      const pixelCount = pixels.length / 4;

      for (let i = 0; i < pixels.length; i += 4) {
        totalBrightness += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      }

      const avgBrightness = totalBrightness / pixelCount;

      if (avgBrightness < brightnessThreshold) {
        blackCountRef.current += 1;
        if (blackCountRef.current >= consecutiveChecks) {
          setPartnerBlackScreen(true);
        }
      } else {
        blackCountRef.current = 0;
        setPartnerBlackScreen(false);
      }
    }, checkIntervalMs);

    return () => clearInterval(interval);
  }, [isConnected, checkIntervalMs, brightnessThreshold, consecutiveChecks, remoteVideoRef]);

  // No longer disabling local video — the non-offender keeps their camera on.

  return { partnerBlackScreen };
}
