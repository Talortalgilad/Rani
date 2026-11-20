/** The faces of the squishies (SPEC-squishy.md 2.6): 6 pairs of eyes, 6 mouths, 4 kinds of cheeks, all drawn in code, in the style of the other squishies (dark shiny eyes, a small smile). */
export type FaceState = 'open' | 'blink' | 'squeezed';
export interface FaceParts { eyes: number; mouth: number; cheeks: number }
export const EYES = 6, MOUTHS = 6, CHEEKS = 4;
export const DEFAULT_FACE: FaceParts = { eyes: 0, mouth: 0, cheeks: 1 };
const INK = '#2a1830';

export function drawEyes(g: CanvasRenderingContext2D, x: number, y: number, size: number, kind: number, state: FaceState, look: { x: number; y: number }): void {
  const gap = size * 0.34;
  const rx = size * 0.075, ry = size * 0.11;
  g.save();
  g.lineCap = 'round';
  for (const s of [-1, 1]) {
    const ex = x + s * gap;
    if (state !== 'open') {
      // closed: a happy arch (squeezed) or a flat line (a blink)
      g.strokeStyle = INK;
      g.lineWidth = size * 0.045;
      g.beginPath();
      if (state === 'squeezed') g.arc(ex, y + ry * 0.4, rx * 1.1, Math.PI * 1.1, Math.PI * 1.9);
      else (g.moveTo(ex - rx, y + ry * 0.2), g.lineTo(ex + rx, y + ry * 0.2));
      g.stroke();
      continue;
    }
    const lx = ex + look.x * rx * 0.55, ly = y + look.y * ry * 0.45;
    g.fillStyle = INK;
    const shine = (r: number): void => {
      g.fillStyle = '#fff';
      g.beginPath();
      g.ellipse(lx - r * 0.35, ly - r * 0.4, r * 0.38, r * 0.38, 0, 0, Math.PI * 2);
      g.fill();
    };
    if (kind === 0) {            // round, shiny
      g.beginPath(); g.ellipse(lx, ly, rx, ry, 0, 0, Math.PI * 2); g.fill(); shine(rx);
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(lx + rx * 0.35, ly + ry * 0.4, rx * 0.17, rx * 0.17, 0, 0, Math.PI * 2); g.fill();
    } else if (kind === 1) {     // big, two shines
      g.beginPath(); g.ellipse(lx, ly, rx * 1.35, ry * 1.4, 0, 0, Math.PI * 2); g.fill(); shine(rx * 1.35);
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(lx + rx * 0.5, ly + ry * 0.55, rx * 0.25, rx * 0.25, 0, 0, Math.PI * 2); g.fill();
    } else if (kind === 2) {     // happy arches (always)
      g.strokeStyle = INK; g.lineWidth = size * 0.05; g.beginPath(); g.arc(ex, y + ry * 0.5, rx * 1.2, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    } else if (kind === 3) {     // sleepy: half closed
      g.beginPath(); g.ellipse(lx, ly + ry * 0.2, rx, ry * 0.7, 0, 0, Math.PI); g.fill();
      g.strokeStyle = INK; g.lineWidth = size * 0.04; g.beginPath(); g.moveTo(ex - rx * 1.3, ly + ry * 0.15); g.lineTo(ex + rx * 1.3, ly + ry * 0.15); g.stroke();
    } else if (kind === 4) {     // stars
      g.fillStyle = '#ffb703';
      g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 ? rx * 0.75 : rx * 1.7; g.lineTo(lx + Math.cos(a) * r, ly + Math.sin(a) * r); }
      g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = size * 0.025; g.stroke();
    } else {                     // small dots
      g.beginPath(); g.ellipse(lx, ly, rx * 0.62, rx * 0.62, 0, 0, Math.PI * 2); g.fill();
    }
  }
  g.restore();
}

export function drawMouth(g: CanvasRenderingContext2D, x: number, y: number, size: number, kind: number, state: FaceState): void {
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = INK; g.fillStyle = '#7a2038';
  g.lineWidth = size * 0.04;
  const cy = y + size * 0.12;
  if (state === 'squeezed') {   // a laughing mouth whatever the mouth is
    g.beginPath(); g.arc(x, y + size * 0.17, size * 0.1, 0, Math.PI); g.closePath(); g.fill();
  } else if (kind === 0) { g.beginPath(); g.arc(x, cy, size * 0.075, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); }
  else if (kind === 1) { g.beginPath(); g.arc(x, cy - size * 0.02, size * 0.09, 0, Math.PI); g.closePath(); g.fill(); }
  else if (kind === 2) { g.beginPath(); g.arc(x - size * 0.05, cy, size * 0.05, Math.PI * 0.1, Math.PI * 0.9); g.arc(x + size * 0.05, cy, size * 0.05, Math.PI * 0.1, Math.PI * 0.9); g.stroke(); }
  else if (kind === 3) { g.beginPath(); g.ellipse(x, cy + size * 0.02, size * 0.04, size * 0.055, 0, 0, Math.PI * 2); g.fill(); }
  else if (kind === 4) { g.beginPath(); g.arc(x, cy, size * 0.08, Math.PI * 0.1, Math.PI * 0.9); g.stroke(); g.fillStyle = '#ff6f91'; g.beginPath(); g.ellipse(x + size * 0.02, cy + size * 0.1, size * 0.04, size * 0.055, 0, 0, Math.PI * 2); g.fill(); }
  else { g.beginPath(); g.moveTo(x - size * 0.1, cy - size * 0.01); g.quadraticCurveTo(x, cy + size * 0.1, x + size * 0.1, cy - size * 0.01); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.stroke(); }
  g.restore();
}

export function drawCheeks(g: CanvasRenderingContext2D, x: number, y: number, size: number, kind: number): void {
  if (kind === 0) return;
  const gap = size * 0.34 + size * 0.16;
  g.save();
  for (const s of [-1, 1]) {
    const cx = x + s * gap, cy = y + size * 0.17;
    if (kind === 1) { g.fillStyle = 'rgba(255,120,150,.38)'; g.beginPath(); g.ellipse(cx, cy, size * 0.09, size * 0.06, 0, 0, Math.PI * 2); g.fill(); }
    else if (kind === 2) { g.strokeStyle = 'rgba(255,90,130,.6)'; g.lineWidth = size * 0.025; g.lineCap = 'round'; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(cx + i * size * 0.035 - size * 0.015, cy + size * 0.035); g.lineTo(cx + i * size * 0.035 + size * 0.015, cy - size * 0.035); g.stroke(); } }
    else { g.fillStyle = 'rgba(150,80,60,.5)'; for (const [dx, dy] of [[-0.04, -0.02], [0.02, -0.03], [0.0, 0.025], [0.05, 0.02], [-0.045, 0.03]]) { g.beginPath(); g.arc(cx + dx * size, cy + dy * size, size * 0.011, 0, Math.PI * 2); g.fill(); } }
  }
  g.restore();
}

export function drawFace(g: CanvasRenderingContext2D, x: number, y: number, size: number, state: FaceState, look: { x: number; y: number }, parts: FaceParts = DEFAULT_FACE): void {
  drawCheeks(g, x, y, size, parts.cheeks);
  drawEyes(g, x, y, size, parts.eyes, state, look);
  drawMouth(g, x, y, size, parts.mouth, state);
}
