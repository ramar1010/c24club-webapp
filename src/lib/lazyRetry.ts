import { lazy, type ComponentType } from "react";

// If a page file can't load (usually because a newer version was published),
// reload the page once to fetch the latest files instead of a blank screen.
export function lazyRetry<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      const key = "c24-chunk-reload-at";
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last > 10_000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
