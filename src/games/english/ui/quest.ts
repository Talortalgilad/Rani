import { mountCheesy, type Expression } from '../art/cheesy';
import { VERBS } from '../content/words';
import { en, he } from '../content/lines';
import { speakEn, speakHe, speakWord, stopSpeech } from '../voice';
import type { SoundApi } from '../../../sound';
import { cardPlan, type Step } from './plan';
import { dragTask } from '../tasks/drag';
import { circleTask } from '../tasks/circle';
import { listenTask } from '../tasks/listen';
import { matchTask } from '../tasks/match';
import { tapTask } from '../tasks/tap';
import { wordCard } from '../tasks/card';
import { el, type TaskEnv, type TaskHandle } from '../tasks/common';

export interface QuestDeps {
  name: string;
  sound: SoundApi;
  /** how many times each verb was done right already (the Hebrew help goes away after 3) */
  verbs: Record<string, number>;
  onVerb(verb: string): void;
  onHome(): void;
  /** the station is over: stars 1..3 */
  onFinish(stars: 1 | 2 | 3): void;
}

/** One station: new word cards, then the tasks, with Cheesy in the corner and the instruction in English. */
export function runStation(root: HTMLElement, d: QuestDeps): () => void {
  const steps: Step[] = cardPlan();
  root.innerHTML = `
    <div class="en-screen en-quest">
      <div class="en-sky"></div>
      <header class="q-top">
        <button class="q-home" id="qh" type="button" aria-label="${he.home}">🏠</button>
        <div class="q-dots" id="dots"></div>
        <button class="q-say" id="qs" type="button" aria-label="הקראה">🔊</button>
      </header>
      <div class="q-helper">
        <div class="cheesy-corner" id="ch"></div>
        <div class="bubble" id="bub" hidden></div>
      </div>
      <div class="q-instr" id="instr"></div>
      <div class="q-stage" id="stage"></div>
    </div>`;
  const stage = root.querySelector<HTMLElement>('#stage')!;
  const instr = root.querySelector<HTMLElement>('#instr')!;
  const bub = root.querySelector<HTMLElement>('#bub')!;
  const dots = root.querySelector<HTMLElement>('#dots')!;
  const cheesy = mountCheesy(root.querySelector<HTMLElement>('#ch')!, 'happy', () => d.sound.play('pop', 520));
  steps.forEach(() => el('i', 'dot', dots));
  let index = -1;
  let handle: TaskHandle | null = null;
  let mistakesInTask = 0;
  let mistakesTotal = 0;
  const timers: number[] = [];
  let dead = false;
  const later = (f: () => void, ms: number): void => void timers.push(window.setTimeout(() => !dead && f(), ms));

  const note = (text?: string): void => {
    bub.hidden = !text;
    if (text) bub.textContent = text;
  };
  const face = (e: Expression, text?: string): void => {
    cheesy.set(e);
    note(text);
    if (e === 'dance') later(() => cheesy.set('happy'), 1800);
    else if (e === 'encourage') later(() => cheesy.set('happy'), 1800);
  };

  const sparkle = (x: number, y: number): void => {
    const s = el('i', 'spark', stage);
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    s.textContent = ['✨', '⭐', '🌟'][Math.floor(Math.random() * 3)];
    window.setTimeout(() => s.remove(), 900);
  };

  const env: TaskEnv = {
    stage,
    face,
    mistake: () => ((mistakesInTask += 1), (mistakesTotal += 1), mistakesInTask),
    done: () => next(),
    sparkle,
    sound: (n) => d.sound.play(n),
    say: (text, word) => void (word ? speakWord(text) : speakEn(text)),
  };

  const instruction = (s: Step): { text: string; html: string } => {
    switch (s.kind) {
      case 'card': return { text: '', html: `<span class="hint-he">${he.cardTap}</span>` };
      case 'circle': return { text: en.circle(s.right), html: `Circle the <b>${s.right}</b>!` };
      case 'tap': return { text: en.tap(s.right), html: `Tap the <b>${s.right}</b>!` };
      case 'put': return { text: en.put(s.right, 'box'), html: `Put the <b>${s.right}</b> in the <b>box</b>!` };
      case 'listen': return { text: s.right, html: `<span class="listen-q">?</span>` };
      case 'match': return { text: en.match, html: `Match!` };
    }
  };
  const verbOf = (s: Step): string | null => (s.kind === 'card' || s.kind === 'listen' ? null : s.kind === 'put' ? 'put' : s.kind);

  const start = (s: Step): void => {
    mistakesInTask = 0;
    const i = instruction(s);
    instr.innerHTML = i.html;
    instr.classList.remove('pop');
    void instr.offsetWidth;
    instr.classList.add('pop');
    face('happy');
    const verb = verbOf(s);
    const first = verb && (d.verbs[verb] ?? 0) < 3;
    const speakInstr = (): void => {
      if (i.text) void (s.kind === 'listen' ? speakWord(i.text) : speakEn(i.text));
    };
    if (first && verb) {
      const v = VERBS[verb];
      note(he.verb(v.en, v.he));
      void speakEn(v.en, 0.85).then(() => speakHe(`זה ${v.he}!`)).then(speakInstr);
    } else later(speakInstr, 500);
    switch (s.kind) {
      case 'card': handle = wordCard(env, s.word); break;
      case 'circle': handle = circleTask(env, s.right, s.ids, 1); break;
      case 'tap': handle = tapTask(env, s.right, s.ids, 2); break;
      case 'put': handle = dragTask(env, s.right, s.others); break;
      case 'listen': handle = listenTask(env, s.right, s.ids, 3); break;
      case 'match': handle = matchTask(env, s.ids, 4); break;
    }
  };

  function next(): void {
    const prev = steps[index];
    if (prev) {
      const v = verbOf(prev);
      if (v && mistakesInTask < 3) d.onVerb(v);
      dots.children[index]?.classList.add('done');
    }
    handle?.destroy();
    handle = null;
    stopSpeech();
    index++;
    if (index >= steps.length) {
      const stars: 1 | 2 | 3 = mistakesTotal <= 1 ? 3 : mistakesTotal <= 4 ? 2 : 1;
      later(() => d.onFinish(stars), 200);
      return;
    }
    dots.children[index]?.classList.add('now');
    later(() => start(steps[index]), 350);
  }

  root.querySelector('#qh')!.addEventListener('click', () => d.onHome());
  root.querySelector('#qs')!.addEventListener('click', () => (handle ? handle.repeat() : undefined));
  later(next, 300);
  return () => {
    dead = true;
    timers.forEach(clearTimeout);
    handle?.destroy();
    stopSpeech();
  };
}
