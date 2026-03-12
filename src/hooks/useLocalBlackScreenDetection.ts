import { useEffect, useRef, useState, RefObject } from "react";

interface UseLocalBlackScreenDetectionOptions {
  localVideoRef: RefObject<HTMLVideoElement>;
  isActive: boolean;
  checkIntervalMs?: number;
  brightnessThreshold?: number;
  consecutiveChecks?: number;
}

/**
 * Detects if the LOCAL user's own camera is producing a black screen.
 * Used to warn them that their camera appears off/covered.
 */
export function useLocalBlackScreenDetection({
  localVideoRef,
  isActive,
  checkIntervalMs = 5000,
  brightnessThreshold = 10,
  consecutiveChecks = 2,
}: UseLocalBlackScreenDetectionOptions) {
  const [localBlackScreen, setLocalBlackScreen] = useState(false);
  const blackCountRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isActive) {
      blackCountRef.current = 0;
      setLocalBlackScreen(false);
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
      const video = localVideoRef.current;
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
          setLocalBlackScreen(true);
        }
      } else {
        blackCountRef.current = 0;
        setLocalBlackScreen(false);
      }
    }, checkIntervalMs);

    return () => clearInterval(interval);
  }, [isActive, checkIntervalMs, brightnessThreshold, consecutiveChecks, localVideoRef]);

  return { localBlackScreen };
}
