/**
 * Cuts the long takes (assets/voice-raw/voice-takes.json: one audio file with several lines, about 3 s of silence between lines) into one
 * clip per line.
 *
 * The silences of at least 0.4 s are found with ffmpeg silencedetect; the N-1 cuts of a take with N lines are the silences that fit best,
 * by the length of the silence (a pause between lines is long) and by the length of the text (the time of a line is about
 * proportional to its letters). Every clip keeps 0.1 s of silence on each side and is normalised (loudnorm), and is saved in the format and
 * the place of scripts/import-voice.ts: public/english/voice/he/<id>.mp3 (Hebrew) or .../en/<id>.mp3 (English), and manifest.json
 * of that folder is updated. The order of priority does not change: a recording made on the device, then a file of the repo, then TTS.
 *
 *   npx vite-node scripts/import-takes.ts            downloads what is missing (assets/voice-raw/takes/take-<n>.mp3), cuts, reports
 *   options: --only=<takes: 5, 100-107, 3,5,100-107>   (the page of the parents area is fed by he/_review.json, written here; the lines of the takes that
 *   are not cut now stay in it)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const RAW = join(ROOT, 'assets/voice-raw');
const TAKES = join(RAW, 'takes');
const OUT = (lang: string): string => join(ROOT, 'public/english/voice', lang);
// --only=100-107 or --only=3,5,100-107: the takes to cut (nothing: all of them)
const onlyArg = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const wanted = (n: number): boolean => !onlyArg || onlyArg.split(',').some((p) => { const [a, b] = p.split('-').map(Number); return n >= a && n <= (b ?? a); });
const MARGIN = 0.1;

// What the voice really says where it is not the text of the file (the id stays): shown in the review page and used to find the clip by text
const SAID: Record<string, string> = { cakeslice: 'cake slice', candycane: 'candy cane', candyjar: 'candy jar', cottoncandy: 'cotton candy', gummybear: 'gummy bear', nightsky: 'night sky', shootingstar: 'shooting star', pufferfish: 'puffer fish', ufo: 'U.F.O', snowmans: 'snowmen' };

interface Take { take: number; lang: 'he' | 'en'; url: string; lines: { id: string; text: string }[] }
interface Sil { start: number; end: number; dur: number }

const run = (cmd: string, args: string[]): { out: string; ok: boolean } => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 26 });
  return { out: `${r.stdout ?? ''}${r.stderr ?? ''}`, ok: r.status === 0 };
};

const duration = (f: string): number => Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).out.trim());

function silences(f: string, noise: number, min: number, total: number): Sil[] {
  const out = run('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', `silencedetect=noise=${noise}dB:d=${min}`, '-f', 'null', '-']).out;
  const res: Sil[] = [];
  let start = -1;
  for (const l of out.split('\n')) {
    const a = /silence_start: ([\d.-]+)/.exec(l);
    const b = /silence_end: ([\d.]+)/.exec(l);
    if (a) start = Math.max(0, Number(a[1]));
    if (b && start >= 0) {
      res.push({ start, end: Number(b[1]), dur: Number(b[1]) - start });
      start = -1;
    }
  }
  if (start >= 0) res.push({ start, end: total, dur: total - start });
  return res;
}

const letters = (s: string): number => Math.max(1, s.replace(/[^\p{L}\p{N}]/gu, '').length);

interface Cut { spans: { from: number; to: number }[]; cuts: Sil[]; candidates: number; lead: number; trail: number }

/** The best N-1 cuts among the silences (null when there are fewer than N-1). */
function choose(sil: Sil[], lines: { id: string; text: string }[], total: number): Cut | null {
  const N = lines.length;
  const lead = sil.length && sil[0].start < 0.05 ? sil[0] : null;
  const trail = sil.length && sil[sil.length - 1].end >= total - 0.05 && sil[sil.length - 1] !== lead ? sil[sil.length - 1] : null;
  const cand = sil.filter((s) => s !== lead && s !== trail);
  const onset = lead ? lead.end : 0;
  const offset = trail ? trail.start : total;
  if (cand.length < N - 1) return null;
  const len = lines.map((l) => letters(l.text));
  const totalLen = len.reduce((a, b) => a + b, 0);
  // the speaking rate: what is left of the take after the N-1 longest silences, over the letters
  const longest = [...cand].sort((a, b) => b.dur - a.dur).slice(0, N - 1).reduce((a, s) => a + s.dur, 0);
  const rate = Math.max(0.01, (offset - onset - longest) / totalLen);
  const lineCost = (i: number, from: number, to: number): number => Math.pow(Math.log(Math.max(0.05, to - from) / (rate * len[i])), 2);
  const cutCost = (s: Sil): number => 1.5 * (Math.max(0, 3 - Math.min(s.dur, 3)) / 3);
  const K = cand.length;
  const INF = 1e9;
  // dp[k][j]: the first k+1 lines are placed, line k ends at silence j
  const dp: number[][] = Array.from({ length: N - 1 }, () => new Array(K).fill(INF));
  const from: number[][] = Array.from({ length: N - 1 }, () => new Array(K).fill(-1));
  for (let j = 0; j < K; j++) dp[0][j] = lineCost(0, onset, cand[j].start) + cutCost(cand[j]);
  for (let k = 1; k < N - 1; k++) {
    for (let j = k; j < K; j++) {
      for (let i = k - 1; i < j; i++) {
        if (dp[k - 1][i] >= INF) continue;
        const c = dp[k - 1][i] + lineCost(k, cand[i].end, cand[j].start) + cutCost(cand[j]);
        if (c < dp[k][j]) {
          dp[k][j] = c;
          from[k][j] = i;
        }
      }
    }
  }
  let bestJ = -1;
  let best = INF;
  for (let j = N - 2; j < K; j++) {
    const c = dp[N - 2][j] + lineCost(N - 1, cand[j].end, offset);
    if (c < best) {
      best = c;
      bestJ = j;
    }
  }
  if (bestJ < 0) return null;
  const idxs: number[] = [];
  for (let k = N - 2, j = bestJ; k >= 0; k--) {
    idxs.unshift(j);
    j = from[k][j];
  }
  const cuts = idxs.map((i) => cand[i]);
  const spans = lines.map((_, i) => ({ from: i === 0 ? onset : cuts[i - 1].end, to: i === N - 1 ? offset : cuts[i].start }));
  return { spans, cuts, candidates: K, lead: lead?.dur ?? 0, trail: trail?.dur ?? 0 };
}

