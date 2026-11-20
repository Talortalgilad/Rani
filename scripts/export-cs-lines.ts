/**
 * Writes src/lobby/carnival/csLines.ts: the Hebrew lines of the carnival of stage 2 (the cs_* of voice-takes-carnival-3.json), so that they are in the list of recordings (he-lines.csv) and the
 * phone can read one when its recording is missing.   npx vite-node scripts/export-cs-lines.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
interface Take { take: number; lang: string; lines: { id: string; text: string }[] }
const takes = JSON.parse(readFileSync(join(ROOT, 'assets/voice-raw/voice-takes-carnival-3.json'), 'utf8')) as Take[];
const lines = takes.filter((t) => t.lang === 'he').flatMap((t) => t.lines).filter((l) => l.id.startsWith('cs_'));
writeFileSync(join(ROOT, 'src/lobby/carnival/csLines.ts'), `/** The Hebrew lines of the carnival of stage 2 (written by scripts/export-cs-lines.ts from voice-takes-carnival-3.json): id (the file name of the recording) and text. */\nexport const CS_LINES: { id: string; text: string }[] = ${JSON.stringify(lines, null, 1)};\n`);
console.log(`${lines.length} lines`);
