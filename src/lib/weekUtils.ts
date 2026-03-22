/**
 * Returns the ISO date string (YYYY-MM-DD) of the Monday starting the current week.
 */
export function getCurrentWeekStart(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - diff);
  return monday.toISOString().slice(0, 10);
}

/**
 * Checks if a localStorage key belongs to the current week.
 * If stale, clears it and returns true (was reset).
 */
export function resetIfStaleWeek(storageKey: string): boolean {
  const weekKey = `${storageKey}__week`;
  const currentWeek = getCurrentWeekStart();
  const savedWeek = localStorage.getItem(weekKey);

  if (savedWeek && savedWeek === currentWeek) return false;

  // Week changed — clear the progress
  localStorage.removeItem(storageKey);
  localStorage.setItem(weekKey, currentWeek);
  return true;
}

/**
 * Stamps the current week on a localStorage key (call when setting progress).
 */
export function stampWeek(storageKey: string): void {
  localStorage.setItem(`${storageKey}__week`, getCurrentWeekStart());
}
