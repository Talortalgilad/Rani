import { mountCheesy, type Expression } from '../art/cheesy';
import { sceneImg } from '../art/scenes';
import { COLORS } from '../content/colors';
import { VERBS, labelOf, pluralOf } from '../content/words';
import { en, he } from '../content/lines';
import type { Step } from '../engine/steps';
import { speakEn, speakHe, speakWord, stopSpeech } from '../voice';
import type { SoundApi } from '../../../sound';
import { bigSmallTask } from '../tasks/bigsmall';
import { circleTask } from '../tasks/circle';
import { colorCard, wordCard } from '../tasks/card';
import { colorTask } from '../tasks/color';
import { countTask } from '../tasks/count';
import { dragTask } from '../tasks/drag';
import { findTask } from '../tasks/find';
import { listenTask } from '../tasks/listen';
import { matchTask } from '../tasks/match';
import { sentenceTask } from '../tasks/sentence';
import { songTask } from '../tasks/song';
import { tapTask } from '../tasks/tap';
import { whereTask, whereText } from '../tasks/where';
import { el, type TaskEnv, type TaskHandle } from '../tasks/common';
import { mixed } from './text';

export interface QuestDeps {
  name: string;
  /** the world whose room is the background */
  world: number;
  steps: Step[];
  sound: SoundApi;
  /** how many times each verb was done right already (the Hebrew help goes away after 3) */
  verbs: Record<string, number>;
  onVerb(verb: string): void;
  /** a task is done: the words it counts for, and whether it went right at the first try */
  onScore(words: string[], firstTry: boolean): void;
  /** a card was shown (the word is now "seen") */
  onSeen(key: string): void;
  onHome(): void;
  /** the station is over: stars 1..3 */
  onFinish(stars: 1 | 2 | 3): void;
}

/** The word of the instruction that has a Hebrew help the first times: find, color, how many, big, on... */
export function verbOf(s: Step): string | null {
  switch (s.kind) {
    case 'card': case 'colorcard': case 'listen': case 'song': return null;
    case 'put': return 'put';
    case 'count': return 'count';
    case 'bigsmall': return s.which;
    case 'where': return s.prep;
    case 'sentence': return 'sentence';
    case 'match': return 'match';
    default: return s.kind;
  }
}

/** What is said and shown for a step. */
export function instruction(s: Step): { text: string; html: string } {
  switch (s.kind) {
    case 'card': return { text: '', html: `<span class="hint-he">${he.cardTap}</span>` };
    case 'colorcard': return { text: '', html: `<span class="hint-he">${he.cardTap}</span>` };
    case 'circle': return { text: en.circle(labelOf(s.right)), html: `Circle the <b>${labelOf(s.right)}</b>!` };
    case 'tap': return { text: en.tap(labelOf(s.right)), html: `Tap the <b>${labelOf(s.right)}</b>!` };
    case 'put': return { text: en.put(labelOf(s.right), 'box'), html: `Put the <b>${labelOf(s.right)}</b> in the <b>box</b>!` };
    case 'listen': return { text: labelOf(s.right), html: `<span class="listen-q">?</span>` };
    case 'match': return { text: s.mode === 'audio' ? 'Listen and match!' : en.match, html: s.mode === 'audio' ? 'Listen and match!' : 'Match!' };
    case 'find': return { text: `Find all the ${pluralOf(s.right)}!`, html: `Find all the <b>${pluralOf(s.right)}</b>!` };
    case 'color': return { text: `Color the ${s.object} ${s.color}!`, html: `Color the <b>${s.object}</b> <b>${s.color}</b>!` };
    case 'count': return { text: `How many ${pluralOf(s.right)}? Tap the number!`, html: `How many <b>${pluralOf(s.right)}</b>?` };
    case 'bigsmall': return { text: `Tap the ${s.which} ${labelOf(s.right)}!`, html: `Tap the <b>${s.which}</b> ${labelOf(s.right)}!` };
    case 'where': {
      const text = whereText(s.item, s.prep, s.ref);
      return { text, html: text.replace(new RegExp(`\\b(${s.prep}|${labelOf(s.ref)}|Jump|Go)\\b`, 'g'), '<b>$1</b>') };
    }
    case 'sentence': return { text: 'Make the sentence!', html: 'Make the sentence!' };
    case 'song': return { text: 'Let’s sing!', html: 'Let’s sing!' };
  }
}

