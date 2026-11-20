/**
 * Mixing the colours of the spoons (SPEC-squishy.md 2.3): pure. Paint mixes like paint, not like light: blue and yellow make GREEN, red and yellow make orange, blue and red make
 * purple, and white makes any colour paler. So the hue is averaged on a painter's colour wheel (red, yellow, blue 120 degrees apart: scripts-free table below),
 * weighted by the spoons and by how coloured each colour is; the lightness and the colourfulness are averaged by the spoons (white: very light, not coloured at all).
 */
import { PALETTE, type RGB } from './paint';

export interface Spoons { id: string; n: number }
export const WHITE: RGB = [255, 255, 255];
/** the seven jars: the six colours of the palette and white */
export const JARS: { id: string; he: string; rgb: RGB }[] = [...PALETTE, { id: 'white', he: 'לבן', rgb: WHITE }];
export const MAX_SPOONS = 10;

const rgbOf = (id: string): RGB => JARS.find((j) => j.id === id)?.rgb ?? WHITE;

function toHsl([r, g, b]: RGB): { h: number; s: number; l: number } {
  const R = r / 255, G = g / 255, B = b / 255;
  const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s, l };
}
function fromHsl(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** the painter's wheel: [hue of light (RGB), hue of paint (RYB)] at the corners; between them straight lines (red 0, orange 60, yellow 120, green 180, blue 240, purple 285, pink 330) */
const WHEEL: [number, number][] = [[0, 0], [30, 60], [60, 120], [120, 180], [240, 240], [285, 285], [330, 330], [360, 360]];
function mapHue(h: number, from: 0 | 1): number {
  const to = from === 0 ? 1 : 0;
  for (let i = 0; i < WHEEL.length - 1; i++) {
    const a = WHEEL[i][from], b = WHEEL[i + 1][from];
    if (h >= a && h <= b) return WHEEL[i][to] + ((h - a) / (b - a)) * (WHEEL[i + 1][to] - WHEEL[i][to]);
  }
  return h;
}

/** The colour of the bowl: the spoons, in any order. No spoons: white. */
export function mixSpoons(spoons: Spoons[]): RGB {
  const list = spoons.filter((s) => s.n > 0);
  const total = list.reduce((a, s) => a + s.n, 0);
  if (!total) return WHITE;
  if (list.length === 1) return rgbOf(list[0].id);
  let vx = 0, vy = 0, wsum = 0, sat = 0, light = 0;
  for (const sp of list) {
    const { h, s, l } = toHsl(rgbOf(sp.id));
    const ryb = (mapHue(h, 0) * Math.PI) / 180;
    // a colour that is hardly a colour (white) does not pull the hue
    const w = sp.n * s;
    vx += Math.cos(ryb) * w;
    vy += Math.sin(ryb) * w;
    wsum += w;
    sat += s * sp.n;
    light += l * sp.n;
  }
  sat /= total;
  light /= total;
  if (wsum < 1e-6) return fromHsl(0, 0, light);
  const hue = mapHue(((Math.atan2(vy, vx) * 180) / Math.PI + 360) % 360, 1);
  // two colours that are opposite on the wheel cancel each other: a duller colour, never a brighter one
  const agree = Math.min(1, Math.hypot(vx, vy) / wsum);
  return fromHsl(hue, Math.min(1, sat * (0.55 + 0.45 * agree)), light);
}

/** the id of the palette colour that is nearest to a colour (for "the colour that he likes best"); 'mix' when it is far from all of them */
export function nearestColorId(c: RGB): string {
  let best = 'mix', bd = 90 * 90;
  for (const j of PALETTE) {
    const d = (j.rgb[0] - c[0]) ** 2 + (j.rgb[1] - c[1]) ** 2 + (j.rgb[2] - c[2]) ** 2;
    if (d < bd) (bd = d), (best = j.id);
  }
  return best;
}
