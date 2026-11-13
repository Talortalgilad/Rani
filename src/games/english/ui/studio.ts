import { cleanRecording, toInt16 } from '../engine/audioFx';
import { readZip, writeZip } from '../engine/zip';
import { allClips, canonicalClip, clipsOfTrack, soundClips, type Clip, type Track } from '../content/heLines';
import { resetRecorded, speakWord } from '../voice';
import { clipIds, getClip, putClip } from '../voiceStore';
import { gameStore } from '../../../storage';
import { counter } from '../../../ui/counter';

/**
 * The recording studio (parents' area): the sentences of the game one by one, big, with a microphone to hold while speaking.
 * The recording is cleaned (silence cut, loudness evened, Web Audio), made into a 64 kbps mp3 and kept in the phone (IndexedDB);
 * the game plays it before any file of the repo and before the voice of the phone. A zip backs them up and brings them back.
 */
const RATE = 24000;
const store = gameStore('english');
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const TRACKS: { id: Track; title: string; hint: string }[] = [
  { id: 'important', title: 'חשוב', hint: 'המשפטים של צ׳יזי והשמות' },
  { id: 'words', title: 'מילים', hint: 'המילים והצבעים שרני לומדת' },
  { id: 'sounds', title: 'צלילי אותיות', hint: 'הצליל הראשון של כל אות (באנגלית)' },
];

/** Mono samples at 24 kHz from whatever the phone recorded (webm, m4a...). */
export async function decodeToMono(blob: Blob): Promise<Float32Array> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(buf.duration * RATE)), RATE);
    const src = off.createBufferSource();
    src.buffer = buf;
    src.connect(off.destination); // channels are mixed down to one
    src.start();
    return (await off.startRendering()).getChannelData(0).slice();
  } finally {
    void ctx.close();
  }
}

/** The samples as an mp3 (mono, 64 kbps). The encoder is loaded only when a recording is made. */
export async function encodeMp3(samples: Float32Array): Promise<Blob> {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const enc = new Mp3Encoder(1, RATE, 64);
  const pcm = toInt16(samples);
  const out: Uint8Array[] = [];
  for (let i = 0; i < pcm.length; i += 1152) {
    const part = enc.encodeBuffer(pcm.subarray(i, i + 1152));
    if (part.length) out.push(Uint8Array.from(part));
  }
  const end = enc.flush();
  if (end.length) out.push(Uint8Array.from(end));
  return new Blob(out as BlobPart[], { type: 'audio/mpeg' });
}

