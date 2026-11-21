/** The numbers of the chase that the ⚙️ panel moves (stage 0: to find the feel with Rani). Units: a lane is 1 unit wide, a second is a second. */
export interface Tuning {
  /** units per second on a clear road */
  speed: number;
  /** how high a jump goes (units; a low obstacle is 0.55 high, a star in the air at 0.9) */
  jumpHeight: number;
  /** how long a jump takes (seconds) */
  jumpTime: number;
  /** how long it takes to move to the next lane (seconds) */
  laneTime: number;
  /** the share of the speed that is left in front of a gate (0.5 = half) */
  gateSlow: number;
  /** seconds between two gates (at the clear speed); under 13 gives five gates, 13 and more four */
  gateGap: number;
}

export const DEFAULT_TUNING: Tuning = { speed: 9, jumpHeight: 1.0, jumpTime: 0.7, laneTime: 0.16, gateSlow: 0.5, gateGap: 14.5 };

export interface Slider { key: keyof Tuning; label: string; min: number; max: number; step: number }
export const SLIDERS: Slider[] = [
  { key: 'speed', label: 'מהירות', min: 5, max: 16, step: 0.5 },
  { key: 'jumpHeight', label: 'גובה קפיצה', min: 0.6, max: 1.8, step: 0.05 },
  { key: 'jumpTime', label: 'משך קפיצה', min: 0.4, max: 1.2, step: 0.05 },
  { key: 'laneTime', label: 'זמן מעבר מסלול', min: 0.08, max: 0.4, step: 0.01 },
  { key: 'gateSlow', label: 'האטה לפני שער', min: 0.25, max: 1, step: 0.05 },
  { key: 'gateGap', label: 'מרחק בין שערים', min: 10, max: 18, step: 0.5 },
];

/** a saved or typed set of values, made safe (a missing or crazy number falls back to the default) */
export function cleanTuning(x: unknown): Tuning {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<Record<keyof Tuning, unknown>>;
  const t = { ...DEFAULT_TUNING };
  for (const s of SLIDERS) {
    const v = o[s.key];
    if (typeof v === 'number' && Number.isFinite(v)) t[s.key] = Math.min(s.max, Math.max(s.min, v));
  }
  return t;
}
