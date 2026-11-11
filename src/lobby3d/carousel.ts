import { clamp, Spring } from './motion';

/** Tap result: the centre island opens, a side island turns to the centre. */
export type TapResult = 'enter' | 'rotate';

const FLING = 2.2; // rad/s: a quicker flick than this skips to the next island
const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * The turning ring of islands, without any 3D in it (so it can be tested on its own).
 * Island i sits at angle i·step + rot. The island in front is the one with -rot/step closest to a whole number.
 */
export class Carousel {
  readonly step: number;
  readonly rot: Spring;
  /** Leaning toward the direction of movement while dragging (radians, small). */
  lean = 0;
  private leanSpring = new Spring(0, 70, 9);
  private dragging = false;
  private startRot = 0;

  constructor(readonly count: number, private reduced = false, startFront = 0) {
    this.step = (Math.PI * 2) / count;
    this.rot = new Spring(-startFront * this.step, 90, 12);
  }

  /** Index of the island in the middle (or the one the carousel is heading for). */
  get front(): number {
    return mod(Math.round(-this.rot.target / this.step), this.count);
  }
  /** The island nearest the middle right now. */
  get nearest(): number {
    return mod(Math.round(-this.rot.value / this.step), this.count);
  }

  dragStart(): void {
    this.dragging = true;
    this.startRot = this.rot.value;
    this.rot.velocity = 0;
  }
  /** `turn` = how far the finger has gone, as an angle. */
  dragBy(turn: number, velocity: number): void {
    this.rot.value = this.startRot + turn;
    this.rot.target = this.rot.value;
    this.rot.velocity = 0;
    this.leanSpring.target = clamp(velocity * 0.06, -0.3, 0.3);
  }

  /** Let go: a quick flick skips one island; a slow drag settles on the nearest one with a little throw. */
  release(velocity: number): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.leanSpring.target = 0;
    const base = Math.round(-this.startRot / this.step);
    const k = Math.abs(velocity) > FLING ? base + (velocity < 0 ? 1 : -1) : Math.round(-(this.rot.value + velocity * 0.12) / this.step);
    this.goToK(k);
  }

  private goToK(k: number): void {
    this.rot.target = -k * this.step;
    if (this.reduced) this.rot.snap();
  }

  /** Bring island i to the middle by the shorter way round. */
  goTo(i: number): void {
    const cur = -this.rot.value / this.step;
    this.goToK(i + this.count * Math.round((cur - i) / this.count));
  }

  tap(i: number): TapResult {
    if (i === this.nearest && Math.abs(this.rot.value - this.rot.target) < 0.05) return 'enter';
    this.goTo(i);
    return 'rotate';
  }

  update(dt: number): void {
    if (!this.dragging) this.rot.step(dt);
    this.lean = this.reduced ? 0 : this.leanSpring.step(dt);
  }

  /** Angle of island i around the ring. */
  angleOf(i: number): number {
    return i * this.step + this.rot.value;
  }
}
