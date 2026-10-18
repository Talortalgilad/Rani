/** Short vibration where the browser supports it (Android Chrome; iOS Safari has no vibrate API). */
export function buzz(ms = 15): void {
  try {
    if ('vibrate' in navigator) navigator.vibrate(ms);
  } catch {
    /* ignore */
  }
}