// Takes from 300 on (the tutor, the carnival): a 10 ms fade-in (a take can start on the first sound, and a cut there would click), and a silence of more than 0.35 s at the end of a clip is cut off (the last line of a take can come with the rest of the take's silence).
// The older takes are not touched, so running everything again does not change a clip that was already approved.
const POLISH_FROM = 300;

function clip(src: string, from: number, to: number, total: number, out: string, polish = false): boolean {
  const s = Math.max(0, from - MARGIN);
  const e = Math.min(total, to + MARGIN);
  const r = run('ffmpeg', ['-y', '-v', 'error', '-i', src, '-ss', s.toFixed(3), '-to', e.toFixed(3), '-af', `${polish ? 'afade=t=in:d=0.01,' : ''}loudnorm=I=-16:TP=-1.5:LRA=11`, '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '64k', out]);
  if (r.ok && polish) {
    const d = duration(out);
    const tail = silences(out, -35, 0.35, d).find((x) => x.end >= d - 0.3 && x.start > 0.3);
    // cut the long tail: the clip ends 0.15 s after the last sound
    if (tail) return run('ffmpeg', ['-y', '-v', 'error', '-i', src, '-ss', s.toFixed(3), '-to', (s + tail.start + 0.15).toFixed(3), '-af', 'afade=t=in:d=0.01,loudnorm=I=-16:TP=-1.5:LRA=11', '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '64k', out]).ok;
  }
  return r.ok;
}

async function main(): Promise<void> {
  // every assets/voice-raw/voice-takes*.json (voice-takes.json, voice-takes-carnival.json, voice-takes-tutor.json ...): the take numbers are unique across the files
  const takes = readdirSync(RAW).filter((f) => /^voice-takes.*\.json$/.test(f)).sort().flatMap((f) => JSON.parse(readFileSync(join(RAW, f), 'utf8')) as Take[]);
  mkdirSync(TAKES, { recursive: true });
  const problems: string[] = [];
  const all: { id: string; text: string; lang: string; take: number; from: number; to: number; dur: number; letters: number; note: string; extra: string[] }[] = [];
  for (const t of takes) {
    if (!wanted(t.take)) continue;
    const src = join(TAKES, `take-${t.take}.mp3`);
    if (!existsSync(src)) {
      const r = await fetch(t.url);
      if (!r.ok) {
        problems.push(`take ${t.take}: download failed (${r.status})`);
        continue;
      }
      writeFileSync(src, Buffer.from(await r.arrayBuffer()));
    }
    const total = duration(src);
    let cut: Cut | null = null;
    let used = '';
    // the usual threshold first; then a more forgiving one when there are too few silences
    for (const [noise, min] of [[-35, 0.4], [-30, 0.4], [-30, 0.3], [-25, 0.3]] as const) {
      cut = choose(silences(src, noise, min, total), t.lines, total);
      used = `${noise}dB/${min}s`;
      if (cut) break;
    }
    if (!cut) {
      problems.push(`take ${t.take}: fewer silences than ${t.lines.length - 1} even at -25dB/0.3s - not cut`);
      continue;
    }
    if (used !== '-35dB/0.4s') problems.push(`take ${t.take}: needed a looser threshold (${used}) to find enough silences - check every cut by ear`);
    console.log(`take ${t.take} (${t.lang}, ${total.toFixed(1)}s): ${t.lines.length} lines, ${cut.candidates} silences >= ${used}, cuts at ${cut.cuts.map((c) => `${c.start.toFixed(1)}(${c.dur.toFixed(1)}s)`).join(' ')}`);
    const dir = OUT(t.lang);
    mkdirSync(dir, { recursive: true });
    t.lines.forEach((l, i) => {
      const sp = cut!.spans[i];
      if (!clip(src, sp.from, sp.to, total, join(dir, `${l.id}.mp3`), t.take >= POLISH_FROM)) problems.push(`take ${t.take}: ${l.id}: ffmpeg failed`);
      // for the review page: a pause of 0.6 s or more inside the clip, and a cut next to a silence shorter than 0.8 s
      const extra: string[] = [];
      if (silences(join(dir, `${l.id}.mp3`), -35, 0.6, 1e9).some((x) => x.start > 0.25 && x.end < duration(join(dir, `${l.id}.mp3`)) - 0.25)) extra.push('pause');
      if ((i > 0 && cut!.cuts[i - 1].dur < 0.8) || (i < cut!.cuts.length && cut!.cuts[i].dur < 0.8)) extra.push('tight');
      all.push({ id: l.id, text: l.text, lang: t.lang, take: t.take, from: sp.from, to: sp.to, dur: Math.max(0.05, duration(join(dir, `${l.id}.mp3`)) - 2 * MARGIN), letters: letters(l.text), note: '', extra });
    });
    if (cut.cuts.some((c) => c.dur < 0.8)) problems.push(`take ${t.take}: a cut at a silence shorter than 0.8 s (${cut.cuts.filter((c) => c.dur < 0.8).map((c) => `${c.start.toFixed(1)}s=${c.dur.toFixed(2)}`).join(', ')}) - check by ear`);
  }
  // lines that look wrong: shorter than 0.3 s, or more than twice what the text asks for (the speed of speaking is measured for each language)
  const rateOf = new Map<string, number>();
  for (const lang of ['he', 'en']) {
    const r = all.filter((a) => a.lang === lang).map((a) => a.dur / a.letters).sort((x, y) => x - y);
    rateOf.set(lang, r[Math.floor(r.length / 2)] ?? 0.1);
  }
  for (const a of all) {
    if (a.lang === 'en' && SAID[a.id]) a.text = SAID[a.id];
    const exp = rateOf.get(a.lang)! * a.letters;
    if (a.dur < 0.3) a.note = 'short';
    else if (a.dur > 2 * exp) a.note = 'long';
    if (a.note) problems.push(`take ${a.take}: ${a.id} ${a.note}: ${a.dur.toFixed(2)}s, the text asks for about ${exp.toFixed(2)}s ("${a.text}")`);
  }
  // manifests: what exists in each folder
  for (const lang of ['he', 'en']) {
    const mine = all.filter((a) => a.lang === lang);
    if (!mine.length) continue;
    const mf = join(OUT(lang), 'manifest.json');
    const cur = existsSync(mf) ? (JSON.parse(readFileSync(mf, 'utf8')) as { clips?: string[] }) : {};
    const clips = [...new Set([...(cur.clips ?? []), ...mine.map((a) => a.id)])].sort();
    writeFileSync(mf, JSON.stringify({ ...cur, clips }, null, 1) + '\n');
    console.log(`${lang}/manifest.json: ${clips.length} recordings`);
  }
  // the English clips by what the game says: src/games/english/content/enClips.ts (text of the line and its id -> id), written from all the English takes
  const clipKey = (x: string): string => {
    const k = x.replace(/[^A-Za-z0-9]/g, '');
    return k.length === 1 && /[A-Za-z]/.test(k) ? k : k.toLowerCase();
  };
  const byText: Record<string, string> = {};
  for (const t of takes.filter((x) => x.lang === 'en')) {
    for (const l of t.lines) {
      const num = /^number_(\d+)$/.exec(l.id);
      for (const k of [clipKey(SAID[l.id] ?? l.text), clipKey(l.text), clipKey(l.id), num ? num[1] : '']) if (k && !(k in byText)) byText[k] = l.id;
    }
  }
  writeFileSync(join(ROOT, 'src/games/english/content/enClips.ts'), `/** The English recordings by what the game says (written by scripts/import-takes.ts): letters and digits of the text only, lower case (a single letter keeps its case: "A" is the letter, "a" the word), to the id of the clip in public/english/voice/en. */\nexport const EN_CLIPS: Record<string, string> = ${JSON.stringify(byText, null, 1)};\n`);
  // the temporary review page in the parents area reads this (the lines of the takes that were not cut now are kept)
  mkdirSync(OUT('he'), { recursive: true });
  const reviewFile = join(OUT('he'), '_review.json');
  type Review = { id: string; text: string; lang: string; take: number; dur: number; flag: string };
  const prev = existsSync(reviewFile) ? (JSON.parse(readFileSync(reviewFile, 'utf8')) as Review[]) : [];
  const now: Review[] = all.map((a) => ({ id: a.id, text: a.text, lang: a.lang, take: a.take, dur: Math.round((a.dur + 2 * MARGIN) * 100) / 100, flag: [a.note, ...a.extra].filter(Boolean).join(',') }));
  const keep = prev.map((r) => ({ lang: 'he', ...r })).filter((r) => !now.some((n) => n.id === r.id && n.lang === r.lang));
  writeFileSync(reviewFile, JSON.stringify([...keep, ...now], null, 1) + '\n');
  const rate = rateOf.get('he')!;
  console.log(`\n${all.length} lines cut. Median ${rate.toFixed(3)} s per letter (Hebrew), ${rateOf.get('en')!.toFixed(3)} (English).`);
  console.log(problems.length ? `\nTo check:\n  ${problems.join('\n  ')}` : '\nEvery take matched its lines, and no line looks wrong.');
}

void main();
