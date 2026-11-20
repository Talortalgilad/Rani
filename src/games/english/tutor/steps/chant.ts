import { esc } from '../../ui/text';
import { currentClip } from '../audio';
import type { StepRun } from '../shell';
import { playTutor } from '../audio';

let ac: AudioContext | null = null;
/** A simple drum of Web Audio: a low thump on the beat, a light tick between. */
function drum(strong: boolean): void {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ac ??= new AC();
    const t = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(strong ? 150 : 260, t);
    o.frequency.exponentialRampToValueAtTime(strong ? 55 : 120, t + 0.12);
    g.gain.setValueAtTime(strong ? 0.35 : 0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + 0.2);
  } catch {
    /* no drum */
  }
}

/**
 * chant: a rhyme. A drum keeps the beat, the clip plays, and its lines light up like karaoke (each line gets the time of its letters). Rani claps (taps) on the beat.
 * No score. At the end: "Do you want to hear it again?".
 */
export const chant: StepRun = async (sh, step) => {
  const clip = String(step.clip);
  const lines = (step.lines as string[]) ?? [];
  await sh.say('t_chant_intro', { look: 'happy' });
  let again = true;
  while (again) {
    const c = sh.clear();
    c.innerHTML = `<div class="tutor-chant">${lines.map((l, i) => `<div class="tutor-line" data-i="${i}" dir="ltr">${esc(l)}</div>`).join('')}</div><button class="tutor-clap" type="button" aria-label="👏">👏</button>`;
    const els = [...c.querySelectorAll<HTMLElement>('.tutor-line')];
    const clap = c.querySelector<HTMLButtonElement>('.tutor-clap')!;
    clap.addEventListener('pointerdown', () => {
      drum(true);
      sh.lolly.set('clap');
      clap.classList.remove('hit');
      void clap.offsetWidth;
      clap.classList.add('hit');
      window.setTimeout(() => sh.lolly.set('idle'), 220);
    });
    sh.bubble('', 'en');
    sh.lolly.set('idle');
    // the beat: every 0.5 s, the strong one every four
    let beat = 0;
    const metro = window.setInterval(() => drum(beat++ % 4 === 0), 500);
    const weights = lines.map((l) => Math.max(1, l.replace(/[^A-Za-z]/g, '').length));
    const total = weights.reduce((a, b) => a + b, 0);
    // the lines are lit by the time of the recording (its currentTime over its duration, shared by the letters of each line); with no recording, by a guess
    const before = currentClip();
    const p = playTutor(clip);
    let over = false;
    void p.then(() => (over = true));
    const t0 = Date.now();
    const loop = (): void => {
      if (over) return;
      const cur = currentClip();
      const a = cur !== before ? cur : null;
      const dur = a && Number.isFinite(a.duration) && a.duration > 0 ? a.duration : lines.length * 2.6;
      const t = a && Number.isFinite(a.duration) && a.duration > 0 ? a.currentTime : (Date.now() - t0) / 1000;
      let at = 0;
      let idx = -1;
      weights.forEach((w, i) => {
        if (t >= at - 0.02) idx = i;
        at += (dur * w) / total;
      });
      els.forEach((e, j) => e.classList.toggle('on', j === idx));
      requestAnimationFrame(loop);
    };
    loop();
    await p;
    window.clearInterval(metro);
    els.forEach((e) => e.classList.remove('on'));
    await sh.say('t_chant_again', { look: 'happy' });
    again = await new Promise<boolean>((res) => {
      const row = document.createElement('div');
      row.className = 'tutor-yesno';
      row.innerHTML = '<button type="button" class="tutor-next" data-a="1"><span>שוב</span> <b>🔁</b></button><button type="button" class="tutor-next" data-a="0"><span>הלאה</span> <b>➜</b></button>';
      row.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => res((b as HTMLElement).dataset.a === '1')));
      sh.stage.appendChild(row);
    });
  }
};
