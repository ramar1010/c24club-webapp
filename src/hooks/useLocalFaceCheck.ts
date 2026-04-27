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
 * If no face is detected for >= graceSeconds, `noFaceWarning` flips to true so
 * we can blur the local preview and warn the user to show their face.
 *
 * Uses the browser-native FaceDetector (Shape Detection API) where available
 * (Chrome/Edge on Android, Chrome on most desktop). Gracefully no-ops elsewhere.
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
    if (!FaceDetectorCtor) {
      setSupported(false);
      return; // browser doesn't support Shape Detection API
    }
    setSupported(true);

    try {
      detectorRef.current = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 1 });
    } catch {
      setSupported(false);
      return;
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
      canvasRef.current.width = 320;
      canvasRef.current.height = 240;
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    lastFaceAtRef.current = Date.now();

    const interval = setInterval(async () => {
      const video = localVideoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector || video.readyState < 2) return;

      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const faces = await detector.detect(canvas);
        if (faces && faces.length > 0) {
          lastFaceAtRef.current = Date.now();
          if (noFaceWarning) setNoFaceWarning(false);
        } else {
          const elapsed = (Date.now() - lastFaceAtRef.current) / 1000;
          if (elapsed >= graceSeconds && !noFaceWarning) {
            setNoFaceWarning(true);
          }
        }
      } catch {
        // Ignore individual frame errors
      }
    }, checkIntervalMs);

    return () => clearInterval(interval);
  }, [isActive, localVideoRef, graceSeconds, checkIntervalMs, noFaceWarning]);

  return { noFaceWarning, faceDetectorSupported: supported };
}