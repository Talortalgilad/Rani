/** Springs and easing, written by hand (no animation library). Pure: easy to test. */

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const easeOutCubic = (t: number): number => 1 - (1 - clamp(t, 0, 1)) ** 3;
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const x = clamp(t, 0, 1) - 1;
  return 1 + (c1 + 1) * x ** 3 + c1 * x ** 2;
};

/** Damped spring that chases `target`. Stepped in small slices so big frame gaps stay stable. */
export class Spring {
  velocity = 0;
  target: number;
  constructor(public value = 0, public stiffness = 120, public damping = 14) {
    this.target = value;
  }
  step(dt: number): number {
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
      this.velocity += a * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }
  /** Jump to the target at once (reduced motion). */
  snap(): void {
    this.value = this.target;
    this.velocity = 0;
  }
  get settled(): boolean {
    return Math.abs(this.value - this.target) < 1e-3 && Math.abs(this.velocity) < 1e-3;
  }
}

/** Squash & stretch for a hop. t in 0..1: crouch, stretch while rising, squash on landing, settle. */
export function squashStretch(t: number): { sx: number; sy: number; sz: number; lift: number } {
  const u = clamp(t, 0, 1);
  let sy = 1;
  let lift = 0;
  if (u < 0.2) sy = 1 - 0.22 * Math.sin((u / 0.2) * (Math.PI / 2));
  else if (u < 0.55) {
    const k = (u - 0.2) / 0.35;
    sy = 0.78 + 0.5 * Math.sin(k * Math.PI * 0.5) - 0.28 * k;
    lift = Math.sin(k * Math.PI);
  } else if (u < 0.75) {
    const k = (u - 0.55) / 0.2;
    sy = 0.84 - 0.12 * Math.sin(k * Math.PI);
  } else sy = 1 - 0.16 * (1 - easeOutBack((u - 0.75) / 0.25));
  const sx = 1 / Math.sqrt(sy); // keep the volume
  return { sx, sy, sz: sx, lift };
}
