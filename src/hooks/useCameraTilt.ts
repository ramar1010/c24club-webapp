import { useEffect, useState } from "react";

interface UseCameraTiltOptions {
  isActive: boolean;
  /** Upper beta bound — above this the phone is upright (safe). */
  uprightMinBeta?: number;
  /** Lower beta bound — below this the phone is flipped backwards (safe-ish, ignore). */
  downwardMinBeta?: number;
  /** Sustained seconds before warning fires. */
  sustainedSeconds?: number;
}

/**
 * Detects when a mobile user tilts their device so the rear/front camera is
 * pointed downward at their body — a common flasher pattern. Uses the
 * DeviceOrientation API; gracefully no-ops on desktop / unsupported devices.
 *
 * `beta` semantics (degrees):
 *   ~ 90  = phone held upright, screen facing user (NORMAL)
 *   ~ 0   = phone lying flat (screen up OR down — ambiguous, IGNORE)
 *   ~ -45 = phone tilted forward, top edge away from user, camera angled
 *           down toward lap (SUSPICIOUS — fire warning)
 *   ~-180 = phone upside down
 *
 * We only warn in the suspicious window: downwardMinBeta < beta < uprightMinBeta
 * Default: -60° < beta < 10°  (skip the flat-on-table zone too).
 */
export function useCameraTilt({
  isActive,
  uprightMinBeta = 10,
  downwardMinBeta = -60,
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

      // Only suspicious when tilted forward (camera aimed at body),
      // NOT when upright (beta>=upright) and NOT when laying flat / face-up
      // on a table (beta near 0 ambiguous — require beta below upright AND
      // above the flipped-backwards floor).
      const isSuspicious = beta < uprightMinBeta && beta > downwardMinBeta;
      if (isSuspicious) {
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
  }, [isActive, uprightMinBeta, downwardMinBeta, sustainedSeconds, tiltWarning]);

  return { tiltWarning };
}