import { clipText } from '../audio';
import { pictureHtml } from '../pictures';
import { setSparkle } from '../state';
import type { StepRun } from '../shell';

interface Item { kind: 'pick' | 'answer'; clip: string; choices?: string[]; choiceClips?: string[]; correct: number }

/**
 * challenge: three harder questions at the end of the lesson, four choices each, no hints. `pick`: she hears a clip and picks the picture (2 x 2). `answer`: a question and four
 * bubbles (a tap plays one, a second tap chooses). A mistake shows the answer and goes on (no second try). No mistake at all: "perfect", and the sticker of the lesson sparkles
 * (also when the lesson is done again). Otherwise: "well done for trying". Nothing is ever lost.
 */
export const challenge: StepRun = async (sh, step) => {
  const items = (Array.isArray(step.items) ? step.items : []) as Item[];
  sh.clear();
  await sh.say('t_challenge_intro', { look: 'happy' });
  let mistakes = 0;
  for (const it of items) {
    sh.clear();
    const hear = (): Promise<void> => sh.say(it.clip, { look: 'listen' });
    await hear();
    const n = it.kind === 'pick' ? (it.choices ?? []).length : (it.choiceClips ?? []).length;
    const box = document.createElement('div');
    box.className = `tutor-choices ${it.kind === 'pick' ? 'four ch4' : 'bubbles four'}`;
    sh.stage.appendChild(box);
    const btns: HTMLButtonElement[] = [];
    for (let i = 0; i < n; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tutor-opt';
      b.innerHTML = it.kind === 'pick' ? `<span class="tutor-pic">${pictureHtml(it.choices![i])}</span>` : `<span class="tutor-speech" dir="ltr">${clipText(it.choiceClips![i])}</span>`;
      box.appendChild(b);
      btns.push(b);
    }
    if (it.kind === 'pick') {
      const sp = document.createElement('button');
      sp.className = 'tutor-speaker lone';
      sp.type = 'button';
      sp.textContent = '🔊';
      sp.addEventListener('click', () => void hear().catch(() => {}));
      sh.stage.prepend(sp);
    }
    sh.lolly.set('listen');
    const right = await new Promise<boolean>((res, rej) => {
      let picked = -1;
      let busy = false;
      btns.forEach((b, i) =>
        b.addEventListener('click', () => {
          if (busy) return;
          if (it.kind === 'answer' && picked !== i) {
            picked = i;
            btns.forEach((x, j) => x.classList.toggle('sel', j === i));
            void sh.say(it.choiceClips![i], { nobubble: true }).catch(() => {});
            return;
          }
          busy = true;
          const ok = i === it.correct;
          btns[it.correct].classList.add('right');
          if (!ok) b.classList.add('wrong');
          sh.deps.sound.play(ok ? 'bonus' : 'pop', ok ? undefined : 300);
          // right: a short praise and on; wrong: the answer is shown and on (no hint, no second try)
          (ok ? sh.praise() : sh.wait(1300)).then(() => res(ok)).catch(rej);
        }),
      );
    });
    if (!right) mistakes++;
  }
  sh.clear();
  if (mistakes === 0) {
    sh.deps.setState(setSparkle(sh.deps.state(), sh.lesson.id));
    sh.deps.sound.play('fanfare');
    sh.stage.innerHTML = '<div class="tutor-card"><div class="tutor-sticker sparkle-big">✨⭐✨</div></div>';
    await sh.say('t_challenge_perfect', { look: 'clap', keep: true });
    await sh.wait(500);
  } else {
    await sh.say('t_challenge_ok', { look: 'happy' });
  }
};
