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
  idea: 'רגע, יש לי רעיון!',
  noStars: 'אין מספיק כוכבים',
  nothingHere: 'אין מה לפרק',
  nothingToTurn: 'אין מה לסובב',
  pickShape: 'בחרי צורה לסיבוב',
  pickBlock: 'בחרי קובייה לפירוק',
  swap: 'החלפה',
  rotate: 'סיבוב',
  hammer: 'פטיש',
  free: 'חינם',
};
export const BLOCKS_LINES: { id: string; parts: (string | null)[] }[] = ((Object.keys(bk) as (keyof typeof bk)[])).map((k) => ({ id: `blk_${k}`, parts: [bk[k]] }));
