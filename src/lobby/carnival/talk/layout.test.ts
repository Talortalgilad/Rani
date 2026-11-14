import { describe, expect, it } from 'vitest';
import { MATH_KINDS, makeTalk, validTalk, type TalkEnv, type TalkKind } from './gen';
import { PILE, PILE_MAX, VIEW, availableHeight, boardFor, contentHeight, contentWidth } from './layout';

const env = (level: number): TalkEnv => ({ level, words: {}, today: 100, name: 'רני', otherNames: ['דני', 'נועה'], resident: 'מוצי' });

describe('a talk never needs scrolling (360 x 640)', () => {
  it('the things to count: 36 px with 8 px between and 5 in a row; over 15 on the board, 28 px with 6 and 7 in a row', () => {
    expect(boardFor(15)).toEqual({ size: 36, gap: 8, cols: 5 });
    expect(boardFor(16)).toEqual({ size: 28, gap: 6, cols: 7 });
    expect(PILE).toEqual({ size: 48, gap: 8, cols: 5 });
    expect(PILE_MAX).toBe(12);
  });

  it('every question of every level fits the height and the width of the screen', () => {
    const room = availableHeight();
    let worst: Record<string, number> = {};
    for (let level = 1; level <= 5; level++)
      for (const kind of [...MATH_KINDS, 'hello'] as TalkKind[])
        for (let seed = 1; seed <= 400; seed++) {
          const t = makeTalk(kind, seed * 31 + level, env(level))!;
          expect(validTalk(t, level)).toBe(true);
          const h = contentHeight(t);
          expect(h, `${kind} level ${level} ${JSON.stringify(t)}`).toBeLessThanOrEqual(room);
          expect(contentWidth(t), `${kind} width`).toBeLessThanOrEqual(VIEW.w - 24);
          worst[kind] = Math.max(worst[kind] ?? 0, h);
          if (t.kind === 'exact') {
            expect(t.pile).toBeLessThanOrEqual(PILE_MAX);
            expect(PILE.size).toBeGreaterThanOrEqual(48);
          }
        }
    expect(Math.max(...Object.values(worst))).toBeLessThanOrEqual(room);
  });
});
