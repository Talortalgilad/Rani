import { describe, expect, it } from 'vitest';
import { addPart, END, G, MAX_SLOPE, addLoop, buildPath, deleteFrom, extend, finish, moveY, newTrack, pathLength, type Track } from './track';
import { sample, simulate } from './physics';

/** A track from points (after the crest), finished at the station when it reaches it. */
function make(points: [number, number][], loopAt: number | null = null): Track {
  const t = newTrack();
  for (const [x, y] of points) t.pts.push({ x, y });
  finish(t);
  return t;
}
const EASY: [number, number][] = [[8.5, 3], [10.8, 0.8], [13.5, 3.5], [16, 0.8], [18.5, 3], [20.4, 1.6]];

describe('drawing a track', () => {
  it('the points go only to the right, and the slope never passes 70 degrees', () => {
    const t = newTrack();
    expect(extend(t, 6.3, 6)).toBe(false); // too close
    expect(extend(t, 4, 6)).toBe(false); // to the left
    expect(extend(t, 7, 0.5)).toBe(true); // a wall of a drop is clamped
    const a = t.pts[0], b = t.pts[1];
    expect(Math.abs(b.y - a.y) / (b.x - a.x)).toBeLessThanOrEqual(MAX_SLOPE + 1e-9);
    extend(t, 9.5, 9.9);
    for (let i = 1; i < t.pts.length; i++) expect(Math.abs(t.pts[i].y - t.pts[i - 1].y) / (t.pts[i].x - t.pts[i - 1].x)).toBeLessThanOrEqual(MAX_SLOPE + 1e-9);
  });

  it('a point that is moved stays inside what its neighbours allow, and the crest and the station cannot be moved', () => {
    const t = make(EASY);
    expect(t.complete).toBe(true);
    const y = moveY(t, 2, 9.5);
    const [a, b, c] = [t.pts[1], t.pts[2], t.pts[3]];
    expect(Math.abs(b.y - a.y) / (b.x - a.x)).toBeLessThanOrEqual(MAX_SLOPE + 1e-9);
    expect(Math.abs(c.y - b.y) / (c.x - b.x)).toBeLessThanOrEqual(MAX_SLOPE + 1e-9);
    expect(y).toBe(b.y);
    expect(moveY(t, 0, 1)).toBe(6);
    expect(moveY(t, t.pts.length - 1, 5)).toBe(END.y);
  });

  it('the track is complete only when it reaches the station, and "delete" takes it back from a point to the end', () => {
    const t = make([[8, 3], [10.5, 1]]);
    expect(t.complete).toBe(false);
    const u = make(EASY);
    expect(u.complete).toBe(true);
    deleteFrom(u, 3);
    expect(u.complete).toBe(false);
    expect(u.pts.length).toBe(3);
    deleteFrom(u, 0);
    expect(u.pts.length).toBe(1); // the crest stays
  });

  it('the curve is smooth, goes to the right, and has a point every 0.05', () => {
    const p = buildPath(make(EASY));
    for (let i = 1; i < p.n; i++) expect(p.x[i]).toBeGreaterThanOrEqual(p.x[i - 1] - 1e-9);
    expect(pathLength(p)).toBeGreaterThan(30);
    let maxTurn = 0;
    for (let i = 2; i < p.n; i++) maxTurn = Math.max(maxTurn, Math.abs(p.th[i] - p.th[i - 1]));
    expect(maxTurn).toBeLessThan(0.17);
  });
});

