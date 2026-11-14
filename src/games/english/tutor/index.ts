/** The tutor's screen (SPEC-tutor.md): the lessons of Miss Lolly, one new lesson a day, the old ones again whenever. */
import type { SoundApi } from '../../../sound';
import { dayNumber, type Words } from '../engine/progress';
import { imageUrl } from '../art/images';
import { esc } from '../ui/text';
import { stopSpeech } from '../voice';
import { canRun, runLesson, type Run } from './engine';
import { LESSONS, units, type Lesson } from './lessons';
import { mountLolly, preloadTutor } from './lolly';
import { access, isDone, loadTutor, type TutorState } from './state';
import { playTutor, stopTutor, clipText } from './audio';
import type { Deps } from './shell';
import './tutor.css';

export interface TutorDeps {
  sound: SoundApi;
  /** the saved state (anything: it is cleaned) and how to save it */
  load(): unknown;
  save(s: TutorState): void;
  words(): Words;
  setWords(w: Words): void;
  openAll(): boolean;
  onBack(): void;
}

export function showTutor(root: HTMLElement, d: TutorDeps): () => void {
  preloadTutor();
  const stepCounts = Object.fromEntries(LESSONS.map((l) => [l.id, l.steps.length]));
  let state = loadTutor(d.load(), stepCounts);
  let run: Run | null = null;
  let alive = true;
  const today = (): number => dayNumber();
  const deps = (): Deps => ({
    sound: d.sound,
    today: today(),
    state: () => state,
    setState: (s) => ((state = s), d.save(s)),
    words: d.words,
    setWords: d.setWords,
    onClose: () => {
      run = null;
      if (alive) list();
    },
  });

  function list(note = ''): void {
    stopTutor();
    const open = d.openAll();
    const next = LESSONS.find((l) => access(LESSONS, state, l, today(), canRun, open) === 'ok' && !isDone(state, l.id)) ?? null;
    root.innerHTML = `
      <div class="en-screen tutor-screen tutor-list">
        <div class="en-sky"></div>
        <header class="tutor-top"><button class="q-home" id="tback" type="button" aria-label="חזרה">←</button><h1 class="map-title">המורה לולי</h1><span style="width:44px"></span></header>
        <div class="tutor-lolly-row"><div class="tutor-lolly sm" id="tl"></div><button class="tutor-bubble ${note ? "" : "empty"}" id="tb" type="button"><span id="tbt">${esc(note)}</span></button></div>
        <div class="tutor-units">${units()
          .map(
            (u) => `<section class="tutor-unit"><h2>יחידה ${u}</h2><div class="tutor-lessons">${LESSONS.filter((l) => l.unit === u)
              .map((l) => card(l, next, open))
              .join('')}</div></section>`,
          )
          .join('')}</div>
      </div>`;
    const lolly = mountLolly(root.querySelector<HTMLElement>('#tl')!, 'happy');
    root.querySelector('#tback')!.addEventListener('click', () => {
      stopTutor();
      d.onBack();
    });
    root.querySelectorAll<HTMLButtonElement>('.tl-card').forEach((b) =>
      b.addEventListener('click', () => {
        const l = LESSONS.find((x) => x.id === b.dataset.id)!;
        const a = access(LESSONS, state, l, today(), canRun, open);
        if (a === 'ok') return start(l);
        d.sound.play('pop', 300);
        b.classList.remove('shake');
        void b.offsetWidth;
        b.classList.add('shake');
        if (a === 'doneToday') {
          root.querySelector('#tb')!.classList.remove('empty');
          root.querySelector('#tbt')!.innerHTML = `<span class="tb-he">${esc(clipText('t_done_today'))}</span>`;
          lolly.set('happy');
          lolly.speaking(true);
          void playTutor('t_done_today').then(() => lolly.speaking(false));
        }
      }),
    );
  }

  function card(l: Lesson, next: Lesson | null, open: boolean): string {
    const a = access(LESSONS, state, l, today(), canRun, open);
    const done = isDone(state, l.id);
    const mid = state.progress?.lesson === l.id;
    const cls = done ? 'done' : mid ? 'mid' : l.id === next?.id ? 'new' : a === 'doneToday' ? 'wait' : 'locked';
    const sticker = state.stickers[l.id];
    const badge = done ? (sticker ? `<img src="${imageUrl(sticker)}" alt="" draggable="false">` : '✅') : mid ? '▶' : cls === 'new' ? '⭐' : a === 'doneToday' ? '🌙' : canRun(l) ? '🔒' : '🚧';
    return `<button class="tl-card ${cls}" data-id="${l.id}" type="button"><span class="tl-badge ${state.sparkle[l.id] ? 'sparkle' : ''}">${badge}</span><span class="tl-t"><b>${esc(l.titleHe)}</b>${(l.kind === 'teacher' && l.titleHe !== 'רני המורה' ? 'רני המורה' : mid ? 'ממשיכים' : cls === 'new' ? 'שיעור חדש' : done ? 'לחזור' : '') ? `<small>${l.kind === 'teacher' && l.titleHe !== 'רני המורה' ? 'רני המורה' : mid ? 'ממשיכים' : cls === 'new' ? 'שיעור חדש' : done ? 'לחזור' : ''}</small>` : ''}</span></button>`;
  }

  function start(l: Lesson): void {
    stopSpeech();
    const from = !isDone(state, l.id) && state.progress?.lesson === l.id ? state.progress.step : 0;
    run = runLesson(root, deps(), l, from);
    void run.done.then((r) => {
      if (r === 'finished' && alive) list();
    });
  }

  list();
  return () => {
    alive = false;
    run?.stop();
    stopTutor();
  };
}
