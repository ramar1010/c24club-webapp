import { useEffect, useState } from "react";

interface UseCameraTiltOptions {
  isActive: boolean;
  /** Beta tilt threshold (degrees) before considered "pointed downward". */
  tiltThreshold?: number;
  /** Sustained seconds before warning fires. */
  sustainedSeconds?: number;
}

/**
 * Detects when a mobile user tilts their device far downward — a common
 * pattern for flashers pointing the camera at their crotch. Uses the
 * DeviceOrientation API; gracefully no-ops on desktop / unsupported devices.
 *
 * `beta` ranges roughly -180 to 180; held upright facing the user it sits
 * around 60-90. Below ~20 means the phone is being held flat or tilted down.
 */
export function useCameraTilt({
  isActive,
  tiltThreshold = 25,
  sustainedSeconds = 3,
}: UseCameraTiltOptions) {
  const [tiltWarning, setTiltWarning] = useState(false);

  useEffect(() => {
    if (!isActive || typeof window === "undefined") {
      setTiltWarning(false);
      return;
    }
    if (!("DeviceOrientationEvent" in window)) return;

    let downSinceMs: number | null = null;
    let raf = 0;

    const onOrient = (e: DeviceOrientationEvent) => {
      const beta = typeof e.beta === "number" ? e.beta : null;
      if (beta === null) return;

      // beta < tiltThreshold = phone is flat or pointed downward
      if (beta < tiltThreshold) {
        if (downSinceMs === null) downSinceMs = Date.now();
        const elapsed = (Date.now() - downSinceMs) / 1000;
        if (elapsed >= sustainedSeconds) {
          if (!tiltWarning) {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => setTiltWarning(true));
          }
        }
      } else {
        downSinceMs = null;
        if (tiltWarning) {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => setTiltWarning(false));
        }
      }
    };

    window.addEventListener("deviceorientation", onOrient);
    return () => {
      window.removeEventListener("deviceorientation", onOrient);
      cancelAnimationFrame(raf);
    };
  }, [isActive, tiltThreshold, sustainedSeconds, tiltWarning]);

  return { tiltWarning };
}