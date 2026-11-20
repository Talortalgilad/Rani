/**
 * The squeeze of the squishy (SPEC-squishy.md 5): a grid of points, each tied by a spring to its place of rest. Pure numbers, no Three.js and no DOM, so that it is tested.
 *
 * A finger that presses pushes in the points near it (they move towards the finger, as the surface of a soft toy does when it is seen from the front) and swells the sides a
 * little (the volume stays: what is pushed in comes out around it), and the whole body is squashed along the line of the press and widened across it. A finger that
 * is dragged stretches the points near where it came down. A finger that is lifted: the points go back to their places, SLOWLY (about a second and a half, like a real
 * squishy), with the damping of a spring that is exactly critical, so there is no wobble.
 *
 * The three numbers that are tuned by hand until it feels right are in SQUEEZE: the radius of the influence, the depth of the press and the time of the return.
 * They are `let` fields of one object so that the sliders of the prototype can change them on the phone.
 */

export const SQUEEZE = {
  /** How far from the finger the squishy gives way, as a share of half of the picture (0.5 = a quarter of the width). A bigger number: a soft, wide dent, like a marshmallow. A smaller one: a sharp dent, like a ball. */
  radius: 0.55,
  /** How deep the press goes: the share of the radius by which the middle of the dent is drawn in (0.5 = halfway to the finger). */
  depth: 0.55,
  /** How long the return to the shape takes, in seconds (until it is 98% back). A real squishy is slow: about 1.5. */
  returnSeconds: 1.5,
} as const as { radius: number; depth: number; returnSeconds: number };

/** how much the sides swell for what is pushed in (1 = the volume stays the same, as seen from the front) */
export const BULGE = 0.9;
/** the whole body: how much it is squashed along the line of the press and widened across it, at full press */
export const SQUASH = 0.085;
/** how quickly the points follow the finger while it is down (a spring of 1/s: fast, so that the squeeze follows the finger with no delay that can be felt) */
export const FOLLOW = 26;
/** how far a finger that is dragged pulls the points near its first place (the share of the way), and how big that place is, against the radius */
export const PULL = 0.85;
export const PULL_RADIUS = 1.35;

export interface Finger {
  /** where it is, in the space of the picture (-1..1 on both sides, y up) */
  x: number;
  y: number;
  /** where it came down (the same space); the difference is the drag */
  x0: number;
  y0: number;
  /** 0..1: how hard it presses (grows while it is held, so a long press is deeper than a tap) */
  force: number;
}

const smooth = (t: number): number => (t <= 0 ? 1 : t >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * t));

export class SquishGrid {
  readonly n: number;
  /** the places of rest and the offsets (x, y interleaved) */
  readonly rest: Float32Array;
  readonly off: Float32Array;
  readonly vel: Float32Array;
  private finger: Finger | null = null;
  /** 0..1: how much the finger counts (it rises when it comes down and falls when it is lifted, so a release is not a jump) */
  private grip = 0;

