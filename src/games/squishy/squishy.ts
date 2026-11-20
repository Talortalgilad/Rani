/** Drawing a squishy from its data (SPEC-squishy.md 3): the colours of the parts over the map (paint.ts), the finish, the decorations, the face. Nothing is saved but the data. */
import { drawFace, type FaceState } from './faces';
import { compose } from './paint';
import { fillColors, type Decor, type DecorKind, type Finish, type SquishyData } from './save';
import { SIZE, type Loaded } from './shapes';

const FINISH_OPTS: Record<Finish, { shine: number; flat: number }> = { gloss: { shine: 0.55, flat: 1 }, glitter: { shine: 0.5, flat: 1 }, matte: { shine: 0.04, flat: 0.55 } };

const hash = (s: string): number => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const rng = (seed: number): (() => number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

/** a decoration: a star, a flower or a heart, about 30 pixels of the 512 */
export function drawDecor(g: CanvasRenderingContext2D, k: DecorKind, x: number, y: number, r = 17): void {
  g.save();
  g.translate(x, y);
  g.shadowColor = 'rgba(60,20,40,.35)';
  g.shadowBlur = 4;
  g.shadowOffsetY = 2;
  g.lineJoin = 'round';
  if (k === 'star') {
    g.fillStyle = '#ffd23f';
    g.strokeStyle = '#e0a000';
    g.lineWidth = 2.5;
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.48 : r * 1.15; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath(); g.fill(); g.stroke();
  } else if (k === 'flower') {
    g.fillStyle = '#ff8fc0';
    for (let i = 0; i < 5; i++) { const a = (i * Math.PI * 2) / 5 - Math.PI / 2; g.beginPath(); g.arc(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, r * 0.5, 0, Math.PI * 2); g.fill(); }
    g.shadowColor = 'transparent';
    g.fillStyle = '#ffe14d'; g.beginPath(); g.arc(0, 0, r * 0.42, 0, Math.PI * 2); g.fill();
  } else {
    g.fillStyle = '#ff4d6d';
    g.strokeStyle = '#c9184a';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(0, r * 0.95);
    g.bezierCurveTo(-r * 1.4, -r * 0.1, -r * 0.7, -r * 1.1, 0, -r * 0.35);
    g.bezierCurveTo(r * 0.7, -r * 1.1, r * 1.4, -r * 0.1, 0, r * 0.95);
    g.closePath(); g.fill(); g.stroke();
  }
  g.restore();
}

/** a few sparkles, always in the same places for the same squishy (inside the shape) */
function drawGlitter(g: CanvasRenderingContext2D, map: Uint8ClampedArray, seed: string): void {
  const r = rng(hash(seed));
  g.save();
  for (let n = 0, tries = 0; n < 110 && tries < 900; tries++) {
    const x = Math.floor(r() * SIZE), y = Math.floor(r() * SIZE);
    if (map[(y * SIZE + x) * 4 + 3] < 220) continue;
    n++;
    const s = 2 + r() * 4.5;
    g.fillStyle = ['#ffffff', '#fff6b0', '#d9f1ff', '#ffd9f0'][n % 4];
    g.globalAlpha = 0.7 + r() * 0.3;
    g.beginPath();
    g.moveTo(x, y - s); g.lineTo(x + s * 0.3, y - s * 0.3); g.lineTo(x + s, y); g.lineTo(x + s * 0.3, y + s * 0.3);
    g.lineTo(x, y + s); g.lineTo(x - s * 0.3, y + s * 0.3); g.lineTo(x - s, y); g.lineTo(x - s * 0.3, y - s * 0.3);
    g.closePath(); g.fill();
  }
  g.restore();
}

const bufs = new WeakMap<CanvasRenderingContext2D, { data: Uint8ClampedArray; img: ImageData }>();
export interface DrawOpts { face?: FaceState; look?: { x: number; y: number }; noFace?: boolean; noDecor?: boolean; draftDecor?: Decor[] }

/** draws the squishy on a canvas of SIZE x SIZE (cleared first) */
export function drawSquishy(g: CanvasRenderingContext2D, loaded: Loaded, d: SquishyData, o: DrawOpts = {}): void {
  let b = bufs.get(g);
  if (!b) {
    const data = new Uint8ClampedArray(SIZE * SIZE * 4);
    b = { data, img: new ImageData(data, SIZE, SIZE) };
    bufs.set(g, b);
  }
  g.clearRect(0, 0, g.canvas.width, g.canvas.height);
  const f = FINISH_OPTS[d.finish];
  compose(loaded.map, fillColors(d), b.data, 2, { shine: f.shine, flat: f.flat });
  g.putImageData(b.img, 0, 0);
  if (d.finish === 'glitter') drawGlitter(g, loaded.map, d.id);
  if (!o.noDecor) for (const k of d.decor) drawDecor(g, k.k, k.x, k.y);
  if (!o.noFace && loaded.face) drawFace(g, loaded.face.x, loaded.face.y, loaded.face.size, o.face ?? 'open', o.look ?? { x: 0, y: 0 }, d.face);
}

/** is a point inside the shape (for putting a decoration) */
export const inside = (map: Uint8ClampedArray, x: number, y: number): boolean => {
  const px = Math.round(x), py = Math.round(y);
  return px >= 0 && py >= 0 && px < SIZE && py < SIZE && map[(py * SIZE + px) * 4 + 3] > 200;
};
/** the decoration under a point (the nearest within `reach` pixels), or -1 */
export function decorAt(decor: Decor[], x: number, y: number, reach = 24): number {
  let best = -1, bd = reach * reach;
  decor.forEach((k, i) => { const d = (k.x - x) ** 2 + (k.y - y) ** 2; if (d <= bd) (bd = d), (best = i); });
  return best;
}
