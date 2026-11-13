import { el, shuffled, type TaskEnv, type TaskHandle } from '../../tasks/common';
import { toyLetter } from '../ui/glyph';

/** Places on a grid, with a little shake, so that letters never overlap. */
export function huntSpots(n: number, cols = 3, seed = 1): [number, number][] {
  const rows = Math.ceil(n / cols);
  const cells = shuffled(Array.from({ length: cols * rows }, (_, i) => i), seed).slice(0, n);
  let s = seed || 1;
  // a small shake inside the cell (a quarter of its free space at most), so that two tap areas can never touch
  const jit = (): number => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5) * 0.04;
  return cells.map((c) => [((c % cols) + 0.5) / cols + jit(), (Math.floor(c / cols) + 0.5) / rows + jit()]);
}

/** "Find all the S!": letters scattered in capitals and small ones, only the ones she has learned; she taps every S (both shapes). */
export function huntTask(env: TaskEnv, letterId: string, pool: string[], seed = 8): TaskHandle {
  const layer = el('div', 'hunt', env.stage);
  const targets = 3 + (seed % 2);
  const others = pool.filter((l) => l !== letterId);
  const items: { ch: string; target: boolean }[] = [];
  for (let i = 0; i < targets; i++) items.push({ ch: i % 2 ? letterId.toUpperCase() : letterId, target: true });
  for (let i = 0; i < 12 - targets; i++) {
    const l = others[(i + seed) % others.length];
    items.push({ ch: i % 3 === 0 ? l.toUpperCase() : l, target: false });
  }
  const order = shuffled(items, seed);
  const spots = huntSpots(order.length, 3, seed);
  let found = 0;
  let locked = false;
  let dead = false;
  order.forEach((it, i) => {
    const b = el('button', 'hunt-tile', layer);
    b.type = 'button';
    b.setAttribute('aria-label', it.ch);
    b.innerHTML = toyLetter(it.ch);
    b.style.left = `${spots[i][0] * 100}%`;
    b.style.top = `${spots[i][1] * 100}%`;
    b.addEventListener('click', () => {
      if (locked || b.classList.contains('got')) return;
      if (it.target) {
        b.classList.add('got');
        found++;
        env.sound('pop', 480 + found * 80);
        const s = env.stage.getBoundingClientRect();
        const r = b.getBoundingClientRect();
        env.sparkle(r.left - s.left + r.width / 2, r.top - s.top + r.height / 2);
        if (found === targets) {
          locked = true;
          env.face('dance');
          env.sayLetter(letterId);
          window.setTimeout(() => !dead && env.done(), 1400);
        }
      } else {
        b.classList.remove('shake');
        void b.offsetWidth;
        b.classList.add('shake');
        env.mistake();
        env.sound('oops');
        env.face('cheer', 'Hmm, try again!');
      }
    });
  });
  return { repeat: () => env.say(`Find all the ${letterId.toUpperCase()}!`), destroy: () => ((dead = true), layer.remove()) };
}
