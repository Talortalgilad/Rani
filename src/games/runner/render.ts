/**
 * The picture of the chase: Canvas 2D with a made-up perspective. The road is a trapezoid, and every thing is a sprite (made once, in `makeSprites`) whose size comes from its distance.
 * Nothing is made in a frame: the lists, the sprites and the colours are all made before.
 */
import { LOW_H, VIEW, type Gate, type Run } from './engine';

/** the camera: the focal length (units), where the horizon is, and where her feet stand (shares of the height) */
const F = 6.5;
const HORIZON = 0.34;
const FEET = 0.8;
const LANE_FRAC = 0.3;

export interface Sprites {
  crate: HTMLCanvasElement;
  pillar: HTMLCanvasElement;
  star: HTMLCanvasElement;
  shovi: HTMLCanvasElement;
  bunch: HTMLCanvasElement;
  /** the cat from behind (no face) and from the front */
  back: HTMLCanvasElement | null;
  front: HTMLCanvasElement | null;
}

const mk = (w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
};
const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void => {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
};

/** the simple shapes: no drawings yet (stage 0), only colours */
export function makeSprites(): Sprites {
  const [crate, c] = mk(128, 96);
  c.fillStyle = '#ff9a3c';
  rr(c, 4, 6, 120, 86, 12);
  c.fill();
  c.fillStyle = '#ffd23f';
  for (let i = 0; i < 4; i++) c.fillRect(14 + i * 28, 6, 12, 86);
  c.strokeStyle = '#c4621a';
  c.lineWidth = 5;
  rr(c, 4, 6, 120, 86, 12);
  c.stroke();

  const [pillar, p] = mk(96, 256);
  p.fillStyle = '#9b5de5';
  rr(p, 6, 4, 84, 248, 22);
  p.fill();
  p.fillStyle = '#f15bb5';
  for (let i = 0; i < 5; i++) p.fillRect(6, 30 + i * 46, 84, 16);
  p.fillStyle = '#4cc9f0';
  p.beginPath();
  p.arc(48, 22, 20, 0, 7);
  p.fill();
  p.strokeStyle = '#5a2a8a';
  p.lineWidth = 5;
  rr(p, 6, 4, 84, 248, 22);
  p.stroke();

  const [star, s] = mk(64, 64);
  s.fillStyle = '#ffd23f';
  s.strokeStyle = '#e09a00';
  s.lineWidth = 4;
  s.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 13 : 29;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    s.lineTo(32 + Math.cos(a) * r, 33 + Math.sin(a) * r);
  }
  s.closePath();
  s.fill();
  s.stroke();

  // Shovi, a plain shape: a dark purple blob with an orange beak and a red scarf
  const [shovi, v] = mk(128, 128);
  v.fillStyle = '#4b3a8c';
  v.beginPath();
  v.ellipse(64, 78, 36, 38, 0, 0, 7);
  v.fill();
  v.beginPath();
  v.arc(64, 42, 24, 0, 7);
  v.fill();
  v.fillStyle = '#ff8a1f';
  v.beginPath();
  v.moveTo(48, 42);
  v.lineTo(64, 56);
  v.lineTo(80, 42);
  v.closePath();
  v.fill();
  v.fillStyle = '#e63946';
  v.fillRect(42, 64, 44, 9);
  v.fillStyle = '#ff8a1f';
  v.fillRect(46, 112, 12, 10);
  v.fillRect(70, 112, 12, 10);

  const [bunch, b] = mk(128, 128);
  const cols = ['#ff4d6d', '#ffd23f', '#4cc9f0', '#80ed99', '#c77dff'];
  b.strokeStyle = '#444';
  b.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const x = 24 + i * 20;
    const y = 30 + (i % 2) * 18;
    b.beginPath();
    b.moveTo(64, 126);
    b.lineTo(x, y + 18);
    b.stroke();
    b.fillStyle = cols[i];
    b.beginPath();
    b.ellipse(x, y, 17, 21, 0, 0, 7);
    b.fill();
  }
  return { crate, pillar, star, shovi, bunch, back: null, front: null };
}

