/**
 * How each letter is written: its strokes in order, each a line of points in a box of 100 x 100 (y down): the ascender line is at y = 10,
 * the x-height line at 40, the baseline at 75 and the descender at 100. A stroke goes in the direction that it is written (left to right, top to bottom).
 */
export type Pt = { x: number; y: number };
export type Stroke = Pt[];

const P = (x: number, y: number): Pt => ({ x, y });
/** Points of an ellipse arc; angles in degrees (y is down, so a growing angle turns clockwise on the screen). */
function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 18): Stroke {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    return P(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
  });
}
const line = (...p: [number, number][]): Stroke => p.map(([x, y]) => P(x, y));
/** An S between two heights (the small s and the capital S are the same curve). */
const ess = (top: number, bottom: number): Stroke => {
  const h = bottom - top;
  const at = (x: number, t: number): Pt => P(x, top + h * t);
  return [at(66, 0.17), at(60, 0.05), at(50, 0), at(40, 0.04), at(34, 0.16), at(37, 0.3), at(46, 0.42), at(56, 0.52), at(64, 0.66), at(66, 0.8), at(61, 0.93), at(51, 1), at(41, 0.97), at(34, 0.86)];
};

export interface Glyph { lower: Stroke[]; upper: Stroke[] }
export const STROKES: Record<string, Glyph> = {
  s: { lower: [ess(40, 75)], upper: [ess(10, 75)] },
  a: { lower: [arc(47, 58, 15, 17, -40, -375), line([62, 41], [62, 58], [62, 75])], upper: [line([50, 10], [39, 42], [28, 75]), line([50, 10], [61, 42], [72, 75]), line([36, 56], [50, 56], [64, 56])] },
  t: { lower: [[...line([46, 15], [46, 40], [46, 62]), ...arc(54, 62, 8, 12, 180, 90, 6).slice(0)], line([34, 40], [47, 40], [60, 40])], upper: [line([28, 10], [50, 10], [72, 10]), line([50, 10], [50, 42], [50, 75])] },
  p: { lower: [line([36, 40], [36, 70], [36, 100]), arc(49, 57, 13, 17, 200, 560)], upper: [line([35, 10], [35, 42], [35, 75]), [...line([35, 10], [50, 10]), ...arc(50, 24, 16, 14, -90, 90, 10), ...line([35, 38])]] },
};
export const hasStrokes = (letter: string): boolean => letter in STROKES;
