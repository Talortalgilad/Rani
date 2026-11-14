/**
 * Which piece can go next (SPEC-park.md 3.3): "you cannot make a mistake". Before every tap the game knows the speed of the train at the end of the
 * track, with the same energy as the physics: a piece is allowed when the track with it is still ridden to the end. Pure.
 */
import { V_CHAIN, V_MAX } from './physics';
import { DS, G, KINDS, cloneTrack, buildCurve, fits, walk, type Curve, type Kind, type Track } from './track';

/** the slowest speed that the train may have anywhere on the track (outside the chain lift); the friction of the rest takes less than this */
export const V_MIN = 2.2;
export const FRICTION = 0.16;
const LOOP_MARGIN = 3;

export interface Energy {
  ok: boolean;
  /** the speed at the end of the pieces and the slowest speed after the chain lift */
  endV: number;
  minV: number;
  /** why not: the car would not get up (hill) or round (loop) */
  why: 'speed' | null;
}

/** Runs the speed along the curve (v^2 changes with the height and the friction) up to the end of the pieces. */
export function energyAlong(c: Curve, upTo = c.piecesEnd + 1.5): Energy {
  let v2 = 0;
  let minV = Infinity;
  const i0 = Math.round(c.startS / DS);
  const last = Math.min(c.n - 1, Math.round(upTo / DS));
  let endV = 0;
  const endI = Math.min(c.n - 1, Math.round(c.piecesEnd / DS));
  for (let i = i0; i <= last; i++) {
    if (c.s[i] < c.crestS) {
      // a loop on the chain lift does not work: the loop needs speed that comes from a descent
      if (c.inLoop[i]) return { ok: false, endV: V_CHAIN, minV: V_CHAIN, why: 'speed' };
      v2 = V_CHAIN * V_CHAIN;
    }
    else {
      v2 -= 2 * G * (c.y[i] - c.y[i - 1]) + 2 * FRICTION * DS;
      v2 = Math.min(v2, V_MAX * V_MAX);
      if (v2 < V_MIN * V_MIN) return { ok: false, endV: Math.sqrt(Math.max(0, v2)), minV: Math.sqrt(Math.max(0, v2)), why: 'speed' };
      minV = Math.min(minV, Math.sqrt(v2));
      if (c.inLoop[i] && v2 + G * (c.cy[i] - c.y[i]) < LOOP_MARGIN) return { ok: false, endV: Math.sqrt(Math.max(0, v2)), minV: Math.sqrt(Math.max(0, v2)), why: 'speed' };
    }
    if (i === endI) endV = Math.sqrt(Math.max(0, v2));
  }
  return { ok: true, endV, minV: Number.isFinite(minV) ? minV : V_CHAIN, why: null };
}

export type Verdict = { ok: true } | { ok: false; why: 'speed' | 'space' | 'high' };

/** Can this piece be put at the end of the track? */
export function allowed(t: Track, k: Kind): Verdict {
  const f = fits(walk(t), k);
  if (!f.ok) return { ok: false, why: f.why };
  const c = cloneTrack(t);
  c.pieces.push(k);
  return energyAlong(buildCurve(c)).ok ? { ok: true } : { ok: false, why: 'speed' };
}

export const allAllowed = (t: Track): Record<Kind, Verdict> => Object.fromEntries(KINDS.map((k) => [k, allowed(t, k)])) as Record<Kind, Verdict>;

/** The speed of the train at the end of the track, for the meter: green, yellow or red. */
export function speedAtEnd(t: Track): { v: number; level: 'green' | 'yellow' | 'red' } {
  const e = energyAlong(buildCurve(t));
  const v = e.endV;
  return { v, level: v >= 6 ? 'green' : v >= 4 ? 'yellow' : 'red' };
}
