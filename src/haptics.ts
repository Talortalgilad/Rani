const android = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

/** Short vibration, Android only (iOS has no vibration API). */
export function buzz(ms = 15): void {
  try {
    if (android && 'vibrate' in navigator) navigator.vibrate(ms);
  } catch {
    /* ignore */
  }
}
