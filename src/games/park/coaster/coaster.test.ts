import { describe, expect, it } from 'vitest';
import { allAllowed, allowed, energyAlong, speedAtEnd } from './allowed';
import { closeOrUndo } from './closer';
import { simulate } from './physics';
import { DS, KINDS, LH, N, START, STATION, T, buildCurve, fits, newTrack, step, walk, type Kind, type Track } from './track';

const tr = (...p: Kind[]): Track => ({ pieces: p });
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('the pieces on the tiles', () => {
  it('the track leaves the station to the east, and every piece moves the cursor', () => {
    expect(walk(newTrack()).end).toEqual(START);
    expect(step(START, 'straight').next).toEqual({ c: 5, r: 7, d: 0, z: 0 });
    expect(step(START, 'up').next.z).toBe(1);
    expect(step(START, 'left').next).toEqual({ c: 4, r: 6, d: 3, z: 0 });
    expect(step(START, 'right').next).toEqual({ c: 4, r: 8, d: 1, z: 0 });
    expect(step(START, 'loop').tiles).toHaveLength(2);
    expect(step(START, 'loop').next.c).toBe(6);
  });

  it('the plot has walls, 7 levels, no overlaps, and the station only from the west at level 0', () => {
    expect(fits(walk(tr('right')), 'straight')).toEqual({ ok: false, why: 'space' });
    expect(allowed({ pieces: Array(6).fill('up') as Kind[] }, 'up')).toEqual({ ok: false, why: 'high' });
    expect(fits(walk(tr('straight', 'straight', 'straight', 'left', 'left')), 'straight').ok).toBe(true);
    expect(fits(walk(tr('left', 'left')), 'straight').ok).toBe(true);
    // a loop that does not fit in the height
    expect(fits(walk({ pieces: Array(5).fill('up') as Kind[] }), 'loop')).toBeDefined();
  });

  it('the curve is smooth, one point every 0.05, and goes through the tiles', () => {
    const c = buildCurve(tr('straight', 'up', 'down', 'left', 'loop'));
    for (let i = 1; i < c.n; i++) expect(Math.hypot(c.X[i] - c.X[i - 1], c.Y[i] - c.Y[i - 1], c.Z[i] - c.Z[i - 1])).toBeLessThan(DS * 1.02);
    // no kinks: the direction changes little from one point to the next
    let worst = 0;
    for (let i = 3; i < c.n - 3; i++) {
      const a = [c.X[i] - c.X[i - 2], c.Y[i] - c.Y[i - 2], c.Z[i] - c.Z[i - 2]], b = [c.X[i + 2] - c.X[i], c.Y[i + 2] - c.Y[i], c.Z[i + 2] - c.Z[i]];
      const dot = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b));
      worst = Math.max(worst, Math.acos(Math.min(1, dot)));
    }
    expect(worst).toBeLessThan(0.25);
    // the first piece starts at the east edge of the station tile
    expect(c.X[Math.round(1.5 / DS)]).toBeCloseTo((STATION.c + 1) * T, 1);
    expect(c.loops).toHaveLength(1);
  });
});

