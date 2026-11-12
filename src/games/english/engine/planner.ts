import { COLORS, colorKey } from '../content/colors';
import { PAINT } from '../content/paint';
import { sentencesFor } from '../content/sentences';
import { wordsOfWorld } from '../content/words';
import { STATIONS_PER_WORLD, dueWords, isKnown, type Words } from './progress';
import type { Kind, Step } from './steps';

/** Which kinds of task a world brings (SPEC-english.md sections 4 and 5): each world has the ones of the world before, and more. */
export function kindsForWorld(world: number): Kind[] {
  const k: Kind[] = ['circle', 'tap', 'put', 'listen', 'match'];
  if (world >= 2) k.push('find');
  if (world >= 4) k.push('color');
  if (world >= 5) k.push('count');
  if (world >= 6) k.push('sentence');
  if (world >= 11) k.push('where', 'bigsmall');
  // the words of the dance party are actions and the weather cannot be put in a box or counted: those worlds keep to tapping, circling, listening and matching
  const not: Kind[] = world === 8 ? ['put', 'find', 'count'] : world === 9 ? ['put', 'count'] : [];
  return k.filter((x) => !not.includes(x));
}

/** What can be done with each obstacle of the ninja park. */
export const OBSTACLES: Record<string, ('on' | 'in' | 'under' | 'over')[]> = { crate: ['on', 'over'], mat: ['on'], bridge: ['under', 'over'], tunnel: ['in'], rope: ['over', 'under'] };

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, a: T[]): T => a[Math.floor(r() * a.length)];
function sample<T>(r: () => number, a: T[], n: number): T[] {
  const c = [...a];
  const out: T[] = [];
  while (out.length < n && c.length) out.push(c.splice(Math.floor(r() * c.length), 1)[0]);
  return out;
}

export interface PlanInput {
  world: number;
  /** 0..4: three stations with three new words each, a review station, and the rescue */
  station: number;
  words: Words;
  today: number;
  seed: number;
  /** the words that Rani likes (parents choose): the new words of a world start with them */
  likes?: string[];
}

/** The colours introduced by a station of world 4 (three at a time, with a card each). */
export const colorsOfStation = (world: number, station: number): string[] => (world === 4 && station === 1 ? ['red', 'blue', 'yellow'] : world === 4 && station === 2 ? ['pink', 'purple', 'green'] : []);
/** The colours that Rani has met by a station of world 4. */
const metColors = (world: number, station: number): string[] => (world > 4 ? COLORS.map((c) => c.id) : world < 4 ? [] : COLORS.slice(0, station >= 2 ? 6 : station >= 1 ? 3 : 0).map((c) => c.id));

/**
 * Builds a station: cards for the new words, then 4-6 tasks of which about 60% are about the new words and 40% review words that are
 * due, and at the end of the world a song. The same seed gives the same station.
 */
