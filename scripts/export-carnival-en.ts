/**
 * The English sentences of the carnival talks (SPEC-carnival.md 4.4) for the recording: the fixed openings, and the sentences of the small bubbles.
 * After an opening comes the recording of the word that already exists (the word of "Can I have the ..."), so only the openings are new.
 *   npx vite-node scripts/export-carnival-en.ts   ->   voice/carnival-en-lines.txt
 */
import { writeFileSync } from 'node:fs';
import { CARNIVAL_EN } from '../src/lobby/carnival/talk/lines';

const rows = CARNIVAL_EN.map((x, i) => `${i + 1}. ${x.text}    [${x.id}]  (${x.note})`);
writeFileSync(new URL('../voice/carnival-en-lines.txt', import.meta.url), `English sentences of the carnival talks\n(the word after "Can I have the" is the existing recording of the word; the name after "Hello! I'm" is one of Cheesy, Mozzi, Horiko, Pop Cheese)\n\n${rows.join('\n')}\n`);
console.log(`${CARNIVAL_EN.length} English sentences -> voice/carnival-en-lines.txt`);
