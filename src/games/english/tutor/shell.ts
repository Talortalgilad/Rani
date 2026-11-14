/** The screen of a lesson and what a step can do with it: Lolly and her bubble, saying a clip, waiting for a tap, the rule of the mistakes (SPEC-tutor.md section 5). */
import type { SoundApi } from '../../../sound';
import { esc, mixed } from '../ui/text';
import { clipLang, clipText, playTutor, stopTutor } from './audio';
import { mountLolly, type Lolly, type Look } from './lolly';
import type { Lesson, Step } from './lessons';
import type { TutorState } from './state';
import type { Words } from '../engine/progress';

export class Aborted extends Error {}

/** What the engine needs from the game around it (no storage or clock in the steps themselves). */
export interface Deps {
  sound: SoundApi;
  today: number;
  state(): TutorState;
  setState(s: TutorState): void;
  words(): Words;
  setWords(w: Words): void;
  /** the lesson was left (the X, or the end): back to the list */
  onClose(): void;
}

export interface Shell {
  deps: Deps;
  lesson: Lesson;
  /** the part of the screen that a step fills */
  stage: HTMLElement;
  lolly: Lolly;
  alive(): boolean;
  say(id: string, o?: { look?: Look; keep?: boolean; text?: string; nobubble?: boolean; pre?: number }): Promise<void>;
  /** a guest (a squishy) takes Lolly's place in the middle; she is small in the corner */
  guest(html: string): void;
  /** Lolly's bubble with a text of its own (no clip) */
  bubble(text: string, lang?: 'he' | 'en'): void;
  wait(ms: number): Promise<void>;
  /** a big button; resolves when it is pressed */
  next(label?: string, id?: string): Promise<void>;
  /** the step area, emptied */
  clear(): HTMLElement;
  /** a step with nothing to tap (hello, goodbye, a sentence said): Lolly takes the room */
  roomy(): void;
  /** per-lesson memory of the things that are said once ("tap the picture") */
  once(key: string): boolean;
  /** how many `kind` of step came before in this lesson run */
  praise(): Promise<void>;
  tapTwice: boolean;
}

const PRAISE = ['t_very_good', 't_excellent', 't_you_got_it', 't_super', 't_well_done'];
const fast = (): boolean => typeof window !== 'undefined' && !!(window as unknown as { __tutorFast?: boolean }).__tutorFast;

export function bubbleHtml(text: string, lang: 'he' | 'en'): string {
  return lang === 'en' ? `<span dir="ltr" class="tb-en">${esc(text)}</span>` : `<span class="tb-he">${mixed(text)}</span>`;
}

export function createShell(root: HTMLElement, deps: Deps, lesson: Lesson, onX: () => void): { shell: Shell; setStage(n: number): void; destroy(): void } {
  root.innerHTML = `
    <div class="en-screen tutor-screen">
      <div class="en-sky"></div>
      <header class="tutor-top"><button class="q-home" id="tx" type="button" aria-label="סגירה">✕</button><div class="tutor-dots" id="td">${Array.from({ length: 6 }, () => '<i></i>').join('')}</div></header>
      <div class="tutor-lolly-col"><div class="tutor-lolly" id="tl"></div><button class="tutor-bubble" id="tb" type="button" aria-label="שוב"><span id="tbt"></span></button></div>
      <div class="tutor-stage" id="ts"></div>
    </div>`;
  const q = <T extends HTMLElement>(s: string): T => root.querySelector<T>(s)!;
  const stage = q('#ts');
  const lolly = mountLolly(q('#tl'));
  let dead = false;
  let last = '';
  const seen = new Set<string>();
  const check = (): void => {
    if (dead) throw new Aborted();
  };
  const setBubble = (text: string, lang: 'he' | 'en'): void => {
    q('#tbt').innerHTML = bubbleHtml(text, lang);
    q('#tb').classList.toggle('empty', !text);
    q('#tb').classList.remove('pop');
    void q('#tb').offsetWidth;
    q('#tb').classList.add('pop');
  };
  const wait = (ms: number): Promise<void> =>
    new Promise((res, rej) => {
      window.setTimeout(() => (dead ? rej(new Aborted()) : res()), fast() ? Math.min(ms, 30) : ms);
    });
  const guestOn = (): boolean => !!root.querySelector('.tutor-screen.dlg');
  /** a pose without a moving mouth is shown before and after a clip, never during it (the mouth changes between idle, talk1 and talk2 while she speaks) */
  const PRE: Partial<Record<Look, number>> = { wave: 600, clap: 500, confused: 500, think: 400 };
  const say = async (id: string, o: { look?: Look; keep?: boolean; text?: string; nobubble?: boolean; pre?: number } = {}): Promise<void> => {
    check();
    const guest = guestOn();
    if (!o.nobubble) {
      last = id;
      setBubble(o.text ?? clipText(id), clipLang(id));
    }
    // while a guest (a squishy) talks, Lolly stays small in the corner and does not move her mouth
    if (o.look && !guest) lolly.set(o.look);
    const pre = o.pre ?? (o.look ? PRE[o.look] ?? 0 : 0);
    if (pre && !guest) await wait(pre);
    if (!guest) lolly.speaking(true);
    const t0 = Date.now();
    const ok = await playTutor(id);
    if (!guest) lolly.speaking(false);
    check();
    // no sound (or the voice of the phone failed): the text is left to be read
    if (!ok) await wait(Math.min(2200, 500 + clipText(id).length * 45) - (Date.now() - t0));
    if (!o.keep && o.look && !guest) lolly.set('idle');
  };
  q('#tb').addEventListener('click', () => {
    if (last) void say(last).catch(() => {});
  });
  q('#tx').addEventListener('click', () => {
    dead = true;
    stopTutor();
    onX();
  });
  const shell: Shell = {
    deps,
    lesson,
    stage,
    lolly,
    alive: () => !dead,
    say,
    bubble: setBubble,
    wait,
    next: (label = 'הלאה', id = 'next') =>
      new Promise((res, rej) => {
        check();
        const b = document.createElement('button');
        b.className = 'tutor-next';
        b.type = 'button';
        b.dataset.say = id;
        b.innerHTML = `<span>${esc(label)}</span> <b aria-hidden="true">➜</b>`;
        b.addEventListener('click', () => {
          deps.sound.play('pop', 600);
          b.remove();
          dead ? rej(new Aborted()) : res();
        });
        stage.appendChild(b);
      }),
    clear: () => {
      stage.innerHTML = '';
      root.querySelector('.tutor-screen')?.classList.remove('roomy', 'dlg');
      root.querySelector('.tutor-guest')?.remove();
      return stage;
    },
    guest: (html) => {
      const g = document.createElement('div');
      g.className = 'tutor-guest';
      g.innerHTML = html;
      q('.tutor-lolly-col').insertBefore(g, q('#tb'));
      root.querySelector('.tutor-screen')?.classList.add('dlg');
      lolly.set('listen');
    },
    roomy: () => root.querySelector('.tutor-screen')?.classList.add('roomy'),
    once: (key) => (seen.has(key) ? false : (seen.add(key), true)),
    praise: async () => {
      deps.sound.play('bonus');
      // the happy pose first, then the praise with the mouth moving, then happy again for a moment
      lolly.set('happy');
      await wait(400);
      await say(PRAISE[Math.floor(Math.random() * PRAISE.length)], { look: 'happy', keep: true });
      await wait(450);
      lolly.set('idle');
    },
    tapTwice: true,
  };
  return {
    shell,
    setStage: (n) => root.querySelectorAll<HTMLElement>('#td i').forEach((d, i) => d.classList.toggle('on', i < n)),
    destroy: () => {
      dead = true;
      lolly.speaking(false);
      stopTutor();
    },
  };
}

