import * as T from './lib';
import type { Tier } from './quality';

/** Sky colours by time of day: bright morning, blue noon, orange-pink evening, calm indigo night. */

export interface Sky { top: string; bottom: string; light: string; intensity: number }

const KEYS: { h: number; top: string; bottom: string; light: string; intensity: number }[] = [
  { h: 0, top: '#2b2f6b', bottom: '#5b5aa8', light: '#b9c4ff', intensity: 0.7 },
  { h: 5, top: '#3d4a8f', bottom: '#f2a6b8', light: '#ffd9c2', intensity: 0.9 },
  { h: 8, top: '#7ec8ff', bottom: '#fff3c9', light: '#fff1d0', intensity: 1.5 },
  { h: 12, top: '#4aa8f0', bottom: '#d9f1ff', light: '#ffffff', intensity: 1.8 },
  { h: 16, top: '#5bb0f0', bottom: '#ffe9b5', light: '#fff0cc', intensity: 1.6 },
  { h: 18.5, top: '#ff9a6b', bottom: '#ffd0e0', light: '#ffc28a', intensity: 1.3 },
  { h: 20.5, top: '#4a3f8f', bottom: '#d98fb8', light: '#e0b3ff', intensity: 0.9 },
  { h: 24, top: '#2b2f6b', bottom: '#5b5aa8', light: '#b9c4ff', intensity: 0.7 },
];

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) =>
  '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');

export function skyFor(date: Date): Sky {
  const h = date.getHours() + date.getMinutes() / 60;
  let i = 0;
  while (i < KEYS.length - 2 && h >= KEYS[i + 1].h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = (h - a.h) / (b.h - a.h);
  return {
    top: mix(a.top, b.top, t),
    bottom: mix(a.bottom, b.bottom, t),
    light: mix(a.light, b.light, t),
    intensity: a.intensity + (b.intensity - a.intensity) * t,
  };
}

/** Stars show in the sky from late evening to early morning. */
export const isNight = (date: Date): boolean => {
  const h = date.getHours() + date.getMinutes() / 60;
  return h < 5.5 || h >= 20.5;
};

/**
 * A few small birds that cross the sky now and then (high quality only, never with reduced motion).
 * `rand` is injectable so the timing can be tested.
 */
export class Birds {
  readonly group = new T.Group();
  private birds: { g: T.Group; wings: T.Mesh[]; x: number; v: number; y: number; phase: number }[] = [];
  private wait: number;
  private mat = new T.MeshBasicMaterial({ color: '#3a2f4b', side: 2, fog: false });
  private geo = new T.PlaneGeometry(0.34, 0.12);

  constructor(private enabled: boolean, private rand: () => number = Math.random) {
    this.wait = 5 + this.rand() * 6;
  }

  setTier(tier: Tier): void {
    this.enabled = this.enabled && tier === 'high';
    if (!this.enabled) this.clear();
  }

  get flying(): number {
    return this.birds.length;
  }

  private clear(): void {
    this.birds.forEach((b) => this.group.remove(b.g));
    this.birds = [];
  }

  private spawn(): void {
    const n = 1 + Math.floor(this.rand() * 3);
    const dir = this.rand() < 0.5 ? 1 : -1;
    const y = 3 + this.rand() * 2.5;
    for (let i = 0; i < n; i++) {
      const g = new T.Group();
      const wings = [-1, 1].map((side) => {
        const w = new T.Mesh(this.geo, this.mat);
        w.position.x = side * 0.17;
        g.add(w);
        return w;
      });
      this.group.add(g);
      this.birds.push({ g, wings, x: -dir * (11 + i * 1.1), v: dir * (1.3 + this.rand() * 0.4), y: y + i * 0.3 + this.rand() * 0.4, phase: this.rand() * 6 });
    }
  }

  update(dt: number, time: number): void {
    if (!this.enabled) return;
    this.wait -= dt;
    if (this.wait <= 0 && this.birds.length === 0) {
      this.spawn();
      this.wait = 10 + this.rand() * 10;
    }
    for (const b of this.birds) {
      b.x += b.v * dt;
      b.g.position.set(b.x, b.y + Math.sin(time * 1.5 + b.phase) * 0.12, -9);
      const flap = Math.sin(time * 11 + b.phase) * 0.6;
      b.wings[0].rotation.z = flap;
      b.wings[1].rotation.z = -flap;
    }
    const gone = this.birds.filter((b) => Math.abs(b.x) > 12.5 && Math.sign(b.x) === Math.sign(b.v));
    if (gone.length) {
      gone.forEach((b) => this.group.remove(b.g));
      this.birds = this.birds.filter((b) => !gone.includes(b));
    }
  }

  dispose(): void {
    this.clear();
    this.mat.dispose();
    this.geo.dispose();
  }
}
