import { getState } from '../../storage';
import { clipIds, getClip } from './voiceStore';
import { WORDS } from './content/words';
import { EN_CLIPS } from './content/enClips';

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
      window.setTimeout(done, Math.min(SOUND_GUARD.unknownMs, 1500 + text.length * 120)); // a voice that never finishes must not stall the game
      s.speak(u);
    } catch {
      resolve(false);
    }
  });
}

/** English: instructions at 0.85, single words at 0.75. */
/**
 * English: a word of the game is played from its recording (public/english/voice/en/<id>.mp3) when there is one; the voice of the phone reads
 * it only when there is not. The same order as the Hebrew: the recording made on this phone, then the file of the game, then the phone's voice.
 */
export const speakEn = (text: string, rate = 0.85): Promise<boolean> => {
  stopSpeech();
  const id = wordIdOf(text) ?? enClipIdOf(text);
  return id ? playWord(id).then((ok) => ok || say(text, 'en', rate)) : say(text, 'en', rate);
};
export const speakWord = (word: string): Promise<boolean> => speakEn(word, 0.75);

const wordKey = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const WORD_IDS = new Map<string, string>();
for (const w of WORDS) {
  WORD_IDS.set(wordKey(w.id), w.id);
  WORD_IDS.set(wordKey(w.label ?? w.id), w.id);
}
const clipKey = (s: string): string => {
  const k = s.replace(/[^A-Za-z0-9]/g, '');
  return k.length === 1 && /[A-Za-z]/.test(k) ? k : k.toLowerCase();
};
/** The id of the recording of anything else the game says in English (a fixed sentence, a name, a verb, a number, a colour, a letter, a word of a song, a sentence to build, a card of the memory game, a plural): by its text, or null. */
export const enClipIdOf = (text: string): string | null => EN_CLIPS[clipKey(text)] ?? null;

/** The id of the word that a text says ("Ice cream." and "ice cream" are icecream; "yo-yo" is yoyo), or null for anything else (a sentence, a name). */
export const wordIdOf = (text: string): string | null => WORD_IDS.get(wordKey(text)) ?? null;
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
const enBase = (): string => `${import.meta.env.BASE_URL}english/voice/en/`;
export const wordClipUrl = (id: string): string => `${enBase()}${id}.mp3`;
let enManifest: Promise<Set<string>> | null = null;
/** The words that have a recording in the game (the manifest of the en folder; an empty set when there is none). */
export function recordedWords(): Promise<Set<string>> {
  enManifest ??= fetch(`${enBase()}manifest.json`)
    .then((r) => (r.ok ? r.json() : { clips: [] }))
    .then((j: { clips?: string[] }) => new Set(j.clips ?? []))
    .catch(() => new Set<string>());
  return enManifest;
}
/** Plays the recording of a word: the one made on this phone (key en:<id>) first, then the file of the game. False when there is none. */
export async function playWord(id: string): Promise<boolean> {
  if ((await phoneClipIds()).has(`en:${id}`)) {
    const blob = await getClip(`en:${id}`);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const ok = await playClip(url);
      URL.revokeObjectURL(url);
      if (ok) return true;
    }
  }
  return (await recordedWords()).has(id) ? playClip(wordClipUrl(id)) : false;
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
  enManifest = null;
  phone = null;
};

let clip: HTMLAudioElement | null = null;
let stopCurrent: (() => void) | null = null;
function stopClip(): void {
  // whoever waits for this clip is let go (it was stopped on purpose: nothing is read in its place)
  stopCurrent?.();
  stopCurrent = null;
  try {
    clip?.pause();
  } catch {
    /* ignore */
  }
  clip = null;
}
/** A screen that wants to see the sound of every recording that starts (the mouth of the tutor moves with its volume). */
let clipHook: ((a: HTMLAudioElement) => void) | null = null;
export const onClipStart = (f: ((a: HTMLAudioElement) => void) | null): void => void (clipHook = f);
/**
 * How long the game waits for a sound (nothing in the game may be held by a sound that does not end: an `ended` that never comes, a clip that does not load or is empty).
 * Until the length of the clip is known: at most 6 s. Then: its length plus one second (at most 15 s, so that a long song is not cut).
 */
export const SOUND_GUARD = { unknownMs: 6000, extraMs: 1000, longestMs: 15000 };
export const guardMs = (duration: number): number => (Number.isFinite(duration) && duration > 0 ? Math.min(SOUND_GUARD.longestMs, duration * 1000 + SOUND_GUARD.extraMs) : SOUND_GUARD.extraMs);
/** Plays one recording to its end. False when it cannot play (then the caller reads the text instead). Also ends (true if it was heard, false if not) when the guard time is over. */
export function playClip(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (typeof Audio === 'undefined' || !getState().settings.tts) return resolve(false);
      const a = new Audio(url);
      clip = a;
      try { clipHook?.(a); } catch { /* the mouth is a nicety */ }
      let timer = 0;
      let over = false;
      const done = (ok: boolean): void => {
        if (over) return;
        over = true;
        window.clearTimeout(timer);
        resolve(ok);
      };
      stopCurrent = () => done(true);
      // the guard: the length of the clip is not known yet (6 s), then its length plus a second
      timer = window.setTimeout(() => (a.pause?.(), done((a.currentTime ?? 0) > 0)), SOUND_GUARD.unknownMs);
      a.addEventListener?.('loadedmetadata', () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => (a.pause?.(), done((a.currentTime ?? 0) > 0)), guardMs(a.duration));
      });
      a.onended = () => done(true);
      a.onerror = () => done(false);
      a.play().catch(() => done(false));
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
