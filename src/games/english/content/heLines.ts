import { ACCESSORIES } from '../art/accessories';
import { BLOCKS_LINES } from '../../blocks/lines';
import { FAMILY_NAMES, MEMORY_LINES } from '../../memory/lines';
import { ISLANDS, LETTERS } from '../letters/journey';
import { COLORS } from './colors';
import { WORLDS } from './worlds';
import { clipUrl, recordedClips, speakHeLine } from '../voice';
import { he, nameOptions } from './lines';
import { VERBS, WORDS } from './words';

/**
 * Every Hebrew sentence that Cheesy says aloud, each with a fixed id (the file name of its recording: public/english/voice/he/<id>.mp3).
 * A sentence with the name in it is cut round the name: the pieces have their own clips ("proud.1"), and the four ready-made names
 * have a clip each ("name.cheesy"). A name that was typed by hand (or a squishy friend's English name) is read by the phone.
 * `world` says when the clip is fetched for offline (0 = with the game, otherwise when that world is entered).
 */
export interface HeLine { id: string; world: number; /** the pieces: text, or null where the name goes */ parts: (string | null)[] }

/** The verb help ("זה על!") comes the first times a verb is met: the world that brings the verb. */
const VERB_WORLD: Record<string, number> = { find: 2, color: 4, count: 5, sentence: 6, on: 11, over: 11, in: 11, under: 11, big: 11, small: 11 };

const NAME = '\u0000';
const cut = (template: string): (string | null)[] => template.split(NAME).flatMap((t, i, a) => (i < a.length - 1 ? [t, null] : [t])).filter((p) => p !== '' && (p === null || /[א-ת]/.test(p))); // a piece that is only "!" has nothing to record

