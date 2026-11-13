/** The Hebrew of the park game, each with an id (recorded like the other games: src/games/english/content/heLines.ts takes this list). */
export const pk = {
  title: 'הפארק של רני',
  draw: 'ציירי מסילה עם האצבע!',
  go: 'סע',
  ride: 'לנסוע!',
  again: 'עוד פעם',
  del: 'מחק',
  restart: 'התחל מחדש',
  overview: 'מבט כולל',
  loop: 'לופ',
  fixMe: 'תקני לי',
  hint_high: 'הגבעה הזאת גבוהה מדי!',
  hint_first: 'הגבעה הראשונה צריכה להיות הכי גבוהה!',
  hint_loop: 'צריך יותר תנופה לפני הלופ!',
  hint_short: 'המסילה לא הגיעה לתחנה!',
  great: 'איזה כיף!',
  wheee: 'וויי!',
  sideView: 'מבט מהצד',
  carView: 'מבט מהקרונית',
  back: 'חזרה למסילה',
};
export const PARK_LINES: { id: string; parts: (string | null)[] }[] = (Object.keys(pk) as (keyof typeof pk)[]).map((k) => ({ id: `park_${k}`, parts: [pk[k]] }));
