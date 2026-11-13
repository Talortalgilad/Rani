/**
 * The jelly blocks (SPEC-blocks.md 2.2): each colour is drawn once into a sprite of the size of a cell, and then only copied, so that it is
 * sharp at any resolution and fast. Layers: a gradient base (light at the top, dark at the bottom), a darker rim (8%), an oval white
 * highlight (opacity .55) in the top third, a small shine dot, and a soft shadow under it.
 */
export const PALETTE = [
  { name: 'strawberry', top: '#ff7b8c', mid: '#ff4d63', bottom: '#d92e4a' },
  { name: 'orange', top: '#ffbb6b', mid: '#ff9a3c', bottom: '#e4741a' },
  { name: 'lemon', top: '#fff08a', mid: '#ffd93d', bottom: '#e8b514' },
  { name: 'apple', top: '#94e87c', mid: '#5fd35f', bottom: '#3aa83e' },
  { name: 'sky', top: '#8adcff', mid: '#4cc3ff', bottom: '#2799e0' },
  { name: 'grape', top: '#bd9bff', mid: '#9b6bff', bottom: '#7442da' },
  { name: 'bubblegum', top: '#ffb7e6', mid: '#ff8fd0', bottom: '#e062ac' },
] as const;

export type Canvas2 = HTMLCanvasElement | OffscreenCanvas;

function makeCanvas(w: number, h: number): Canvas2 {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const rr = (g: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void => {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
};

export interface Sprite { canvas: Canvas2; /** the padding round the block for the shadow, in sprite px */ pad: number; size: number }

/** One jelly block of `size` px (device pixels) in colour `color`. */
export function makeSprite(color: number, size: number): Sprite {
  const pal = PALETTE[color % PALETTE.length];
  const pad = Math.round(size * 0.1);
  const total = size + pad * 2;
  const c = makeCanvas(total, total + Math.round(pad * 0.6));
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const x = pad;
  const y = pad;
  const r = size * 0.24;
  // the soft shadow under the block
  g.save();
  g.shadowColor = 'rgba(58, 30, 70, .35)';
  g.shadowBlur = size * 0.16;
  g.shadowOffsetY = size * 0.07;
  rr(g, x, y, size, size, r);
  g.fillStyle = pal.mid;
  g.fill();
  g.restore();
  // the body: light at the top, dark at the bottom
  const base = g.createLinearGradient(0, y, 0, y + size);
  base.addColorStop(0, pal.top);
  base.addColorStop(0.45, pal.mid);
  base.addColorStop(1, pal.bottom);
  rr(g, x, y, size, size, r);
  g.fillStyle = base;
  g.fill();
  // the dark rim inside (8%)
  const rim = size * 0.08;
  g.save();
  rr(g, x, y, size, size, r);
  g.clip();
  g.lineWidth = rim * 2;
  g.strokeStyle = 'rgba(0, 0, 0, .16)';
  rr(g, x, y, size, size, r);
  g.stroke();
  // a lighter inner body, so that the block looks puffy
  const inner = g.createRadialGradient(x + size * 0.4, y + size * 0.32, size * 0.05, x + size * 0.5, y + size * 0.55, size * 0.62);
  inner.addColorStop(0, 'rgba(255, 255, 255, .22)');
  inner.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = inner;
  g.fillRect(x, y, size, size);
  g.restore();
  // the oval highlight in the top third
  g.save();
  g.globalAlpha = 0.55;
  g.fillStyle = '#fff';
  g.beginPath();
  g.ellipse(x + size * 0.5, y + size * 0.23, size * 0.34, size * 0.14, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // a small shine dot, top left
  g.fillStyle = 'rgba(255, 255, 255, .95)';
  g.beginPath();
  g.ellipse(x + size * 0.24, y + size * 0.2, size * 0.055, size * 0.045, -0.5, 0, Math.PI * 2);
  g.fill();
  return { canvas: c, pad, size };
}

/** All seven colours at one size. */
export function makeSprites(size: number): Sprite[] {
  return PALETTE.map((_, i) => makeSprite(i, size));
}

/** A little star for the bursts (a sprite, white; tinted by drawing it with globalAlpha and a colour overlay is not needed: it is drawn in the colour of the block). */
export function drawStar(g: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();
}