export const HE_LINES: HeLine[] = [
  { id: 'ask_name', world: 0, parts: [he.askName] },
  { id: 'start', world: 0, parts: [he.start] },
  { id: 'help_call', world: 0, parts: ['שמעת? מישהו קורא לעזרה!'] },
  { id: 'proud', world: 0, parts: cut(he.proud(NAME)) },
  { id: 'rescued', world: 0, parts: cut(he.rescued(NAME)) },
  { id: 'parent_test', world: 0, parts: ['שלום! בואי נשחק באנגלית.'] },
  ...ACCESSORIES.map((a): HeLine => ({ id: `new_acc_${a.id}`, world: 0, parts: [he.newAccessory(a.he)] })),
  ...Object.entries(VERBS).map(([key, v]): HeLine => ({ id: `verb_${key}`, world: VERB_WORLD[key] ?? 1, parts: [`זה ${v.he}!`] })),
  // every other Hebrew text that a child sees: bubbles, hints, buttons and titles (she does not read well yet)
  { id: 'new_words', world: 0, parts: [he.newWords] },
  { id: 'card_tap', world: 0, parts: [he.cardTap] },
  { id: 'try_again', world: 0, parts: [he.tryAgain] },
  { id: 'show', world: 0, parts: [he.show] },
  { id: 'great', world: 0, parts: [he.great] },
  { id: 'next', world: 0, parts: [he.next] },
  { id: 'home', world: 0, parts: [he.home] },
  { id: 'ok', world: 0, parts: [he.ok] },
  { id: 'other_name', world: 0, parts: [he.otherName] },
  { id: 'type_name', world: 0, parts: [he.typeName] },
  { id: 'name_confirm', world: 0, parts: ['זה השם שלי!'] },
  { id: 'i_am', world: 0, parts: cut(he.iAm(NAME)) },
  { id: 'island_title', world: 0, parts: cut(he.islandTitle(NAME)) },
  { id: 'shelf', world: 0, parts: [he.shelf] },
  { id: 'shelf_title', world: 0, parts: [he.shelfTitle] },
  { id: 'buddy_pick', world: 0, parts: [he.buddyPick] },
  { id: 'buddy_now', world: 0, parts: [he.buddyNow] },
  { id: 'accessories_title', world: 0, parts: [he.accessories] },
  { id: 'accessory_note', world: 0, parts: [he.accessoryNote] },
  { id: 'wordbook', world: 0, parts: [he.wordbook] },
  { id: 'songs', world: 0, parts: [he.songs] },
  // the letters journey
  { id: 'j_words', world: 0, parts: [he.tabWords] },
  { id: 'j_letters', world: 0, parts: [he.tabLetters] },
  { id: 'letters_title', world: 0, parts: [he.lettersTitle] },
  { id: 'words_station', world: 0, parts: [he.wordsStation] },
  { id: 'l_new', world: 0, parts: [he.newLetter] },
  { id: 'l_trace_capital', world: 0, parts: [he.traceCapital] },
  { id: 'l_trace_dots', world: 0, parts: [he.traceDots] },
  { id: 'l_trace_blur', world: 0, parts: [he.traceBlur] },
  { id: 'l_trace_again', world: 0, parts: [he.traceAgain] },
  { id: 'soon', world: 0, parts: [he.soon] },
  // the carnival: the name of a resident (the name is one of the recorded ones)
  { id: 'carnival_name', world: 0, parts: [null] },
  // the memory game
  ...MEMORY_LINES.map((l): HeLine => ({ id: l.id, world: 0, parts: l.parts })),
  // the block game
  ...BLOCKS_LINES.map((l): HeLine => ({ id: l.id, world: 0, parts: l.parts })),
  { id: 'my_letters', world: 0, parts: [he.myLetters] },
  { id: 'abc_song', world: 0, parts: [he.abcSong] },
  { id: 'abc_done', world: 0, parts: [he.abcDone] },
  { id: 'l_bd_b', world: 0, parts: [he.bdB] },
  { id: 'l_bd_d', world: 0, parts: [he.bdD] },
  { id: 'letter_shelf', world: 0, parts: [he.letterShelf] },
  ...ISLANDS.map((i): HeLine => ({ id: `island_${i.n}`, world: 0, parts: [i.he] })),
  ...ACCESSORIES.map((a): HeLine => ({ id: `acc_${a.id}`, world: 0, parts: [a.he] })),
  ...ACCESSORIES.map((a): HeLine => ({ id: `acc_locked_${a.world}`, world: 0, parts: [he.accessoryLocked(a.world)] })),
  ...WORLDS.map((w): HeLine => ({ id: `world_${w.n}`, world: 0, parts: [w.he] })),
  ...COLORS.map((c): HeLine => ({ id: `c_${c.id}`, world: 4, parts: [c.he] })),
  ...WORDS.map((w): HeLine => ({ id: `w_${w.id}`, world: w.world, parts: [w.he] })),
];

export const NAME_KEYS: Record<string, string> = { 'צ׳יזי': 'cheesy', 'מוצי': 'mozzi', 'חוריקו': 'horiko', 'פופצ׳יז': 'popcheese', ...Object.fromEntries(FAMILY_NAMES.map((n) => [n.he, n.key])) };

export interface Clip { id: string; text: string; world: number; /** a letter sound (the studio shows the letter and its word, not a sentence) */ sound?: { letter: string; word: string } }

/** Every text piece of every sentence, and the ready-made names, one entry each (some have the same text as another: see allClips). */
function rawClips(): Clip[] {
  const out: Clip[] = [];
  for (const l of HE_LINES) {
    l.parts.forEach((p, i) => {
      if (p !== null) out.push({ id: l.parts.length === 1 ? l.id : `${l.id}.${i}`, text: p.trim(), world: l.world });
    });
  }
  for (const n of nameOptions) out.push({ id: `name.${NAME_KEYS[n.name]}`, text: n.name, world: 0 });
  for (const n of FAMILY_NAMES) out.push({ id: `name.${n.key}`, text: n.he, world: 0 });
  return out;
}

/** The first id of every text: two ids with exactly the same text ("משקפיים" is an accessory and a word) share one recording. */
const firstOfText = (): Map<string, string> => {
  const m = new Map<string, string>();
  for (const c of rawClips()) if (!m.has(c.text)) m.set(c.text, c.id);
  return m;
};
/** The id of the recording that an id plays: its own, or the earlier id that has the same text. */
export function canonicalClip(id: string): string {
  const c = rawClips().find((x) => x.id === id);
  return c ? (firstOfText().get(c.text) ?? id) : id;
}