export function planStation(o: PlanInput): Step[] {
  const r = mulberry32(o.seed * 7919 + o.world * 131 + o.station);
  const likes = o.likes ?? [];
  const ws = wordsOfWorld(o.world).map((w) => w.id).sort((a, b) => Number(likes.includes(b)) - Number(likes.includes(a)));
  const fresh = o.station < 3 ? ws.slice(o.station * 3, o.station * 3 + 3) : [];
  const steps: Step[] = [];
  for (const id of fresh) if (!o.words[id]?.seen) steps.push({ kind: 'card', word: id, score: [] });
  for (const c of colorsOfStation(o.world, o.station)) if (!o.words[colorKey(c)]?.seen) steps.push({ kind: 'colorcard', color: c, score: [] });

  // the words to review: the ones that are due (not known well and left alone for long), else earlier words of this world
  const earlier = ws.slice(0, o.station * 3);
  const due = dueWords(o.words, o.today).filter((id) => !fresh.includes(id) && !id.startsWith('color:') && wordsOfWorld(o.world).concat(wordsOfWorld(o.world - 1)).some((w) => w.id === id));
  const review = o.station >= 3 ? ws : due.length ? due : earlier;
  const taskCount = o.station < 3 ? 5 : 6;

  const kinds = kindsForWorld(o.world);
  let last: Kind | null = null;
  const used: Record<string, number> = {};
  const targets: string[] = [];
  // new and review words, interleaved: N N R N R (for five tasks)
  const newPool = fresh.length ? fresh : [];
  let ni = 0;
  let ri = 0;
  const pattern = taskCount === 5 ? ['N', 'N', 'R', 'N', 'R'] : ['N', 'R', 'N', 'R', 'N', 'R'];
  for (const p of pattern) {
    if ((p === 'N' && newPool.length) || !review.length) targets.push(newPool.length ? newPool[ni++ % newPool.length] : ws[(ri++) % ws.length]);
    else targets.push(review[ri++ % review.length]);
  }

  const colorsMet = metColors(o.world, o.station);
  for (let i = 0; i < taskCount; i++) {
    const target = targets[i];
    // a kind that was not used just before and not more than twice; colour tasks only when colours were met
    const options = kinds.filter((k) => k !== last && (used[k] ?? 0) < 2 && (k !== 'color' || colorsMet.length > 0));
    let kind = pick(r, options.length ? options : kinds.filter((k) => k !== last));
    if (o.station === 3 || o.station === 4) {
      // the review and rescue stations lean on the harder kinds of the world
      const hard = options.filter((k) => ['find', 'color', 'count', 'sentence', 'where', 'bigsmall', 'match'].includes(k));
      if (hard.length && r() < 0.6) kind = pick(r, hard);
    }
    last = kind;
    used[kind] = (used[kind] ?? 0) + 1;
    const others = (n: number): string[] => sample(r, ws.filter((x) => x !== target), n);
    switch (kind) {
      case 'circle': case 'tap': case 'listen':
        steps.push({ kind, right: target, ids: [target, ...others(2)], score: [target] });
        break;
      case 'put':
        steps.push({ kind, right: target, others: others(2), score: [target] });
        break;
      case 'match': {
        const ids = [target, ...others(2)];
        const written = ids.every((id) => (o.words[id]?.level ?? 0) >= 2) && o.world >= 3;
        steps.push({ kind, ids, mode: written ? 'written' : 'audio', score: ids });
        break;
      }
      case 'find':
        steps.push({ kind, right: target, others: others(3), count: 2 + Math.floor(r() * 2), score: [target] });
        break;
      case 'color': {
        const c = pick(r, colorsMet);
        steps.push({ kind, object: pick(r, PAINT).id, color: c, score: [colorKey(c)] });
        break;
      }
      case 'count':
        steps.push({ kind, right: target, n: 2 + Math.floor(r() * 4), score: [target] });
        break;
      case 'bigsmall':
        steps.push({ kind, right: target, which: r() < 0.5 ? 'big' : 'small', score: [target] });
        break;
      case 'where': {
        // the ninja course (world 11): the ninja is dragged on, over, under or into an obstacle
        const ref = pick(r, Object.keys(OBSTACLES));
        steps.push({ kind, item: 'ninja', ref, prep: pick(r, OBSTACLES[ref]), score: [ref] });
        break;
      }
      case 'sentence': {
        const s = pick(r, sentencesFor(o.world));
        steps.push({ kind, words: s.words, picture: s.picture, missing: s.words.length - 1, score: [] });
        break;
      }
      default:
        break;
    }
  }
  if (o.station === STATIONS_PER_WORLD - 1) steps.push({ kind: 'song', world: o.world, score: [] });
  return steps;
}

/** Words that count as learned in this world: all nine known (used to decide how well a world went). */
export const worldMastery = (words: Words, world: number): number => {
  const ws = wordsOfWorld(world);
  return ws.filter((w) => isKnown(words[w.id])).length / Math.max(1, ws.length);
};
