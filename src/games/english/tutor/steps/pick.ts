import { WORDS, labelOf } from '../../content/words';
import { dueWords, review as leitner } from '../../engine/progress';
import { playWord } from '../../voice';
import { clipText } from '../audio';
import { pictureHtml } from '../pictures';
import { pickRound, type Option, type StepRun } from '../shell';
import { esc } from '../../ui/text';

const arr = <T>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const str = (x: unknown): string => (typeof x === 'string' ? x : '');
const shuffle = <T>(a: T[]): T[] => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map((p) => p[1]);
const picOpt = (p: string): Option => ({ html: `<span class="tutor-pic">${pictureHtml(p)}</span>` });
const speaker = (sh: Parameters<StepRun>[0], again: () => Promise<void>): void => {
  const b = document.createElement('button');
  b.className = 'tutor-speaker lone';
  b.type = 'button';
  b.textContent = '🔊';
  b.addEventListener('click', () => void again().catch(() => {}));
  sh.stage.prepend(b);
};

/** review: `count` words of the Leitner box that are due. Hear the word, pick the picture of three. Updates the Leitner as the word journey does. */
export const review: StepRun = async (sh, step) => {
  const today = sh.deps.today;
  const due = dueWords(sh.deps.words(), today).filter((id) => WORDS.some((w) => w.id === id)).slice(0, Number(step.count) || 3);
  // the word journey has not started (or nothing is due): this step is skipped
  if (!due.length) return;
  await sh.say('t_review', { look: 'happy' });
  const pool = WORDS.map((w) => w.id);
  let worst = 1;
  for (const id of due) {
    sh.clear();
    const others = shuffle(pool.filter((x) => x !== id)).slice(0, 2);
    const ids = shuffle([id, ...others]);
    const hear = async (): Promise<void> => {
      sh.lolly.speaking(true);
      if (!(await playWord(id))) await sh.wait(500);
      sh.lolly.speaking(false);
    };
    sh.bubble(labelOf(id), 'en');
    await hear();
    speaker(sh, hear);
    const tries = await pickRound(sh, { options: ids.map((x) => picOpt(`word:${x}`)), correct: ids.indexOf(id), replay: hear, cls: 'three' });
    sh.deps.setWords(leitner(sh.deps.words(), id, tries === 1, today));
    worst = Math.max(worst, tries);
  }
  return { tries: worst >= 3 ? 3 : 1 };
};

/** listenPick: hear `clip`, pick the picture of `choices`. The "tap the picture" instruction is said the first time only. */
export const listenPick: StepRun = async (sh, step) => {
  sh.clear();
  const clip = str(step.clip);
  const intro = str(step.intro);
  if (intro && sh.once(`intro:${intro}`)) await sh.say(intro, { look: 'listen' });
  const hear = (): Promise<void> => sh.say(clip, { look: 'listen' });
  await hear();
  speaker(sh, hear);
  const ch = arr<string>(step.choices);
  const tries = await pickRound(sh, { options: ch.map(picOpt), correct: Number(step.correct) || 0, replay: hear, cls: ch.length > 3 ? 'four' : 'three' });
  return { tries };
};

/** whoSaid: three squishies; hear "Hello! I'm Mozzi." and tap the one who said it. */
export const whoSaid: StepRun = async (sh, step) => {
  sh.clear();
  const clip = str(step.clip);
  if (sh.once('whoSaid')) await sh.say('t_who_said', { look: 'listen' });
  // the name is hidden until she answers right: "Hello! I'm ___."
  const masked = clipText(clip).replace(/(I'm\s+)(.+?)([.!?]*)$/, '$1___$3');
  const hear = (): Promise<void> => sh.say(clip, { look: 'listen', text: masked });
  await hear();
  speaker(sh, hear);
  const ch = arr<string>(step.choices);
  const tries = await pickRound(sh, { options: ch.map(picOpt), correct: Number(step.correct) || 0, replay: hear, cls: 'three', onRight: () => sh.bubble(clipText(clip), 'en') });
  return { tries };
};

const bubbleOpt = (text: string, clip?: string): Option => ({ html: `<span class="tutor-speech" dir="ltr">${esc(text)}</span>`, clip });

/** answerPick: Lolly asks; Rani picks one of 2-3 bubbles (the first tap plays it, the second chooses). */
export const answerPick: StepRun = async (sh, step) => {
  const c = sh.clear();
  const clip = str(step.clip);
  if (step.picture) c.innerHTML = `<div class="tutor-pic big">${pictureHtml(str(step.picture))}</div>`;
  const hear = (): Promise<void> => sh.say(clip, { look: 'listen' });
  await hear();
  const ch = arr<string>(step.choices);
  const cc = arr<string>(step.choiceClips);
  // the question stays in Lolly's bubble the whole time; a tap on an answer plays it and marks it, the bubble does not change
  const tries = await pickRound(sh, { options: ch.map((t, i) => bubbleOpt(t, cc[i])), correct: Number(step.correct) || 0, replay: hear, twice: true, cls: 'bubbles', restore: () => sh.bubble(clipText(clip), 'en') });
  return { tries };
};

/** dialogue: a squishy takes Lolly's place in the middle (she is small in the corner, listening) and talks; Rani answers by choosing one of two bubbles, turn after turn. A right answer: Lolly is happy. */
export const dialogue: StepRun = async (sh, step) => {
  let worst = 1;
  const turns = arr<{ squishy: string; choices: string[]; correct: number }>(step.turns);
  sh.clear();
  sh.guest(pictureHtml('squishy:mozzi'));
  for (const t of turns) {
    sh.stage.innerHTML = '';
    const hear = (): Promise<void> => sh.say(t.squishy);
    await hear();
    const tries = await pickRound(sh, { options: t.choices.map((id) => bubbleOpt(clipText(id), id)), correct: t.correct, replay: hear, twice: true, cls: 'bubbles', praise: false, onRight: () => sh.lolly.set('happy') });
    worst = Math.max(worst, tries);
    await sh.wait(600);
  }
  // the guest leaves, Lolly is big again and praises
  sh.clear();
  await sh.praise();
  return { tries: worst >= 3 ? 3 : 1 };
};
