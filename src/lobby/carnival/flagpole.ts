/**
 * The flagpole picture comes out without flags, so the flags are drawn here, in code, on the pole: a few pennants that wave. Everywhere the
 * flagpole is used, it is used through this (a canvas with the picture of the pole and its flags).
 */
export const FLAG_COLORS = ['#ff3b5c', '#ffcf1f', '#1fb6ff', '#2fd44a', '#b45cff'];

/** The flags on a pole whose picture is 512 wide (the pole in the middle, its top at y = 28): the rectangle of each flag. */
export function flagRects(count = 4, phase = 0): { x: number; y: number; w: number; h: number; wave: number; color: string }[] {
  return Array.from({ length: count }, (_, i) => ({
    x: 262,
    y: 46 + i * 58,
    w: 190 - i * 14,
    h: 44,
    wave: Math.sin(phase + i * 0.9) * 8,
    color: FLAG_COLORS[i % FLAG_COLORS.length],
  }));
}

/** Draws the pole with its flags on a 512 x 512 canvas. `img` is the picture of the pole (public/park/items/flagpole.webp), or null while it is loading. */
export function drawFlagpole(g: CanvasRenderingContext2D, img: CanvasImageSource | null, phase = 0): void {
  g.clearRect(0, 0, 512, 512);
  if (img) g.drawImage(img, 0, 0, 512, 512);
  for (const f of flagRects(4, phase)) {
    g.fillStyle = f.color;
    g.beginPath();
    g.moveTo(f.x, f.y);
    g.quadraticCurveTo(f.x + f.w * 0.5, f.y + f.wave, f.x + f.w, f.y + f.h * 0.5 + f.wave * 0.5);
    g.quadraticCurveTo(f.x + f.w * 0.5, f.y + f.h + f.wave, f.x, f.y + f.h);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,.7)';
    g.lineWidth = 3;
    g.stroke();
  }
}
