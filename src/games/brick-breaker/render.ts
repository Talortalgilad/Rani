import { BALL_R, BONUS_R, EFFECT_TIME, W, type BonusType, type Brick, type Engine } from './engine';

export const BONUS_ICON: Record<BonusType, string> = { wide: '🟦', multi: '⚪', slow: '🐢', life: '❤️' };
const BONUS_COLOR: Record<BonusType, string> = { wide: '#3aa0ff', multi: '#8e5cf0', slow: '#3fb56b', life: '#ff5d73' };

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function brick(g: CanvasRenderingContext2D, b: Brick): void {
  g.fillStyle = 'rgba(58,47,75,0.18)';
  rr(g, b.x, b.y + 6, b.w, b.h, 14);
  g.fill();
  g.fillStyle = b.color;
  rr(g, b.x, b.y, b.w, b.h, 14);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  rr(g, b.x + 8, b.y + 6, b.w - 16, 10, 5);
  g.fill();

  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (b.kind === 'strong') {
    g.strokeStyle = '#5b6190';
    g.lineWidth = 5;
    rr(g, b.x + 3, b.y + 3, b.w - 6, b.h - 6, 12);
    g.stroke();
    if (b.hp < 2) {
      g.strokeStyle = 'rgba(58,47,75,0.75)';
      g.lineWidth = 4;
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(cx - 6, b.y + 4);
      g.lineTo(cx + 8, b.y + 20);
      g.lineTo(cx - 10, b.y + 32);
      g.lineTo(cx + 4, b.y + b.h - 4);
      g.stroke();
    }
  } else if (b.kind === 'star') {
    g.font = '40px system-ui, sans-serif';
    g.fillText('⭐', cx, cy + 2);
  } else if (b.kind === 'surprise') {
    g.fillStyle = '#fff';
    g.font = '800 44px Rubik, system-ui, sans-serif';
    g.fillText('?', cx, cy + 3);
  }
}

/** `k` = CSS pixels per world unit. */
export function draw(g: CanvasRenderingContext2D, e: Engine, k: number, dpr: number, time: number): void {
  g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
  g.clearRect(0, 0, W, e.h);

  for (const b of e.bricks) if (b.alive) brick(g, b);

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

  // falling bonuses
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const b of e.bonuses) {
    g.fillStyle = '#fff';
    g.strokeStyle = BONUS_COLOR[b.type];
    g.lineWidth = 8;
    g.beginPath();
    g.arc(b.x, b.y, BONUS_R, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.font = '44px system-ui, sans-serif';
    g.fillText(BONUS_ICON[b.type], b.x, b.y + 3);
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

  // active effects: small icon with a ring that empties
  const active = (['wide', 'slow'] as const).filter((t) => e.effects[t] > 0);
  active.forEach((t, i) => {
    const x = 60 + i * 96;
    const y = 62;
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(x, y, 34, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = BONUS_COLOR[t];
    g.lineWidth = 9;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(x, y, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (e.effects[t] / EFFECT_TIME));
    g.stroke();
    g.font = '34px system-ui, sans-serif';
    g.fillText(BONUS_ICON[t], x, y + 2);
  });

  if (e.state === 'ready') {
    g.font = '90px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('👆', p.x, p.y - 110 + Math.sin(time / 250) * 12);
  }
}
