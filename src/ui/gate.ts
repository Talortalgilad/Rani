import { activeLevel, recordAnswer } from '../math/adaptive';
import { createGenerator, type Question } from '../math/generator';
import { gameStore, getState } from '../storage';
import { sound } from '../sound';
import { speak, stopSpeaking } from '../speech';
import { go } from '../router';
import { renderHint } from './hints';
import { englishGateQuestion } from '../games/english/gate';
import { imageUrl } from '../games/english/art/images';
import { speakWord } from '../games/english/voice';
import type { Words } from '../games/english/engine/progress';

const generator = createGenerator();

export function renderGate(root: HTMLElement, gameId: string, onPass: () => void): () => void {
  const total = getState().settings.gateQuestions;
  let solved = 0;
  let dead = false;
  let passed = false;
  const timers: number[] = [];
  const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(() => !dead && fn(), ms));

  root.innerHTML = `
    <div class="screen gate">
      <div class="gate-top">
        <button class="icon-btn small" id="home" aria-label="בית">🏠</button>
        <div class="progress" id="progress"></div>
        <button class="icon-btn small" id="say" aria-label="הקראה">🔊</button>
      </div>
      <div class="gate-body" id="body"></div>
    </div>`;
  const body = root.querySelector('#body') as HTMLElement;
  const progress = root.querySelector('#progress') as HTMLElement;
  const sayBtn = root.querySelector('#say') as HTMLElement;
  root.querySelector('#home')!.addEventListener('click', () => go({ name: 'home' }));

  const paintProgress = () => {
    progress.innerHTML = Array.from({ length: total }, (_, i) =>
      `<span class="pip ${i < solved ? 'full' : ''}">${i < solved ? '⭐' : ''}</span>`).join('');
  };

  let current: Question | null = null;
  let english: { say: string } | null = null;
  sayBtn.addEventListener('click', () => (english ? void speakWord(english.say) : current && speak(current.speech)));

  function intro() {
    paintProgress();
    sayBtn.style.visibility = 'hidden';
    body.innerHTML = `
      <div class="intro">
        <div class="intro-emoji">🎮</div>
        <h2>פותרים ${total === 1 ? 'תרגיל אחד' : `${total} תרגילים`} ומשחקים!</h2>
        <button class="btn big" id="start">יאללה!</button>
      </div>`;
    body.querySelector('#start')!.addEventListener('click', nextQuestion);
  }

  function nextQuestion() {
    if (solved >= total) return finish();
    sayBtn.style.visibility = 'visible';
    english = null;
    const subject = getState().settings.gateSubject;
    // English (or every second question for "both"): "what did you hear?"; maths when she has not met three words yet
    if (subject === 'english' || (subject === 'both' && solved % 2 === 1)) {
      const eq = englishGateQuestion(gameStore('english').load<Words>('words', {}));
      if (eq) return englishQuestion(eq);
    }
    const q = (current = generator.next(activeLevel(), getState().settings.enabledTypes));
    let attempts = 0;
    let locked = false;

    const v = q.visual;
    const visual =
      v?.kind === 'emoji'
        ? `<div class="emoji-grid">${Array.from({ length: v.n }, () => `<span class="em">${v.emoji}</span>`).join('')}</div>`
        : v?.kind === 'tenframe'
          ? `<div class="hint tenframe" dir="ltr">${Array.from({ length: 10 }, (_, i) =>
              `<span class="cell ${i < v.filled ? 'on' : ''}"></span>`).join('')}</div>`
          : '';

    body.innerHTML = `
      <div class="question">
        ${q.text ? `<div class="q-text ${q.text.length > 11 ? 'long' : ''}" dir="${q.ltr ? 'ltr' : 'rtl'}">${q.text}</div>` : ''}
        ${visual}
      </div>
      <div class="choices ${q.choices.length === 2 ? 'two' : ''}">
        ${q.choices.map((c) => `<button class="choice" data-v="${c}">${c}</button>`).join('')}
      </div>
      <div class="hint-slot" id="hint"></div>`;
    speak(q.speech);

    body.querySelectorAll<HTMLButtonElement>('.choice').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (locked) return;
        attempts++;
        if (Number(btn.dataset.v) === q.answer) {
          locked = true;
          btn.classList.add('right');
          body.querySelectorAll<HTMLButtonElement>('.choice').forEach((b) => (b.disabled = b !== btn));
          sound.play('correct');
          recordAnswer(q.type, attempts);
          solved++;
          paintProgress();
          progress.children[solved - 1]?.classList.add('pop');
          later(nextQuestion, 900);
        } else {
          btn.classList.add('wrong');
          btn.disabled = true;
          sound.play('oops');
          showHint(q);
        }
      });
    });
  }

  /** "What did you hear?": the word is said, three pictures, one tap. */
  function englishQuestion(eq: NonNullable<ReturnType<typeof englishGateQuestion>>) {
    english = eq;
    current = null;
    let locked = false;
    body.innerHTML = `
      <div class="question"><div class="q-text" dir="ltr" style="font-size:36px;letter-spacing:0">What did you hear?</div></div>
      <div class="choices english-gate">
        ${eq.choices.map((c) => `<button class="choice" data-v="${c}" aria-label="${c}"><img src="${imageUrl(c)}" alt="" draggable="false"></button>`).join('')}
      </div>`;
    void speakWord(eq.say);
    body.querySelectorAll<HTMLButtonElement>('.choice').forEach((btn) =>
      btn.addEventListener('click', () => {
        if (locked) return;
        if (btn.dataset.v === eq.word) {
          locked = true;
          btn.classList.add('right');
          body.querySelectorAll<HTMLButtonElement>('.choice').forEach((b) => (b.disabled = b !== btn));
          sound.play('correct');
          solved++;
          paintProgress();
          progress.children[solved - 1]?.classList.add('pop');
          later(nextQuestion, 900);
        } else {
          btn.classList.add('wrong');
          btn.disabled = true;
          sound.play('oops');
          later(() => void speakWord(eq.say), 500);
        }
      }),
    );
  }

  function showHint(q: Question) {
    const slot = body.querySelector('#hint') as HTMLElement;
    if (q.hint.kind === 'count') {
      body.querySelectorAll<HTMLElement>('.em').forEach((el, i) => {
        later(() => {
          el.classList.add('numbered');
          el.dataset.n = String(i + 1);
        }, i * 350);
      });
      return;
    }
    slot.innerHTML = renderHint(q.hint);
  }

  function finish() {
    sayBtn.style.visibility = 'hidden';
    stopSpeaking();
    sound.play('win');
    body.innerHTML = `<div class="intro"><div class="intro-emoji bounce">🎉</div><h2>יאללה משחקים!</h2></div>`;
    later(() => {
      passed = true;
      onPass();
    }, 1300);
  }

  intro();

  return () => {
    // Left the gate without playing: forget the round that was queued behind it.
    if (!passed) gameStore(gameId).save('queued', null);
    dead = true;
    timers.forEach(clearTimeout);
    stopSpeaking();
  };
}
