/**
 * The panoramas of the zones are not made to repeat: their two edges do not meet. In the parallax every second copy is turned over (a mirror), so that
 * each copy meets the next one with the same edge. Pure: which copies are on the screen, and which of them are mirrored.
 */
export interface Tile { /** the left edge of the copy on the screen, px */ x: number; mirrored: boolean; index: number }

/** The copies of a panorama of width `tileW` that cover the screen of width `W`, when the picture is moved `offset` px to the left. */
export function tilesFor(offset: number, W: number, tileW: number): Tile[] {
  const first = Math.floor(offset / tileW);
  const out: Tile[] = [];
  for (let k = first; k * tileW - offset < W; k++) out.push({ x: k * tileW - offset, mirrored: ((k % 2) + 2) % 2 === 1, index: k });
  return out;
}

/** Draws the panorama (cover: its height fills `h`) with the copies turned over, moving at `par` of the speed of the track. */
export function drawPanorama(g: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x0: number, scale: number, par: number, y: number, h: number, W: number): void {
  const tileW = (img.width * h) / img.height;
  for (const t of tilesFor(x0 * scale * par, W, tileW)) {
    if (t.mirrored) {
      g.save();
      g.translate(t.x + tileW, y);
      g.scale(-1, 1);
      g.drawImage(img, 0, 0, tileW + 1, h);
      g.restore();
    } else g.drawImage(img, t.x, y, tileW + 1, h);
  }
}
