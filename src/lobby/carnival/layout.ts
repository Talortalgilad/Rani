/**
 * The plan of the carnival island (SPEC-carnival.md 2, 5): a round island, a ring path with a cross path, a plaza in the middle with the star jar,
 * and a plot for every game round the outside. Pure: numbers only.
 */
export const ISLAND_R = 10.4;
export const RING_R = 4.9;
export const PLAZA_R = 1.9;
export const PATH_W = 1.1;
/** the plots of the games sit on this circle */
export const PLOT_R = 7.7;
export const PLOT_PAD = 1.55;
export const RING_NODES = 16;

export interface Plot { x: number; z: number; /** the angle from the middle, 0 at the top of the screen (the far side) and growing clockwise seen from above */ angle: number }

/** The plots for `n` things (games and the locked tents), evenly round the island; the first one is at the back, to the left of the middle. */
export function plots(n: number): Plot[] {
  return Array.from({ length: n }, (_, i) => {
    // from the back-left going clockwise, with the front (the camera side) left to the cross path
    const angle = (i / n) * Math.PI * 2 + Math.PI / n - Math.PI / 2 * 0;
    return { x: Math.sin(angle) * PLOT_R, z: -Math.cos(angle) * PLOT_R, angle };
  });
}

/** The nearest distance between two plots' pads: they must not touch. */
export function minGap(ps: Plot[]): number {
  let m = Infinity;
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) m = Math.min(m, Math.hypot(ps[i].x - ps[j].x, ps[i].z - ps[j].z) - 2 * PLOT_PAD);
  return m;
}
