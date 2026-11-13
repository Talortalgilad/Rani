/** Everything the memory game says in Hebrew (SPEC-memory.md: all text is Hebrew, RTL), each with an id: they are recorded in the studio like the sentences of the English game (src/games/english/content/heLines.ts takes this list). `{name}` is a player's name. */
export const mm = {
  title: 'זיכרון',
  journey: 'מסע',
  versus: 'בשניים',
  decks: 'ערכות',
  levels: 'שלבים',
  again: 'שוב',
  next: 'השלב הבא',
  attempts: 'ניסיונות',
  streak: 'רצף ארוך',
  best: 'שיא אישי',
  record: 'שיא חדש!',
  resume: 'המשך',
  pickDeck: 'בחרי ערכה',
  pickSize: 'בחרי גודל לוח',
  small: 'קטן',
  medium: 'בינוני',
  large: 'גדול',
  locked: 'נעול',
  lockWorld: 'נפתח אחרי שמסיימים את העולם במסע',
  lockPhotos: 'צריך לפחות שש תמונות. מוסיפים באזור ההורים',
  needPhotos: 'צריך עוד תמונות בערכה',
  animals: 'חיות',
  food: 'אוכל',
  sweets: 'ממתקים',
  toys: 'צעצועים',
  clothes: 'בגדים',
  music: 'מוזיקה',
  weather: 'מזג אוויר',
  journeySweets: 'ממתקי המסע',
  farm: 'חווה',
  sea: 'ים',
  space: 'חלל',
  family: 'המשפחה שלי',
  who: 'מי משחק?',
  player1: 'שחקן 1',
  player2: 'שחקן 2',
  dad: 'אבא',
  mum: 'אמא',
  ray: 'ריי',
  otherName: 'שם אחר',
  go: 'יאללה, מתחילים!',
  turnOf: (name: string) => `התור של ${name}`,
  pairAgain: (name: string) => `זוג! עוד תור ל${name}`,
  wins: (name: string) => `ניצחון ל${name}!`,
  tie: 'תיקו! כל הכבוד לשניכם!',
  newGame: 'משחק חדש',
};

/** The names that are recorded once and used wherever a player is named. */
export const FAMILY_NAMES = [
  { key: 'rani', he: 'רני' },
  { key: 'aba', he: 'אבא' },
  { key: 'ima', he: 'אמא' },
  { key: 'ray', he: 'ריי' },
];

const NAME = '\u0000';
/** The sentences as ids and pieces (null where a name goes). */
const cut = (t: string): (string | null)[] => t.split(NAME).flatMap((p, i, a) => (i < a.length - 1 ? [p, null] : [p])).filter((p) => p === null || /[א-ת]/.test(p));
export const MEMORY_LINES: { id: string; parts: (string | null)[] }[] = [
  ...(['title', 'journey', 'versus', 'decks', 'levels', 'again', 'next', 'attempts', 'streak', 'best', 'record', 'resume', 'pickDeck', 'pickSize', 'small', 'medium', 'large', 'locked', 'lockWorld', 'lockPhotos', 'needPhotos', 'animals', 'food', 'sweets', 'toys', 'clothes', 'music', 'weather', 'journeySweets', 'farm', 'sea', 'space', 'family', 'who', 'player1', 'player2', 'dad', 'mum', 'ray', 'otherName', 'go', 'tie', 'newGame'] as const).map((k) => ({ id: `mm_${k}`, parts: [mm[k]] })),
  { id: 'mm_turnOf', parts: cut(mm.turnOf(NAME)) },
  { id: 'mm_pairAgain', parts: cut(mm.pairAgain(NAME)) },
  { id: 'mm_wins', parts: cut(mm.wins(NAME)) },
];
