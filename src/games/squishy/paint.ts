/**
 * Painting a squishy (SPEC-squishy.md 4): the picture of a shape has no colour of its own at run time, only a MAP (scripts/squishy-art.py): in every pixel the part it belongs to,
 * the shading and the highlight. The colour of a part x the shading, and a little white for the highlight, is the squishy: 3D and shiny in any colour, with no picture for each colour.
 * Pure functions over arrays (no DOM), so that they are tested.
 */

export type RGB = [number, number, number];

/** the six colours of the palette (SPEC-squishy.md 2.5): English names, for the voice later */
export const PALETTE: { id: string; he: string; rgb: RGB }[] = [
  { id: 'pink', he: 'ורוד', rgb: [255, 112, 170] },
  { id: 'blue', he: 'כחול', rgb: [64, 140, 255] },
  { id: 'yellow', he: 'צהוב', rgb: [255, 214, 64] },
  { id: 'purple', he: 'סגול', rgb: [160, 98, 232] },
  { id: 'green', he: 'ירוק', rgb: [84, 200, 96] },
  { id: 'red', he: 'אדום', rgb: [240, 68, 80] },
];

/** how much white the highlight adds on top (0..1 of the highlight channel) */
export const SHINE = 0.55;

/**
 * Paints the picture: `map` is the RGBA of the map (R part, G shading x100, B highlight, A alpha), `out` is the RGBA to be filled (the same size), `colors[p-1]` the colour of part p.
 * The colour comes out as it is multiplied, so a pale colour has pale shadows and a deep colour has deep ones, with the shape of the light that was in the picture.
 */
export interface ComposeOpts { /** how much white the highlight adds (default SHINE) */ shine?: number; /** 1 = the shading as it is, less: flatter (matte) */ flat?: number }
export function compose(map: Uint8ClampedArray, colors: RGB[], out: Uint8ClampedArray, soft = 2, o: ComposeOpts = {}): void {
  const shineK = o.shine ?? SHINE;
  const flat = o.flat ?? 1;
  const n = map.length / 4;
  const size = Math.round(Math.sqrt(n));
  const part = (p: number): number => (map[p * 4 + 3] ? map[p * 4] : 0);
  // 1. the flat colour of every pixel (the colour of its part)
  const base = new Float32Array(n * 3);
  for (let p = 0; p < n; p++) {
    const q = part(p);
    if (!q) continue;
    const c = colors[q - 1] ?? [200, 200, 200];
    base[p * 3] = c[0]; base[p * 3 + 1] = c[1]; base[p * 3 + 2] = c[2];
  }
  // 2. a soft border between two parts: the pixels within `soft` pixels of another part take the average of the flat colours around them (a small blur, only there),
  //    so the edge between two colours is not jagged (the ear and the head of the cat). The map itself is not touched: a tap still finds the part it found.
  if (soft > 0) {
    const soften: number[] = [];
    for (let y = soft; y < size - soft; y++) {
      for (let x = soft; x < size - soft; x++) {
        const p = y * size + x;
        const q = part(p);
        if (!q) continue;
        let edge = false;
        for (let dy = -soft; dy <= soft && !edge; dy++) {
          for (let dx = -soft; dx <= soft; dx++) {
            const o = part(p + dy * size + dx);
            if (o && o !== q) { edge = true; break; }
          }
        }
        if (edge) soften.push(p);
      }
    }
    const blurred = new Float32Array(soften.length * 3);
    soften.forEach((p, i) => {
      const x = p % size, y = (p / size) | 0;
      let w = 0, r = 0, g = 0, b = 0;
      for (let dy = -soft; dy <= soft; dy++) {
        for (let dx = -soft; dx <= soft; dx++) {
          const o = (y + dy) * size + x + dx;
          if (!part(o)) continue;
          const k = 1 / (1 + dx * dx + dy * dy);
          w += k; r += base[o * 3] * k; g += base[o * 3 + 1] * k; b += base[o * 3 + 2] * k;
        }
      }
      blurred[i * 3] = r / w; blurred[i * 3 + 1] = g / w; blurred[i * 3 + 2] = b / w;
    });
    soften.forEach((p, i) => { base[p * 3] = blurred[i * 3]; base[p * 3 + 1] = blurred[i * 3 + 1]; base[p * 3 + 2] = blurred[i * 3 + 2]; });
  }
  // 3. the shading and the highlight
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (!part(p)) {
      out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0;
      continue;
    }
    const shade = 1 + (map[i + 1] / 100 - 1) * flat;
    const hi = (map[i + 2] / 255) * shineK;
    for (let k = 0; k < 3; k++) {
      const v = base[p * 3 + k] * shade;
      out[i + k] = v + (255 - v) * hi;
    }
    out[i + 3] = map[i + 3];
  }
}

/**
 * The part under a finger at (x, y) of the picture (pixels of the map). A small part (an ear, a tail) has a wider reach: the parts within `reach` pixels are looked at, and
 * when more than one is there, the smaller part wins (the finger of a child does not hit an ear of 20 pixels exactly). Returns 0 when there is nothing near.
 */
export function partAt(map: Uint8ClampedArray, size: number, x: number, y: number, areas: number[], reach = 12): number {
  const cx = Math.round(x), cy = Math.round(y);
  const at = (px: number, py: number): number => (px < 0 || py < 0 || px >= size || py >= size ? 0 : map[(py * size + px) * 4 + 3] > 20 ? map[(py * size + px) * 4] : 0);
  const exact = at(cx, cy);
  const found = new Set<number>();
  if (exact) found.add(exact);
  for (let dy = -reach; dy <= reach; dy += 2) {
    for (let dx = -reach; dx <= reach; dx += 2) {
      if (dx * dx + dy * dy > reach * reach) continue;
      const p = at(cx + dx, cy + dy);
      if (p) found.add(p);
    }
  }
  if (!found.size) return 0;
  // the exact part wins unless a smaller part is near enough to be meant
  let best = exact || [...found][0];
  for (const p of found) if ((areas[p - 1] ?? 1) < (areas[best - 1] ?? 1) * (exact ? 0.5 : 1)) best = p;
  return best;
}
