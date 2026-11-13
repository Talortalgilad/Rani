/** The side view (SPEC-park.md 2 and 3.1): the sky and the hills of the candy hills, the track with its sleepers and its pillars, the train. Drawing only. */
import { CHAIN_X0, CREST, END, G, START_PTS, WORLD_H, WORLD_W, at, type Path, type Pt, type Track } from './track';

export interface View {
  /** the world x at the left edge of the screen, the scale (px per unit) and the screen y of the ground */
  x0: number;
  s: number;
  y0: number;
  W: number;
  H: number;
}
export const toX = (v: View, x: number): number => (x - v.x0) * v.s;
export const toY = (v: View, y: number): number => v.y0 - y * v.s;
export const fromX = (v: View, px: number): number => px / v.s + v.x0;
export const fromY = (v: View, py: number): number => (v.y0 - py) / v.s;

/** The view of a canvas of W x H px: the ten units of height fill it; `overview` shows the whole world. */
export function makeView(W: number, H: number, x0: number, overview: boolean): View {
  const top = Math.max(76, H * 0.11);
  const bottom = Math.max(124, H * 0.17);
  const full = (H - top - bottom) / WORLD_H;
  const s = overview ? Math.min(full, W / (WORLD_W + 2)) : full;
  const y0 = overview ? H - bottom - (WORLD_H * (full - s)) / 2 : H - bottom;
  return { x0: overview ? -1 : x0, s, y0: overview ? Math.max(y0, H * 0.7) : y0, W, H };
}

export interface Look {
  /** the colour of the track */
  track: string;
  /** the pictures of the passengers: the first car, the others */
  riders: (HTMLImageElement | null)[];
}
export const CAR_GAP = 0.95;
const CAR_COLORS = ['#ff7aa8', '#ffb84d', '#5ad1ff'];

const hill = (x: number, seed: number): number => Math.sin(x * 0.7 + seed) * 0.5 + Math.sin(x * 0.31 + seed * 2) * 0.7 + Math.sin(x * 1.3 + seed * 3) * 0.12;

/** The sky and the three layers of the background (parallax): far hills, near hills, the ground with candy canes and lollipops. */
export function drawBackground(g: CanvasRenderingContext2D, v: View, t: number): void {
  const { W, H } = v;
  const sky = g.createLinearGradient(0, 0, 0, v.y0);
  sky.addColorStop(0, '#ffd6f0');
  sky.addColorStop(0.55, '#ffe9f7');
  sky.addColorStop(1, '#fff3d6');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  // soft clouds, slowly moving
  g.fillStyle = 'rgba(255,255,255,.85)';
  for (let i = 0; i < 6; i++) {
    const cx = ((i * 211 + t * 6) % (W + 200)) - 100 - v.x0 * v.s * 0.08;
    const wrapped = ((cx % (W + 200)) + (W + 200)) % (W + 200) - 100;
    const cy = 40 + ((i * 53) % 90);
    g.beginPath();
    g.ellipse(wrapped, cy, 46, 16, 0, 0, Math.PI * 2);
    g.ellipse(wrapped + 26, cy - 10, 30, 14, 0, 0, Math.PI * 2);
    g.ellipse(wrapped - 28, cy - 6, 26, 12, 0, 0, Math.PI * 2);
    g.fill();
  }
  const layer = (par: number, base: number, amp: number, color: string, seed: number): void => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, H);
    for (let px = 0; px <= W + 8; px += 8) {
      const wx = px / v.s + v.x0 * par;
      g.lineTo(px, v.y0 - base * v.s - hill(wx, seed) * amp * v.s);
    }
    g.lineTo(W, H);
    g.closePath();
    g.fill();
  };
  layer(0.25, 3.4, 0.9, '#e7d4ff', 1);
  layer(0.5, 1.6, 0.6, '#c9f0dd', 4);
  // the ground
  const ground = g.createLinearGradient(0, v.y0, 0, H);
  ground.addColorStop(0, '#ffb3d2');
  ground.addColorStop(1, '#ff8fb8');
  g.fillStyle = ground;
  g.fillRect(0, v.y0, W, H - v.y0);
  g.fillStyle = '#ffd1e4';
  g.fillRect(0, v.y0, W, Math.max(4, v.s * 0.12));
  // candy canes and lollipops on the ground
  for (let k = 0; k < 14; k++) {
    const wx = k * 2.3 + ((k * 7) % 5) * 0.2;
    const px = toX(v, wx);
    if (px < -40 || px > W + 40) continue;
    const h = v.s * (0.7 + ((k * 3) % 4) * 0.15);
    const base = v.y0 + Math.max(10, H - v.y0) * 0.35;
    g.strokeStyle = '#fff';
    g.lineWidth = Math.max(3, v.s * 0.08);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(px, base);
    g.lineTo(px, base - h);
    g.stroke();
    g.fillStyle = ['#ff5d8f', '#ffb84d', '#7ad7ff', '#b58cff'][k % 4];
    g.beginPath();
    g.arc(px, base - h, v.s * 0.2, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,.8)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(px, base - h, v.s * 0.12, 0, Math.PI * 1.6);
    g.stroke();
  }
}

