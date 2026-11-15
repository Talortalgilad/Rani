/** The face of a squishy (SPEC-squishy.md 2.6), drawn in code in the style of the other squishies: dark shiny eyes, a small smile. Here only one face (the first of the six), with three states. */
export type FaceState = 'open' | 'blink' | 'squeezed';

export function drawFace(g: CanvasRenderingContext2D, x: number, y: number, size: number, state: FaceState): void {
  const gap = size * 0.34;
  const ry = size * 0.11;
  const rx = size * 0.075;
  g.save();
  g.lineCap = 'round';
  // cheeks
  g.fillStyle = 'rgba(255, 120, 150, .38)';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(x + s * (gap + size * 0.16), y + size * 0.17, size * 0.09, size * 0.06, 0, 0, Math.PI * 2);
    g.fill();
  }
  for (const s of [-1, 1]) {
    const ex = x + s * gap;
    if (state === 'open') {
      g.fillStyle = '#2a1830';
      g.beginPath();
      g.ellipse(ex, y, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.ellipse(ex - rx * 0.3, y - ry * 0.35, rx * 0.34, rx * 0.34, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(ex + rx * 0.35, y + ry * 0.4, rx * 0.17, rx * 0.17, 0, 0, Math.PI * 2);
      g.fill();
    } else {
      // closed eyes: a happy arch (squeezed) or a flat line (a blink)
      g.strokeStyle = '#2a1830';
      g.lineWidth = size * 0.045;
      g.beginPath();
      if (state === 'squeezed') g.arc(ex, y + ry * 0.4, rx * 1.1, Math.PI * 1.1, Math.PI * 1.9);
      else (g.moveTo(ex - rx, y + ry * 0.2), g.lineTo(ex + rx, y + ry * 0.2));
      g.stroke();
    }
  }
  // the mouth: a small smile, a laughing mouth when squeezed
  g.strokeStyle = '#2a1830';
  g.lineWidth = size * 0.04;
  if (state === 'squeezed') {
    g.fillStyle = '#7a2038';
    g.beginPath();
    g.arc(x, y + size * 0.17, size * 0.1, 0, Math.PI);
    g.closePath();
    g.fill();
  } else {
    g.beginPath();
    g.arc(x, y + size * 0.12, size * 0.075, Math.PI * 0.15, Math.PI * 0.85);
    g.stroke();
  }
  g.restore();
}
