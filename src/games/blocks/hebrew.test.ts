import { describe, expect, it } from 'vitest';
import { BLOCKS_LINES, bk } from './lines';
import { HE_LINES } from '../english/content/heLines';
import { LEVELS } from './levels';

// the sources of the game and the csv, as text (vite)
const all = import.meta.glob('./**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const files = Object.entries(all).filter(([f]) => !/\.test\.ts$/.test(f) && !/lines\.ts$/.test(f));
const csv = (import.meta.glob('../../../voice/he-lines.csv', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['../../../voice/he-lines.csv'];

describe('the Hebrew of the block game is all in he-lines.csv and is spoken', () => {
  it('every line has an id in the registry and a row in he-lines.csv', () => {
    for (const l of BLOCKS_LINES) {
      expect(HE_LINES.some((h) => h.id === l.id), l.id).toBe(true);
      // a line with the same words as another one shares its recording (the csv has one row for each text)
      expect(csv.includes(l.parts[0] as string), `${l.id} in the csv`).toBe(true);
    }
    expect(BLOCKS_LINES).toHaveLength(Object.keys(bk).length);
  });

  it('every id that the code uses (written out or built from the lists below) is one of the lines', () => {
    const ids = new Set(BLOCKS_LINES.map((l) => l.id));
    const used = new Set<string>();
    for (const [, text] of files) for (const m of text.matchAll(/['"`](blk_[a-zA-Z]+(?:_[a-zA-Z]+)*)['"`]/g)) used.add(m[1]);
    for (const id of used) if (id !== 'blk_tut') expect(ids.has(id), id).toBe(true); // blk_tut is the prefix of the three lessons
    // built ids: the helpers, the three lessons, the combo words, the rescue and the end windows
    for (const h of ['swap', 'rotate', 'hammer']) expect(ids.has(`blk_${h}`)).toBe(true);
    for (const t of new Set(LEVELS.map((l) => l.tutorial).filter(Boolean))) expect(ids.has(`blk_tut_${t}`)).toBe(true);
    for (const id of ['blk_nice', 'blk_amazing', 'blk_wow', 'blk_magic', 'blk_clean', 'blk_idea', 'blk_full', 'blk_best', 'blk_newBoard', 'blk_levelDone', 'blk_prize', 'blk_wave', 'blk_cheer', 'blk_noStars', 'blk_nothingHere', 'blk_nothingToTurn', 'blk_pickShape', 'blk_pickBlock']) expect(ids.has(id), id).toBe(true);
  });

  it('the code has no Hebrew text of its own: every Hebrew string comes from lines.ts, the level names or the helpers', () => {
    for (const [f, text] of files) {
      if (/levels\.ts$/.test(f)) continue; // the names of the worlds
      const src = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\/\/ .*$/gm, '');
      const found = [...src.matchAll(/['"`]([^'"`\n]*[א-ת][^'"`\n]*)['"`]/g)].map((m) => m[1]);
      // the combo words in game.ts are the ones of lines.ts; aria-labels and the clean-board title are allowed too
      const strays = found.filter((t) => !Object.values(bk).includes(t) && !['חזרה', 'נעול', 'לוח נקי!', 'יופי!', 'מדהים!', 'וואו!', 'קסם!'].includes(t));
      expect(strays, f).toEqual([]);
    }
  });
});
