import { describe, expect, it } from 'vitest';
import HE from '../../../public/english/voice/he/manifest.json';
import EN from '../../../public/english/voice/en/manifest.json';
import gameSrc from './game.ts?raw';
import sqvoiceSrc from './sqvoice.ts?raw';
import viewSrc from './view.ts?raw';
import squishySrc from './squishy.ts?raw';
import csv from '../../../voice/squishy-lines-to-record.csv?raw';
import { CHEEKS, EYES, MOUTHS } from './faces';
import { cleanName, DOT_OF, FINISHES, FOODS, loadStore, newSquishy, OPEN_MOLDS, STEP_ORDER, cleanSquishy } from './save';
import { SHAPES, shapeInfo } from './shapes';
import { WANTED } from './sqvoice';

const he = new Set((HE as { clips: string[] }).clips);
const en = new Set((EN as { clips: string[] }).clips);

describe('what the workshop remembers', () => {
  it('a new squishy is data only, and is cleaned when it is read back (a damaged save does not break)', () => {
    const d = newSquishy('cat');
    expect(JSON.parse(JSON.stringify(d))).toEqual(d);
    expect(cleanSquishy({ shape: 'nope' })).toBeNull();
    expect(cleanSquishy(null)).toBeNull();
    const c = cleanSquishy({ shape: 'cat', colors: [[999, -5, 'x'], [1, 2, 3], [4, 5, 6], [7, 8, 9], [1, 1, 1], [2, 2, 2]], decor: [{ k: 'star', x: 9999, y: -3 }, { k: 'bad', x: 1, y: 1 }], finish: 'zzz', face: { eyes: 99, mouth: -1, cheeks: 'q' }, name: '<b>abcdefghijklmnopqrstu</b>', food: 'pizza' })!;
    expect(c.colors.length).toBeLessThanOrEqual(shapeInfo('cat').parts);
    expect(c.decor).toEqual([{ k: 'star', x: 512, y: 0 }]);
    expect(FINISHES).toContain(c.finish);
    expect(c.face.eyes).toBe(EYES - 1);
    expect(c.face.mouth).toBe(0);
    expect(c.face.cheeks).toBe(1);
    expect(c.name.length).toBeLessThanOrEqual(12);
    expect(c.name).not.toContain('<');
    expect(c.food).toBe('');
    expect(cleanName('  <hi>  ')).toBe('hi');
  });
  it('the draft and the shelf are loaded safely, and the shelf is the data of squishies, never pictures', () => {
    expect(loadStore({ draft: 5, shelf: 'x' })).toEqual({ draft: null, shelf: [], orders: { done: [], hearts: 0, given: 0, toys: [] }, carnival: [] });
    const d = newSquishy('dog');
    const s = loadStore({ draft: { step: 'paint', data: d, poured: true, squeezes: 3 }, shelf: [d, { shape: 'zzz' }, null] });
    expect(s.draft?.step).toBe('paint');
    expect(s.shelf).toHaveLength(1);
    expect(loadStore({ draft: { step: 'unknown', data: d }, shelf: [] }).draft).toBeNull();
  });
  it('seven points in the progress bar, in the order of the steps; six molds are open from the start; the whole set of 18 shapes is there', () => {
    expect(new Set(Object.values(DOT_OF)).size).toBe(7);
    let last = 0;
    for (const st of STEP_ORDER) { expect(DOT_OF[st]).toBeGreaterThanOrEqual(last); last = DOT_OF[st]; }
    expect(OPEN_MOLDS).toHaveLength(6);
    for (const m of OPEN_MOLDS) expect(SHAPES).toContain(m);
    expect(SHAPES).toHaveLength(18);
  });
  it('6 pairs of eyes, 6 mouths and 4 kinds of cheeks; six sweets to choose from, each a shape of the workshop', () => {
    expect([EYES, MOUTHS, CHEEKS]).toEqual([6, 6, 4]);
    expect(FOODS).toHaveLength(6);
    for (const f of FOODS) expect(SHAPES).toContain(f);
  });
});

describe('the voice of the workshop: recordings only', () => {
  const src = gameSrc;
  it('every Hebrew line that the game says (sq_*) is recorded, except the ones that are listed as wanted', () => {
    const wanted = new Set(WANTED.map((w) => w.id));
    for (const id of new Set([...src.matchAll(/say\('(sq_[a-z_]+)'\)/g)].map((m) => m[1]).concat([...src.matchAll(/sayHe\('(sq_[a-z_]+)'\)/g)].map((m) => m[1])))) {
      expect(he.has(id) || wanted.has(id), `${id} is neither recorded nor in the list of wanted lines`).toBe(true);
    }
  });
  it('the wanted lines are really not recorded yet, and are in the file that goes to the recording', () => {
    for (const w of WANTED) {
      expect((w.lang === 'he' ? he : en).has(w.id), `${w.id} is recorded now: take it out of WANTED`).toBe(false);
      expect(csv.includes(w.id), w.id).toBe(true);
    }
  });
  it('the English words that the game says (the colours, the sweets, the numbers) are recorded', () => {
    for (const id of ['pink', 'blue', 'yellow', 'purple', 'green', 'red', 'white', 'star', 'flower', 'heart', ...FOODS, ...Array.from({ length: 10 }, (_, i) => `number_${i + 1}`)]) expect(en.has(id), id).toBe(true);
  });
  it('no line of the workshop is read by the voice of the phone: the game never calls the phone voice', () => {
    for (const [f, t] of Object.entries({ 'game.ts': gameSrc, 'sqvoice.ts': sqvoiceSrc, 'view.ts': viewSrc, 'squishy.ts': squishySrc })) {
      expect(/speakEn|speakHe\b|speakHeLine|sayLine\(|sayLabel\(|speechSynthesis/.test(t), f).toBe(false);
    }
  });
});

describe('the lines of the order check are recorded', () => {
  it('sq_order_shape (take 503) is connected: recorded, and said by the check when the shape is not the one that was ordered', () => {
    expect(he.has('sq_order_shape')).toBe(true);
    expect(gameSrc.includes("'sq_order_shape'")).toBe(true);
    expect(WANTED.map((w) => w.id).sort()).toEqual(['sq_cup_almost', 'sq_cup_drain']);
  });
});
