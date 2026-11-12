import { ACCESSORIES } from '../art/accessories';
import { clipUrl, recordedClips, speakHeLine } from '../voice';
import { he, nameOptions } from './lines';
import { VERBS } from './words';

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
const cut = (template: string): (string | null)[] => template.split(NAME).flatMap((t, i, a) => (i < a.length - 1 ? [t, null] : [t])).filter((p) => p !== '');

export const HE_LINES: HeLine[] = [
  { id: 'ask_name', world: 0, parts: [he.askName] },
  { id: 'start', world: 0, parts: [he.start] },
  { id: 'help_call', world: 0, parts: ['שמעת? מישהו קורא לעזרה!'] },
  { id: 'proud', world: 0, parts: cut(he.proud(NAME)) },
  { id: 'rescued', world: 0, parts: cut(he.rescued(NAME)) },
  { id: 'parent_test', world: 0, parts: ['שלום! בואי נשחק באנגלית.'] },
  ...ACCESSORIES.map((a): HeLine => ({ id: `new_acc_${a.id}`, world: 0, parts: [he.newAccessory(a.he)] })),
  ...Object.entries(VERBS).map(([key, v]): HeLine => ({ id: `verb_${key}`, world: VERB_WORLD[key] ?? 1, parts: [`זה ${v.he}!`] })),
];

export const NAME_KEYS: Record<string, string> = { 'צ׳יזי': 'cheesy', 'מוצי': 'mozzi', 'חוריקו': 'horiko', 'פופצ׳יז': 'popcheese' };

export interface Clip { id: string; text: string; world: number }

/** The recordings to make: one for each text piece of each sentence, and one for each ready-made name. */
export function allClips(): Clip[] {
  const out: Clip[] = [];
  for (const l of HE_LINES) {
    l.parts.forEach((p, i) => {
      if (p !== null) out.push({ id: l.parts.length === 1 ? l.id : `${l.id}.${i}`, text: p.trim(), world: l.world });
    });
  }
  for (const n of nameOptions) out.push({ id: `name.${NAME_KEYS[n.name]}`, text: n.name, world: 0 });
  return out;
}

export interface LinePart { clip?: string; text: string; lang: 'he' | 'en' }

/** What to play for a sentence: a clip with the text to read if the clip is missing; the name as a clip only when it is one of the four. */
export function linePartsFor(id: string, name = ''): LinePart[] {
  const l = HE_LINES.find((x) => x.id === id);
  if (!l) return [];
  return l.parts.map((p, i): LinePart => {
    if (p !== null) return { clip: l.parts.length === 1 ? l.id : `${l.id}.${i}`, text: p.trim(), lang: 'he' };
    const key = NAME_KEYS[name];
    if (key) return { clip: `name.${key}`, text: name, lang: 'he' };
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

/** Says a sentence of the registry aloud (recording or phone voice); `name` fills the place of the name. */
export const sayLine = (id: string, name = ''): Promise<boolean> => speakHeLine(linePartsFor(id, name));

/** Fetches the recordings of a world (0: the ones of the game itself) so that the service worker keeps them for offline; the ones that do not exist are not asked for. */
export async function preloadVoice(world: number): Promise<void> {
  const have = await recordedClips();
  await Promise.all(clipsOfWorld(world).filter((id) => have.has(id)).map((id) => fetch(clipUrl(id)).then((r) => r.arrayBuffer()).catch(() => undefined)));
}
