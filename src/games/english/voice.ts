import { getState } from '../../storage';
import { clipIds, getClip } from './voiceStore';

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

/** A label that was just pressed ("home") is let finish when the screen changes: until then a plain stopSpeech(false) leaves it alone. */
let keepUntil = 0;
/** True while a pressed label is still being said (a title that opens next stays quiet instead of cutting it). */
export const labelBusy = (): boolean => Date.now() < keepUntil;
export function stopSpeech(force = true): void {
  if (!force && Date.now() < keepUntil) return;
  stopClip();
  try {
    synth()?.cancel();
  } catch {
    /* ignore */
  }
}

/**
 * Speech recognition ("Say it!", off unless a parent turns it on). On Android and iPhone the browser sends the sound to Google or
 * Apple and needs the internet, so it is only offered when both exist. Nothing is recorded or kept here: only the words it heard.
 */
interface Rec {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
const recCtor = (): (new () => Rec) | null => {
  const w = typeof window === 'undefined' ? null : (window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec });
  return w?.SpeechRecognition ?? w?.webkitSpeechRecognition ?? null;
};
export const recognitionAvailable = (): boolean => !!recCtor() && (typeof navigator === 'undefined' || navigator.onLine !== false);

/** Listens once. The things that were heard (best first), [] when nothing was understood, null when it cannot listen (no permission, no net). */
export function listenOnce(timeoutMs = 7000): Promise<string[] | null> {
  return new Promise((resolve) => {
    const C = recCtor();
    if (!C) return resolve(null);
    stopSpeech();
    let done = false;
    const finish = (v: string[] | null): void => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      try { rec.abort(); } catch { /* ignore */ }
      resolve(v);
    };
    const rec = new C();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 5;
    rec.onresult = (e) => finish(Array.from(e.results[0] ?? []).map((a) => a.transcript));
    rec.onerror = () => finish(null);
    rec.onend = () => finish([]);
    const timer = window.setTimeout(() => finish([]), timeoutMs);
    try { rec.start(); } catch { finish(null); }
  });
}

// ---- the recorded Hebrew voice ----
// A sentence is played from a recording (public/english/voice/he/<id>.mp3) when there is one; the voice of the phone reads it only when
// there is not. The list of the recordings that exist is manifest.json (written by scripts/gen-voice.ts), so nothing is asked for that is not there.
const voiceBase = (): string => `${import.meta.env.BASE_URL}english/voice/he/`;
export const clipUrl = (id: string): string => `${voiceBase()}${id}.mp3`;
let manifest: Promise<Set<string>> | null = null;
/** The ids of the recordings that exist (an empty set when there is no manifest). */
export function recordedClips(): Promise<Set<string>> {
  manifest ??= fetch(`${voiceBase()}manifest.json`)
    .then((r) => (r.ok ? r.json() : { clips: [] }))
    .then((j: { clips?: string[] }) => new Set(j.clips ?? []))
    .catch(() => new Set<string>());
  return manifest;
}
/** The recordings made in the studio on this phone (they come first). */
let phone: Promise<Set<string>> | null = null;
export function phoneClipIds(): Promise<Set<string>> {
  phone ??= clipIds().then((ids) => new Set(ids));
  return phone;
}
/** Forget what was learned about the recordings (the tests, and the studio after it saved or imported one). */
export const resetRecorded = (): void => {
  manifest = null;
  phone = null;
};

let clip: HTMLAudioElement | null = null;
function stopClip(): void {
  try {
    clip?.pause();
  } catch {
    /* ignore */
  }
  clip = null;
}
/** Plays one recording to its end. False when it cannot play (then the caller reads the text instead). */
export function playClip(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (typeof Audio === 'undefined' || !getState().settings.tts) return resolve(false);
      const a = new Audio(url);
      clip = a;
      const done = (ok: boolean): void => resolve(ok);
      a.onended = () => done(true);
      a.onerror = () => done(false);
      a.play().catch(() => done(false));
      window.setTimeout(() => done(false), 20000);
    } catch {
      resolve(false);
    }
  });
}

/** The sound of a letter: the recording (sound_<letter>) if there is one, until then the phone reads the letter and the example word ("s... sun"). */
export const speakLetterSound = (letter: string, word: string): Promise<boolean> => speakHeLine([{ clip: `sound_${letter}`, text: `${letter}... ${word}`, lang: 'en' }]);

export interface LinePiece { clip?: string; text: string; lang: 'he' | 'en' }
/**
 * Says a Hebrew sentence made of pieces, one after the other: each piece from its recording if there is one, else read by the phone
 * (English for a squishy's name). With no recording at all the whole sentence is read at once, which sounds smoother. False when
 * nothing could be heard (no Hebrew voice, sound off): the text stays in the speech bubble.
 */
export async function speakHeLine(pieces: LinePiece[], keep = false): Promise<boolean> {
  stopSpeech();
  if (keep) keepUntil = Date.now() + 2500;
  if (!pieces.length) return false;
  const have = await recordedClips();
  const mine = await phoneClipIds();
  if (!pieces.some((p) => p.clip && (mine.has(p.clip) || have.has(p.clip)))) return say(pieces.map((p) => p.text).join(' '), 'he', 0.9);
  let heard = false;
  for (const p of pieces) {
    // the recording made on this phone first, then the file of the game, and the voice of the phone only at the end
    let played = false;
    if (p.clip && mine.has(p.clip)) {
      const blob = await getClip(p.clip);
      if (blob) {
        const url = URL.createObjectURL(blob);
        played = await playClip(url);
        URL.revokeObjectURL(url);
      }
    }
    if (!played && p.clip && have.has(p.clip)) played = await playClip(clipUrl(p.clip));
    if (played) heard = true;
    else if (await say(p.text, p.lang, p.lang === 'he' ? 0.9 : 0.8)) heard = true;
  }
  return heard;
}
