import type { Board } from './board';
import type { Piece } from './pieces';

/**
 * Dragging (SPEC-blocks.md 2.4). The shape floats ABOVE the finger: its bottom edge is 1.5 cells over the touch point, so that the finger
 * never hides it. Where it would land is the nearest legal place (tolerance: a place up to 0.9 of a cell away is still taken). Pure geometry.
 */
export const LIFT_CELLS = 1.5;
export const TOLERANCE = 0.9;

export interface Geometry { /** top-left corner of the board on the canvas, in px */ x: number; y: number; cell: number }

/** Where the top-left cell of the shape is, in cells (not rounded), when the finger is at (px, py). */
export function floatingAnchor(geo: Geometry, p: Piece, px: number, py: number): { r: number; c: number } {
  return { c: (px - geo.x) / geo.cell - p.w / 2, r: (py - geo.y) / geo.cell - p.h - LIFT_CELLS };
}

/** The finger position where the shape's top-left would be at a given place (the inverse, for tests and for returning to a slot). */
export function fingerFor(geo: Geometry, p: Piece, r: number, c: number): { x: number; y: number } {
  return { x: geo.x + (c + p.w / 2) * geo.cell, y: geo.y + (r + p.h + LIFT_CELLS) * geo.cell };
}

export interface Landing { r: number; c: number; /** the place that is exactly under the shape (no tolerance was needed) */ exact: boolean }

/**
 * The legal place that the shape lands on: the nearest whole cell if it is legal, otherwise the nearest legal place within the tolerance;
 * null when there is none (the shape goes back to the tray).
 */
export function landing(board: Board, p: Piece, fr: number, fc: number, tolerance = TOLERANCE): Landing | null {
  const r0 = Math.round(fr);
  const c0 = Math.round(fc);
  if (board.canPlace(p, r0, c0)) return { r: r0, c: c0, exact: true };
  let best: Landing | null = null;
  let bestD = Infinity;
  for (let r = Math.floor(fr) - 1; r <= Math.ceil(fr) + 1; r++) {
    for (let c = Math.floor(fc) - 1; c <= Math.ceil(fc) + 1; c++) {
      if (!board.canPlace(p, r, c)) continue;
      const d = Math.hypot(r - fr, c - fc);
      if (d <= tolerance && d < bestD) (best = { r, c, exact: false }), (bestD = d);
    }
  }
  return best;
}
