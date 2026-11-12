import { getState } from '../../storage';

/** English (instructions, words) and Hebrew (story, encouragement) read aloud with the device's own voices. Works offline. */
let voices: SpeechSynthesisVoice[] = [];
const synth = (): SpeechSynthesis | null => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);

function load(): void {
  const s = synth();
  if (!s) return;
  voices = s.getVoices();
}
if (synth()) {
  load();
  synth()!.addEventListener?.('voiceschanged', load);
}

const NATURAL = /natural|neural|enhanced|premium|google|samantha|karen|daniel|serena/i;

/** The most natural voice of a language that the device has (null when there is none). */
export function pickVoice(lang: 'en' | 'he'): SpeechSynthesisVoice | null {
  if (!voices.length) load();
  const match = voices.filter((v) => (lang === 'he' ? /^(he|iw)([-_]|$)/i.test(v.lang) : /^en([-_]|$)/i.test(v.lang)));
  if (!match.length) return null;
  const rank = (v: SpeechSynthesisVoice): number => (NATURAL.test(v.name) ? 2 : 0) + (/en[-_]US/i.test(v.lang) ? 1 : 0) + (v.localService ? 0.5 : 0);
  return [...match].sort((a, b) => rank(b) - rank(a))[0];
}

export const hasHebrewVoice = (): boolean => pickVoice('he') !== null;

function say(text: string, lang: 'en' | 'he', rate: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = synth();
    try {
      if (!s || !getState().settings.tts) return resolve(false);
      const v = pickVoice(lang);
      if (lang === 'he' && !v) return resolve(false);
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === 'he' ? 'he-IL' : v?.lang || 'en-US';
      if (v) u.voice = v;
      u.rate = rate;
      u.pitch = 1.08;
      const done = (): void => resolve(true);
      u.onend = done;
      u.onerror = done;
      window.setTimeout(done, 9000 + text.length * 120); // a voice that never finishes must not stall the game
      s.speak(u);
    } catch {
      resolve(false);
    }
  });
}

/** English: instructions at 0.85, single words at 0.75. */
export const speakEn = (text: string, rate = 0.85): Promise<boolean> => (stopSpeech(), say(text, 'en', rate));
export const speakWord = (word: string): Promise<boolean> => speakEn(word, 0.75);
/** Hebrew: false when the device has no Hebrew voice (the text stays in the speech bubble). */
export const speakHe = (text: string): Promise<boolean> => (stopSpeech(), say(text, 'he', 0.9));

export function stopSpeech(): void {
  try {
    synth()?.cancel();
  } catch {
    /* ignore */
  }
}
