import { soundsOf } from './journey';

/** The "slide" of blending: the sounds one after the other, then the whole word (/c/ - /a/ - /t/ -> cat). Times in ms from the start. */
export interface BlendStep { at: number; kind: 'sound' | 'word'; letter?: string; index?: number }
export function blendTimeline(word: string, gap = 700): BlendStep[] {
  const out: BlendStep[] = soundsOf(word).map((letter, i) => ({ at: 300 + i * gap, kind: 'sound', letter, index: i }));
  out.push({ at: 300 + soundsOf(word).length * gap + 200, kind: 'word' });
  return out;
}

/** What the tiles of a "build" task are: the letters of the word plus two others that the child has met (never one of the word's own). */
export function buildTiles(word: string, pool: string[], pick: (n: number) => number): string[] {
  const own = new Set(soundsOf(word));
  const extra = pool.filter((l) => !own.has(l));
  const tiles = [...soundsOf(word)];
  const left = [...extra];
  for (let i = 0; i < 2 && left.length; i++) tiles.push(left.splice(pick(left.length), 1)[0]);
  // shuffled, and never already in the order of the word (that would give the answer away)
  for (let k = 0; k < 6; k++) {
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = pick(i + 1);
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    if (tiles.slice(0, word.length).join('') !== word) break;
  }
  return tiles;
}