describe('the ride', () => {
  it('is the same every time', () => {
    const p = buildPath(make(EASY));
    const a = simulate(p);
    const b = simulate(p);
    expect(Array.from(a.s)).toEqual(Array.from(b.s));
    expect(a.outcome).toBe(b.outcome);
  });

  it('a gentle track gets to the station, under the top speed, and nothing in it is not a number', () => {
    const r = simulate(buildPath(make(EASY)));
    expect(r.outcome).toBe('finished');
    expect(r.vMax).toBeLessThanOrEqual(13);
    expect([...r.s, ...r.v].every(Number.isFinite)).toBe(true);
  });

  it('follows the energy: the speed at the bottom of a drop is what the height says, less a little friction', () => {
    const path = buildPath(make(EASY));
    const r = simulate(path);
    // the valley at x = 11: find the sample whose point is the lowest of the first valley
    let i = 0;
    for (let k = 0; k < path.n; k++) if (path.x[k] > 10.5 && path.x[k] < 11.5 && path.y[k] < path.y[i] || (path.x[i] < 10 && path.x[k] > 10.5)) i = k;
    const drop = 6 - path.y[i];
    const ideal = Math.sqrt(2.6 * 2.6 + 2 * G * drop);
    const idx = Array.from(r.s).findIndex((s) => s >= path.s[i]);
    expect(r.v[idx]).toBeLessThan(ideal);
    expect(r.v[idx]).toBeGreaterThan(ideal * 0.8);
  });

  it('a hill that is too high: the car slows down, stops, rolls back into the valley, and nothing breaks', () => {
    const p = buildPath(make([[8, 3], [10, 1], [13, 8.8], [16.2, 1], [18.2, 3], [20.4, 1.6]]));
    const r = simulate(p);
    expect(r.outcome).toBe('stalled');
    expect(r.stopS).not.toBeNull();
    const last = r.s.length - 1;
    expect(r.s[last]).toBeLessThan(r.stopS!); // it rolled back
    expect(Math.abs(r.v[last])).toBeLessThan(0.05);
    expect(Math.max(...r.s)).toBeLessThan(p.endS);
  });

  it('a loop without speed: the car climbs and rolls back; with a deep drop before it, it goes through', () => {
    const slow = make([[7.5, 5.4], [10.5, 4.4], [13, 2.8], [16, 1.8], [20.4, 1.6]], 1);
    expect(addLoop(slow, 7.5)).toBe(true);
    const s = simulate(buildPath(slow));
    expect(s.outcome).toBe('loop');
    const fast = make([[8.5, 0.8], [11.8, 0.8], [15, 2], [20.4, 1.6]], 2);
    expect(addLoop(fast, 8.5)).toBe(true);
    const f = simulate(buildPath(fast));
    expect(f.outcome).toBe('finished');
  });

  it('a track that does not reach the station ends at its last point', () => {
    const r = simulate(buildPath(make([[8, 3], [10.5, 1], [13, 3]])));
    expect(r.outcome).toBe('short');
  });

  it('the position at a time is between the samples', () => {
    const r = simulate(buildPath(make(EASY)));
    const mid = sample(r, r.t[40] + (r.t[41] - r.t[40]) / 2);
    expect(mid.s).toBeGreaterThanOrEqual(Math.min(r.s[40], r.s[41]));
    expect(mid.s).toBeLessThanOrEqual(Math.max(r.s[40], r.s[41]));
  });
});

import { diagnose, fix } from './hints';
import { END as STATION } from './track';