/** One station: new word cards, then the tasks, with Cheesy in the corner and the instruction in English. */
export function runStation(root: HTMLElement, d: QuestDeps): () => void {
  const steps = d.steps;
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
  stage.insertAdjacentHTML('afterbegin', `<div class="scene">${sceneImg(d.world)}</div>`);
  const instr = root.querySelector<HTMLElement>('#instr')!;
  const bub = root.querySelector<HTMLElement>('#bub')!;
  const dots = root.querySelector<HTMLElement>('#dots')!;
  const cheesy = mountCheesy(root.querySelector<HTMLElement>('#ch')!, 'happy', () => d.sound.play('pop', 520));
  steps.forEach(() => el('i', 'dot', dots));
  let index = -1;
  let handle: TaskHandle | null = null;
  let mistakesInTask = 0;
  let mistakesTotal = 0;
  let scored = 0;
  const timers: number[] = [];
  let dead = false;
  const later = (f: () => void, ms: number): void => void timers.push(window.setTimeout(() => !dead && f(), ms));

  const note = (text?: string): void => {
    bub.hidden = !text;
    if (text) bub.innerHTML = mixed(text);
  };
  const face = (e: Expression, text?: string): void => {
    cheesy.set(e);
    note(text);
    if (e === 'dance' || e === 'cheer') later(() => cheesy.set('happy'), 1800);
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
    sound: (n, pitch) => d.sound.play(n, pitch),
    say: (text, word) => void (word ? speakWord(text) : speakEn(text)),
  };

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
    if (first && verb && VERBS[verb]) {
      const v = VERBS[verb];
      note(he.verb(v.en, v.he));
      void speakEn(v.en, 0.85).then(() => speakHe(`זה ${v.he}!`)).then(speakInstr);
    } else later(speakInstr, 500);
    const met = COLORS.map((c) => c.id);
    switch (s.kind) {
      case 'card': handle = wordCard(env, s.word); break;
      case 'colorcard': handle = colorCard(env, s.color); break;
      case 'circle': handle = circleTask(env, s.right, s.ids, index + 1); break;
      case 'tap': handle = tapTask(env, s.right, s.ids, index + 2); break;
      case 'put': handle = dragTask(env, s.right, s.others); break;
      case 'listen': handle = listenTask(env, s.right, s.ids, index + 3); break;
      case 'match': handle = matchTask(env, s.ids, index + 4, s.mode); break;
      case 'find': handle = findTask(env, s.right, s.others, s.count, index + 5); break;
      case 'color': handle = colorTask(env, s.object, s.color, met); break;
      case 'count': handle = countTask(env, s.right, s.n); break;
      case 'bigsmall': handle = bigSmallTask(env, s.right, s.which, index); break;
      case 'where': handle = whereTask(env, s.item, s.ref, s.prep); break;
      case 'sentence': handle = sentenceTask(env, s.words, s.picture, s.missing); break;
      case 'song': handle = songTask(env, s.world); break;
    }
  };

  function next(): void {
    const prev = steps[index];
    if (prev) {
      const v = verbOf(prev);
      if (v && mistakesInTask < 3) d.onVerb(v);
      if (prev.kind === 'card') d.onSeen(prev.word);
      else if (prev.kind === 'colorcard') d.onSeen(`color:${prev.color}`);
      if (prev.score.length) {
        d.onScore(prev.score, mistakesInTask === 0);
        scored++;
      }
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
  void scored;

  root.querySelector('#qh')!.addEventListener('click', () => d.onHome());
  root.querySelector('#qs')!.addEventListener('click', () => (handle ? handle.repeat() : undefined));
  // (for development: run one step by hand)
  if (import.meta.env.DEV) (window as unknown as { __enSteps?: Step[] }).__enSteps = steps;
  if (import.meta.env.DEV) (window as unknown as { __enRun?: (s: Step) => void }).__enRun = (s) => (handle?.destroy(), (handle = null), start(s));
  later(next, 300);
  return () => {
    dead = true;
    timers.forEach(clearTimeout);
    handle?.destroy();
    stopSpeech();
  };
}