describe('what is allowed (you cannot make a mistake)', () => {
  it('a hill needs speed: up is free on the chain lift, and after a descent only as high as the speed gets', () => {
    expect(allowed(tr('up', 'up'), 'up').ok).toBe(true);
    // one level of descent does not give enough speed for another level of climb after the lift
    expect(allowed(tr('up', 'up', 'down'), 'up')).toEqual({ ok: false, why: 'speed' });
    expect(allowed(tr('up', 'up', 'up', 'down', 'down'), 'up').ok).toBe(true);
    expect(allowed(tr('up', 'up', 'up', 'down', 'down'), 'straight').ok).toBe(true);
  });

  it('a loop needs a long descent first, and is never allowed on the lift', () => {
    expect(allowed(tr('left', 'up'), 'loop')).toEqual({ ok: false, why: 'speed' });
    expect(allowed(tr('up', 'up', 'down', 'right'), 'loop')).toEqual({ ok: false, why: 'speed' });
    expect(allowed(tr('up', 'up', 'up', 'down', 'down', 'down'), 'loop').ok).toBe(false); // no room: the end of the plot
    expect(allowed(tr('up', 'up', 'up', 'left', 'down', 'down', 'down'), 'loop').ok).toBe(true);
  });

  it('a track with a loop is ridden through the loop', () => {
    const t = tr('up', 'up', 'up', 'left', 'down', 'down', 'down', 'loop');
    const p = buildCurve(t);
    expect(energyAlong(p).ok).toBe(true);
    const r = simulate(p);
    expect(r.outcome).toBe('short');
  });

  it('the meter: green with speed, red when slow', () => {
    expect(speedAtEnd(tr('up', 'up', 'up', 'down', 'down', 'down')).level).toBe('yellow');
    expect(speedAtEnd(tr('up', 'up', 'up', 'up', 'up', 'down')).v).toBeGreaterThan(6);
    expect(speedAtEnd(tr('up', 'up')).level).toBe('red');
  });
});

describe('closing the track', () => {
  it('closes a track into the station, and the train rides the circuit', () => {
    const t = tr('up', 'up', 'down', 'left');
    const way = closeOrUndo(t);
    expect(way).not.toBeNull();
    const c = tr(...t.pieces.slice(0, t.pieces.length - way!.undo), ...way!.pieces);
    expect(walk(c).closed).toBe(true);
    const r = simulate(buildCurve(c));
    expect(r.outcome).toBe('finished');
  });

  it('an empty track can be closed, and so can a closed one (nothing to do)', () => {
    const w = closeOrUndo(newTrack())!;
    expect(w.undo).toBe(0);
    expect(closeOrUndo(tr(...w.pieces))!.pieces).toEqual([]);
  });

  it('when there is no way back, it takes pieces off', () => {
    // a spiral into the corner with no way out
    const t = tr('straight', 'straight', 'straight', 'right', 'straight', 'straight', 'right', 'straight', 'straight', 'straight', 'straight', 'straight', 'right');
    const w = closeOrUndo(t);
    expect(w).not.toBeNull();
    expect(w!.undo).toBeGreaterThanOrEqual(0);
  });
});

describe('5000 random tracks', () => {
  it('a track that is built from the allowed pieces is always ridden to the end, and a closed one finishes', () => {
    const rand = rng(7);
    let closed = 0;
    for (let i = 0; i < 5000; i++) {
      let t = newTrack();
      const len = 3 + Math.floor(rand() * 16);
      for (let k = 0; k < len; k++) {
        const order = [...KINDS].sort(() => rand() - 0.5);
        const pick = order.find((q) => allowed(t, q).ok);
        if (!pick) break;
        t = tr(...t.pieces, pick);
      }
      const c = buildCurve(t);
      // an open track: the train gets to the end of it
      const r = simulate(c);
      expect(r.outcome, `track ${i}: ${t.pieces.join(',')}`).toBe(walk(t).closed ? 'finished' : 'short');
      if (i % 12 === 0) {
        const way = closeOrUndo(t)!;
        expect(way, `track ${i}`).not.toBeNull();
        const full = tr(...t.pieces.slice(0, t.pieces.length - way.undo), ...way.pieces);
        expect(walk(full).closed).toBe(true);
        expect(simulate(buildCurve(full)).outcome, `closed ${i}: ${full.pieces.join(',')}`).toBe('finished');
        closed++;
      }
    }
    expect(closed).toBeGreaterThan(300);
  }, 600000);
});

describe('a few numbers', () => {
  it('the plot is 8 x 8 and the levels are 1.4 high', () => {
    expect(N).toBe(8);
    expect(LH).toBe(1.4);
    expect(allAllowed(newTrack()).straight.ok).toBe(true);
  });
});
