import { el, type TaskEnv, type TaskHandle } from '../../tasks/common';
import { STROKES, isDot, type Pt, type Stroke } from '../strokes';
import { evaluateStroke, resample } from '../trace';
import { toyLetter } from '../ui/glyph';

const NS = 'http://www.w3.org/2000/svg';
type Pass = { mode: 'arrows' | 'dots' | 'faint'; upper: boolean };
/** The four times: the small letter with arrows, with dots only, from a faint shadow, then the capital with arrows (SPEC-letters.md 3.1). */
export const PASSES: Pass[] = [{ mode: 'arrows', upper: false }, { mode: 'dots', upper: false }, { mode: 'faint', upper: false }, { mode: 'arrows', upper: true }];

function node<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
}
const d = (s: Stroke): string => s.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

/**
 * "Write the letter with your finger": one stroke at a time, in order. The stroke to write has an arrow that runs along it (or dots, or
 * only a faint shadow in the later passes); the finger leaves a thick marker line in the colour of the island. A stroke that is not
 * right is wiped and its arrow shows again: no penalty, no counting of mistakes.
 */
export function traceTask(env: TaskEnv, letterId: string, color = '#ff5d9e'): TaskHandle {
  const glyph = STROKES[letterId];
  const box = el('div', 'trace-box', env.stage);
  box.innerHTML = '<div class="ltr-arrow" aria-hidden="true">➜</div>';
  const svg = node('svg', { viewBox: '0 0 100 100', class: 'trace-svg' }, box);
  const guide = node('g', {}, svg);
  const ink = node('g', {}, svg);
  const hand = node('g', {}, svg);
  let pass = 0;
  let si = 0;
  let locked = false;
  let dead = false;
  let drawing: Pt[] | null = null;
  let line: SVGPolylineElement | null = null;
  let anim = 0;
  let failedHere = false;
  const timers: number[] = [];
  const later = (f: () => void, ms: number): void => void timers.push(window.setTimeout(() => !dead && f(), ms));

  const strokes = (): Stroke[] => (PASSES[pass].upper ? glyph.upper : glyph.lower);
  const toBox = (e: PointerEvent): Pt => {
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const q = p.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: q.x, y: q.y };
  };

  /** The arrow that runs along the stroke to write, again and again. */
  function arrow(s: Stroke): void {
    window.clearInterval(anim);
    hand.innerHTML = '';
    const pts = resample(s, 60);
    const tri = node('polygon', { points: '-3.2,-3.6 4.4,0 -3.2,3.6', fill: '#fff', stroke: '#3a2f4b', 'stroke-width': 1.3, 'stroke-linejoin': 'round' }, hand);
    let k = 0;
    const step = (): void => {
      const a = pts[Math.min(pts.length - 1, k)];
      const b = pts[Math.min(pts.length - 1, k + 2)];
      tri.setAttribute('transform', `translate(${a.x} ${a.y}) rotate(${(Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI})`);
      k = (k + 1) % (pts.length + 14); // a pause at the end, then again
    };
    step();
    anim = window.setInterval(step, 34);
  }

  /** What is drawn for the stroke that is to be written now (and the ones that are done keep their ink). */
  function paintGuide(showArrow: boolean): void {
    guide.innerHTML = '';
    hand.innerHTML = '';
    const { mode } = PASSES[pass];
    const all = strokes();
    all.forEach((s, i) => {
      if (mode === 'arrows' || mode === 'faint') node('path', { d: d(s), fill: 'none', stroke: mode === 'faint' ? '#8e5cf0' : '#d9cdf3', 'stroke-width': 11, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: mode === 'faint' ? 0.16 : 0.9, class: mode === 'faint' ? 'faint' : '' }, guide);
      if (mode === 'dots' && i >= si) resample(s, 14).forEach((p) => node('circle', { cx: p.x, cy: p.y, r: 1.9, fill: '#8e5cf0', opacity: 0.8 }, guide));
    });
    // the start of the stroke to write: a numbered dot (all passes but the faint one, where it appears only after a try that failed)
    if (si < all.length && (mode !== 'faint' || showArrow)) {
      const st = all[si][0];
      node('circle', { cx: st.x, cy: st.y, r: 5.2, fill: color, stroke: '#fff', 'stroke-width': 1.5 }, guide);
      const t = node('text', { x: st.x, y: st.y + 2.4, 'text-anchor': 'middle', 'font-size': 7, 'font-weight': 700, fill: '#fff', 'font-family': 'Fredoka, sans-serif' }, guide);
      t.textContent = String(si + 1);
    }
    if (si < all.length && (mode === 'arrows' || showArrow)) arrow(all[si]);
  }

  function nextPass(): void {
    locked = true;
    env.sound('correct');
    env.face('dance');
    const c = svg.getBoundingClientRect();
    const s = env.stage.getBoundingClientRect();
    env.sparkle(c.left - s.left + c.width / 2, c.top - s.top + c.height / 2);
    ink.querySelectorAll('polyline').forEach((p) => p.classList.add('glow'));
    later(() => {
      pass++;
      if (pass >= PASSES.length) {
        // the letter hops and shines: done
        box.classList.add('trace-win');
        ink.innerHTML = '';
        guide.innerHTML = '';
        hand.innerHTML = '';
        box.insertAdjacentHTML('beforeend', `<div class="trace-final">${toyLetter(PASSES[PASSES.length - 1].upper ? letterId.toUpperCase() : letterId)}</div>`);
        env.sayLetter(letterId);
        later(() => env.done(), 1900);
        return;
      }
      si = 0;
      ink.innerHTML = '';
      failedHere = false;
      locked = false;
      paintGuide(false);
      env.sayHe(PASSES[pass].mode === 'arrows' ? 'l_trace_capital' : PASSES[pass].mode === 'dots' ? 'l_trace_dots' : 'l_trace_blur');
    }, 1300);
  }

  const down = (e: PointerEvent): void => {
    if (locked || drawing) return;
    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    drawing = [toBox(e)];
    line = node('polyline', { points: `${drawing[0].x},${drawing[0].y}`, fill: 'none', stroke: color, 'stroke-width': 7.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.92 }, ink);
  };
  const move = (e: PointerEvent): void => {
    if (!drawing || !line) return;
    const p = toBox(e);
    drawing.push(p);
    line.setAttribute('points', drawing.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' '));
  };
  const up = (): void => {
    if (!drawing || !line) return;
    const got = drawing;
    const mine = line;
    drawing = null;
    line = null;
    const target = strokes()[si];
    const r = evaluateStroke(target, got);
    if (r.ok) {
      env.sound('pop', 500 + si * 60);
      if (isDot(target)) {
        // a dot: a round marker where it belongs
        mine.remove();
        node('circle', { cx: target[0].x, cy: target[0].y, r: 4.6, fill: color, opacity: 0.92 }, ink);
      } else mine.setAttribute('points', resample(got, Math.min(got.length, 60)).map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' '));
      si++;
      failedHere = false;
      if (si >= strokes().length) {
        window.clearInterval(anim);
        hand.innerHTML = '';
        nextPass();
      } else paintGuide(false);
    } else {
      // wipe it and show the arrow of this stroke again; nothing is counted against her
      mine.remove();
      env.sound('tick', 260);
      if (!failedHere) (failedHere = true, env.face('thinking', 'נסי שוב, עקבי אחרי החץ'), env.sayHe('l_trace_again'));
      paintGuide(true);
    }
  };
  svg.addEventListener('pointerdown', down);
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
  paintGuide(false);
  return {
    repeat: () => paintGuide(true),
    destroy: () => ((dead = true), window.clearInterval(anim), timers.forEach(clearTimeout), box.remove()),
  };
}
