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
export function compose(map: Uint8ClampedArray, colors: RGB[], out: Uint8ClampedArray): void {
  for (let i = 0; i < map.length; i += 4) {
    const part = map[i];
    const alpha = map[i + 3];
    if (!part || !alpha) {
      out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0;
      continue;
    }
    const c = colors[part - 1] ?? [200, 200, 200];
    const shade = map[i + 1] / 100;
    const hi = (map[i + 2] / 255) * SHINE;
    for (let k = 0; k < 3; k++) {
      const v = c[k] * shade;
      out[i + k] = v + (255 - v) * hi;
    }
    out[i + 3] = alpha;
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
