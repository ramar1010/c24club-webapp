import { useEffect, useRef, useState, RefObject } from "react";

interface UseLocalFaceCheckOptions {
  localVideoRef: RefObject<HTMLVideoElement>;
  isActive: boolean;
  /** Seconds with no face before the warning fires */
  graceSeconds?: number;
  /** How often to sample the local video (ms) */
  checkIntervalMs?: number;
}

/**
 * Anti-flasher local face gate.
 * Samples the local video every checkIntervalMs and checks for a human face.
 * If no face is detected for >= graceSeconds, `noFaceWarning` flips to true.
 *
 * Strategy:
 *  1. Prefer the native FaceDetector (Shape Detection API) — Android Chrome.
 *  2. Fallback: skin-tone heuristic on the canvas — works on iOS Safari,
 *     Firefox, and every other browser. Catches ceiling/floor/lens-cover
 *     because none of those frames contain enough skin-colored pixels.
 */
export function useLocalFaceCheck({
  localVideoRef,
  isActive,
  graceSeconds = 5,
  checkIntervalMs = 1500,
}: UseLocalFaceCheckOptions) {
  const [noFaceWarning, setNoFaceWarning] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const detectorRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastFaceAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!isActive) {
      setNoFaceWarning(false);
      lastFaceAtRef.current = Date.now();
      return;
    }

    const FaceDetectorCtor = (globalThis as any).FaceDetector;
    let useNativeDetector = false;
    if (FaceDetectorCtor) {
      try {
        detectorRef.current = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 1 });
        useNativeDetector = true;
        setSupported(true);
      } catch {
        useNativeDetector = false;
      }
    }
    if (!useNativeDetector) {
      // Skin-tone fallback is universally supported.
      setSupported(true);
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
      canvasRef.current.width = 160;
      canvasRef.current.height = 120;
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    lastFaceAtRef.current = Date.now();

    // Skin-tone heuristic: returns true if enough pixels look like human skin.
    // Uses a lenient YCbCr range that matches a wide variety of skin tones.
    const hasEnoughSkin = (): boolean => {
      try {
        ctx.drawImage(video!, 0, 0, canvas.width, canvas.height);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let skin = 0;
        const total = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          // YCbCr conversion
          const y = 0.299 * r + 0.587 * g + 0.114 * b;
          const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
          const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
          if (y > 40 && cb >= 77 && cb <= 135 && cr >= 133 && cr <= 180) {
            skin++;
          }
        }
        const ratio = skin / total;
        return ratio >= 0.03; // at least 3% skin pixels = a face/hand is visible
      } catch {
        return true; // on read errors, don't false-trigger the warning
      }
    };

    let video: HTMLVideoElement | null = null;

    const interval = setInterval(async () => {
      video = localVideoRef.current;
      if (!video || video.readyState < 2) return;

      let facePresent = false;
      try {
        if (useNativeDetector && detectorRef.current) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const faces = await detectorRef.current.detect(canvas);
          facePresent = !!(faces && faces.length > 0);
          // If FaceDetector says no face, double-check with skin heuristic
          // to avoid being too strict on profile/side views.
          if (!facePresent) facePresent = hasEnoughSkin();
        } else {
          facePresent = hasEnoughSkin();
        }
      } catch {
        return;
      }

      if (facePresent) {
        lastFaceAtRef.current = Date.now();
        if (noFaceWarning) setNoFaceWarning(false);
      } else {
        const elapsed = (Date.now() - lastFaceAtRef.current) / 1000;
        if (elapsed >= graceSeconds && !noFaceWarning) {
          setNoFaceWarning(true);
        }
      }
    }, checkIntervalMs);

    return () => clearInterval(interval);
  }, [isActive, localVideoRef, graceSeconds, checkIntervalMs, noFaceWarning]);

  return { noFaceWarning, faceDetectorSupported: supported };
}