export function openStudio(root: HTMLElement, onBack: () => void): () => void {
  let stream: MediaStream | null = null;
  let done = new Set<string>();
  let track: Track = 'important';
  let idx = 0;
  let busy = false;
  let dead = false;
  let player: HTMLAudioElement | null = null;
  let note = '';

  const items = (): Clip[] => clipsOfTrack(track);
  const isDone = (c: Clip): boolean => done.has(canonicalClip(c.id));
  const pos = (): Record<Track, number> => ({ important: 0, words: 0, sounds: 0, ...store.load<Partial<Record<Track, number>>>('studioPos', {}) });
  const savePos = (): void => store.save('studioPos', { ...pos(), [track]: idx });
  const shell = (inner: string): void => {
    root.innerHTML = `<div class="screen parent studio">${inner}</div>`;
  };
  const stopPlayer = (): void => {
    try { player?.pause(); } catch { /* ignore */ }
    player = null;
  };
  const stopMic = (): void => {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  };
  const leave = (): void => {
    dead = true;
    stopPlayer();
    stopMic();
    window.removeEventListener('hashchange', leave);
  };
  window.addEventListener('hashchange', leave);
  const refresh = async (): Promise<void> => void (done = new Set(await clipIds()));

  // ---- the permission, asked only here, with a short reason
  function permission(denied = false): void {
    shell(`
      <header class="p-head"><h1>אולפן הקלטה</h1><button class="btn alt" id="back">⬅ חזרה</button></header>
      <section class="p-card st-perm">
        <div class="st-emoji">🎙️</div>
        <p>כדי להקליט את הקול העברי של המשחק, הטלפון יבקש רשות להשתמש במיקרופון.<br>ההקלטות נשמרות רק בטלפון הזה, ואף אחד לא מקבל אותן.</p>
        ${denied ? '<p class="st-bad">המיקרופון לא אושר. אפשר לאשר אותו בהגדרות הדפדפן, ובינתיים אפשר לייבא הקלטות או לשמוע את אלה שכבר נשמרו.</p>' : ''}
        <button class="btn big" id="allow">אפשר מיקרופון</button>
        ${denied ? '<button class="btn alt" id="skip">להמשיך בלי מיקרופון</button>' : ''}
      </section>`);
    root.querySelector('#back')!.addEventListener('click', () => (leave(), onBack()));
    root.querySelector('#skip')?.addEventListener('click', () => void home());
    root.querySelector('#allow')!.addEventListener('click', async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true } });
        void home();
      } catch {
        permission(true);
      }
    });
  }

  // ---- the two tracks, and the backup
  async function home(): Promise<void> {
    await refresh();
    if (dead) return;
    const p = pos();
    shell(`
      <header class="p-head"><h1>אולפן הקלטה</h1><button class="btn alt" id="back">⬅ חזרה</button></header>
      ${note ? `<div class="p-flash">${esc(note)}</div>` : ''}
      ${TRACKS.map((t) => {
        const list = clipsOfTrack(t.id);
        const n = list.filter((c) => done.has(canonicalClip(c.id))).length;
        const first = list.findIndex((c) => !done.has(canonicalClip(c.id)));
        const resume = p[t.id] > 0 && p[t.id] < list.length;
        return `<section class="p-card st-track ${t.id === 'important' ? 'first' : ''}">
          <h2>${t.title} <small>${esc(t.hint)}</small></h2>
          <div class="st-count">${counter(`הוקלטו ${n} מתוך ${list.length}`)}</div>
          <div class="st-bar"><i style="width:${(100 * n) / Math.max(1, list.length)}%"></i></div>
          <div class="p-row">
            <button class="btn big" data-start="${t.id}" data-at="${first < 0 ? 0 : first}">${n === 0 ? 'מתחילים' : first < 0 ? 'לעבור על הכל' : 'ההקלטה הבאה'}</button>
            ${resume ? `<button class="btn alt" data-start="${t.id}" data-at="${p[t.id]}">${counter(`המשך מאיפה שעצרתי (${p[t.id] + 1})`)}</button>` : ''}
          </div>
        </section>`;
      }).join('')}
      <section class="p-card">
        <h2>גיבוי</h2>
        <div class="p-sub">ייצוא מוריד קובץ zip עם קובץ mp3 לכל משפט, בשם ה-id שלו. ייבוא מחזיר אותם (למשל לטלפון אחר), ואפשר גם להכניס אותם לריפו.</div>
        <div class="p-row"><button class="btn alt" id="export">${counter(`⬇ ייצוא הקלטות (${done.size})`)}</button><button class="btn alt" id="import">⬆ ייבוא</button></div>
        <input type="file" id="file" accept=".zip,application/zip" hidden />
      </section>`);
    note = '';
    root.querySelector('#back')!.addEventListener('click', () => (leave(), onBack()));
    root.querySelectorAll<HTMLElement>('[data-start]').forEach((b) =>
      b.addEventListener('click', () => {
        track = b.dataset.start as Track;
        idx = Number(b.dataset.at);
        void record();
      }),
    );
    root.querySelector('#export')!.addEventListener('click', () => void exportAll());
    const file = root.querySelector<HTMLInputElement>('#file')!;
    root.querySelector('#import')!.addEventListener('click', () => file.click());
    file.addEventListener('change', () => file.files?.[0] && void importZip(file.files[0]));
  }

  async function exportAll(): Promise<void> {
    const ids = await clipIds();
    const entries = [];
    for (const id of ids.sort()) {
      const blob = await getClip(id);
      if (blob) entries.push({ name: `${id}.mp3`, data: new Uint8Array(await blob.arrayBuffer()) });
    }
    if (!entries.length) {
      note = 'עוד אין הקלטות לייצוא.';
      return void home();
    }
    const url = URL.createObjectURL(new Blob([writeZip(entries) as BlobPart], { type: 'application/zip' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rani-voice-he.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    note = `יוצאו ${entries.length} הקלטות ✓`;
    void home();
  }

  async function importZip(f: File): Promise<void> {
    try {
      const known = new Set([...allClips(), ...soundClips()].map((c) => c.id));
      let n = 0;
      let skipped = 0;
      for (const e of await readZip(new Uint8Array(await f.arrayBuffer()))) {
        const m = /([^/\\]+)\.mp3$/i.exec(e.name);
        const id = m ? canonicalClip(m[1]) : '';
        if (id && known.has(id)) {
          await putClip(id, new Blob([e.data as BlobPart], { type: 'audio/mpeg' }));
          n++;
        } else skipped++;
      }
      resetRecorded();
      note = `יובאו ${n} הקלטות ✓${skipped ? ` (${skipped} קבצים לא מוכרים דולגו)` : ''}`;
    } catch {
      note = 'הקובץ לא נראה כמו zip של הקלטות.';
    }
    void home();
  }

  // ---- one sentence at a time
  async function record(): Promise<void> {
    await refresh();
    if (dead) return;
    const list = items();
    idx = Math.max(0, Math.min(list.length - 1, idx));
    savePos();
    const c = list[idx];
    const ok = isDone(c);
    shell(`
      <header class="p-head"><button class="btn alt" id="list">⬅ רשימה</button><h1>${TRACKS.find((t) => t.id === track)!.title}</h1><span class="st-pos">${counter(`${idx + 1} מתוך ${list.length}`)}</span></header>
      <div class="st-strip" id="strip">${list.map((x, i) => `<button class="st-chip ${i === idx ? 'now' : ''} ${isDone(x) ? 'ok' : ''}" data-i="${i}" type="button" aria-label="${i + 1}">${isDone(x) ? '✓' : i + 1}</button>`).join('')}</div>
      <section class="st-card">
        <div class="st-id" dir="ltr">${esc(c.id)}</div>
        ${
          c.sound
            ? `<div class="st-letter" dir="ltr">${esc(c.sound.letter)}</div><div class="st-word" dir="ltr">${esc(c.sound.word)} <button class="st-hear" id="hear" type="button" aria-label="השמעת המילה">🔊</button></div><div class="st-instr" dir="rtl">${esc(c.text)}</div>`
            : `<div class="st-text" dir="rtl">${esc(c.text)}</div>`
        }
        <div class="st-state ${ok ? 'ok' : ''}" id="state">${ok ? '✓ הוקלט' : 'עוד לא הוקלט'}</div>
      </section>
      <div class="st-mic-wrap">
        <button class="st-mic" id="mic" type="button" aria-label="החזיקי כדי להקליט" ${stream ? '' : 'disabled'}>🎙️</button>
        <div class="st-hint" id="hint">${stream ? 'מחזיקים לחוץ ומדברים, ומשחררים כדי לעצור' : 'אין מיקרופון: אפשר רק לשמוע ולדלג'}</div>
      </div>
      <div class="st-nav">
        <button class="btn alt" id="prev" ${idx === 0 ? 'disabled' : ''}>→ הקודם</button>
        <button class="btn alt" id="again" ${ok ? '' : 'disabled'}>▶ השמעה</button>
        <button class="btn" id="next">${idx === list.length - 1 ? 'סיום' : 'הבא ←'}</button>
      </div>`);
    const q = <T extends HTMLElement>(s: string): T => root.querySelector<T>(s)!;
    const strip = q('#strip');
    strip.querySelector('.now')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    strip.querySelectorAll<HTMLElement>('.st-chip').forEach((b) => b.addEventListener('click', () => ((idx = Number(b.dataset.i)), void record())));
    q('#list').addEventListener('click', () => (stopPlayer(), void home()));
    q('#prev').addEventListener('click', () => (stopPlayer(), idx--, void record()));
    q('#next').addEventListener('click', () => {
      stopPlayer();
      if (idx >= list.length - 1) return void home();
      idx++;
      void record();
    });
    q('#again').addEventListener('click', () => void play(canonicalClip(c.id)));

    if (c.sound) {
      const word = c.sound.word;
      root.querySelector('#hear')?.addEventListener('click', () => void speakWord(word));
      void speakWord(word); // the studio says the example word, she says only the first sound
    }
    const state = q('#state');
    const hint = q('#hint');
    const mic = q('#mic');
    let rec: MediaRecorder | null = null;
    let chunks: Blob[] = [];
    let t0 = 0;
    const begin = (e: Event): void => {
      e.preventDefault();
      if (!stream || rec || busy) return;
      stopPlayer();
      chunks = [];
      try {
        rec = new MediaRecorder(stream);
      } catch {
        hint.textContent = 'הדפדפן הזה לא יודע להקליט';
        return;
      }
      rec.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
      rec.onstop = () => void finish(new Blob(chunks, { type: rec?.mimeType || 'audio/webm' }), Date.now() - t0);
      t0 = Date.now();
      rec.start();
      mic.classList.add('on');
      state.textContent = '● מקליט...';
      state.classList.add('live');
    };
    const end = (): void => {
      if (!rec) return;
      mic.classList.remove('on');
      state.classList.remove('live');
      if (rec.state !== 'inactive') rec.stop();
    };
    const finish = async (blob: Blob, ms: number): Promise<void> => {
      rec = null;
      if (dead) return;
      if (ms < 400) {
        state.textContent = ok ? '✓ הוקלט' : 'עוד לא הוקלט';
        hint.textContent = 'קצר מדי. מחזיקים לחוץ עד שמסיימים לדבר.';
        return;
      }
      busy = true;
      state.textContent = 'מעבד...';
      try {
        const clean = cleanRecording(await decodeToMono(blob), RATE);
        if (!clean) {
          state.textContent = 'לא נשמע כלום';
          hint.textContent = 'לא שמעתי קול. מנסים שוב, קרוב יותר למיקרופון.';
          return;
        }
        await putClip(canonicalClip(c.id), await encodeMp3(clean));
        resetRecorded();
        done.add(canonicalClip(c.id));
        state.textContent = '✓ נשמר';
        state.classList.add('ok');
        const chip = strip.querySelector<HTMLElement>('.now');
        if (chip) (chip.classList.add('ok'), (chip.textContent = '✓'));
        (q('#again') as HTMLButtonElement).disabled = false;
        hint.textContent = 'ההקלטה מתנגנת. לא טוב? מחזיקים את המיקרופון ומקליטים שוב.';
        await play(canonicalClip(c.id));
      } catch {
        state.textContent = 'משהו השתבש';
        hint.textContent = 'לא הצלחתי לעבד את ההקלטה. מנסים שוב.';
      } finally {
        busy = false;
      }
    };
    mic.addEventListener('pointerdown', (e) => {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      begin(e);
    });
    mic.addEventListener('pointerup', end);
    mic.addEventListener('pointercancel', end);
    mic.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  async function play(id: string): Promise<void> {
    stopPlayer();
    const blob = await getClip(id);
    if (!blob || dead) return;
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    player = a;
    a.onended = () => URL.revokeObjectURL(url);
    void a.play().catch(() => undefined);
  }

  permission();
  return leave;
}
