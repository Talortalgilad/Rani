/**
 * Makes the Hebrew recordings of the English game with Azure Text to Speech (voice he-IL-HilaNeural, a little slow).
 * Reads voice/he-lines.csv (id, text) and writes public/english/voice/he/<id>.mp3 and manifest.json (the list of what exists).
 *
 *   AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=westeurope npx vite-node scripts/gen-voice.ts
 *   add --force to make everything again (otherwise clips that exist are kept), --only=id1,id2 for some clips.
 *
 * The key is read from the environment only: it is never written anywhere. Costs a few thousand characters (cents).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const KEY = process.env.AZURE_SPEECH_KEY;
const REGION = process.env.AZURE_SPEECH_REGION;
const VOICE = process.env.AZURE_SPEECH_VOICE ?? 'he-IL-HilaNeural';
const RATE = process.env.AZURE_SPEECH_RATE ?? '-12%'; // a little slower than normal: she is learning
const OUT = new URL('../public/english/voice/he/', import.meta.url);
const CSV = new URL('../voice/he-lines.csv', import.meta.url);

if (!KEY || !REGION) {
  console.error('Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (for example westeurope) in the environment.');
  process.exit(1);
}

/** The rows of the CSV: an id, then a text in quotes ("" inside is a quote). */
function parse(csv: string): { id: string; text: string }[] {
  return csv
    .split(/\r?\n/)
    .slice(1)
    .filter((l) => l.trim())
    .map((l) => {
      const i = l.indexOf(',');
      const raw = l.slice(i + 1).trim();
      return { id: l.slice(0, i).trim(), text: raw.replace(/^"|"$/g, '').replace(/""/g, '"') };
    });
}

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);

async function synth(text: string): Promise<Buffer> {
  const ssml = `<speak version="1.0" xml:lang="he-IL" xmlns="http://www.w3.org/2001/10/synthesis"><voice name="${VOICE}"><prosody rate="${RATE}">${esc(text)}</prosody></voice></speak>`;
  const res = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': KEY!,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'rani-english-voice',
    },
    body: ssml,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
  mkdirSync(OUT, { recursive: true });
  const rows = parse(readFileSync(CSV, 'utf8'));
  let made = 0;
  for (const r of rows) {
    if (only && !only.includes(r.id)) continue;
    const file = new URL(`${r.id}.mp3`, OUT);
    if (!force && existsSync(file)) continue;
    process.stdout.write(`${r.id}: ${r.text} ... `);
    try {
      writeFileSync(file, await synth(r.text));
      made += 1;
      console.log('ok');
    } catch (e) {
      console.log(`FAILED (${(e as Error).message})`);
    }
  }
  const have = readdirSync(OUT).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)).sort();
  writeFileSync(new URL('manifest.json', OUT), JSON.stringify({ voice: VOICE, clips: have }, null, 1) + '\n');
  console.log(`${made} new recordings, ${have.length} in manifest.json`);
}

void main();
