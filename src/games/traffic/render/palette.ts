import type { ColorId } from '../engine/state';

/** The base colour of each vehicle and passenger colour (SPEC-traffic 2.2). */
export const COLOR_HEX: Record<ColorId, string> = {
  red: '#F0453A',
  orange: '#FF8A1F',
  yellow: '#FFD02B',
  green: '#47C94A',
  cyan: '#2EC4F0',
  blue: '#2F6BFF',
  purple: '#8A4DFF',
  pink: '#FF4FB8',
  brown: '#9A5B2E',
  fire: '#C62828',
};

/** A second shape on every passenger and place, so that colours that look alike (cyan and blue) are never confused. */
export const COLOR_SHAPE: Record<ColorId, StickerShape> = {
  red: 'circle', orange: 'triangle', yellow: 'star', green: 'leaf', cyan: 'drop', blue: 'square', purple: 'moon', pink: 'heart', brown: 'diamond', fire: 'helmet',
};

export type StickerShape = 'circle' | 'triangle' | 'star' | 'leaf' | 'drop' | 'square' | 'moon' | 'heart' | 'diamond' | 'helmet';

/** Outline of a sticker as points around the origin, about 1 unit wide: used for the 3D shape and the canvas drawing. */
export function shapePoints(shape: StickerShape): [number, number][] {
  const n = 48;
  const circle = (r: number, a0 = 0, a1 = Math.PI * 2, k = n): [number, number][] => Array.from({ length: k }, (_, i) => [Math.cos(a0 + ((a1 - a0) * i) / k) * r, Math.sin(a0 + ((a1 - a0) * i) / k) * r]);
  switch (shape) {
    case 'circle': return circle(0.5);
    case 'triangle': return [[0, 0.56], [-0.52, -0.38], [0.52, -0.38]];
    case 'helmet': return [...circle(0.5, 0, Math.PI, 24), [-0.5, -0.12] as [number, number], [0.62, -0.12] as [number, number]];
    case 'diamond': return [[0, 0.58], [-0.44, 0], [0, -0.58], [0.44, 0]];
    case 'square': return [[-0.42, -0.42], [0.42, -0.42], [0.42, 0.42], [-0.42, 0.42]];
    case 'star': return Array.from({ length: 10 }, (_, i) => { const a = Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 === 0 ? 0.58 : 0.26; return [Math.cos(a) * r, Math.sin(a) * r] as [number, number]; });
    case 'heart': return Array.from({ length: 40 }, (_, i) => { const t = (i / 40) * Math.PI * 2; return [(16 * Math.sin(t) ** 3) / 34, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 34 + 0.04] as [number, number]; });
    case 'drop': return [[0, 0.6] as [number, number], ...circle(0.36, Math.PI * 0.18, Math.PI * 0.82 + Math.PI * 1.0, 28).map(([x, y]) => [x, y - 0.14] as [number, number])].reverse();
    case 'leaf': return Array.from({ length: 36 }, (_, i) => { const t = (i / 36) * Math.PI * 2; const x = Math.cos(t) * 0.52; const y = Math.sin(t) * 0.26 * (1 - 0.25 * Math.cos(t * 2)); return [x * 0.9 - y * 0.45, x * 0.9 + y * 0.45] as [number, number]; });
    case 'moon': {
      const outer = circle(0.5, Math.PI * 0.62, Math.PI * 2.38, 30);
      const inner = circle(0.4, Math.PI * 2.38, Math.PI * 0.62, 24).map(([x, y]) => [x + 0.24, y + 0.04] as [number, number]);
      return [...outer, ...inner];
    }
  }
}