/** the sky and the far hills: made again when the size changes */
export function makeBackground(w: number, h: number): HTMLCanvasElement {
  const [c, g] = mk(w, h);
  const hz = h * HORIZON;
  g.fillStyle = '#8fd3ff';
  g.fillRect(0, 0, w, hz);
  g.fillStyle = '#c9ecff';
  g.fillRect(0, hz * 0.55, w, hz * 0.45);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.ellipse(((i * 0.29 + 0.1) % 1) * w, hz * (0.2 + (i % 2) * 0.22), w * 0.1, hz * 0.07, 0, 0, 7);
    g.fill();
  }
  g.fillStyle = '#9ad98a';
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.ellipse(w * (0.1 + i * 0.3), hz + 2, w * 0.22, hz * 0.2, 0, Math.PI, 0);
    g.fill();
  }
  g.fillStyle = '#7ccf6d';
  g.fillRect(0, hz, w, h - hz);
  return c;
}

interface Item { z: number; kind: 0 | 1 | 2 | 3; i: number }

export class Painter {
  readonly sp: Sprites;
  private bg: HTMLCanvasElement | null = null;
  private bgKey = '';
  private items: Item[] = [];
  private nItems = 0;
  /** shake and flash of the last events, set by the screen */
  flash = 0;
  private cam = 0;
  private camT = 0;
  constructor(private g: CanvasRenderingContext2D, sprites: Sprites) {
    this.sp = sprites;
  }

  /** the depth scale: 1 at her feet, 0 at the horizon */
  private p(d: number): number {
    return F / (F + Math.max(-F * 0.8, d));
  }

