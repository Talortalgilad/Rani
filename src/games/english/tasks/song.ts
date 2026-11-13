import { itemImg } from '../art/images';
import { SONGS, type Song } from '../content/songs';
import { el, type TaskEnv, type TaskHandle } from './common';

/** Beats per second of a song, and how many milliseconds a word takes. */
export const beatMs = (bpm: number): number => Math.round(60000 / bpm);

/** The timeline of a song: when (ms from the start) each word is said. One beat per word, a rest of one beat between lines. */
export function timeline(song: Song): { line: number; word: number; at: number }[] {
  const beat = beatMs(song.bpm);
  const out: { line: number; word: number; at: number }[] = [];
  let t = beat; // a beat of count-in
  song.lines.forEach((line, li) => {
    line.forEach((_, wi) => {
      out.push({ line: li, word: wi, at: t });
      t += beat;
    });
    t += beat;
  });
  return out;
}

/**
 * The song of a world: a chant on a steady beat. The line is shown, each word lights up when it is said, the picture of a word
 * hops (and can be tapped), and a drum ticks on every beat. Nothing can go wrong, so there is no score.
 */
export function songTask(env: TaskEnv, world: number): TaskHandle {
  const song = SONGS[world];
  const wrap = el('div', 'song', env.stage);
  const lineEl = el('div', 'song-line', wrap);
  const pics = el('div', 'song-pics', wrap);
  const title = el('div', 'song-title', wrap);
  title.textContent = `♪ ${song.title} ♪`;
  const timers: number[] = [];
  const beat = beatMs(song.bpm);
  const shown = new Map<string, HTMLElement>();
  const tl = timeline(song);
  let current = -1;
  const showLine = (li: number): void => {
    lineEl.innerHTML = '';
    pics.innerHTML = '';
    shown.clear();
    song.lines[li].forEach((w, wi) => {
      const s = el('span', 'song-word', lineEl);
      s.textContent = w.t;
      s.dataset.i = String(wi);
      if (w.pic) {
        const p = el('button', 'pic small song-pic', pics);
        p.type = 'button';
        p.innerHTML = itemImg(w.pic);
        p.addEventListener('click', () => {
          p.classList.add('hop');
          window.setTimeout(() => p.classList.remove('hop'), 500);
          env.sound('pop', 600);
        });
        shown.set(`${wi}`, p);
      }
    });
  };
  const total = tl[tl.length - 1].at + beat * 2;
  tl.forEach((e) => {
    timers.push(
      window.setTimeout(() => {
        if (e.line !== current) {
          current = e.line;
          showLine(e.line);
          env.face('happy');
        }
        lineEl.querySelectorAll('.song-word').forEach((x) => x.classList.remove('on'));
        const wordEl = lineEl.querySelector(`.song-word[data-i="${e.word}"]`);
        wordEl?.classList.add('on');
        const pic = shown.get(String(e.word));
        if (pic) {
          pic.classList.add('hop', 'lit');
          window.setTimeout(() => pic.classList.remove('hop', 'lit'), beat);
        }
        env.sound('tick', e.word === 0 ? 300 : 220);
        env.say(song.lines[e.line][e.word].t.replace(/[,!]/g, ''), true);
        if (/clap/i.test(song.lines[e.line][e.word].t)) env.face('dance');
      }, e.at),
    );
  });
  timers.push(window.setTimeout(() => (env.face('dance', 'כל הכבוד!'), env.sayHe('great')), total - beat));
  timers.push(window.setTimeout(() => env.done(), total + 800));
  lineEl.textContent = 'Let’s sing!';
  return { repeat: () => undefined, destroy: () => (timers.forEach(clearTimeout), wrap.remove()) };
}
