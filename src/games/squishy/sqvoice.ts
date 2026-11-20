/**
 * The voice of the workshop: ONLY recordings. A line that has no recording is never read by the voice of the phone: it is not said, and it is written in MISSING (dev console) so that
 * it can be recorded (voice/squishy-lines-to-record.csv lists the ones that the game wants and that do not exist yet; a test keeps the two in step).
 */
import { clipUrl, playClip, recordedClips, recordedWords, stopSpeech, wordClipUrl } from '../english/voice';

export const MISSING = new Set<string>();
const miss = (lang: string, id: string): false => {
  if (!MISSING.has(`${lang}:${id}`)) {
    MISSING.add(`${lang}:${id}`);
    if (import.meta.env?.DEV) console.info(`[squishy] no recording: ${lang}/${id}`);
  }
  return false;
};
/** says a Hebrew line (sq_*): false when there is no recording */
export async function sayHe(id: string): Promise<boolean> {
  stopSpeech();
  if (!(await recordedClips()).has(id)) return miss('he', id);
  return playClip(clipUrl(id));
}
/** says an English clip (a word, a number, an order): false when there is no recording */
export async function sayEn(id: string): Promise<boolean> {
  stopSpeech();
  if (!(await recordedWords()).has(id)) return miss('en', id);
  return playClip(wordClipUrl(id));
}
/** counts aloud: the number 1..10 in English (the recordings that the game has) */
export const sayNumber = (n: number): Promise<boolean> => (n >= 1 && n <= 10 ? sayEn(`number_${n}`) : Promise.resolve(false));

/** the lines that the game wants and that are not recorded yet (voice/squishy-lines-to-record.csv): they are never said, and never read by the phone */
export const WANTED: { id: string; lang: 'he' | 'en'; text: string; where: string }[] = [
  { id: 'sq_free_decorate', lang: 'he', text: 'עכשיו קישוטים! הקישי על הסקווישי כדי להדביק.', where: 'the decorations (free mode): sq_decorate asks "how many do you need?", which is for the orders' },
  { id: 'sq_free_spoons_full', lang: 'he', text: 'הקערה מלאה! עכשיו מערבבים.', where: 'the bowl is full (10 spoons)' },
  { id: 'sq_free_finish', lang: 'he', text: 'איזה גימור תרצי? מבריק, נצנצים או מט.', where: 'the choice of the finish' },
  { id: 'sq_free_stir_done', lang: 'he', text: 'התערבב! איזה צבע יפה.', where: 'the end of the stirring' },
  { id: 'glitter', lang: 'en', text: 'Glitter', where: 'the finish: glitter (tap on the button)' },
  { id: 'matte', lang: 'en', text: 'Matte', where: 'the finish: matte (tap on the button)' },
  { id: 'glossy', lang: 'en', text: 'Glossy', where: 'the finish: glossy (tap on the button)' },
];
