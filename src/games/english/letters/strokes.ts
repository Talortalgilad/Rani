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
/** The bowl of a, d, g, q (starts top right, goes round to the left, counterclockwise). */
const bowl = (): Stroke => arc(47, 58, 15, 17, -40, -375);
/** The bowl of b and p (starts at the stem, goes clockwise). */
const bowlR = (): Stroke => arc(49, 57, 13, 17, 200, 560);
const dot = (x: number, y: number): Stroke => line([x, y], [x, y + 0.5]);
/** The big bowls of B, P and R: a line out of the stem and round. */
const bumpP = (): Stroke => [...line([35, 10], [50, 10]), ...arc(50, 24, 16, 14, -90, 90, 10), ...line([35, 38])];

export const STROKES: Record<string, Glyph> = {
  s: { lower: [ess(40, 75)], upper: [ess(10, 75)] },
  a: { lower: [bowl(), line([62, 41], [62, 58], [62, 75])], upper: [line([50, 10], [39, 42], [28, 75]), line([50, 10], [61, 42], [72, 75]), line([36, 56], [50, 56], [64, 56])] },
  t: { lower: [[...line([46, 15], [46, 40], [46, 62]), ...arc(54, 62, 8, 12, 180, 90, 6)], line([34, 40], [47, 40], [60, 40])], upper: [line([28, 10], [50, 10], [72, 10]), line([50, 10], [50, 42], [50, 75])] },
  p: { lower: [line([36, 40], [36, 70], [36, 100]), bowlR()], upper: [line([35, 10], [35, 42], [35, 75]), bumpP()] },
  i: { lower: [line([48, 40], [48, 58], [48, 75]), dot(48, 24)], upper: [line([50, 10], [50, 42], [50, 75])] },
  n: { lower: [line([36, 40], [36, 58], [36, 75]), line([36, 52], [40, 43], [48, 40], [56, 43], [60, 52], [60, 63], [60, 75])], upper: [line([34, 75], [34, 42], [34, 10], [50, 42], [66, 75], [66, 42], [66, 10])] },
  m: { lower: [line([28, 40], [28, 58], [28, 75]), line([28, 52], [32, 43], [39, 40], [45, 44], [47, 52], [47, 75]), line([47, 52], [51, 43], [58, 40], [64, 44], [66, 52], [66, 75])], upper: [line([30, 75], [30, 42], [30, 10], [50, 50], [70, 10], [70, 42], [70, 75])] },
  d: { lower: [bowl(), line([62, 10], [62, 42], [62, 75])], upper: [line([34, 10], [34, 42], [34, 75]), line([34, 10], [48, 10], [62, 22], [66, 42], [62, 62], [48, 75], [34, 75])] },
  g: { lower: [bowl(), [...line([62, 41], [62, 70], [62, 88]), ...line([58, 97], [48, 100], [38, 95])]], upper: [[...arc(52, 42, 22, 33, -40, -340, 20), ...line([74, 44], [54, 44])]] },
  o: { lower: [arc(50, 58, 15, 17, -90, -450, 24)], upper: [arc(50, 42, 24, 33, -90, -450, 24)] },
  c: { lower: [arc(51, 58, 16, 17, -40, -320, 18)], upper: [arc(52, 42, 22, 33, -45, -315, 20)] },
  k: { lower: [line([36, 10], [36, 42], [36, 75]), line([62, 40], [36, 58]), line([46, 52], [64, 75])], upper: [line([36, 10], [36, 42], [36, 75]), line([66, 10], [36, 46]), line([46, 38], [68, 75])] },
  e: { lower: [[...line([35, 58], [50, 58], [65, 58]), ...arc(50, 58, 15, 17, 0, -320, 18)]], upper: [line([66, 10], [36, 10], [36, 42], [36, 75], [66, 75]), line([36, 42], [60, 42])] },
  u: { lower: [line([36, 40], [36, 62], [40, 72], [48, 76], [56, 72], [62, 62]), line([62, 40], [62, 58], [62, 75])], upper: [line([34, 10], [34, 58], [40, 70], [50, 75], [60, 70], [66, 58], [66, 10])] },
  r: { lower: [line([38, 40], [38, 58], [38, 75]), line([38, 52], [42, 44], [50, 40], [58, 41])], upper: [line([34, 10], [34, 42], [34, 75]), bumpP(), line([48, 42], [66, 75])] },
  h: { lower: [line([36, 10], [36, 42], [36, 75]), line([36, 52], [42, 44], [50, 40], [58, 44], [62, 52], [62, 63], [62, 75])], upper: [line([34, 10], [34, 42], [34, 75]), line([66, 10], [66, 42], [66, 75]), line([34, 42], [50, 42], [66, 42])] },
  b: { lower: [line([36, 10], [36, 42], [36, 75]), bowlR()], upper: [line([34, 10], [34, 42], [34, 75]), line([34, 10], [50, 10], [60, 16], [60, 26], [50, 40], [34, 40]), line([34, 40], [52, 40], [64, 48], [64, 64], [52, 75], [34, 75])] },
  f: { lower: [line([62, 16], [54, 11], [46, 14], [44, 24], [44, 40], [44, 75]), line([32, 40], [45, 40], [58, 40])], upper: [line([64, 10], [36, 10], [36, 42], [36, 75]), line([36, 42], [58, 42])] },
  l: { lower: [line([48, 10], [48, 42], [48, 75])], upper: [line([36, 10], [36, 42], [36, 75], [50, 75], [64, 75])] },
  j: { lower: [[...line([52, 40], [52, 70], [52, 88]), ...line([48, 97], [40, 99], [34, 94])], dot(52, 24)], upper: [line([60, 10], [60, 42], [60, 58], [56, 70], [46, 75], [38, 70], [34, 62])] },
  v: { lower: [line([34, 40], [41, 58], [48, 75], [55, 58], [62, 40])], upper: [line([30, 10], [40, 42], [50, 75], [60, 42], [70, 10])] },
  w: { lower: [line([28, 40], [33, 58], [38, 75], [44, 62], [50, 48], [56, 62], [62, 75], [67, 58], [72, 40])], upper: [line([24, 10], [30, 42], [36, 75], [43, 52], [50, 30], [57, 52], [64, 75], [70, 42], [76, 10])] },
  x: { lower: [line([36, 40], [50, 58], [64, 75]), line([64, 40], [50, 58], [36, 75])], upper: [line([34, 10], [50, 42], [66, 75]), line([66, 10], [50, 42], [34, 75])] },
  y: { lower: [line([36, 40], [42, 56], [49, 72]), line([63, 40], [55, 64], [46, 86], [38, 98])], upper: [line([32, 10], [41, 28], [50, 44]), line([68, 10], [59, 28], [50, 44], [50, 60], [50, 75])] },
  z: { lower: [line([36, 40], [49, 40], [62, 40], [49, 58], [36, 75], [50, 75], [64, 75])], upper: [line([34, 10], [50, 10], [66, 10], [50, 42], [34, 75], [50, 75], [66, 75])] },
  q: { lower: [bowl(), line([62, 41], [62, 70], [62, 100])], upper: [arc(50, 42, 24, 33, -90, -450, 24), line([50, 58], [60, 68], [72, 80])] },
};
/** A dot (the dot of i and j): a stroke that is a point, written with a tap. */
export const isDot = (s: Stroke): boolean => s.length >= 2 && Math.hypot(s[0].x - s[s.length - 1].x, s[0].y - s[s.length - 1].y) < 2 && s.length === 2;
export const hasStrokes = (letter: string): boolean => letter in STROKES;