describe('help when the car does not get to the end', () => {
  const run = (t: Track) => {
    const path = buildPath(t);
    const ride = simulate(path);
    return { path, ride, d: diagnose(t, path, ride) };
  };

  it('a track that works needs no help', () => {
    expect(run(make(EASY)).d).toBeNull();
  });

  it('a hill that is too high: the stop is marked on the climb, the dashed line is the height of the stop, and the hint is "too high"', () => {
    const t = make([[8, 3], [10, 1], [12.3, 4], [14.5, 1], [17, 6.4], [19, 2.5], [20.4, 1.6]]);
    const { d, path, ride } = run(t);
    expect(d?.kind).toBe('high');
    expect(d!.capY).toBeCloseTo(d!.y, 6);
    expect(d!.y).toBeLessThan(6.4);
    expect(d!.x).toBeGreaterThan(14.5);
    expect(d!.x).toBeLessThan(17.1);
    expect(d!.mx).toBeCloseTo(17, 6); // the top of the hill is marked, not the stop
    expect(d!.my).toBeCloseTo(6.4, 6);
    expect(path.n).toBeGreaterThan(0);
    expect(ride.outcome).toBe('stalled');
  });

  it('on the second hill, when it is higher than the first one, the hint is "the first hill must be the highest"; on a later one it is just "too high"', () => {
    const { d } = run(make([[8, 3], [10, 1], [13, 8.8], [16.2, 1], [18.2, 3], [20.4, 1.6]]));
    expect(d?.kind).toBe('first');
    expect(d!.capY).toBeLessThan(d!.my);
    // a later hill that is just as high is "too high", not "the first must be the highest"
    expect(run(make([[8, 3], [10, 1], [12.3, 4], [14.5, 1], [17, 6.4], [19, 2.5], [20.4, 1.6]])).d?.kind).toBe('high');
  });

  it('not enough speed for the loop: the hint is about the swing before the loop', () => {
    const t = make([[7.5, 5.4], [10.5, 4.4], [13, 2.8], [16, 1.8], [20.4, 1.6]], 1);
    addLoop(t, 7.5);
    expect(run(t).d?.kind).toBe('loop');
  });

  it('a track that stops short of the station: the hint is about the station', () => {
    expect(run(make([[8, 3], [10.5, 1], [13, 3]])).d?.kind).toBe('short');
  });

  it('"fix it for me" lowers the hill that is too high, and then the car gets to the end', () => {
    for (const pts of [[[8, 3], [10, 1], [12.3, 4], [14.5, 1], [17, 6.4], [19, 2.5], [20.4, 1.6]], [[8, 3], [10, 1], [13, 8.8], [16.2, 1], [18.2, 3], [20.4, 1.6]]] as [number, number][][]) {
      const t = make(pts);
      for (let k = 0; k < 4; k++) {
        const { d } = run(t);
        if (!d) break;
        expect(fix(t, d)).toBe(true);
      }
      expect(run(t).d, JSON.stringify(pts)).toBeNull();
    }
  });

  it('"fix it for me" gives the loop a deeper drop, and a short track a way down to the station', () => {
    const t = make([[7.5, 5.4], [10.5, 4.4], [13, 2.8], [16, 1.8], [20.4, 1.6]], 1);
    addLoop(t, 7.5);
    for (let k = 0; k < 5; k++) {
      const { d } = run(t);
      if (!d) break;
      fix(t, d);
    }
    expect(run(t).d).toBeNull();
    const u = make([[8, 3], [10.5, 1], [13, 3]]);
    const { d } = run(u);
    expect(fix(u, d!)).toBe(true);
    expect(u.complete).toBe(true);
    expect(u.pts[u.pts.length - 1].x).toBe(STATION.x);
    expect(run(u).ride.outcome).toBe('finished');
  });
});

describe('the special parts', () => {
  it('a chain lift pulls the car up a hill that it could not climb by itself', () => {
    const pts: [number, number][] = [[8.5, 3], [10.5, 1], [13, 7.6], [15.5, 1.2], [18, 3], [20.4, 1.6]];
    const without = make(pts);
    expect(simulate(buildPath(without)).outcome).toBe('stalled');
    const withChain = make(pts);
    expect(addPart(withChain, 'chain', 11.8)).toBe(true);
    const r = simulate(buildPath(withChain));
    expect(r.outcome).toBe('finished');
  });

  it('a tunnel and a splash are decorations: they do not change the ride; and they do not go inside a loop or over another of the same kind', () => {
    const a = make(EASY);
    const b = make(EASY);
    expect(addPart(b, 'tunnel', 10.8)).toBe(true);
    expect(addPart(b, 'splash', 14)).toBe(true);
    expect(addPart(b, 'tunnel', 11)).toBe(false);
    expect(Array.from(simulate(buildPath(a)).s)).toEqual(Array.from(simulate(buildPath(b)).s));
    const path = buildPath(b);
    expect(path.tunnels).toHaveLength(1);
    expect(path.splashes).toHaveLength(1);
    const l = make([[8.5, 0.9], [12, 0.9], [15, 1.5], [18, 2.2], [20.4, 1.6]]);
    expect(addLoop(l, 8.5)).toBe(true);
    expect(addPart(l, 'tunnel', 9)).toBe(false);
  });

  it('two loops: the second one does not touch the first, and the ride with deep drops goes through both', () => {
    const t = make([[8.5, 0.8], [11.8, 0.8], [15.2, 0.8], [18.5, 1.6], [20.4, 1.6]]);
    expect(addLoop(t, 8.5)).toBe(true);
    expect(addLoop(t, 9.5)).toBe(false); // too near the first
    expect(addLoop(t, 15.2)).toBe(true);
    expect(t.loops).toHaveLength(2);
    const p = buildPath(t);
    expect(p.loops).toHaveLength(2);
    expect(p.loops[1][0]).toBeGreaterThan(p.loops[0][1]);
    expect(simulate(p).outcome).toBe('finished');
  });
});