// ---- a round of choosing (listenPick, whoSaid, answerPick, dialogue, review, trueFalse's fix) ----

export interface Option { html: string; clip?: string; label?: string }
/**
 * The mistake rule of SPEC-tutor.md section 5: the first mistake says "almost" and plays the clip again, the second makes the right answer sparkle,
 * the third shows it ("let me show you") and goes on. Never a score, never "failed". Resolves with the number of tries (1..3).
 * `twice`: a bubble is played by the first tap and chosen by the second (answerPick, dialogue).
 */
export async function pickRound(sh: Shell, o: { options: Option[]; correct: number; replay?: () => Promise<void>; twice?: boolean; cls?: string; praise?: boolean; onRight?: () => void; restore?: () => void }): Promise<number> {
  const box = document.createElement('div');
  box.className = `tutor-choices ${o.cls ?? ''}`;
  sh.stage.appendChild(box);
  sh.lolly.set('listen');
  const btns = o.options.map((op, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tutor-opt';
    b.dataset.i = String(i);
    b.innerHTML = op.html;
    box.appendChild(b);
    return b;
  });
  let tries = 0;
  let picked = -1;
  const finish = async (): Promise<number> => {
    btns.forEach((b, i) => b.classList.toggle('right', i === o.correct));
    sh.deps.sound.play('bonus');
    if (o.onRight) {
      o.onRight();
      await sh.wait(1000);
    }
    if (o.praise !== false && tries === 1) await sh.praise();
    return Math.min(3, tries);
  };
  return new Promise<number>((resolve, reject) => {
    let busy = false;
    const onTap = async (i: number): Promise<void> => {
      if (busy) return;
      const op = o.options[i];
      if (o.twice && picked !== i) {
        // the first tap only plays the bubble (and does not hold the second tap back)
        picked = i;
        btns.forEach((b, j) => b.classList.toggle('sel', j === i));
        if (op.clip) void sh.say(op.clip, { nobubble: true }).catch(() => {});
        return;
      }
      busy = true;
      try {
        tries++;
        if (i === o.correct) return void resolve(await finish());
        btns[i].classList.remove('shake');
        void btns[i].offsetWidth;
        btns[i].classList.add('shake', 'wrong');
        picked = -1;
        btns.forEach((b) => b.classList.remove('sel'));
        if (tries === 1) {
          await sh.say('t_almost', { look: 'listen' });
          o.restore?.();
          await o.replay?.();
        } else if (tries === 2) {
          btns[o.correct].classList.add('glow');
          await o.replay?.();
        } else {
          btns[o.correct].classList.add('glow');
          await sh.say('t_show', { look: 'happy' });
          o.restore?.();
          return void resolve(await finish());
        }
        btns[i].classList.remove('wrong');
        busy = false;
      } catch (e) {
        reject(e);
      }
    };
    btns.forEach((b, i) => b.addEventListener('click', () => void onTap(i)));
  });
}

export type StepRun = (sh: Shell, step: Step, i: number) => Promise<{ tries?: number } | void>;