  draw(r: Run, W: number, H: number, time: number, reduced: boolean): void {
    const g = this.g;
    const key = `${W}x${H}`;
    if (key !== this.bgKey || !this.bg) {
      this.bg = makeBackground(W, H);
      this.bgKey = key;
    }
    g.drawImage(this.bg, 0, 0);
    const yH = H * HORIZON;
    const yF = H * FEET;
    const cx = W / 2;
    const laneW = W * LANE_FRAC;
    // the camera follows her a little; while a gate shows its answers it settles in the middle, so that every lane (and its label) is whole on the screen
    const gateOn = !!r.nextGate && r.nextGate.prepared && r.phase === 'run';
    const dtc = Math.min(0.1, Math.max(0, time - this.camT));
    this.camT = time;
    this.cam += ((gateOn ? 0 : r.x * 0.45) - this.cam) * Math.min(1, dtc * 6);
    const camX = this.cam;
    const yAt = (d: number): number => yH + (yF - yH) * this.p(d);
    const xAt = (lane: number, d: number): number => cx + (lane - camX) * laneW * this.p(d);

    // the road in bands that run toward her: the road and the grass are drawn once in their light colour, and only the dark bands are drawn on top
    g.fillStyle = '#f0cb78';
    g.beginPath();
    g.moveTo(xAt(-1.5, VIEW), yAt(VIEW));
    g.lineTo(xAt(1.5, VIEW), yAt(VIEW));
    g.lineTo(xAt(1.5, -F * 0.8), yAt(-F * 0.8));
    g.lineTo(xAt(-1.5, -F * 0.8), yAt(-F * 0.8));
    g.closePath();
    g.fill();
    const band = 2;
    const off = r.z % (band * 2);
    for (let k = -1; k * band - off < VIEW; k++) {
      if ((Math.floor((r.z + k * band) / band) & 1) === 0) continue;
      const d0 = k * band - off;
      const d1 = d0 + band;
      const y0 = yAt(Math.min(d1, VIEW));
      const y1 = yAt(Math.max(d0, -F * 0.8));
      if (y1 <= y0) continue;
      g.fillStyle = '#74c866';
      g.fillRect(0, y0, W, y1 - y0 + 1);
      g.fillStyle = '#f4d58d';
      g.beginPath();
      g.moveTo(xAt(-1.5, d1), y0);
      g.lineTo(xAt(1.5, d1), y0);
      g.lineTo(xAt(1.5, d0), y1);
      g.lineTo(xAt(-1.5, d0), y1);
      g.closePath();
      g.fill();
    }
    // the lines between the lanes
    g.strokeStyle = 'rgba(255,255,255,.7)';
    g.lineWidth = 3;
    for (const l of [-0.5, 0.5]) {
      g.beginPath();
      g.moveTo(xAt(l, VIEW), yAt(VIEW));
      g.lineTo(xAt(l, -F * 0.8), yAt(-F * 0.8));
      g.stroke();
    }
    // the edges: a pole every few units
    for (let k = 0; k * 4 - (r.z % 4) < VIEW; k++) {
      const d = k * 4 - (r.z % 4);
      for (const s of [-1.8, 1.8]) {
        const x = xAt(s, d);
        const y = yAt(d);
        const sc = this.p(d);
        g.fillStyle = (Math.floor((r.z + d) / 4) & 1) === 0 ? '#ff5d8f' : '#ffd23f';
        g.fillRect(x - 5 * sc, y - 50 * sc, 10 * sc, 50 * sc);
      }
    }

    // the finish line
    const fd = r.finishZ - r.z;
    if (fd < VIEW && fd > -F * 0.8) this.finish(fd, xAt, yAt, W);

    // things, far to near
    this.nItems = 0;
    const it = this.items;
    const push = (z: number, kind: 0 | 1 | 2 | 3, i: number): void => {
      let o = it[this.nItems];
      if (!o) o = it[this.nItems] = { z: 0, kind: 0, i: 0 };
      o.z = z;
      o.kind = kind;
      o.i = i;
      this.nItems++;
    };
    for (let i = 0; i < r.obstacles.length; i++) {
      const o = r.obstacles[i];
      const d = o.z - r.z;
      if (d > VIEW) break;
      if (d > -F * 0.7 && !o.done) push(d, o.kind === 'low' ? 0 : 1, i);
    }
    for (let i = 0; i < r.starsList.length; i++) {
      const s = r.starsList[i];
      const d = s.z - r.z;
      if (d > VIEW) break;
      if (d > -F * 0.7 && !s.got) push(d, 2, i);
    }
    for (let i = 0; i < r.gates.length; i++) {
      const d = r.gates[i].z - r.z;
      if (d < VIEW && d > -F * 0.7) push(d, 3, i);
    }
    // Shovi, far in front
    const gap = Math.max(0.1, 1 - 0.3 * r.correct);
    const caught = r.phase !== 'run' && r.caught;
    const sd = caught ? Math.max(1.5, 3 + (1 - Math.min(1, r.finishT / 2)) * 4) : r.phase === 'finish' ? 40 + r.finishT * 20 : 5 + gap * 26;
    push(sd, 3 as 3, -1);
    it.length = Math.max(it.length, this.nItems);
    const arr = it;
    const n = this.nItems;
    // insertion sort, far first (the list is short and nearly sorted from frame to frame)
    for (let a = 1; a < n; a++) {
      const x = arr[a];
      let b = a - 1;
      while (b >= 0 && arr[b].z < x.z) {
        arr[b + 1] = arr[b];
        b--;
      }
      arr[b + 1] = x;
    }
    for (let a = 0; a < n; a++) {
      const x = arr[a];
      const d = x.z;
      const sc = this.p(d);
      const y = yAt(d);
      if (x.kind === 0) {
        const o = r.obstacles[x.i];
        const w = laneW * 0.8 * sc;
        const h = w * (LOW_H / 0.8) * 1.05;
        g.drawImage(this.sp.crate, xAt(o.lane, d) - w / 2, y - h, w, h);
      } else if (x.kind === 1) {
        const o = r.obstacles[x.i];
        const w = laneW * 0.7 * sc;
        const h = w * (256 / 96);
        g.drawImage(this.sp.pillar, xAt(o.lane, d) - w / 2, y - h, w, h);
      } else if (x.kind === 2) {
        const s = r.starsList[x.i];
        const w = laneW * 0.4 * sc;
        const lift = (s.air ? 0.95 : 0.3) * laneW * 0.55 * sc;
        const bob = reduced ? 0 : Math.sin(time * 5 + s.z) * 3 * sc;
        g.drawImage(this.sp.star, xAt(s.lane, d) - w / 2, y - lift - w / 2 + bob, w, w);
      } else if (x.i < 0) {
        this.shovi(xAt(Math.sin(time * 2) * 0.35, d), y, sc, time, caught, r);
      } else {
        this.gate(r.gates[x.i], d, sc, xAt, yAt, laneW, time, r);
      }
    }

    this.player(r, W, H, laneW, yF, camX, time, reduced);
    this.labels(r, W, H, laneW, camX, time);
    if (this.flash > 0) {
      g.fillStyle = `rgba(255,255,255,${Math.min(0.55, this.flash)})`;
      g.fillRect(0, 0, W, H);
    }
    // the power-ups that are on, near her
    if (r.magnetT > 0 || r.shieldT > 0) {
      g.font = `${Math.round(W * 0.07)}px system-ui, sans-serif`;
      g.textAlign = 'left';
      g.fillText((r.magnetT > 0 ? '🧲' : '') + (r.shieldT > 0 ? '🛡️' : ''), 12, H - 14);
    }
  }