/** The lines of the heights 1-10 with their numbers at the left edge of the screen. */
export function drawHeights(g: CanvasRenderingContext2D, v: View): void {
  g.save();
  g.lineWidth = 1;
  g.font = `bold ${Math.max(11, v.s * 0.28)}px system-ui, sans-serif`;
  g.textBaseline = 'middle';
  for (let h = 1; h <= WORLD_H; h++) {
    const y = toY(v, h);
    g.strokeStyle = h % 5 === 0 ? 'rgba(120,70,150,.28)' : 'rgba(120,70,150,.14)';
    g.setLineDash([2, 6]);
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(v.W, y);
    g.stroke();
  }
  g.setLineDash([]);
  g.textAlign = 'left';
  for (let h = 1; h <= WORLD_H; h++) {
    g.fillStyle = 'rgba(255,255,255,.8)';
    g.beginPath();
    g.roundRect(2, toY(v, h) - v.s * 0.19, v.s * 0.5, v.s * 0.38, 6);
    g.fill();
    g.fillStyle = '#7a4a9a';
    g.fillText(String(h), 2 + v.s * 0.1, toY(v, h) + 1);
  }
  g.restore();
}

/** The stations, with the chain of the lift. */
export function drawStations(g: CanvasRenderingContext2D, v: View, path: Path): void {
  const s = v.s;
  // the start: a little house
  const px = toX(v, -0.3);
  const gy = toY(v, 1.5);
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#ff5d8f';
  g.lineWidth = Math.max(3, s * 0.07);
  g.beginPath();
  g.roundRect(px - s * 1.6, gy - s * 1.2, s * 2.2, s * 1.2, s * 0.15);
  g.fill();
  g.stroke();
  g.fillStyle = '#ff5d8f';
  g.beginPath();
  g.moveTo(px - s * 1.75, gy - s * 1.2);
  g.lineTo(px - s * 0.5, gy - s * 1.75);
  g.lineTo(px + s * 0.75, gy - s * 1.2);
  g.fill();
  // the chain: little teeth along the lift
  g.strokeStyle = '#6a5a7a';
  g.lineWidth = Math.max(2, s * 0.05);
  const x0 = Math.max(0, Math.floor(0)), n = path.n;
  for (let i = 0; i < n; i += 6) {
    if (path.x[i] < CHAIN_X0 || path.s[i] > path.crestS) continue;
    const a = path.th[i];
    const cx = toX(v, path.x[i]), cy = toY(v, path.y[i]);
    g.beginPath();
    g.moveTo(cx - Math.sin(a) * s * 0.17, cy - Math.cos(a) * s * 0.17);
    g.lineTo(cx + Math.sin(a) * s * 0.17, cy + Math.cos(a) * s * 0.17);
    g.stroke();
  }
  void x0;
  // the end: a banner
  const ex = toX(v, END.x + 1.4);
  const ey = toY(v, END.y);
  g.fillStyle = '#ffffff';
  g.fillRect(ex - 2, ey - s * 1.6, 4, s * 1.6);
  const cells = 6;
  for (let k = 0; k < cells; k++) {
    g.fillStyle = k % 2 ? '#333' : '#fff';
    g.fillRect(ex + (k % 3) * s * 0.18, ey - s * 1.6 + Math.floor(k / 3) * s * 0.18, s * 0.18, s * 0.18);
  }
  g.strokeStyle = '#555';
  g.lineWidth = 2;
  g.strokeRect(ex, ey - s * 1.6, s * 0.54, s * 0.36);
  g.fillStyle = '#ff5d8f';
  g.beginPath();
  g.roundRect(toX(v, END.x + 0.4), ey + 2, s * 2.8, s * 0.22, 4);
  g.fill();
}

