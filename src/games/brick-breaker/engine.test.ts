import { describe, expect, it } from 'vitest';
import {
  BASE_SPEED, BALL_R, Engine, LIVES, MAX_SPEED, MIN_VERT, PADDLE_W, STEP, W, buildBricks, starsFor,
} from './engine';
import { LEVELS } from './levels';

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
const H = 1770;

/** A bot that keeps the paddle under the ball, aiming off-centre so the ball varies its angle. */
function runBot(e: Engine, seconds: number, onStep?: () => void) {
  const r = rng(7);
  let off = 0;
  for (let i = 0; i < seconds / STEP && e.state !== 'won' && e.state !== 'lost'; i++) {
    if (e.state === 'ready') e.launch(r);
    const b = e.balls[0];
    e.paddle.x = Math.min(W - 125, Math.max(125, b.x - off));
    e.paddle.target = e.paddle.x;
    e.step(STEP);
    for (const ev of e.events.splice(0)) if (ev === 'paddle') off = (r() - 0.5) * 200;
    onStep?.();
  }
}

describe('levels', () => {
  it('parse into bricks inside the world', () => {
    expect(LEVELS.map((l) => buildBricks(l).length)).toEqual([16, 24, 24]);
    for (const l of LEVELS) for (const b of buildBricks(l)) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(W);
    }
  });
});

describe('kid-friendly setup', () => {
  it('paddle is 25% of the width, 3 hearts, slow ball', () => {
    const e = new Engine(LEVELS[0], H);
    expect(e.paddle.w).toBe(PADDLE_W);
    expect(PADDLE_W / W).toBe(0.25);
    expect(e.lives).toBe(LIVES);
    expect(LIVES).toBe(3);
    expect(e.speed).toBe(BASE_SPEED);
  });
  it('ball is stuck to the paddle until launched', () => {
    const e = new Engine(LEVELS[0], H);
    e.paddle.target = 300;
    for (let i = 0; i < 240; i++) e.step(STEP);
    expect(e.state).toBe('ready');
    expect(e.balls[0].x).toBeCloseTo(e.paddle.x, 5);
    e.launch();
    expect(e.state).toBe('playing');
  });
  it('stars: 3 none lost, 2 one lost, 1 otherwise, 0 on a loss', () => {
    expect([starsFor(true, 0), starsFor(true, 1), starsFor(true, 2), starsFor(false, 3)]).toEqual([3, 2, 1, 0]);
  });
});

describe('physics', () => {
  it.each(LEVELS.map((l, i) => [i + 1, l] as const))('a perfect bot wins level %i without tunnelling', (_n, layout) => {
    const e = new Engine(layout, H);
    let minVert = 1;
    let maxSpeed = 0;
    runBot(e, 600, () => {
      const b = e.balls[0];
      if (e.state !== 'playing') return;
      for (const br of e.bricks) {
        if (br.alive) expect(b.x > br.x && b.x < br.x + br.w && b.y > br.y && b.y < br.y + br.h).toBe(false);
      }
      expect(b.y).toBeLessThan(H);
      const s = Math.hypot(b.vx, b.vy);
      maxSpeed = Math.max(maxSpeed, s);
      minVert = Math.min(minVert, Math.abs(b.vy) / s);
    });
    expect(e.state).toBe('won');
    expect(e.livesLost).toBe(0);
    expect(maxSpeed).toBeLessThanOrEqual(MAX_SPEED + 1e-6);
    expect(maxSpeed).toBeGreaterThan(BASE_SPEED);
    expect(minVert).toBeGreaterThanOrEqual(MIN_VERT - 1e-6);
  });

  it('does not tunnel at the maximum speed', () => {
    const e = new Engine(LEVELS[2], H);
    e.speed = MAX_SPEED;
    runBot(e, 120, () => {
      const b = e.balls[0];
      for (const br of e.bricks) {
        if (br.alive) expect(b.x > br.x && b.x < br.x + br.w && b.y > br.y && b.y < br.y + br.h).toBe(false);
      }
    });
    expect(e.state).not.toBe('lost');
  });

  it('safety net saves the first fall only, then hearts are lost and it ends in a loss', () => {
    const e = new Engine(LEVELS[0], H, true);
    e.paddle.x = e.paddle.target = 125; // parked in the corner, never catches
    e.launch(() => 0.99);
    let nets = 0;
    let lostAfterNet: number | null = null;
    for (let i = 0; i < 120 * 300 && e.state !== 'lost'; i++) {
      if (e.state === 'ready') e.launch(() => 0.99);
      e.paddle.x = 125;
      e.step(STEP);
      for (const ev of e.events.splice(0)) if (ev === 'net') { nets++; lostAfterNet = e.livesLost; }
    }
    expect(nets).toBe(1);
    expect(lostAfterNet).toBe(0);
    expect(e.state).toBe('lost');
    expect(e.livesLost).toBe(3);
  });

  it('after losing a heart the ball resets slow and stuck', () => {
    const e = new Engine(LEVELS[0], H, false);
    e.speed = 800;
    e.launch();
    e.balls[0].y = H + BALL_R + 60;
    e.step(STEP);
    expect(e.lives).toBe(2);
    expect(e.state).toBe('ready');
    expect(e.speed).toBe(BASE_SPEED);
  });
});

describe('save / restore', () => {
  it('round-trips bricks, hearts and score; ball comes back stuck', () => {
    const e = new Engine(LEVELS[1], H);
    runBot(e, 8);
    const snap = JSON.parse(JSON.stringify(e.snapshot()));
    const f = new Engine(LEVELS[1], H);
    f.restore(snap);
    expect(f.remaining()).toBe(e.remaining());
    expect(f.score).toBe(e.score);
    expect(f.lives).toBe(e.lives);
    expect(f.state).toBe('ready');
    expect(e.remaining()).toBeLessThan(24);
  });
});