/** The recordings to make: one for each different text (the ids that share a text are aliases of the first). */
export function allClips(): Clip[] {
  const seen = new Set<string>();
  return rawClips().filter((c) => (seen.has(c.text) ? false : (seen.add(c.text), true)));
}

/** The two tracks of the recording studio: the sentences of the game and the names first, then the words (and colours) she learns. */
export type Track = 'important' | 'words' | 'sounds';
export const trackOf = (id: string): Track => (/^(w_|c_)/.test(id) ? 'words' : 'important');
/** The 26 sounds of the letters and "qu": English, recorded in the studio (not part of the Hebrew list): `sound_<letter>`. */
export function soundClips(): Clip[] {
  const hint = 'אמרי רק את הצליל הראשון של המילה, קצר, בלי שם האות';
  return [...LETTERS.map((l) => ({ id: `sound_${l.id}`, text: hint, world: 0, sound: { letter: l.id, word: l.label } })), { id: 'sound_qu', text: hint, world: 0, sound: { letter: 'qu', word: 'queen' } }];
}
export const clipsOfTrack = (t: Track): Clip[] => {
  if (t === 'sounds') return soundClips();
  const all = allClips();
  const names = all.filter((c) => c.id.startsWith('name.'));
  return t === 'words' ? all.filter((c) => trackOf(c.id) === 'words') : [...all.filter((c) => trackOf(c.id) === 'important' && !c.id.startsWith('name.')), ...names];
};

export interface LinePart { clip?: string; text: string; lang: 'he' | 'en' }

/** What to play for a sentence: a clip with the text to read if the clip is missing; the name as a clip only when it is one of the four. */
export function linePartsFor(id: string, name = ''): LinePart[] {
  const l = HE_LINES.find((x) => x.id === id);
  if (!l) return [];
  return l.parts.map((p, i): LinePart => {
    if (p !== null) return { clip: canonicalClip(l.parts.length === 1 ? l.id : `${l.id}.${i}`), text: p.trim(), lang: 'he' };
    const key = NAME_KEYS[name];
    if (key) return { clip: canonicalClip(`name.${key}`), text: name, lang: 'he' };
    return { text: name, lang: /[A-Za-z]/.test(name) ? 'en' : 'he' };
  });
}

/** The verb help sentence of a verb key ("on"): its id. */
export const verbLineId = (verb: string): string => `verb_${verb}`;

export const clipsOfWorld = (world: number): string[] => allClips().filter((c) => c.world === world).map((c) => c.id);

/** The CSV for the recordings: id, text (quoted, with a header). */
export function toCsv(): string {
  const q = (s: string): string => `"${s.replace(/"/g, '""')}"`;
  return ['id,text', ...allClips().map((c) => `${c.id},${q(c.text)}`)].join('\n') + '\n';
}

/** The numbered list for recording: `number. id — text`. The number is the place in voice/he-lines.csv (the name of the recording: 01.m4a). */
export function numberedList(): string {
  return allClips().map((c, i) => `${i + 1}. ${c.id} — ${c.text}`).join('\n') + '\n';
}

/** Says a sentence of the registry aloud (recording or phone voice); `name` fills the place of the name. */
export const sayLine = (id: string, name = ''): Promise<boolean> => speakHeLine(linePartsFor(id, name));
/** The same for a button or a title that she pressed: it is let finish while the next screen opens. */
export const sayLabel = (id: string, name = ''): Promise<boolean> => speakHeLine(linePartsFor(id, name), true);

/** Fetches the recordings of a world (0: the ones of the game itself) so that the service worker keeps them for offline; the ones that do not exist are not asked for. */
export async function preloadVoice(world: number): Promise<void> {
  const have = await recordedClips();
  await Promise.all(clipsOfWorld(world).filter((id) => have.has(id)).map((id) => fetch(clipUrl(id)).then((r) => r.arrayBuffer()).catch(() => undefined)));
}
