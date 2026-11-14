import { clipText } from '../audio';
import { pictureHtml } from '../pictures';
import { pickRound, type StepRun } from '../shell';

/** trueFalse ("Rani the teacher"): Lolly shows a picture and says a sentence; Rani taps ✔ or ✖. When Lolly was wrong and Rani caught it, Lolly is confused and Rani picks the right sentence. */
export const trueFalse: StepRun = async (sh, step) => {
  const c = sh.clear();
  const clip = String(step.clip);
  const truth = step.truth === true;
  c.innerHTML = `<div class="tutor-pic big">${pictureHtml(String(step.picture ?? ''))}</div>`;
  if (sh.once('tf-intro')) await sh.say('t_right_or_wrong', { look: 'listen' });
  const hear = async (): Promise<void> => {
    await sh.say(clip, { look: 'listen', keep: true });
    await sh.say('t_am_i_right', { look: 'listen' });
  };
  await hear();
  const tries = await pickRound(sh, {
    options: [{ html: '<span class="tutor-tf yes">✔</span>' }, { html: '<span class="tutor-tf no">✖</span>' }],
    correct: truth ? 0 : 1,
    replay: hear,
    cls: 'tf',
    praise: false,
  });
  if (truth) {
    await sh.say('t_i_was_right', { look: 'happy' });
    return { tries };
  }
  // Lolly was wrong: she is confused, thanks Rani, and Rani fixes the sentence
  sh.lolly.set('confused');
  await sh.say('t_silly_me', { look: 'confused', keep: true });
  await sh.say('t_oops', { look: 'confused', pre: 0 });
  const fix = step.fixChoices as { clips: string[]; correct: number } | null;
  if (fix) {
    sh.clear().innerHTML = `<div class="tutor-pic big">${pictureHtml(String(step.picture ?? ''))}</div>`;
    await sh.say('t_fix_me', { look: 'listen' });
    const t2 = await pickRound(sh, {
      options: fix.clips.map((id) => ({ html: `<span class="tutor-speech" dir="ltr">${clipText(id)}</span>`, clip: id })),
      correct: fix.correct,
      twice: true,
      cls: 'bubbles',
    });
    return { tries: Math.max(tries, t2) };
  }
  return { tries };
};
