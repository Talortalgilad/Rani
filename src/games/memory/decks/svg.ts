export const INK = '#3a2f4b';

/** Wraps drawing commands in the shared illustration style: round shapes, thick outline. */
export const svg = (inner: string): string =>
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${inner}</svg>`;

/** Big friendly eye with a highlight. */
export const eye = (x: number, y: number, r = 9): string =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke-width="3.5"/>` +
  `<circle cx="${x + r * 0.18}" cy="${y + r * 0.18}" r="${r * 0.55}" fill="${INK}" stroke="none"/>` +
  `<circle cx="${x - r * 0.12}" cy="${y - r * 0.2}" r="${r * 0.2}" fill="#fff" stroke="none"/>`;

export const nostrils = (x1: number, x2: number, y: number, rx = 2.6, ry = 3.6): string =>
  `<ellipse cx="${x1}" cy="${y}" rx="${rx}" ry="${ry}" fill="${INK}" stroke="none"/>` +
  `<ellipse cx="${x2}" cy="${y}" rx="${rx}" ry="${ry}" fill="${INK}" stroke="none"/>`;

export interface Deck {
  id: string;
  name: string;
  /** drawing commands per picture key (wrap with svg()) */
  art: Record<string, string>;
  keys: string[];
  /** full card-back SVG, viewBox 0 0 100 125 */
  back: string;
  /** border colour of the card front */
  frame: string;
}

/** Thick outlined stroke (a body part, a tentacle, a stem). */
export const thick = (d: string, color: string, w: number): string =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 9}"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${w}"/>`;

/** Five-point star path. */
export function star5(cx: number, cy: number, R: number, r: number): string {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? R : r;
    return `${(cx + Math.cos(a) * rad).toFixed(1)} ${(cy + Math.sin(a) * rad).toFixed(1)}`;
  });
  return `M${pts.join(' L')}Z`;
}

/** n evenly spaced rays/spikes around a circle, drawn as small triangles. */
export function spikes(cx: number, cy: number, r1: number, r2: number, n: number, fill: string): string {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const b = 0.16;
    const p = (rad: number, ang: number) => `${(cx + Math.cos(ang) * rad).toFixed(1)} ${(cy + Math.sin(ang) * rad).toFixed(1)}`;
    return `<path d="M${p(r1, a - b)} L${p(r2, a)} L${p(r1, a + b)}Z" fill="${fill}"/>`;
  }).join('');
}

export const smile = (x: number, y: number, w = 12): string =>
  `<path d="M${x - w} ${y} Q${x} ${y + w * 0.9} ${x + w} ${y}" fill="none" stroke-width="3.5"/>`;
