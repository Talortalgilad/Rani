import { COLORS } from './levels';

/** The world is always 1000 units wide; its height follows the screen aspect ratio. */
export const W = 1000;
export const STEP = 1 / 120;

export const PADDLE_W = W * 0.25;
export const PADDLE_H = 30;
export const BALL_R = 16;
export const BASE_SPEED = 620;
export const MAX_SPEED = 1100;
export const SPEED_UP = 1.02;
export const MAX_BOUNCE = (60 * Math.PI) / 180;
/** The ball never travels flatter than ~15° off the horizontal. */
export const MIN_VERT = Math.sin((15 * Math.PI) / 180);
export const LIVES = 3;

const BRICK_H = 54;
const GAP = 8;
const MARGIN = 40;
const TOP = 70;

export interface Brick { x: number; y: number; w: number; h: number; color: string; alive: boolean }
export interface Ball { x: number; y: number; vx: number; vy: number }
export type EngineEvent = 'brick' | 'paddle' | 'wall' | 'net' | 'launch' | 'lifeLost' | 'win' | 'lose';
export type State = 'ready' | 'playing' | 'won' | 'lost';

export interface Snapshot {
  mask: string;
  lives: number;
  livesLost: number;
  score: number;
  netAvailable: boolean;
}

export function buildBricks(layout: string[]): Brick[] {
  const cols = Math.max(...layout.map((r) => r.length));
  const w = (W - 2 * MARGIN - (cols - 1) * GAP) / cols;
  const bricks: Brick[] = [];
  layout.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      const color = COLORS[ch];
      if (!color) return;
      bricks.push({ x: MARGIN + c * (w + GAP), y: TOP + r * (BRICK_H + GAP), w, h: BRICK_H, color, alive: true });
    }),
  );
  return bricks;
}

/** 1 star for finishing, 2 for losing at most one heart, 3 for losing none. */
export function starsFor(won: boolean, livesLost: number): 0 | 1 | 2 | 3 {
  if (!won) return 0;
  return livesLost === 0 ? 3 : livesLost === 1 ? 2 : 1;
}

export class Engine {
  bricks: Brick[];
  balls: Ball[] = [];
  paddle = { x: W / 2, w: PADDLE_W, h: PADDLE_H, y: 0, target: W / 2 };
  lives = LIVES;
  livesLost = 0;
  score = 0;
  speed = BASE_SPEED;
  state: State = 'ready';
  netAvailable: boolean;
  events: EngineEvent[] = [];

  constructor(layout: string[], public h: number, safetyNet = true) {
    this.bricks = buildBricks(layout);
    this.netAvailable = safetyNet;
    this.setHeight(h);
    this.resetBall();
  }

  get netY(): number { return this.h - 60; }

  setHeight(h: number): void {
    this.h = h;
    this.paddle.y = h - 180;
  }

  setTarget(x: number): void {
    this.paddle.target = x;
  }

  private clampPaddle(): void {
    const half = this.paddle.w / 2;
    this.paddle.x = Math.min(W - half, Math.max(half, this.paddle.x));
  }

  private resetBall(): void {
    this.speed = BASE_SPEED;
    this.balls = [{ x: this.paddle.x, y: this.paddle.y - BALL_R, vx: 0, vy: 0 }];
    this.state = 'ready';
  }

  launch(rand: () => number = Math.random): void {
    if (this.state !== 'ready') return;
    const deg = 8 + rand() * 12;
    const theta = ((rand() < 0.5 ? -1 : 1) * deg * Math.PI) / 180;
    const b = this.balls[0];
    b.vx = this.speed * Math.sin(theta);
    b.vy = -this.speed * Math.cos(theta);
    this.state = 'playing';
    this.events.push('launch');
  }

  remaining(): number {
    return this.bricks.reduce((n, b) => n + (b.alive ? 1 : 0), 0);
  }

  snapshot(): Snapshot {
    return {
      mask: this.bricks.map((b) => (b.alive ? '1' : '0')).join(''),
      lives: this.lives,
      livesLost: this.livesLost,
      score: this.score,
      netAvailable: this.netAvailable,
    };
  }

  /** Restores progress; the ball always comes back stuck to the paddle. */
  restore(s: Snapshot): void {
    this.bricks.forEach((b, i) => (b.alive = s.mask[i] !== '0'));
    this.lives = s.lives;
    this.livesLost = s.livesLost;
    this.score = s.score;
    this.netAvailable = s.netAvailable;
    this.resetBall();
  }

