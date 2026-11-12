/** Everything Cheesy says. `{name}` is the name Rani gave her (companion.name): never written into the text. */
export const nameOptions = [
  { name: 'צ׳יזי', say: 'Cheesy' },
  { name: 'מוצי', say: 'Mozzi' },
  { name: 'חוריקו', say: 'Horiko' },
  { name: 'פופצ׳יז', say: 'Pop Cheese' },
];

export const he = {
  askName: 'היי! עוד אין לי שם... איך תקראי לי?',
  otherName: 'שם אחר',
  typeName: 'איזה שם תרצי?',
  ok: 'אישור',
  iAm: (name: string) => `אני ${name}!`,
  islandTitle: (name: string) => `ההרפתקאות של ${name}`,
  start: 'בואי נתחיל!',
  newWords: 'שלוש מילים חדשות! הקישי על הקלף.',
  cardTap: 'הקישי על הקלף כדי לשמוע',
  next: 'הלאה',
  tryAgain: 'כמעט! עוד פעם',
  show: 'אני אראה לך!',
  proud: (name: string) => `${name} גאה בך!`,
  great: 'כל הכבוד!',
  rescued: (name: string) => `הצלת אותי! תודה! ${name} ואני עכשיו חברים.`,
  voiceMissing: '',
  again: 'עוד פעם',
  home: 'בית',
  shelf: 'המדף',
  shelfTitle: 'מדף הסקווישים',
  verb: (en: string, he: string) => `${en}, זה ${he}!`,
};

export const en = {
  circle: (w: string) => `Circle the ${w}!`,
  tap: (w: string) => `Tap the ${w}!`,
  put: (w: string, to: string) => `Put the ${w} in the ${to}!`,
  match: 'Match!',
  listen: (w: string) => w,
  tryAgain: 'Hmm, try again!',
  great: 'Great job!',
  almost: 'Almost! Try again!',
  imBunny: "I'm Bunny!",
};
