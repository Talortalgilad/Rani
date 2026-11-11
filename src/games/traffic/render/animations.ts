import { clamp } from '../../../lobby3d/motion';

/** Easing and a tiny timeline, so every movement in the game is a few lines. */

export const easeInQuad = (t: number): number => clamp(t, 0, 1) ** 2;
export const easeOutQuad = (t: number): number => 1 - (1 - clamp(t, 0, 1)) ** 2;
export const easeInOutCubic = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
};
export const easeOutBack = (t: number): number => {
  const x = clamp(t, 0, 1) - 1;
  return 1 + 2.70158 * x ** 3 + 1.70158 * x ** 2;
};

/** Something that moves for a while: returns true when finished. */
export type Anim = (dt: number) => boolean;

export class Timeline {
  private anims: Anim[] = [];
  private waits: { left: number; fn: () => void }[] = [];

  add(a: Anim): void {
    this.anims.push(a);
  }

  /** `duration` seconds of progress 0..1, then `done`. */
  tween(duration: number, step: (t: number) => void, done?: () => void): void {
    let t = 0;
    this.add((dt) => {
      t += dt / Math.max(0.0001, duration);
      step(Math.min(1, t));
      if (t >= 1) {
        done?.();
        return true;
      }
      return false;
    });
  }

  after(seconds: number, fn: () => void): void {
    this.waits.push({ left: seconds, fn });
  }

  get busy(): boolean {
    return this.anims.length > 0 || this.waits.length > 0;
  }

  update(dt: number): void {
    // animations may add new ones from their own "done" callbacks: run a snapshot and keep what was added meanwhile
    const run = this.anims;
    this.anims = [];
    const keep = run.filter((a) => !a(dt));
    this.anims = keep.concat(this.anims);
    const due = this.waits.filter((w) => (w.left -= dt) <= 0);
    this.waits = this.waits.filter((w) => w.left > 0);
    due.forEach((w) => w.fn());
  }

  clear(): void {
    this.anims = [];
    this.waits = [];
  }
}
