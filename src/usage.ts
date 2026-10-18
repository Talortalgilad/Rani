import { getState, saveState } from './storage';
import { today } from './math/adaptive';

/** After the limit is hit mid-round we wait for a calm moment, but no longer than this. */
const GRACE_MS = 90_000;

function usage() {
  const s = getState();
  if (s.usage.date !== today()) s.usage = { date: today(), minutes: 0, extraMin: 0 };
  return s.usage;
}

export function allowedMinutes(): number | null {
  const lim = getState().settings.dailyLimitMin;
  return lim === null ? null : lim + usage().extraMin;
}

export function playedMinutes(): number {
  return usage().minutes;
}

export function isTimeUp(): boolean {
  const a = allowedMinutes();
  return a !== null && usage().minutes >= a;
}

export function addExtraMinutes(n: number): void {
  usage().extraMin += n;
  saveState();
}

interface Hooks {
  /** True while the child is in the gate or a game. */
  active(): boolean;
  /** True when a friendly screen can appear without cutting off a move. */
  canInterrupt(): boolean;
  onTimeUp(): void;
}

/** Counts foreground play time once a second and fires onTimeUp once per time-out. */
export function trackUsage(h: Hooks): void {
  let pendingSince: number | null = null;
  let shown = false;
  let ticks = 0;
  window.setInterval(() => {
    if (document.hidden || !h.active()) return;
    usage().minutes += 1 / 60;
    if (++ticks % 5 === 0) saveState();
    if (!isTimeUp()) {
      pendingSince = null;
      shown = false;
      return;
    }
    if (shown) return;
    pendingSince ??= Date.now();
    if (h.canInterrupt() || Date.now() - pendingSince > GRACE_MS) {
      shown = true;
      saveState();
      h.onTimeUp();
    }
  }, 1000);
}