  /**
   * The three answers again, big, over their lanes, at one fixed height above the cat: from the moment that the exercise shows until the gate is crossed
   * (the numbers on the gate itself stay, small when it is far). The number is 44 px high at the least, on a 360 px wide screen too.
   */
  private labels(r: Run, W: number, H: number, laneW: number, camX: number, time: number): void {
    const gt = r.nextGate;
    if (!gt || !gt.prepared || gt.resolved || r.phase !== 'run') return;
    const g = this.g;
    const w = Math.min(laneW * 0.88, 100);
    const h = 64;
    const y = H * 0.46;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '800 44px Rubik, system-ui, sans-serif';
    for (let i = 0; i < 3; i++) {
      const x = W / 2 + (i - 1 - camX) * laneW;
      const glow = gt.help && i === gt.correct;
      const pulse = glow ? 0.5 + 0.5 * Math.sin(time * 8) : 0;
      g.fillStyle = glow ? `rgb(255,${220 - Math.round(pulse * 40)},70)` : 'rgba(255,255,255,.95)';
      g.strokeStyle = glow ? '#ff8a1f' : '#7b4fc9';
      g.lineWidth = 4;
      rr(g, x - w / 2, y - h / 2, w, h, 18);
      g.fill();
      g.stroke();
      g.fillStyle = '#4a2a8a';
      g.fillText(String(gt.nums[i]), x, y + 2);
    }
  }

  private finish(d: number, xAt: (l: number, d: number) => number, yAt: (d: number) => number, W: number): void {
    const g = this.g;
    const d0 = d;
    const d1 = d + 1.2;
    const y0 = yAt(d1);
    const y1 = yAt(d0);
    if (y1 <= y0) return;
    const n = 12;
    for (let i = 0; i < n; i++) {
      const xa = xAt(-1.5 + (3 * i) / n, d0);
      const xb = xAt(-1.5 + (3 * (i + 1)) / n, d0);
      const xc = xAt(-1.5 + (3 * i) / n, d1);
      const xd = xAt(-1.5 + (3 * (i + 1)) / n, d1);
      g.fillStyle = i % 2 ? '#222' : '#fff';
      g.beginPath();
      g.moveTo(xc, y0);
      g.lineTo(xd, y0);
      g.lineTo(xb, y1);
      g.lineTo(xa, y1);
      g.closePath();
      g.fill();
    }
    // two posts and a bar of balloons
    const sc = this.p(d0);
    g.fillStyle = '#e63946';
    for (const s of [-1.5, 1.5]) g.fillRect(xAt(s, d0) - 6 * sc, y1 - 160 * sc, 12 * sc, 160 * sc);
    g.fillStyle = '#ffd23f';
    g.fillRect(xAt(-1.5, d0), y1 - 160 * sc, xAt(1.5, d0) - xAt(-1.5, d0), 16 * sc);
    void W;
  }