/** The track: pillars, sleepers, the two rails. */
export function drawTrack(g: CanvasRenderingContext2D, v: View, path: Path, color: string): void {
  const s = v.s;
  const n = path.n;
  g.lineCap = 'round';
  // the pillars go down to the ground, under the track, not inside the loop
  g.strokeStyle = 'rgba(110,80,140,.55)';
  g.lineWidth = Math.max(3, s * 0.09);
  let lastP = -9;
  for (let i = 0; i < n; i += 5) {
    const x = path.x[i];
    if (x - lastP < 1.3 || path.inLoop[i]) continue;
    const px = toX(v, x);
    if (px < -20 || px > v.W + 20) continue;
    lastP = x;
    const py = toY(v, path.y[i]);
    if (toY(v, 0) - py < s * 0.35) continue;
    g.beginPath();
    g.moveTo(px, py + s * 0.1);
    g.lineTo(px, toY(v, 0));
    g.stroke();
    g.fillStyle = 'rgba(110,80,140,.55)';
    g.fillRect(px - s * 0.18, toY(v, 0) - 3, s * 0.36, 5);
  }
  // sleepers
  g.strokeStyle = 'rgba(70,40,90,.55)';
  g.lineWidth = Math.max(2, s * 0.06);
  for (let i = 0; i < n; i += 8) {
    const px = toX(v, path.x[i]);
    if (px < -20 || px > v.W + 20) continue;
    const py = toY(v, path.y[i]);
    const a = path.th[i];
    g.beginPath();
    g.moveTo(px + Math.sin(a) * s * 0.22, py + Math.cos(a) * s * 0.22);
    g.lineTo(px - Math.sin(a) * s * 0.22, py - Math.cos(a) * s * 0.22);
    g.stroke();
  }
  // the rails
  const line = (w: number, c: string): void => {
    g.strokeStyle = c;
    g.lineWidth = w;
    g.beginPath();
    let started = false;
    for (let i = 0; i < n; i += 2) {
      const px = toX(v, path.x[i]);
      if (px < -30 || px > v.W + 30) {
        started = false;
        continue;
      }
      if (!started) g.moveTo(px, toY(v, path.y[i]));
      else g.lineTo(px, toY(v, path.y[i]));
      started = true;
    }
    g.stroke();
  };
  line(Math.max(5, s * 0.17), 'rgba(60,20,60,.3)');
  line(Math.max(4, s * 0.14), color);
  line(Math.max(1.5, s * 0.04), 'rgba(255,255,255,.7)');
}

/** The handles of the points (to move a hill up or down). */
export function drawHandles(g: CanvasRenderingContext2D, v: View, t: Track, selected: number): void {
  t.pts.forEach((p, i) => {
    const fixed = i === 0 || (t.complete && i === t.pts.length - 1);
    const px = toX(v, p.x), py = toY(v, p.y);
    if (px < -20 || px > v.W + 20) return;
    g.beginPath();
    g.arc(px, py, Math.max(6, v.s * (fixed ? 0.14 : 0.2)), 0, Math.PI * 2);
    g.fillStyle = fixed ? '#cfc3dc' : i === selected ? '#ffd23f' : '#ffffff';
    g.fill();
    g.lineWidth = 2.5;
    g.strokeStyle = fixed ? '#8a7aa0' : '#ff5d8f';
    g.stroke();
  });
}

