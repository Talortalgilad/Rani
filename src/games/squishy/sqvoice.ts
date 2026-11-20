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
  { id: 'sq_order_shape', lang: 'he', text: 'כמעט! הצורה לא מתאימה להזמנה. רוצה לתקן?', where: 'order check: the shape is not the one that was ordered' },
];
