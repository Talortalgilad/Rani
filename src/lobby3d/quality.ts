import type { AppState } from '../storage';

export type Tier = 'high' | 'medium' | '2d';
export type GraphicsPref = AppState['settings']['lobby'];

const ORDER: Tier[] = ['high', 'medium', '2d'];
let cachedGl: boolean | null = null;

export function webglSupported(): boolean {
  if (cachedGl !== null) return cachedGl;
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    cachedGl = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext(); // do not keep a second context alive just for the check
  } catch {
    cachedGl = false;
  }
  return cachedGl;
}

/** First tier of a session, from the parent's choice and what the device can do. */
export function initialTier(pref: GraphicsPref, hasWebgl = webglSupported(), lowEnd = isLowEnd()): Tier {
  if (pref === '2d' || !hasWebgl) return '2d';
  if (pref === '3d') return 'high';
  return lowEnd ? 'medium' : 'high';
}

function isLowEnd(): boolean {
  const n = navigator as Navigator & { deviceMemory?: number };
  return (n.hardwareConcurrency ?? 8) <= 4 || (n.deviceMemory ?? 8) <= 2;
}

export const lowerTier = (t: Tier): Tier => ORDER[Math.min(ORDER.indexOf(t) + 1, ORDER.length - 1)];

/** The session's current tier. It only ever goes down. */
let current: Tier = '2d';
let lastPref: GraphicsPref | null = null;
export const getTier = (): Tier => current;
/** Tier for this visit. Re-decided only when the parent changes the setting; a fall-back stays for the session. */
export function sessionTier(pref: GraphicsPref): Tier {
  if (lastPref !== pref) {
    lastPref = pref;
    current = initialTier(pref);
  }
  return current;
}
export function setTier(t: Tier): void {
  current = t;
}

export const FPS_FLOOR = 45;
export const SLOW_SECONDS = 3;

/** Watches frame times: if every one of 3 seconds in a row averages below 45 fps, it asks to go down a tier. */
export class QualityMonitor {
  private frames = 0;
  private elapsed = 0;
  private slowSeconds = 0;
  constructor(private onDowngrade: () => void) {}
  sample(dt: number): void {
    this.frames++;
    this.elapsed += dt;
    if (this.elapsed < 1) return;
    const fps = this.frames / this.elapsed;
    // small tolerance: a steady 45 fps must not read as 44.999 because of rounding
    this.slowSeconds = fps < FPS_FLOOR - 0.05 ? this.slowSeconds + 1 : 0;
    this.frames = 0;
    this.elapsed = 0;
    if (this.slowSeconds >= SLOW_SECONDS) {
      this.slowSeconds = 0;
      this.onDowngrade();
    }
  }
  reset(): void {
    this.frames = this.elapsed = this.slowSeconds = 0;
  }
}