  constructor(n = 16) {
    this.n = n;
    const m = (n + 1) * (n + 1);
    this.rest = new Float32Array(m * 2);
    this.off = new Float32Array(m * 2);
    this.vel = new Float32Array(m * 2);
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const k = (j * (n + 1) + i) * 2;
      this.rest[k] = (i / n) * 2 - 1;
      this.rest[k + 1] = 1 - (j / n) * 2;
    }
  }

  get points(): number {
    return (this.n + 1) * (this.n + 1);
  }

  /** a finger came down or moves (the same Finger object can be updated) */
  press(f: Finger): void {
    this.finger = f;
  }
  release(): void {
    this.finger = null;
  }
  get pressed(): boolean {
    return this.finger !== null;
  }

  /** where a point wants to be now (the offset from its place of rest) */
  private target(k: number, out: { x: number; y: number }): void {
    out.x = 0;
    out.y = 0;
    const f = this.finger;
    if (!f || this.grip <= 0.001) return;
    const s = f.force * this.grip;
    const R = SQUEEZE.radius;
    const rx = this.rest[k], ry = this.rest[k + 1];
    const dx = rx - f.x, dy = ry - f.y;
    const dist = Math.hypot(dx, dy) || 1e-6;
    const drag = Math.hypot(f.x - f.x0, f.y - f.y0);
    // a finger that moves a lot stretches instead of denting
    const dent = s * (1 - Math.min(1, drag / (0.35 * R)) * 0.75);
    const w = smooth(dist / R);
    // the points inside the radius go towards the finger; the ring around the radius swells
    const inward = -SQUEEZE.depth * dent * w;           // (a share of the distance to the finger)
    const ring = Math.exp(-(((dist - 1.3 * R) / (0.6 * R)) ** 2));
    const swell = BULGE * SQUEEZE.depth * dent * R * 0.55 * ring;
    out.x += dx * inward + (dx / dist) * swell;
    out.y += dy * inward + (dy / dist) * swell;
    // the whole body: squashed along the line from the finger to the middle, widened across it
    const nl = Math.hypot(f.x, f.y);
    const nx = nl > 0.15 ? -f.x / nl : 0, ny = nl > 0.15 ? -f.y / nl : -1;
    const along = rx * nx + ry * ny;
    out.x += (-nx * along * SQUASH + (rx - nx * along) * SQUASH * 0.55) * dent * 2;
    out.y += (-ny * along * SQUASH + (ry - ny * along) * SQUASH * 0.55) * dent * 2;
    // a drag pulls the points near where the finger came down
    if (drag > 0.01) {
      const wd = smooth(Math.hypot(rx - f.x0, ry - f.y0) / (PULL_RADIUS * R));
      out.x += (f.x - f.x0) * PULL * wd * f.force;
      out.y += (f.y - f.y0) * PULL * wd * f.force;
    }
  }

  /** moves the points by the springs. A step is cut into small ones, so a slow phone (a long frame) does not make it blow up. */
  step(dt: number): void {
    dt = Math.min(dt, 0.1);
    const sub = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / sub;
    // while it is held the springs are stiff (it follows the finger), after it is lifted they are soft: omega is chosen so that the return takes returnSeconds (98%: omega * t = 5.8, critical damping)
    const wSlow = 5.8 / Math.max(0.2, SQUEEZE.returnSeconds);
    const t = { x: 0, y: 0 };
    for (let s = 0; s < sub; s++) {
      const want = this.finger ? 1 : 0;
      // the grip rises fast and falls at the speed of the return
      this.grip += (want - this.grip) * Math.min(1, h * (want ? FOLLOW : wSlow));
      const omega = this.finger ? FOLLOW : wSlow;
      for (let p = 0; p < this.points; p++) {
        const k = p * 2;
        this.target(k, t);
        for (let a = 0; a < 2; a++) {
          const x = this.off[k + a], v = this.vel[k + a];
          const acc = omega * omega * ((a === 0 ? t.x : t.y) - x) - 2 * omega * v;
          this.vel[k + a] = v + acc * h;
          this.off[k + a] = x + this.vel[k + a] * h;
        }
      }
    }
  }

  /** the biggest distance of a point from its place of rest (0 = the shape is back) */
  maxOffset(): number {
    let m = 0;
    for (let p = 0; p < this.points; p++) m = Math.max(m, Math.hypot(this.off[p * 2], this.off[p * 2 + 1]));
    return m;
  }

  /** the area that the grid covers, against the area at rest (the shoelace formula of every little square) */
  areaRatio(): number {
    const n = this.n;
    const at = (i: number, j: number, rest: boolean): [number, number] => {
      const k = (j * (n + 1) + i) * 2;
      return rest ? [this.rest[k], this.rest[k + 1]] : [this.rest[k] + this.off[k], this.rest[k + 1] + this.off[k + 1]];
    };
    let now = 0, base = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      for (const rest of [true, false]) {
        const q = [at(i, j, rest), at(i + 1, j, rest), at(i + 1, j + 1, rest), at(i, j + 1, rest)];
        let a = 0;
        for (let c = 0; c < 4; c++) a += q[c][0] * q[(c + 1) % 4][1] - q[(c + 1) % 4][0] * q[c][1];
        if (rest) base += Math.abs(a) / 2;
        else now += Math.abs(a) / 2;
      }
    }
    return now / base;
  }

  /** puts everything back at once */
  reset(): void {
    this.off.fill(0);
    this.vel.fill(0);
    this.finger = null;
    this.grip = 0;
  }
}
