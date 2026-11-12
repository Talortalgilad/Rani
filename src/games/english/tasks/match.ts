import { itemSvg } from '../art/items';
import { artKey } from '../content/words';
import { el, pictureButton, shuffled, type TaskEnv, type TaskHandle } from './common';

/**
 * "Match!": pictures on one side, written words on the other. Dragging a line from a picture to a word joins them (or tap a picture,
 * then a word). Tapping a word says it. The written word is the first step to reading, so each tap on it is heard.
 */
export function matchTask(env: TaskEnv, ids: string[], seed = 4): TaskHandle {
  const left = el('div', 'match-col pics', env.stage);
  const right = el('div', 'match-col words', env.stage);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'match-lines');
  env.stage.appendChild(svg);
  const pics = new Map<string, HTMLButtonElement>();
  const words = new Map<string, HTMLButtonElement>();
  ids.forEach((id) => pics.set(id, pictureButton(left, itemSvg(artKey(id)), id, 'pic match-pic')));
  shuffled(ids, seed).forEach((id) => {
    const w = el('button', 'match-word', right);
    w.type = 'button';
    w.textContent = id;
    words.set(id, w);
  });
  const joined = new Set<string>();
  let selected: string | null = null;
  let mistakes = 0;
  const center = (e: HTMLElement, side: 'l' | 'r'): { x: number; y: number } => {
    const s = env.stage.getBoundingClientRect();
    const r = e.getBoundingClientRect();
    return { x: (side === 'r' ? r.right : r.left) - s.left, y: r.top - s.top + r.height / 2 };
  };
  const line = (a: { x: number; y: number }, b: { x: number; y: number }, color: string): SVGLineElement => {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', String(a.x));
    l.setAttribute('y1', String(a.y));
    l.setAttribute('x2', String(b.x));
    l.setAttribute('y2', String(b.y));
    l.setAttribute('stroke', color);
    l.setAttribute('stroke-width', '10');
    l.setAttribute('stroke-linecap', 'round');
    svg.appendChild(l);
    return l;
  };
  let rubber: SVGLineElement | null = null;
  const connect = (picId: string, wordId: string): void => {
    if (picId === wordId) {
      joined.add(picId);
      const a = center(pics.get(picId)!, 'l');
      const b = center(words.get(wordId)!, 'l');
      // the picture is on the left of the screen's right-to-left layout: use the nearer edges
      const pr = pics.get(picId)!.getBoundingClientRect();
      const wr = words.get(wordId)!.getBoundingClientRect();
      const s = env.stage.getBoundingClientRect();
      const from = { x: pr.right - s.left, y: pr.top - s.top + pr.height / 2 };
      const to = { x: wr.left - s.left, y: wr.top - s.top + wr.height / 2 };
      void a;
      void b;
      line(from, to, '#3fb56b');
      pics.get(picId)!.classList.add('win');
      words.get(wordId)!.classList.add('joined');
      env.sound('correct');
      env.say(picId, true);
      env.sparkle((from.x + to.x) / 2, (from.y + to.y) / 2);
      if (joined.size === ids.length) {
        env.face('dance');
        window.setTimeout(() => env.done(), 1200);
      } else env.face('happy');
    } else {
      mistakes = env.mistake();
      env.sound('oops');
      env.face('encourage', 'Hmm, try again!');
      words.get(wordId)!.classList.add('shake');
      window.setTimeout(() => words.get(wordId)!.classList.remove('shake'), 500);
      if (mistakes >= 3) {
        // show the solution: join the rest by themselves
        ids.filter((x) => !joined.has(x)).forEach((x, i) => window.setTimeout(() => connect(x, x), 500 + i * 700));
      }
    }
  };
  ids.forEach((id) => {
    const p = pics.get(id)!;
    p.addEventListener('pointerdown', (e) => {
      if (joined.has(id)) return;
      p.setPointerCapture(e.pointerId);
      selected = id;
      p.classList.add('selected');
      env.say(id, true);
      const s = env.stage.getBoundingClientRect();
      const r = p.getBoundingClientRect();
      rubber = line({ x: r.right - s.left, y: r.top - s.top + r.height / 2 }, { x: e.clientX - s.left, y: e.clientY - s.top }, '#ff3d8b');
    });
    p.addEventListener('pointermove', (e) => {
      if (!rubber) return;
      const s = env.stage.getBoundingClientRect();
      rubber.setAttribute('x2', String(e.clientX - s.left));
      rubber.setAttribute('y2', String(e.clientY - s.top));
    });
    const release = (e: PointerEvent): void => {
      if (!rubber) return;
      rubber.remove();
      rubber = null;
      p.classList.remove('selected');
      const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('.match-word') as HTMLElement | null;
      if (under) {
        const wid = [...words.entries()].find(([, w]) => w === under)?.[0];
        if (wid) {
          connect(id, wid);
          selected = null;
        }
      }
    };
    p.addEventListener('pointerup', release);
    p.addEventListener('pointercancel', release);
  });
  words.forEach((w, wid) =>
    w.addEventListener('click', () => {
      env.say(wid, true);
      if (selected && !joined.has(selected)) {
        const pid = selected;
        selected = null;
        pics.get(pid)!.classList.remove('selected');
        connect(pid, wid);
      }
    }),
  );
  return { repeat: () => env.say('Match!'), destroy: () => (left.remove(), right.remove(), svg.remove()) };
}
