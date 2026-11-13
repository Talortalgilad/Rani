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
export type BlockStyle = 'jelly' | 'candy' | 'garden' | 'art' | 'space';

/** One jelly block of `size` px (device pixels) in colour `color`, in the set of a world (SPEC-blocks.md 2.2): stripes (candy), matte (garden), a drop of paint (art), twinkles (space). */
export function makeSprite(color: number, size: number, style: BlockStyle = 'jelly', custom?: { top: string; mid: string; bottom: string }): Sprite {
  const pal = custom ?? PALETTE[color % PALETTE.length];
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
  g.globalAlpha = style === 'garden' ? 0.16 : 0.55;
  g.fillStyle = '#fff';
  g.beginPath();
  g.ellipse(x + size * 0.5, y + size * 0.23, size * 0.34, size * 0.14, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // a small shine dot, top left (not on the matte leaves)
  if (style !== 'garden') {
    g.fillStyle = 'rgba(255, 255, 255, .95)';
    g.beginPath();
    g.ellipse(x + size * 0.24, y + size * 0.2, size * 0.055, size * 0.045, -0.5, 0, Math.PI * 2);
    g.fill();
  }
  if (style !== 'jelly') {
    g.save();
    rr(g, x, y, size, size, r);
    g.clip();
    decorate(g, style, x, y, size);
    g.restore();
  }
  return { canvas: c, pad, size };
}

function decorate(g: CanvasRenderingContext2D, style: BlockStyle, x: number, y: number, size: number): void {
  if (style === 'candy') {
    // diagonal stripes like a sweet
    g.fillStyle = 'rgba(255, 255, 255, .3)';
    for (let k = -2; k < 4; k++) {
      g.beginPath();
      const o = k * size * 0.34;
      g.moveTo(x + o, y + size);
      g.lineTo(x + o + size * 0.16, y + size);
      g.lineTo(x + o + size * 0.16 + size, y);
      g.lineTo(x + o + size, y);
      g.closePath();
      g.fill();
    }
  } else if (style === 'garden') {
    // a small, gentle leaf in the top corner (the block itself is matte)
    const L = size * 0.24;
    g.save();
    g.translate(x + size * 0.72, y + size * 0.27);
    g.rotate(-0.8);
    g.fillStyle = 'rgba(190, 245, 170, .7)';
    g.strokeStyle = 'rgba(40, 110, 50, .45)';
    g.lineWidth = Math.max(1, size * 0.03);
    g.beginPath();
    g.moveTo(-L, 0);
    g.bezierCurveTo(-L * 0.5, -L * 0.8, L * 0.5, -L * 0.8, L, 0);
    g.bezierCurveTo(L * 0.5, L * 0.8, -L * 0.5, L * 0.8, -L, 0);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(-L * 1.25, L * 0.12);
    g.lineTo(L * 0.7, 0);
    g.stroke();
    g.restore();
  } else if (style === 'art') {
    // a glossy drop of paint in the corner
    const cx = x + size * 0.7, cy = y + size * 0.7, d = size * 0.18;
    g.fillStyle = 'rgba(255, 255, 255, .38)';
    g.beginPath();
    g.moveTo(cx, cy - d * 1.5);
    g.bezierCurveTo(cx + d * 1.2, cy - d * 0.2, cx + d, cy + d, cx, cy + d);
    g.bezierCurveTo(cx - d, cy + d, cx - d * 1.2, cy - d * 0.2, cx, cy - d * 1.5);
    g.fill();
    g.fillStyle = 'rgba(255, 255, 255, .85)';
    g.beginPath();
    g.ellipse(cx - d * 0.35, cy, d * 0.18, d * 0.35, 0.3, 0, Math.PI * 2);
    g.fill();
  } else if (style === 'space') {
    // twinkles: four-pointed stars and dust
    const spark = (cx: number, cy: number, r: number): void => {
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const rad = i % 2 === 0 ? r : r * 0.28;
        g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
      }
      g.closePath();
      g.fill();
    };
    g.fillStyle = 'rgba(255, 255, 255, .95)';
    spark(x + size * 0.72, y + size * 0.3, size * 0.16);
    spark(x + size * 0.3, y + size * 0.72, size * 0.1);
    g.fillStyle = 'rgba(255, 255, 255, .7)';
    for (const [px, py] of [[0.2, 0.45], [0.55, 0.8], [0.85, 0.62], [0.48, 0.5]]) {
      g.beginPath();
      g.arc(x + size * px, y + size * py, size * 0.022, 0, Math.PI * 2);
      g.fill();
    }
  }
}

/** The grey stone block of a chained cell. */
export const makeStone = (size: number): Sprite => makeSprite(0, size, 'jelly', { top: '#d5d8de', mid: '#a3a9b4', bottom: '#737a87' });

/** All seven colours at one size. */
export function makeSprites(size: number, style: BlockStyle = 'jelly'): Sprite[] {
  return PALETTE.map((_, i) => makeSprite(i, size, style));
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
