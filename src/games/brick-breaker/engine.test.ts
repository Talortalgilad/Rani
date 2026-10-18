import { describe, expect, it } from 'vitest';
import {
  BASE_SPEED, BALL_R, BONUS_FALL, EFFECT_TIME, Engine, LIVES, MAX_LIVES, MAX_SPEED, MIN_VERT, PADDLE_W, SLOW_FACTOR, SPEED_SCALE,
  STEP, W, WIDE_FACTOR, buildBricks, starsFor, type BonusType,
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
    for (const ev of e.events.splice(0)) if (ev.type === 'paddle') off = (r() - 0.5) * 200;
    onStep?.();
  }
}

describe('levels', () => {
  it('parse into bricks inside the world', () => {
    expect(LEVELS).toHaveLength(10);
    expect(LEVELS.slice(0, 3).map((l) => buildBricks(l).length)).toEqual([16, 24, 24]);
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
  it.each(LEVELS.map((l, i) => [i + 1, l] as const))('a perfect bot wins level %i without tunnelling', (n, layout) => {
    const e = new Engine(layout, H, { safetyNet: n <= 3 });
    let minVert = 1;
    let maxSpeed = 0;
    runBot(e, 1500, () => {
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
    const e = new Engine(LEVELS[0], H, { safetyNet: true });
    e.paddle.x = e.paddle.target = 125; // parked in the corner, never catches
    e.launch(() => 0.99);
    let nets = 0;
    let lostAfterNet: number | null = null;
    for (let i = 0; i < 120 * 300 && e.state !== 'lost'; i++) {
      if (e.state === 'ready') e.launch(() => 0.99);
      e.paddle.x = 125;
      e.step(STEP);
      for (const ev of e.events.splice(0)) if (ev.type === 'net') { nets++; lostAfterNet = e.livesLost; }
    }
    expect(nets).toBe(1);
    expect(lostAfterNet).toBe(0);
    expect(e.state).toBe('lost');
    expect(e.livesLost).toBe(3);
  });

  it('after losing a heart the ball resets slow and stuck', () => {
    const e = new Engine(LEVELS[0], H, { safetyNet: false });
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

const surprise = () => LEVELS.findIndex((l) => l.some((r) => r.includes('?')));

describe('special bricks', () => {
  it('levels 1-3 are plain; specials appear from level 4', () => {
    for (const l of LEVELS.slice(0, 3)) expect(l.join('')).toMatch(/^[RYGBP.]+$/);
    expect(LEVELS.slice(3).join('')).toMatch(/[S*?]/);
    expect(LEVELS.slice(3).join('')).toMatch(/S/);
    expect(LEVELS.slice(3).join('')).toMatch(/\*/);
  });

  it('a strong brick needs two hits and cracks first', () => {
    const e = new Engine(['S'], H, { safetyNet: false });
    const br = e.bricks[0];
    expect(br.hp).toBe(2);
    e.launch();
    e.balls[0].x = br.x + br.w / 2;
    e.balls[0].y = br.y + br.h + BALL_R + 2;
    e.balls[0].vx = 0;
    e.balls[0].vy = -BASE_SPEED;
    const seen: string[] = [];
    for (let i = 0; i < 120 * 14 && e.state === 'playing'; i++) {
      e.paddle.x = e.paddle.target = e.balls[0]?.x ?? 500;
      e.step(STEP);
      for (const ev of e.events.splice(0)) seen.push(ev.type);
    }
    expect(seen.indexOf('crack')).toBeGreaterThanOrEqual(0);
    expect(seen.indexOf('brick')).toBeGreaterThan(seen.indexOf('crack'));
    expect(seen.filter((x) => x === 'crack')).toHaveLength(1);
  });

  it('a star brick reports its kind; a surprise brick drops a bonus', () => {
    const e = new Engine(['*?'], H, { safetyNet: false, rand: () => 0.1 });
    expect(e.bricks.map((b) => b.kind)).toEqual(['star', 'surprise']);
    const [, sp] = e.bricks;
    e.launch();
    const ball = e.balls[0];
    ball.x = sp.x + sp.w / 2; ball.y = sp.y + sp.h + BALL_R + 1; ball.vx = 0; ball.vy = -BASE_SPEED;
    const kinds: string[] = [];
    for (let i = 0; i < 30; i++) { e.step(STEP); for (const ev of e.events.splice(0)) if (ev.type === 'brick') kinds.push(ev.kind); }
    expect(kinds).toEqual(['surprise']);
    expect(e.bonuses).toHaveLength(1);
    expect(e.bonuses[0].type).toBe('wide');
  });
});

describe('bonuses', () => {
  it('fall slowly and are caught by the paddle', () => {
    expect(BONUS_FALL).toBeLessThan(BASE_SPEED / 2);
    const e = new Engine(LEVELS[3], H);
    e.launch();
    e.bonuses.push({ x: 400, y: 500, type: 'wide' });
    e.paddle.x = e.paddle.target = 400;
    let caught = false;
    for (let i = 0; i < 120 * 8 && !caught && e.state === 'playing'; i++) {
      e.balls[0].x = 900; e.balls[0].y = 900; e.balls[0].vx = 0; e.balls[0].vy = -1;
      e.step(STEP);
      if (e.events.splice(0).some((ev) => ev.type === 'bonus')) caught = true;
    }
    expect(caught).toBe(true);
    expect(e.paddle.w).toBe(PADDLE_W * WIDE_FACTOR);
  });

  it('wide paddle lasts 10 s then goes back', () => {
    const e = new Engine(LEVELS[3], H);
    e.launch();
    e.applyBonus('wide');
    expect(e.effects.wide).toBe(EFFECT_TIME);
    for (let i = 0; i < 120 * 9.9; i++) { e.balls[0].y = 800; e.balls[0].vy = 0.01; e.balls[0].vx = 0; e.step(STEP); }
    expect(e.paddle.w).toBe(PADDLE_W * WIDE_FACTOR);
    for (let i = 0; i < 120 * 0.3; i++) { e.balls[0].y = 800; e.step(STEP); }
    expect(e.paddle.w).toBe(PADDLE_W);
  });

  it('multi-ball makes 3 balls and a heart is lost only when all have fallen', () => {
    const e = new Engine(LEVELS[3], H, { safetyNet: false });
    e.launch();
    e.applyBonus('multi');
    expect(e.balls).toHaveLength(3);
    const speeds = e.balls.map((b) => Math.hypot(b.vx, b.vy));
    speeds.forEach((s) => expect(s).toBeCloseTo(e.speed, 3));
    e.balls[0].y = H + 100;
    e.step(STEP);
    expect(e.balls).toHaveLength(2);
    expect(e.lives).toBe(LIVES);
    e.balls.forEach((b) => (b.y = H + 100));
    e.step(STEP);
    expect(e.lives).toBe(LIVES - 1);
    expect(e.state).toBe('ready');
  });

  it('turtle slows every ball, then restores the speed', () => {
    const e = new Engine(LEVELS[3], H);
    e.launch();
    e.applyBonus('slow');
    expect(Math.hypot(e.balls[0].vx, e.balls[0].vy)).toBeCloseTo(e.speed * SLOW_FACTOR, 3);
    for (let i = 0; i < 120 * 10.2; i++) { e.balls[0].x = 500; e.balls[0].y = 900; e.step(STEP); }
    expect(Math.hypot(e.balls[0].vx, e.balls[0].vy)).toBeCloseTo(e.speed, 3);
  });

  it('heart adds a life up to the maximum of 5', () => {
    const e = new Engine(LEVELS[3], H);
    for (let i = 0; i < 6; i++) e.applyBonus('life' as BonusType);
    expect(e.lives).toBe(MAX_LIVES);
  });

  it('surprise never offers a heart when hearts are full', () => {
    const e = new Engine(['?'], H, { rand: () => 0.999 });
    e.lives = MAX_LIVES;
    const br = e.bricks[0];
    e.launch();
    e.balls[0].x = br.x + br.w / 2; e.balls[0].y = br.y + br.h + BALL_R + 1; e.balls[0].vx = 0; e.balls[0].vy = -BASE_SPEED;
    for (let i = 0; i < 30; i++) e.step(STEP);
    expect(e.bonuses[0]?.type).not.toBe('life');
  });
});

describe('ball speed setting', () => {
  it('slow < normal < fast, normal = the previous speed', () => {
    const s = (k: 'slow' | 'normal' | 'fast') => new Engine(LEVELS[0], H, { speedScale: SPEED_SCALE[k] }).baseSpeed;
    expect(s('slow')).toBeLessThan(s('normal'));
    expect(s('normal')).toBeLessThan(s('fast'));
    expect(s('normal')).toBe(BASE_SPEED);
  });
  it('a surprise level exists', () => {
    expect(surprise()).toBeGreaterThan(2);
  });
});
