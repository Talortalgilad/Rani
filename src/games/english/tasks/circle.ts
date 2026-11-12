import { judgeLasso, type Pt, type Target } from '../engine/lasso';
import { itemSvg } from '../art/items';
import { artKey } from '../content/words';
import { en } from '../content/lines';
import { SPOTS3, el, pictureButton, place, shuffled, showSolution, type TaskEnv, type TaskHandle } from './common';

/** "Circle the ball!": the finger draws a thick marker line; a forgiving loop round the right picture works. */
export function circleTask(env: TaskEnv, rightId: string, ids: string[], seed = 1): TaskHandle {
  const order = shuffled(ids, seed);
  const pics = new Map<string, HTMLElement>();
  order.forEach((id, i) => {
    const b = pictureButton(env.stage, itemSvg(artKey(id)), id, 'pic floaty');
    b.tabIndex = -1;
    place(b, SPOTS3[i % 3]);
    pics.set(id, b);
  });
  const canvas = el('canvas', 'draw-layer', env.stage);
  const ctx = canvas.getContext('2d')!;
  let pts: Pt[] = [];
  let drawing = false;
  let locked = false;
  const resize = (): void => {
    const r = env.stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  const stroke = (color = '#ff3d8b'): void => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (pts.length < 2) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(58,47,75,.28)';
    ctx.lineWidth = 16;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x + 2, p.y + 3) : ctx.moveTo(p.x + 2, p.y + 3)));
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 11;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x - 1.5, p.y - 2) : ctx.moveTo(p.x - 1.5, p.y - 2)));
    ctx.stroke();
  };
  const targets = (): Target[] => {
    const sr = env.stage.getBoundingClientRect();
    return [...pics.entries()].map(([id, e]) => {
      const r = e.getBoundingClientRect();
      return { id, x: r.left - sr.left + r.width / 2, y: r.top - sr.top + r.height / 2, r: Math.min(r.width, r.height) * 0.42 };
    });
  };
  const local = (e: PointerEvent): Pt => {
    const r = env.stage.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: PointerEvent): void => {
    if (locked) return;
    drawing = true;
    pts = [local(e)];
    canvas.setPointerCapture(e.pointerId);
    stroke();
  };
  const move = (e: PointerEvent): void => {
    if (!drawing) return;
    pts.push(local(e));
    stroke();
  };
  const up = async (): Promise<void> => {
    if (!drawing) return;
    drawing = false;
    if (pts.length < 6) return (pts = []), stroke();
    const res = judgeLasso(pts, targets(), rightId);
    if (res.ok) {
      locked = true;
      stroke('#3fb56b');
      const t = targets().find((x) => x.id === rightId)!;
      env.sound('correct');
      env.face('dance');
      for (let k = 0; k < 6; k++) window.setTimeout(() => env.sparkle(t.x + (Math.random() - 0.5) * 90, t.y + (Math.random() - 0.5) * 90), k * 70);
      pics.get(rightId)!.classList.add('win');
      window.setTimeout(() => env.done(), 1300);
      return;
    }
    const n = env.mistake();
    env.sound('oops');
    env.face('encourage', 'Hmm, try again!');
    env.say(en.tryAgain);
    window.setTimeout(() => {
      pts = [];
      stroke();
    }, 650);
    if (n >= 3) {
      locked = true;
      env.face('thinking', 'אני אראה לך!');
      pts = [];
      stroke();
      await showSolution(env.stage, pics.get(rightId)!);
      env.done();
    } else if (n >= 2) pics.get(rightId)!.classList.add('glint');
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  const ro = new ResizeObserver(resize);
  ro.observe(env.stage);
  return { repeat: () => env.say(en.circle(rightId)), destroy: () => (ro.disconnect(), canvas.remove(), pics.forEach((e) => e.remove())) };
}
