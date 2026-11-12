import { itemImg } from '../art/images';
import { labelOf } from '../content/words';
import { el, pictureButton, shuffled, type TaskEnv, type TaskHandle } from './common';

/**
 * "Listen and match": the word is said by itself, three pictures, she taps the right one: it flies into the basket with a sound,
 * and at once the next word is said (3 or 4 words). One big speaker repeats the word that is asked now. No lines, no small speakers.
 */
export function matchListenTask(env: TaskEnv, ids: string[], pool: string[] = [], seed = 4): TaskHandle {
  const speaker = el('button', 'big-speaker', env.stage);
  speaker.type = 'button';
  speaker.textContent = '🔊';
  speaker.setAttribute('aria-label', 'שמעי שוב');
  const row = el('div', 'choice-row mid', env.stage);
  const basket = el('div', 'basket', env.stage);
  basket.textContent = '🧺';
  const order = shuffled(ids, seed);
  let round = 0;
  let dead = false;
  let locked = true;
  let current = order[0];
  let timer = 0;
  const say = (): void => env.say(labelOf(current), true);

  const start = (): void => {
    if (dead) return;
    current = order[round];
    row.innerHTML = '';
    // the pictures of this round: the asked word and two others (words she has not matched yet come first, the world's own words fill up)
    const rest = order.filter((x) => x !== current);
    const filler = pool.filter((x) => !order.includes(x));
    const others = shuffled([...rest.slice(round), ...filler, ...rest.slice(0, round)], seed + round).filter((x) => x !== current).slice(0, 2);
    let mistakes = 0;
    const pics = new Map<string, HTMLButtonElement>();
    shuffled([current, ...others], seed + round * 7).forEach((id) => {
      const b = pictureButton(row, itemImg(id), id, 'pic en-choice');
      pics.set(id, b);
      b.addEventListener('click', () => {
        if (locked) return;
        if (id === current) {
          locked = true;
          env.sound('correct');
          env.face('dance');
          const r = b.getBoundingClientRect();
          const t = basket.getBoundingClientRect();
          b.classList.add('flying');
          b.style.translate = `${t.left + t.width / 2 - (r.left + r.width / 2)}px ${t.top + t.height / 2 - (r.top + r.height / 2)}px`;
          b.style.scale = '0.25';
          window.setTimeout(() => !dead && (env.sound('pop', 640), basket.classList.add('got')), 450);
          window.setTimeout(() => basket.classList.remove('got'), 900);
          round += 1;
          timer = window.setTimeout(() => {
            if (dead) return;
            if (round >= order.length) env.done();
            else (locked = false), start();
          }, 1000);
        } else {
          b.classList.remove('shake');
          void b.offsetWidth;
          b.classList.add('shake');
          mistakes = env.mistake();
          env.sound('oops');
          env.face('cheer', 'Hmm, try again!');
          timer = window.setTimeout(say, 500);
          if (mistakes >= 2) pics.get(current)!.classList.add('glint');
        }
      });
    });
    locked = false;
    timer = window.setTimeout(say, 450);
  };
  speaker.addEventListener('click', () => !locked && say());
  start();
  return { repeat: say, destroy: () => ((dead = true), window.clearTimeout(timer), speaker.remove(), row.remove(), basket.remove()) };
}

/**
 * "Match!" with written words (from world 3): the words are in a column, the pictures are dragged onto their word. A tap on a
 * written word says it (the first step to reading). A wrong drop slides back; after three mistakes the rest are placed for her.
 */
export function matchDragTask(env: TaskEnv, ids: string[], seed = 4): TaskHandle {
  const left = el('div', 'match-col pics', env.stage);
  const right = el('div', 'match-col words', env.stage);
  const pics = new Map<string, HTMLButtonElement>();
  const words = new Map<string, HTMLButtonElement>();
  const joined = new Set<string>();
  let locked = false;
  let dead = false;
  ids.forEach((id) => pics.set(id, pictureButton(left, itemImg(id), id, 'pic match-pic')));
  shuffled(ids, seed).forEach((id) => {
    const w = el('button', 'match-word', right);
    w.type = 'button';
    w.textContent = labelOf(id);
    words.set(id, w);
    w.addEventListener('click', () => env.say(labelOf(id), true));
  });
  const place = (id: string): void => {
    joined.add(id);
    const p = pics.get(id)!;
    const w = words.get(id)!;
    const pr = p.getBoundingClientRect();
    const wr = w.getBoundingClientRect();
    p.style.translate = `${wr.left - pr.right + 8}px ${wr.top + wr.height / 2 - (pr.top + pr.height / 2)}px`;
    p.classList.add('win', 'placed');
    w.classList.add('joined');
    env.sound('correct');
    env.say(labelOf(id), true);
    const s = env.stage.getBoundingClientRect();
    env.sparkle(wr.left - s.left + wr.width / 2, wr.top - s.top + wr.height / 2);
    if (joined.size === ids.length) {
      env.face('dance');
      window.setTimeout(() => !dead && env.done(), 1200);
    } else env.face('happy');
  };
  ids.forEach((id) => {
    const p = pics.get(id)!;
    let start: { x: number; y: number } | null = null;
    p.addEventListener('pointerdown', (e) => {
      if (locked || joined.has(id)) return;
      p.setPointerCapture(e.pointerId);
      start = { x: e.clientX, y: e.clientY };
      p.classList.add('dragging');
      env.say(labelOf(id), true);
    });
    p.addEventListener('pointermove', (e) => {
      if (start) p.style.translate = `${e.clientX - start.x}px ${e.clientY - start.y}px`;
    });
    const drop = (e: PointerEvent): void => {
      if (!start) return;
      start = null;
      p.classList.remove('dragging');
      p.releasePointerCapture?.(e.pointerId);
      const r = p.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const hit = [...words.entries()].find(([, w]) => {
        const b = w.getBoundingClientRect();
        return cx > b.left - 12 && cx < b.right + 12 && cy > b.top - 12 && cy < b.bottom + 12;
      });
      if (hit && hit[0] === id) place(id);
      else {
        p.classList.add('slide-back');
        p.style.translate = '0 0';
        window.setTimeout(() => p.classList.remove('slide-back'), 400);
        if (hit) {
          const n = env.mistake();
          env.sound('oops');
          env.face('cheer', 'Hmm, try again!');
          words.get(hit[0])!.classList.add('shake');
          window.setTimeout(() => words.get(hit[0])!.classList.remove('shake'), 500);
          if (n >= 3) {
            locked = true;
            ids.filter((x) => !joined.has(x)).forEach((x, i) => window.setTimeout(() => !dead && place(x), 400 + i * 800));
          }
        }
      }
    };
    p.addEventListener('pointerup', drop);
    p.addEventListener('pointercancel', drop);
  });
  return { repeat: () => env.say('Match!'), destroy: () => ((dead = true), left.remove(), right.remove()) };
}

/** Both kinds of "Match" (the listening one is the default; the written one from world 3). */
export function matchTask(env: TaskEnv, ids: string[], seed = 4, mode: 'audio' | 'written' = 'audio', pool: string[] = []): TaskHandle {
  return mode === 'audio' ? matchListenTask(env, ids, pool, seed) : matchDragTask(env, ids, seed);
}
