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
