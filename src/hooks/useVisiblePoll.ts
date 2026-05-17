import { useEffect, useRef } from "react";

/**
 * Run `callback` every `intervalMs` while the tab is visible.
 * - Skips ticks when document.hidden (saves Cloud egress + battery)
 * - Fires immediately when the tab becomes visible again
 * - Optional `enabled` flag (default true) for conditional polling
 */
export function useVisiblePoll(
  callback: () => void,
  intervalMs: number,
  enabled: boolean = true,
) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      cbRef.current();
    };

    // Initial fire (only if visible)
    tick();

    const id = setInterval(tick, intervalMs);

    const onVis = () => {
      if (!document.hidden) cbRef.current();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [intervalMs, enabled]);
}
