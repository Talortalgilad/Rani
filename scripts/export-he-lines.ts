/**
 * Writes voice/he-lines.csv: every Hebrew clip to record (id, text). Run after a Hebrew sentence of the English game changes:
 *   npx vite-node scripts/export-he-lines.ts
 * (the test src/games/english/content/heLines.test.ts fails when the file is out of date)
 */
import { writeFileSync } from 'node:fs';
import { allClips, HE_LINES, numberedList, toCsv } from '../src/games/english/content/heLines';

writeFileSync(new URL('../voice/he-lines.csv', import.meta.url), toCsv());
writeFileSync(new URL('../voice/he-lines-numbered.txt', import.meta.url), numberedList());
console.log(`${HE_LINES.length} sentences, ${allClips().length} clips -> voice/he-lines.csv, voice/he-lines-numbered.txt`);