/** The train: three cars, the first with the companion; hands up on the way down. `s` is the distance of the front. */
export function drawTrain(g: CanvasRenderingContext2D, v: View, path: Path, s: number, speed: number, look: Look, t: number): void {
  const k = v.s;
  for (let c = 2; c >= 0; c--) {
    const p = at(path, Math.max(0.2, s - c * CAR_GAP));
    const px = toX(v, p.x), py = toY(v, p.y);
    g.save();
    g.translate(px, py);
    g.rotate(-p.th);
    const w = k * 0.82, h = k * 0.4;
    // wheels
    g.fillStyle = '#4a3a5a';
    g.beginPath();
    g.arc(-w * 0.28, -k * 0.02, k * 0.08, 0, Math.PI * 2);
    g.arc(w * 0.28, -k * 0.02, k * 0.08, 0, Math.PI * 2);
    g.fill();
    // the rider
    const img = look.riders[c];
    const down = p.th < -0.25 && speed > 1.5;
    if (img && img.complete && img.naturalWidth) g.drawImage(img, -k * 0.34, -h - k * 0.72, k * 0.68, k * 0.68);
    else {
      g.fillStyle = '#ffe9a8';
      g.beginPath();
      g.arc(0, -h - k * 0.32, k * 0.3, 0, Math.PI * 2);
      g.fill();
    }
    if (down) {
      g.strokeStyle = '#ffd7a8';
      g.lineWidth = Math.max(3, k * 0.08);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-k * 0.3, -h - k * 0.2);
      g.lineTo(-k * 0.42, -h - k * 0.7 - Math.sin(t * 14 + c) * k * 0.04);
      g.moveTo(k * 0.3, -h - k * 0.2);
      g.lineTo(k * 0.42, -h - k * 0.7 + Math.sin(t * 14 + c) * k * 0.04);
      g.stroke();
    }
    // the car: a round box in candy colours
    g.fillStyle = CAR_COLORS[c];
    g.beginPath();
    g.roundRect(-w / 2, -h, w, h, k * 0.14);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.beginPath();
    g.roundRect(-w / 2 + k * 0.06, -h + k * 0.05, w * 0.7, h * 0.28, k * 0.1);
    g.fill();
    g.restore();
  }
  // speed lines behind the train on the way down
  const front = at(path, s);
  if (speed > 6.5 && front.th < -0.15) {
    g.strokeStyle = 'rgba(255,255,255,.85)';
    g.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) {
      const back = at(path, Math.max(0, s - 2.5 - i * 0.5));
      const px = toX(v, back.x), py = toY(v, back.y) - k * (0.3 + (i % 3) * 0.2);
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px - k * 0.8, py - k * 0.15);
      g.stroke();
    }
  }
}

/** The place where the car stopped: a blinking ring, and the dashed line of the highest it could get. */
export function drawStop(g: CanvasRenderingContext2D, v: View, x: number, y: number, capY: number, t: number): void {
  const px = toX(v, x), py = toY(v, y);
  g.save();
  g.setLineDash([8, 8]);
  g.strokeStyle = 'rgba(255,93,143,.75)';
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(0, toY(v, capY));
  g.lineTo(v.W, toY(v, capY));
  g.stroke();
  g.setLineDash([]);
  const pulse = 0.5 + 0.5 * Math.sin(t * 7);
  g.lineWidth = 5;
  g.strokeStyle = `rgba(255,93,143,${0.35 + pulse * 0.65})`;
  g.beginPath();
  g.arc(px, py, v.s * (0.45 + pulse * 0.2), 0, Math.PI * 2);
  g.stroke();
  g.restore();
}

/** The hand that shows how to draw (at the start): it goes from the crest to the right, down and up. */
export function drawHand(g: CanvasRenderingContext2D, v: View, t: number): void {
  const k = (t % 2.6) / 2.6;
  const x = CREST.x + k * 6.2;
  const y = CREST.y - Math.sin(k * Math.PI) * 3.2 + (k > 0.5 ? (k - 0.5) * 1.2 : 0);
  const px = toX(v, x), py = toY(v, y);
  g.save();
  g.globalAlpha = k < 0.08 ? k / 0.08 : k > 0.92 ? (1 - k) / 0.08 : 1;
  // the line that it draws
  g.strokeStyle = 'rgba(255,93,143,.6)';
  g.lineWidth = Math.max(5, v.s * 0.15);
  g.lineCap = 'round';
  g.setLineDash([2, 10]);
  g.beginPath();
  for (let i = 0; i <= k; i += 0.02) {
    const xx = CREST.x + i * 6.2;
    const yy = CREST.y - Math.sin(i * Math.PI) * 3.2 + (i > 0.5 ? (i - 0.5) * 1.2 : 0);
    if (i === 0) g.moveTo(toX(v, xx), toY(v, yy));
    else g.lineTo(toX(v, xx), toY(v, yy));
  }
  g.stroke();
  g.setLineDash([]);
  g.font = `${Math.round(v.s * 1.1)}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('👆', px + v.s * 0.1, py + v.s * 0.5);
  g.restore();
}

export const GRAVITY = G;
export type { Pt };
export { START_PTS };
