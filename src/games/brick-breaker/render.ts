import { BALL_R, W, type Engine } from './engine';

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** `k` = CSS pixels per world unit. */
export function draw(g: CanvasRenderingContext2D, e: Engine, k: number, dpr: number, time: number): void {
  g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
  g.clearRect(0, 0, W, e.h);

  for (const b of e.bricks) {
    if (!b.alive) continue;
    g.fillStyle = 'rgba(58,47,75,0.18)';
    rr(g, b.x, b.y + 6, b.w, b.h, 14);
    g.fill();
    g.fillStyle = b.color;
    rr(g, b.x, b.y, b.w, b.h, 14);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    rr(g, b.x + 8, b.y + 6, b.w - 16, 10, 5);
    g.fill();
  }

  if (e.netAvailable) {
    g.save();
    g.shadowColor = '#5fd8ff';
    g.shadowBlur = 24;
    g.strokeStyle = '#8fe6ff';
    g.lineWidth = 10;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(50, e.netY + 6);
    g.lineTo(W - 50, e.netY + 6);
    g.stroke();
    g.restore();
  }

  const p = e.paddle;
  g.fillStyle = 'rgba(58,47,75,0.2)';
  rr(g, p.x - p.w / 2, p.y + 6, p.w, p.h, 15);
  g.fill();
  g.fillStyle = '#8e5cf0';
  rr(g, p.x - p.w / 2, p.y, p.w, p.h, 15);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.3)';
  rr(g, p.x - p.w / 2 + 10, p.y + 5, p.w - 20, 7, 3.5);
  g.fill();

  for (const b of e.balls) {
    g.fillStyle = '#fff';
    g.strokeStyle = '#3a2f4b';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }

  if (e.state === 'ready') {
    g.font = '90px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('👆', p.x, p.y - 110 + Math.sin(time / 250) * 12);
  }
}
