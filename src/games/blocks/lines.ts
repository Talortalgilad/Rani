/** The Hebrew of the block game, each with an id (recorded in the studio like the other games: src/games/english/content/heLines.ts takes this list). */
export const bk = {
  title: 'קוביות קסם',
  nice: 'יופי!',
  amazing: 'מדהים!',
  wow: 'וואו!',
  magic: 'קסם!',
  clean: 'לוח נקי!',
  full: 'וואו, מילאת את כל הלוח!',
  newBoard: 'לוח חדש',
  best: 'שיא חדש!',
  score: 'ניקוד',
};
export const BLOCKS_LINES: { id: string; parts: (string | null)[] }[] = (['title', 'nice', 'amazing', 'wow', 'magic', 'clean', 'full', 'newBoard', 'best', 'score'] as const).map((k) => ({ id: `blk_${k}`, parts: [bk[k]] }));
