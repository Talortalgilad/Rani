/**
 * Imports the Hebrew recordings that were made by hand on a phone.
 *
 * Put the recordings in assets/voice-raw/, each file named by its number in voice/he-lines-numbered.txt
 * (01.m4a, 02.m4a, ... 186.m4a; mp3, wav, aac, ogg, caf, opus and flac work too; 1.m4a and 001.m4a mean the same number).
 * For every file it: cuts the silence at the start and at the end (leaving a short breath), evens out the loudness (ffmpeg loudnorm),
 * converts to mono mp3 at 64 kbps, saves it as public/english/voice/he/<id>.mp3 and updates manifest.json (the list of the recordings
 * that exist, which the game reads). A number with no file is reported at the end, with its id and text.
 *
 *   npx vite-node scripts/import-voice.ts            (new or changed files only)
 *   npx vite-node scripts/import-voice.ts --force    (everything again)
 *   options: --raw=<folder> --out=<folder>
 *
 * Needs ffmpeg on the PATH. (scripts/gen-voice.ts, with Azure, stays as a backup for the clips that have no recording.)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

const arg = (k: string): string | undefined => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const ROOT = resolve(new URL('..', import.meta.url).pathname);
const RAW = resolve(arg('raw') ?? join(ROOT, 'assets/voice-raw'));
const OUT = resolve(arg('out') ?? join(ROOT, 'public/english/voice/he'));
const CSV = join(ROOT, 'voice/he-lines.csv');
const EXT = new Set(['.m4a', '.mp3', '.wav', '.aac', '.ogg', '.caf', '.opus', '.flac', '.mp4', '.3gp', '.amr']);
const force = process.argv.includes('--force');

/** The rows of the CSV: id and text (the number of a row is its place, starting at 1). */
function rows(): { n: number; id: string; text: string }[] {
  return readFileSync(CSV, 'utf8')
    .split(/\r?\n/)
    .slice(1)
    .filter((l) => l.trim())
    .map((l, i) => {
      const k = l.indexOf(',');
      return { n: i + 1, id: l.slice(0, k).trim(), text: l.slice(k + 1).trim().replace(/^"|"$/g, '').replace(/""/g, '"') };
    });
}

// silence off the start (and, by turning it round, off the end), a breath of 40 ms before and 120 ms after, then the loudness
const FILTER = [
  'silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB:detection=peak',
  'areverse',
  'silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB:detection=peak',
  'areverse',
  'adelay=40:all=1',
  'apad=pad_dur=0.12',
  'loudnorm=I=-16:TP=-1.5:LRA=11',
].join(',');

function convert(input: string, output: string): string | null {
  const r = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', input, '-af', FILTER, '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '64k', output], { encoding: 'utf8' });
  if (r.error) return `ffmpeg did not run (${r.error.message}). Is ffmpeg installed?`;
  return r.status === 0 ? null : (r.stderr || 'ffmpeg failed').trim().split('\n').slice(-2).join(' ');
}

function main(): void {
  const list = rows();
  if (!existsSync(RAW)) {
    console.error(`No folder ${RAW}. Create it and put the recordings there (01.m4a, 02.m4a, ...).`);
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });
  // the newest file of each number
  const byNumber = new Map<number, string>();
  const unknown: string[] = [];
  for (const f of readdirSync(RAW)) {
    const ext = extname(f).toLowerCase();
    if (!EXT.has(ext)) continue;
    const m = /^\d+$/.exec(basename(f, extname(f)));
    if (!m) {
      unknown.push(`${f} (the name must be the number)`);
      continue;
    }
    const n = Number(m[0]);
    if (n < 1 || n > list.length) {
      unknown.push(`${f} (there is no number ${n}; the list has ${list.length})`);
      continue;
    }
    const prev = byNumber.get(n);
    if (!prev || statSync(join(RAW, f)).mtimeMs > statSync(join(RAW, prev)).mtimeMs) byNumber.set(n, f);
  }
  let made = 0;
  let kept = 0;
  const failed: string[] = [];
  for (const [n, f] of [...byNumber.entries()].sort((a, b) => a[0] - b[0])) {
    const row = list[n - 1];
    const input = join(RAW, f);
    const output = join(OUT, `${row.id}.mp3`);
    if (!force && existsSync(output) && statSync(output).mtimeMs >= statSync(input).mtimeMs) {
      kept += 1;
      continue;
    }
    const err = convert(input, output);
    if (err) failed.push(`${n}. ${row.id}: ${err}`);
    else {
      made += 1;
      console.log(`${String(n).padStart(3)}. ${row.id} <- ${f}`);
    }
  }
  // the list of what exists (recordings from here and from the Azure backup alike)
  const have = readdirSync(OUT).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)).sort();
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ clips: have }, null, 1) + '\n');

  console.log(`\n${made} converted, ${kept} unchanged, ${have.length} recordings in manifest.json.`);
  const missing = list.filter((r) => !byNumber.has(r.n) && !have.includes(r.id));
  if (missing.length) {
    console.log(`\nMissing (${missing.length} of ${list.length}) - no file for number:`);
    for (const r of missing) console.log(`  ${String(r.n).padStart(3)}. ${r.id} — ${r.text}`);
  } else console.log('Every number has a recording.');
  if (unknown.length) console.log(`\nIgnored files:\n  ${unknown.join('\n  ')}`);
  if (failed.length) {
    console.log(`\nFailed:\n  ${failed.join('\n  ')}`);
    process.exit(1);
  }
}

main();