  private gate(gt: Gate, d: number, sc: number, xAt: (l: number, d: number) => number, yAt: (d: number) => number, laneW: number, time: number, r: Run): void {
    const g = this.g;
    const y = yAt(d);
    const top = y - laneW * 0.95 * sc * 1.9;
    const xl = xAt(-1.5, d);
    const xr = xAt(1.5, d);
    g.fillStyle = '#7b4fc9';
    g.fillRect(xl - 7 * sc, top, 14 * sc, y - top);
    g.fillRect(xr - 7 * sc, top, 14 * sc, y - top);
    g.fillRect(xl, top, xr - xl, 12 * sc);
    if (!gt.prepared) return;
    const w = laneW * 0.86 * sc;
    const h = w * 0.62;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `800 ${Math.max(6, Math.round(h * 0.7))}px Rubik, system-ui, sans-serif`;
    for (let i = 0; i < 3; i++) {
      const n = gt.nums[i];
      const x = xAt(i - 1, d);
      const glow = (gt.help && !gt.resolved && i === gt.correct) || (gt.reveal > 0 && i === gt.correct);
      const pulse = glow ? 0.65 + 0.35 * Math.sin(time * 8) : 0;
      g.fillStyle = glow ? `rgb(${255},${210 - Math.round(pulse * 30)},${63})` : '#ffffff';
      g.strokeStyle = glow ? '#ff8a1f' : '#7b4fc9';
      g.lineWidth = Math.max(2, 5 * sc);
      rr(g, x - w / 2, top + 12 * sc + 6 * sc, w, h, 12 * sc);
      g.fill();
      g.stroke();
      g.fillStyle = '#4a2a8a';
      g.fillText(String(n), x, top + 12 * sc + 6 * sc + h / 2 + 1);
    }
    // a gate that she went through in the right lane is lit
    if (gt.resolved && gt.ok) {
      g.fillStyle = 'rgba(128,237,153,.45)';
      g.fillRect(xl, top, xr - xl, y - top);
    }
    void r;
  }

  private shovi(x: number, y: number, sc: number, time: number, caught: boolean, r: Run): void {
    const g = this.g;
    const w = 150 * sc * 1.2;
    const bob = Math.sin(time * 9) * 4 * sc;
    if (caught && r.finishT > 1.2) {
      // sorry: he gives the balloons back (still a plain shape: the bunch comes down to her)
      g.drawImage(this.sp.shovi, x - w / 2, y - w + bob, w, w);
      g.drawImage(this.sp.bunch, x + w * 0.25, y - w * 1.3 + (r.finishT - 1.2) * 20 * sc, w * 0.8, w * 0.8);
      return;
    }
    g.drawImage(this.sp.shovi, x - w / 2, y - w + bob, w, w);
    g.drawImage(this.sp.bunch, x - w * 0.4, y - w * 1.55 + bob, w * 0.8, w * 0.8);
  }

  private player(r: Run, W: number, H: number, laneW: number, yF: number, camX: number, time: number, reduced: boolean): void {
    const g = this.g;
    const hC = H * 0.2;
    const x = W / 2 + (r.x - camX) * laneW;
    const celebrating = r.phase !== 'run';
    const img = celebrating && r.finishT > 0.9 ? this.sp.front : this.sp.back;
    const lift = r.h * hC * 1.25;
    // shadow
    g.fillStyle = 'rgba(0,0,0,.22)';
    g.beginPath();
    g.ellipse(x, yF + 4, hC * 0.38 * (1 - Math.min(0.5, r.h * 0.4)), hC * 0.09, 0, 0, 7);
    g.fill();
    if (!img) {
      g.fillStyle = '#ff9a3c';
      rr(g, x - hC * 0.3, yF - lift - hC, hC * 0.6, hC, 16);
      g.fill();
      return;
    }
    // a squash after a hit: wide and flat, then back
    let sx = 1;
    let sy = 1;
    if (r.squishT > 0) {
      const u = r.squishT / 0.45;
      sy = 1 - 0.45 * Math.sin(u * Math.PI);
      sx = 1 + 0.35 * Math.sin(u * Math.PI);
    } else if (!reduced && r.jt < 0 && r.speedNow > 0.1) {
      sy = 1 + 0.03 * Math.sin(time * 18);
    }
    const hop = celebrating && r.finishT > 1 && !reduced ? Math.abs(Math.sin(time * 6)) * hC * 0.25 : 0;
    const asp = img.width / img.height;
    const h = hC * sy;
    const w = hC * asp * sx;
    g.drawImage(img, x - w / 2, yF - lift - hop - h, w, h);
  }
}
