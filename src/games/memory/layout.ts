export const GAP = 8;
export const ASPECT = 0.8; // card width / height
export const MIN_CARD = 56;

/** Card width that fills the area for a cols × rows board; never below 56px. */
export function cardWidth(areaW: number, areaH: number, cols: number, rows: number): number {
  const byWidth = (areaW - GAP * (cols - 1)) / cols;
  const byHeight = ((areaH - GAP * (rows - 1)) / rows) * ASPECT;
  return Math.max(MIN_CARD, Math.min(byWidth, byHeight));
}

/** True when the grid fits without scrolling. */
export function fits(areaW: number, areaH: number, cols: number, rows: number): boolean {
  const cw = cardWidth(areaW, areaH, cols, rows);
  return cw * cols + GAP * (cols - 1) <= areaW + 0.5 && (cw / ASPECT) * rows + GAP * (rows - 1) <= areaH + 0.5;
}
