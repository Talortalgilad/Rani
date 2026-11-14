/**
 * Writes src/games/english/content/tutorClips.ts: the text and language of every clip of the tutor (the t_* lines of
 * assets/voice-raw/voice-takes-tutor.json), so that the engine can show it in the speech bubble and the phone can read it when the recording is missing.
 *   npx vite-node scripts/export-tutor-clips.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
interface Take { take: number; lang: 'he' | 'en'; lines: { id: string; text: string }[] }
const takes = JSON.parse(readFileSync(join(ROOT, 'assets/voice-raw/voice-takes-tutor.json'), 'utf8')) as Take[];
for (const f of ['voice-takes-tutor-2.json']) takes.push(...(JSON.parse(readFileSync(join(ROOT, 'assets/voice-raw', f), 'utf8')) as Take[]));
const out: Record<string, { lang: string; text: string; take: number }> = {};
for (const t of takes) for (const l of t.lines) out[l.id] = { lang: t.lang, text: l.text, take: t.take };
writeFileSync(
  join(ROOT, 'src/games/english/content/tutorClips.ts'),
  `/** The clips of the tutor (written by scripts/export-tutor-clips.ts from voice-takes-tutor.json): language and text of each, for the speech bubble and for the voice of the phone when a recording is missing. */\nexport const TUTOR_CLIPS: Record<string, { lang: 'he' | 'en'; text: string; take: number }> = ${JSON.stringify(out, null, 1)} as never;\n`,
);
console.log(`${Object.keys(out).length} clips`);