  step(dt: number): void {
    const p = this.paddle;
    p.x += (p.target - p.x) * (1 - Math.exp(-dt * 25));
    this.clampPaddle();

    if (this.state === 'ready') {
      this.balls[0].x = p.x;
      this.balls[0].y = p.y - BALL_R;
      return;
    }
    if (this.state !== 'playing') return;

    for (const ball of this.balls.slice()) this.moveBall(ball, dt);
    this.balls = this.balls.filter((b) => b.y - BALL_R <= this.h);
    if (this.balls.length === 0) this.loseLife();
    else if (this.remaining() === 0) {
      this.state = 'won';
      this.events.push('win');
    }
  }

  private loseLife(): void {
    this.lives--;
    this.livesLost++;
    this.events.push('lifeLost');
    if (this.lives <= 0) {
      this.state = 'lost';
      this.events.push('lose');
    } else this.resetBall();
  }

  /** Moves in sub-steps of at most half a ball radius so nothing is tunnelled through. */
  private moveBall(b: Ball, dt: number): void {
    const dist = Math.hypot(b.vx, b.vy) * dt;
    const n = Math.max(1, Math.ceil(dist / (BALL_R * 0.5)));
    const sub = dt / n;
    for (let i = 0; i < n && this.state === 'playing'; i++) {
      b.x += b.vx * sub;
      b.y += b.vy * sub;
      this.walls(b);
      this.paddleHit(b);
      this.brickHit(b);
      this.net(b);
      if (this.remaining() === 0) return;
    }
  }

  private walls(b: Ball): void {
    let hit = false;
    if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx); hit = true; }
    else if (b.x > W - BALL_R) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx); hit = true; }
    if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy); hit = true; }
    if (hit) { this.fixAngle(b); this.events.push('wall'); }
  }

  private paddleHit(b: Ball): void {
    const p = this.paddle;
    if (b.vy <= 0) return;
    const bottom = b.y + BALL_R;
    if (bottom < p.y || bottom > p.y + p.h) return;
    if (Math.abs(b.x - p.x) > p.w / 2 + BALL_R * 0.6) return;
    const t = Math.max(-1, Math.min(1, (b.x - p.x) / (p.w / 2)));
    const theta = t * MAX_BOUNCE;
    b.y = p.y - BALL_R;
    b.vx = this.speed * Math.sin(theta);
    b.vy = -this.speed * Math.cos(theta);
    this.events.push('paddle');
  }

  private brickHit(b: Ball): void {
    for (const br of this.bricks) {
      if (!br.alive) continue;
      const cx = Math.min(Math.max(b.x, br.x), br.x + br.w);
      const cy = Math.min(Math.max(b.y, br.y), br.y + br.h);
      const dx = b.x - cx;
      const dy = b.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= BALL_R * BALL_R) continue;

      let nx: number, ny: number;
      if (d2 > 0) {
        const d = Math.sqrt(d2);
        nx = dx / d; ny = dy / d;
        b.x += nx * (BALL_R - d);
        b.y += ny * (BALL_R - d);
      } else {
        // centre is inside the brick: leave through the nearest side
        const l = b.x - br.x, r = br.x + br.w - b.x, t = b.y - br.y, bo = br.y + br.h - b.y;
        const m = Math.min(l, r, t, bo);
        nx = m === l ? -1 : m === r ? 1 : 0;
        ny = m === t ? -1 : m === bo ? 1 : 0;
        b.x += nx * (m + BALL_R);
        b.y += ny * (m + BALL_R);
      }
      const dot = b.vx * nx + b.vy * ny;
      if (dot < 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; }

      br.alive = false;
      this.score += 10;
      this.speed = Math.min(MAX_SPEED, this.speed * SPEED_UP);
      this.rescale(b);
      this.fixAngle(b);
      this.events.push('brick');
      return; // one brick per sub-step
    }
  }

  /** Safety net: once per level the ball bounces off a glowing line instead of costing a heart. */
  private net(b: Ball): void {
    if (!this.netAvailable || b.vy <= 0 || b.y + BALL_R < this.netY) return;
    b.y = this.netY - BALL_R;
    b.vy = -Math.abs(b.vy);
    this.netAvailable = false;
    this.fixAngle(b);
    this.events.push('net');
  }

  private rescale(b: Ball): void {
    const m = Math.hypot(b.vx, b.vy) || 1;
    b.vx = (b.vx / m) * this.speed;
    b.vy = (b.vy / m) * this.speed;
  }

  private fixAngle(b: Ball): void {
    this.rescale(b);
    const minVy = this.speed * MIN_VERT;
    if (Math.abs(b.vy) < minVy) {
      b.vy = (b.vy < 0 ? -1 : 1) * minVy;
      b.vx = (b.vx < 0 ? -1 : 1) * Math.sqrt(this.speed * this.speed - minVy * minVy);
    }
  }
}
