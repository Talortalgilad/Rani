/**
 * The workshop as a game (SPEC-squishy.md, stage 1: free creation). One screen for each step, with the progress bar of 7 points, and the X on every screen saves the squishy as it is and goes back.
 * Steps: the mold, the spoons (the recipe), the stirring, the pouring and the waiting, the colours and the decorations, the face, the squeeze test, the end (a name and what he likes to eat).
 * The finished squishy is saved as data and goes on the shelf. No orders and no carnival (stages 2 and 3).
 */
import './game.css';
import type { GameContext } from '../types';
import { sound } from '../../sound';
import { imageUrl } from '../english/art/images';
import { COLORS } from '../english/content/colors';
import { CHEEKS, drawCheeks, drawEyes, drawMouth, EYES, MOUTHS } from './faces';
import { JARS, MAX_SPOONS, mixSpoons, nearestColorId } from './mix';
import { partAt, PALETTE, type RGB } from './paint';
import { cleanName, DECORS, DOT_OF, FINISHES, FOODS, isOpen, loadStore, MAX_DECOR, newSquishy, OPEN_MOLDS, STEP_ORDER, type Decor, type DecorKind, type Draft, type Finish, type SquishyData, type StepId, type Store } from './save';
import { fillColors } from './save';
import { sayEn, sayHe, sayNumber } from './sqvoice';
import { gameStore, update } from '../../storage';
import { activeLevel } from '../../math/adaptive';
import { SQUISHIES, squishyUrl } from '../english/art/squishies';
import type { Words } from '../english/engine/progress';
import { CUP, answerAuto, answerGlows, drain, newCup, pourAuto, pourShows, release, rise, showsHand } from './measure';
import { checkOrder, orderById, queue as orderQueue, reward, unlockedMolds, type Learned, type Order } from './orders';
import { makeRecipe, recipeColor, type Recipe } from './recipe';
import { decorAt, drawDecor, drawSquishy, inside } from './squishy';
import { loadShape, shapeInfo, SHAPES, SIZE, type Loaded } from './shapes';
import { setWorkshopBg, SquishView } from './view';

const base = (): string => import.meta.env.BASE_URL;
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const css = (c: RGB): string => `rgb(${c[0]},${c[1]},${c[2]})`;
const shapeUrl = (id: string): string => `${base()}squishy/shapes/${id}.webp`;
const propUrl = (id: string): string => `${base()}squishy/props/${id}.webp`;
const HE_SHAPE: Record<string, string> = { cat: 'חתול', dog: 'כלב', rabbit: 'ארנב', fish: 'דג', bird: 'ציפור', lion: 'אריה', monkey: 'קוף', elephant: 'פיל', giraffe: 'ג׳ירפה', cupcake: 'קאפקייק', donut: 'סופגנייה', icecream: 'גלידה', cookie: 'עוגייה', lollipop: 'סוכרייה', apple: 'תפוח', star: 'כוכב', flower: 'פרח', crown: 'כתר' };
const HE_FINISH: Record<Finish, string> = { gloss: 'מבריק', glitter: 'נצנצים', matte: 'מט' };
const EN_FINISH: Record<Finish, string> = { gloss: 'glossy', glitter: 'glitter', matte: 'matte' };
const NAME_IDEAS = ['פלופי', 'בובו', 'מימי', 'טופי', 'גומי', 'רוקי', 'סוכר', 'לולו'];
const wait = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

export interface Workshop { unmount(): void; pause(): void }

export function createWorkshop(ctx: GameContext): Workshop {
  const root = document.createElement('div');
  root.className = 'sq-game';
  root.innerHTML = '<div class="sq-bg"></div><header class="sqg-top"><button type="button" class="sqg-x" id="sqx" aria-label="סגירה">✕</button><div class="sqg-dots" id="sqd"></div><span class="sqg-spacer"></span></header><button type="button" class="sqg-ocard" id="oc" hidden></button><main class="sqg-body" id="sqb"></main>';
  root.style.setProperty('--sq-bg', `url(${base()}squishy/bg/workshop.webp)`);
  ctx.container.appendChild(root);
  const body = root.querySelector<HTMLElement>('#sqb')!;
  const dots = root.querySelector<HTMLElement>('#sqd')!;
  let dead = false;
  let store: Store = loadStore({ draft: ctx.load<unknown>('draft', null), shelf: ctx.load<unknown>('shelf', []), orders: ctx.load<unknown>('orders', null) });
  /** the order that was chosen and has no squishy yet (it is in the draft from the moment that a mold is chosen) */
  let pending: Order | null = null;
  let view: SquishView | null = null;
  let loaded: Loaded | null = null;
  let onX: () => void = () => ctx.onExit();
  const timers: number[] = [];
  const later = (f: () => void, ms: number): void => void timers.push(window.setTimeout(() => !dead && f(), ms));
  const persist = (): void => {
    ctx.save('draft', store.draft);
    ctx.save('shelf', store.shelf);
    ctx.save('orders', store.orders);
  };
  const say = (id: string): void => void sayHe(id);

  // ---------------------------------------------------------------- the frame of a screen
  const setDots = (n: number): void => {
    dots.hidden = n === 0;
    dots.innerHTML = Array.from({ length: 7 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
  };
  const curOrder = (): Order | null => (store.draft?.orderId ? orderById(store.draft.orderId) ?? null : pending);
  const ocard = root.querySelector<HTMLButtonElement>('#oc')!;
  /** the card of the order: the sentence (never a picture of the result); a tap says it again, at every step */
  const sayOrder = (o: Order): Promise<boolean> => sayEn(o.clip);
  ocard.addEventListener('click', () => {
    const o = curOrder();
    if (o) void sayOrder(o);
  });
  /** the words and colours that Rani learned in the word journey (a parent who opened everything: all) */
  function learned(): Learned {
    const en = gameStore('english');
    const words = en.load<Words>('words', {});
    const map = en.load<{ done: Record<number, number> }>('map', { done: {} });
    const all = en.load<boolean>('openAll', false);
    const d4 = map.done[4] ?? 0;
    const later = Object.entries(map.done).some(([w, n]) => Number(w) > 4 && n > 0) || d4 >= 5;
    const nColors = all || later ? 6 : d4 >= 2 ? 6 : d4 >= 1 ? 3 : 0;
    const known = COLORS.slice(0, nColors).map((c) => c.id);
    return { word: (id) => all || words[id]?.seen === true, color: (id) => all || known.includes(id) };
  }
  const doneCtx = (): { done: string[]; learned: Learned } => ({ done: store.orders.done, learned: learned() });
  function clear(cls = ''): HTMLElement {
    const o = curOrder();
    ocard.hidden = !o;
    if (o) ocard.innerHTML = `<span class="oc-snd" aria-hidden="true">🔊</span><b dir="ltr">${esc(o.text)}</b>`;
    body.className = `sqg-body ${cls} ${o ? 'has-order' : ''}`;
    body.innerHTML = '';
    body.onclick = null;
    return body;
  }
  function killView(): void {
    view?.dispose();
    view = null;
    setWorkshopBg(false, base());
    root.classList.remove('with-view');
  }
  /** the squishy appears on the table (3D or flat): the page is transparent over it */
  async function showView(d: SquishyData, host: HTMLElement): Promise<SquishView> {
    killView();
    root.classList.add('with-view');
    setWorkshopBg(true, base());
    loaded = await loadShape(d.shape);
    if (dead) throw new Error('dead');
    const v = new SquishView({ host });
    view = v;
    v.setLoaded(loaded);
    v.setPaint((g, face, look) => drawSquishy(g, loaded!, d, { face, look }));
    await v.start();
    // the flat view draws on the page: the workshop picture stays as the background of the page
    if (v.flat) root.classList.remove('with-view');
    return v;
  }
  const leaveToMenu = (): void => {
    persist();
    killView();
    menu();
  };

  // ---------------------------------------------------------------- the menu: the workbench
  function menu(): void {
    killView();
    setDots(0);
    onX = () => ctx.onExit();
    const d = store.draft;
    pending = null;
    const waiting = orderQueue(doneCtx());
    const b = clear('menu');
    b.innerHTML = `
      <h1 class="sqg-title" data-say="sq_title">סדנת הסקווישים</h1>
      <div class="sqg-menu">
        ${d ? `<button type="button" class="sqg-big go on" id="mcont" data-say=""><img src="${shapeUrl(d.data.shape)}" alt="" draggable="false"><span>להמשיך את ${d.orderId ? 'ההזמנה' : 'הסקווישי'}</span></button>` : ''}
        <button type="button" class="sqg-big" id="mord" data-say="sq_order_mode"><img src="${propUrl('kiosk')}" alt="" draggable="false"><span>הזמנות</span></button>
        <button type="button" class="sqg-big" id="mnew" data-say="sq_free_mode"><img src="${propUrl('bowl')}" alt="" draggable="false"><span>יצירה חופשית</span></button>
        <button type="button" class="sqg-big" id="mshelf" data-say="sq_shelf"><img src="${propUrl('shelf')}" alt="" draggable="false"><span>המדף שלי</span>${store.shelf.length ? `<b class="sqg-count">${store.shelf.length}</b>` : ''}</button>
      </div>
      <div class="sqg-line" aria-label="הזמנות שמחכות">${waiting.map((o, k) => `<button type="button" class="sqg-wait" data-o="${o.id}" aria-label="הזמנה ${k + 1}"><img src="${squishyUrl(SQUISHIES[(k * 5 + store.orders.done.length) % SQUISHIES.length].id)}" alt="" draggable="false"><span aria-hidden="true">🔊</span></button>`).join('')}</div>`;
    say('sq_title');
    // a tap on a button says its name (the recording); nothing reads itself
    b.querySelectorAll<HTMLElement>('[data-say]').forEach((el) => el.addEventListener('pointerdown', () => el.dataset.say && say(el.dataset.say)));
    b.querySelector('#mnew')!.addEventListener('click', () => {
      sound.play('pop', 640);
      if (store.draft) store.draft = null;
      stepMold();
    });
    b.querySelector('#mord')!.addEventListener('click', () => (sound.play('pop', 640), startOrder(waiting[0])));
    b.querySelectorAll<HTMLButtonElement>('.sqg-wait').forEach((w) => w.addEventListener('click', () => (sound.play('pop', 640), startOrder(waiting.find((o) => o.id === w.dataset.o)!))));
    b.querySelector('#mshelf')!.addEventListener('click', () => (sound.play('pop', 640), shelf()));
    b.querySelector('#mcont')?.addEventListener('click', () => (sound.play('pop', 640), resume()));
  }

  /** an order was chosen from the line: the orderer says it (the card shows the sentence), and the mold is chosen by what she heard */
  function startOrder(o: Order): void {
    pending = o;
    store.draft = null;
    void sayHe('sq_new_order').then(() => sayOrder(o));
    stepMold();
  }

  function resume(): void {
    const d = store.draft;
    if (!d) return stepMold();
    const go: Record<StepId, () => void> = { mold: stepMold, spoons: stepSpoons, mix: stepSpoons, pour: stepMix, paint: stepPaint, face: stepFace, squeeze: stepSqueeze, finish: stepFinish };
    // the stirring and the pouring start again from the recipe that was made; a step with a view starts where it was
    if (d.step === 'pour') return stepPour();
    go[d.step]();
  }
  function setStep(step: StepId): Draft {
    const d = store.draft!;
    d.step = step;
    persist();
    return d;
  }
  const dotsFor = (s: StepId): void => setDots(DOT_OF[s]);

  // ---------------------------------------------------------------- 1. the mold
  function stepMold(): void {
    killView();
    dotsFor('mold');
    onX = leaveToMenu;
    const b = clear('mold');
    b.innerHTML = `<div class="sqg-tray">${SHAPES.map((s) => {
      const open = isOpen(s, unlockedMolds(store.orders.done.length));
      return `<button type="button" class="sqg-mold ${open ? '' : 'locked'}" data-s="${s}" ${open ? '' : 'aria-disabled="true"'} aria-label="${esc(HE_SHAPE[s] ?? s)}"><img src="${shapeUrl(s)}" alt="" draggable="false">${open ? '' : '<i>🔒</i>'}</button>`;
    }).join('')}</div>`;
    say('sq_pick_mold');
    b.querySelectorAll<HTMLButtonElement>('.sqg-mold').forEach((m) =>
      m.addEventListener('click', () => {
        const s = m.dataset.s!;
        if (!isOpen(s, unlockedMolds(store.orders.done.length))) {
          sound.play('pop', 300);
          m.classList.remove('shake');
          void m.offsetWidth;
          m.classList.add('shake');
          return;
        }
        sound.play('bonus');
        const o = curOrder();
        store.draft = { step: 'spoons', data: newSquishy(s), poured: false, squeezes: 0, ...(o ? { orderId: o.id, recipe: makeRecipe(activeLevel(), o.colors[0]) } : {}) };
        pending = null;
        persist();
        stepSpoons();
      }),
    );
  }

  // ---------------------------------------------------------------- 2. the recipe: the spoons
  const total = (d: SquishyData): number => d.spoons.reduce((a, s) => a + s.n, 0);
  /** the layers of the bowl: a stripe for every spoon, in the order of the spoons; p (0..1) is how far they are mixed into one colour */
  function bowlStyle(d: SquishyData, p: number): string {
    const list: RGB[] = [];
    for (const s of d.spoons) for (let i = 0; i < s.n; i++) list.push(JARS.find((j) => j.id === s.id)!.rgb);
    if (!list.length) return 'background: transparent';
    const mixed = mixSpoons(d.spoons);
    const lerp = (c: RGB): string => css([0, 1, 2].map((k) => Math.round(c[k] + (mixed[k] - c[k]) * p)) as RGB);
    const step = 360 / list.length;
    const stops = list.map((c, i) => `${lerp(c)} ${i * step}deg ${(i + 1) * step}deg`).join(',');
    return `background: conic-gradient(from ${Math.round(p * 540)}deg, ${stops})`;
  }
  const bowlHtml = (d: SquishyData, p: number): string => `<div class="sqg-bowl"><img src="${propUrl('bowl')}" alt="" draggable="false"><i class="sqg-fill" style="${bowlStyle(d, p)}"></i></div>`;

  function stepSpoons(): void {
    killView();
    dotsFor('spoons');
    onX = leaveToMenu;
    const d = setStep('spoons').data;
    if (store.draft?.recipe) return stepRecipe(store.draft.recipe, d);
    const b = clear('spoons');
    b.innerHTML = `
      <div class="sqg-bowlbox" id="bb">${bowlHtml(d, 0)}<b class="sqg-n" id="sn"></b></div>
      <div class="sqg-jars">${JARS.map((j) => `<button type="button" class="sqg-jar" data-id="${j.id}" aria-label="${esc(j.he)}"><i style="background:${css(j.rgb)}"></i></button>`).join('')}</div>
      <div class="sqg-actions"><button type="button" class="sqg-round" id="sundo" aria-label="ביטול">↩</button><button type="button" class="sqg-go" id="sready" hidden>✔ ערבבי</button></div>`;
    const paintBowl = (): void => {
      b.querySelector<HTMLElement>('.sqg-fill')!.setAttribute('style', bowlStyle(d, 0));
      const n = total(d);
      b.querySelector<HTMLElement>('#sn')!.textContent = n ? String(n) : '';
      b.querySelector<HTMLElement>('#sready')!.hidden = n < 1;
      b.querySelector<HTMLButtonElement>('#sundo')!.disabled = n < 1;
    };
    paintBowl();
    say('sq_recipe');
    b.querySelectorAll<HTMLButtonElement>('.sqg-jar').forEach((j) =>
      j.addEventListener('click', () => {
        if (total(d) >= MAX_SPOONS) {
          sound.play('pop', 300);
          say('sq_free_spoons_full');
          return;
        }
        const id = j.dataset.id!;
        const e = d.spoons.find((s) => s.id === id);
        if (e) e.n++;
        else d.spoons.push({ id, n: 1 });
        // a spoon flies from the jar to the bowl
        const sp = document.createElement('img');
        sp.className = 'sqg-spoon';
        sp.src = propUrl('spoon');
        const jr = j.getBoundingClientRect(), br = b.querySelector('#bb')!.getBoundingClientRect(), pr = b.getBoundingClientRect();
        sp.style.left = `${jr.left + jr.width / 2 - pr.left - 30}px`;
        sp.style.top = `${jr.top - pr.top - 20}px`;
        b.appendChild(sp);
        sp.animate([{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 }, { transform: `translate(${br.left + br.width / 2 - jr.left - jr.width / 2}px, ${br.top + br.height * 0.3 - jr.top}px) rotate(-30deg)`, opacity: 1 }], { duration: 420, easing: 'ease-in' }).onfinish = () => sp.remove();
        sound.play('pop', 480 + total(d) * 50);
        later(() => {
          paintBowl();
          persist();
          void sayNumber(total(d));
        }, 380);
      }),
    );
    b.querySelector('#sundo')!.addEventListener('click', () => {
      const last = d.spoons[d.spoons.length - 1];
      if (!last) return;
      last.n--;
      if (last.n <= 0) d.spoons.pop();
      sound.play('pop', 300);
      paintBowl();
      persist();
    });
    b.querySelector('#sready')!.addEventListener('click', () => {
      sound.play('bonus');
      d.base = mixSpoons(d.spoons);
      stepMix();
    });
  }

  // ---------------------------------------------------------------- 2b. the stirring: a circle with the finger
  function stepMix(): void {
    killView();
    dotsFor('mix');
    onX = leaveToMenu;
    const d = setStep('mix').data;
    if (!total(d)) return stepSpoons();
    const b = clear('mix');
    b.innerHTML = `<div class="sqg-stir" id="stir">${bowlHtml(d, 0)}<img class="sqg-stirspoon" id="sspoon" src="${propUrl('spoon')}" alt="" draggable="false"><div class="sqg-ring"><i id="sring"></i></div></div>`;
    say('sq_mix');
    const area = b.querySelector<HTMLElement>('#stir')!;
    const fill = b.querySelector<HTMLElement>('.sqg-fill')!;
    const sp = b.querySelector<HTMLElement>('#sspoon')!;
    const ring = b.querySelector<HTMLElement>('#sring')!;
    let last = 0, acc = 0, active = false, done = false;
    const ang = (e: PointerEvent): number => {
      const r = fill.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    };
    area.addEventListener('pointerdown', (e) => { active = true; last = ang(e); try { area.setPointerCapture(e.pointerId); } catch { /* ignore */ } });
    area.addEventListener('pointerup', () => (active = false));
    area.addEventListener('pointercancel', () => (active = false));
    area.addEventListener('pointermove', (e) => {
      const r = area.getBoundingClientRect();
      sp.style.transform = `translate(${e.clientX - r.left - r.width / 2}px, ${e.clientY - r.top - r.height / 2}px) rotate(-25deg)`;
      if (!active || done) return;
      const a = ang(e);
      let da = a - last;
      if (da > Math.PI) da -= Math.PI * 2;
      if (da < -Math.PI) da += Math.PI * 2;
      last = a;
      acc += Math.abs(da);
      const p = Math.min(1, acc / (Math.PI * 4));
      fill.setAttribute('style', bowlStyle(d, p));
      ring.style.width = `${Math.round(p * 100)}%`;
      if (p >= 1) {
        done = true;
        sound.play('bonus');
        say('sq_free_stir_done');
        later(() => stepPour(), 900);
      }
    });
  }

  // ---------------------------------------------------------------- 3. pouring and waiting
  function stepPour(): void {
    killView();
    dotsFor('pour');
    onX = leaveToMenu;
    const d = setStep('pour').data;
    if (!total(d)) return stepSpoons();
    const b = clear('pour');
    const mask = `-webkit-mask-image:url(${shapeUrl(d.shape)});mask-image:url(${shapeUrl(d.shape)})`;
    b.innerHTML = `
      <div class="sqg-pourtray" id="pm"><div class="sqg-cavity" style="${mask}"></div><div class="sqg-lvl" id="plvl" style="${mask};background:${css(d.base)}"></div><div class="sqg-foam" id="pfoam"></div></div>
      <div class="sqg-pourbowl" id="pbowl"><div class="sqg-bowl"><img src="${propUrl('bowl')}" alt="" draggable="false"><i class="sqg-fill" style="background:${css(d.base)}"></i></div></div>`;
    say('sq_pour');
    const bowl = b.querySelector<HTMLElement>('#pbowl')!;
    const mold = b.querySelector<HTMLElement>('#pm')!;
    const lvl = b.querySelector<HTMLElement>('#plvl')!;
    let sx = 0, sy = 0, ox = 0, oy = 0, drag = false, poured = false, misses = 0;
    bowl.addEventListener('pointerdown', (e) => { drag = true; sx = e.clientX - ox; sy = e.clientY - oy; try { bowl.setPointerCapture(e.pointerId); } catch { /* ignore */ } });
    bowl.addEventListener('pointermove', (e) => {
      if (!drag || poured) return;
      ox = e.clientX - sx; oy = e.clientY - sy;
      bowl.style.transform = `translate(${ox}px, ${oy}px)`;
    });
    const release = (): void => {
      drag = false;
      if (poured) return;
      const br = bowl.getBoundingClientRect(), mr = mold.getBoundingClientRect();
      const over = Math.abs(br.left + br.width / 2 - (mr.left + mr.width / 2)) < mr.width * 0.45 && br.bottom > mr.top && br.top < mr.bottom - mr.height * 0.35;
      if (!over) {
        // a drop beside the mold: the bowl goes back and she tries again; after two the mold glows with an arrow, after three the bowl pours by itself (nothing is locked)
        misses++;
        if (pourAuto(misses)) {
          ox += mr.left + mr.width / 2 - (br.left + br.width / 2);
          oy += mr.top + mr.height * 0.3 - (br.top + br.height / 2);
          bowl.style.transition = 'transform .5s';
        } else {
          ox = 0;
          oy = 0;
          bowl.style.transform = '';
          bowl.style.transition = 'transform .3s';
          window.setTimeout(() => (bowl.style.transition = ''), 320);
          if (pourShows(misses)) mold.classList.add('help');
          return;
        }
      }
      poured = true;
      mold.classList.remove('help');
      bowl.style.transition = 'transform .5s';
      bowl.style.transform = `translate(${ox}px, ${oy}px) rotate(-55deg)`;
      sound.play('pop', 360);
      let t = 0;
      const rise = window.setInterval(() => {
        t += 0.06;
        lvl.style.setProperty('--lvl', `${Math.min(100, t * 100)}%`);
        if (t >= 1) {
          window.clearInterval(rise);
          bowl.style.display = 'none';
          foam();
        }
      }, 60);
      timers.push(rise);
    };
    bowl.addEventListener('pointerup', release);
    bowl.addEventListener('pointercancel', release);
    // the foam rises for three seconds, with bubbles; then "tap to take it out"
    function foam(): void {
      say('sq_wait');
      const f = b.querySelector<HTMLElement>('#pfoam')!;
      const t0 = performance.now();
      const bub = window.setInterval(() => {
        const i = document.createElement('i');
        i.style.left = `${20 + Math.random() * 60}%`;
        i.style.bottom = `${15 + Math.random() * 45}%`;
        i.style.width = i.style.height = `${8 + Math.random() * 14}px`;
        f.appendChild(i);
        window.setTimeout(() => i.remove(), 900);
      }, 140);
      timers.push(bub);
      const grow = window.setInterval(() => {
        const p = Math.min(1, (performance.now() - t0) / 3000);
        lvl.style.transform = `scale(${0.88 + 0.14 * p})`;
        if (p >= 1) {
          window.clearInterval(grow);
          window.clearInterval(bub);
          say('sq_pop');
          mold.classList.add('ready');
          mold.addEventListener('click', popOut, { once: true });
        }
      }, 50);
      timers.push(grow);
    }
    function popOut(): void {
      sound.play('unsquish', 420);
      sound.play('bonus');
      mold.classList.add('popped');
      later(() => {
        d.colors = [];
        store.draft!.poured = true;
        stepPaint();
      }, 650);
    }
  }

  // ---------------------------------------------------------------- 4. the colours, the decorations, the finish
  type Snap = { colors: RGB[]; decor: Decor[]; finish: Finish };
  function stepPaint(): void {
    killView();
    dotsFor('paint');
    onX = leaveToMenu;
    const dr = setStep('paint');
    const d = dr.data;
    d.colors = fillColors(d);
    const b = clear('paint');
    let tab: 'color' | 'decor' | 'finish' = 'color';
    let color: RGB = d.base;
    let kind: DecorKind = 'star';
    const history: Snap[] = [];
    const snap = (): void => void history.push({ colors: d.colors.map((c) => [...c] as RGB), decor: d.decor.map((x) => ({ ...x })), finish: d.finish });
    b.innerHTML = `
      <div class="sqg-stage" id="stage"></div>
      <div class="sqg-panel"><div class="sqg-tabs"><button type="button" data-t="color" class="on" aria-label="צבעים">🎨</button><button type="button" data-t="decor" aria-label="קישוטים">⭐</button><button type="button" data-t="finish" aria-label="גימור">✨</button></div><div class="sqg-sub" id="sub"></div>
      <div class="sqg-actions"><button type="button" class="sqg-round" id="pundo" aria-label="ביטול">↩</button><button type="button" class="sqg-go" id="pnext">הבא ➜</button></div></div>`;
    const stage = b.querySelector<HTMLElement>('#stage')!;
    const sub = b.querySelector<HTMLElement>('#sub')!;
    const mkView = async (): Promise<void> => {
      const v = await showView(d, stage);
      v.onTap = (p) => onTap(p);
    };
    // (the view reports taps in pixels of the picture)
    const onTap = (p: { x: number; y: number }): void => {
      if (!loaded) return;
      if (tab === 'color') {
        const part = partAt(loaded.map, SIZE, p.x, p.y, shapeInfo(d.shape).areas);
        if (!part) return;
        snap();
        d.colors[part - 1] = color;
        sound.play('pop', 560);
        view?.bounce();
      } else if (tab === 'decor') {
        const i = decorAt(d.decor, p.x, p.y);
        if (i >= 0) {
          snap();
          d.decor.splice(i, 1);
          sound.play('pop', 300);
        } else if (inside(loaded.map, p.x, p.y) && d.decor.length < MAX_DECOR) {
          snap();
          d.decor.push({ k: kind, x: p.x, y: p.y });
          sound.play('pop', 720);
          view?.bounce();
          // the count of this kind is said aloud
          void sayNumber(d.decor.filter((x) => x.k === kind).length);
        } else return;
      } else return;
      persist();
      view?.invalidate();
      syncUndo();
      if (tab === 'decor') drawSub();
    };
    const syncUndo = (): void => void (b.querySelector<HTMLButtonElement>('#pundo')!.disabled = !history.length);
    const drawSub = (): void => {
      if (tab === 'color') {
        const chips = [{ id: 'mix', rgb: d.base }, ...PALETTE];
        sub.innerHTML = `<div class="sqg-palette">${chips.map((c, i) => `<button type="button" class="${c.rgb === color || (color[0] === c.rgb[0] && color[1] === c.rgb[1] && color[2] === c.rgb[2]) ? 'on' : ''}" data-i="${i}" aria-label="${c.id}" style="background:${css(c.rgb)}">${i === 0 ? '<b>🥣</b>' : ''}</button>`).join('')}</div>`;
        sub.querySelectorAll<HTMLButtonElement>('button').forEach((c) =>
          c.addEventListener('click', () => {
            const i = Number(c.dataset.i);
            color = chips[i].rgb;
            sound.play('pop', 500 + i * 60);
            // each colour is said in English
            if (i > 0) void sayEn(chips[i].id);
            drawSub();
          }),
        );
      } else if (tab === 'decor') {
        sub.innerHTML = `<div class="sqg-kinds">${DECORS.map((k) => `<button type="button" data-k="${k}" class="${k === kind ? 'on' : ''}"><canvas width="56" height="56" data-d="${k}"></canvas></button>`).join('')}<small>${curOrder()?.decor ? `${d.decor.filter((x) => x.k === curOrder()!.decor!.kind).length}/${curOrder()!.decor!.count}` : `${d.decor.length}/${MAX_DECOR}`}</small></div>`;
        sub.querySelectorAll<HTMLCanvasElement>('canvas').forEach((c) => drawDecor(c.getContext('2d')!, c.dataset.d as DecorKind, 28, 28, 18));
        sub.querySelectorAll<HTMLButtonElement>('button').forEach((c) =>
          c.addEventListener('click', () => {
            kind = c.dataset.k as DecorKind;
            sound.play('pop', 600);
            drawSub();
          }),
        );
      } else {
        sub.innerHTML = `<div class="sqg-finish">${FINISHES.map((f) => `<button type="button" data-f="${f}" class="${f === d.finish ? 'on' : ''}">${f === 'glitter' ? `<img src="${propUrl('glitter')}" alt="" draggable="false">` : f === 'gloss' ? '<span>💧</span>' : '<span>🧁</span>'}<b>${HE_FINISH[f]}</b></button>`).join('')}</div>`;
        sub.querySelectorAll<HTMLButtonElement>('button').forEach((c) =>
          c.addEventListener('click', () => {
            const f = c.dataset.f as Finish;
            if (f !== d.finish) snap();
            d.finish = f;
            sound.play('pop', 520);
            void sayEn(EN_FINISH[f]);
            persist();
            view?.invalidate();
            view?.bounce();
            syncUndo();
            drawSub();
          }),
        );
      }
    };
    b.querySelectorAll<HTMLButtonElement>('.sqg-tabs button').forEach((t) =>
      t.addEventListener('click', () => {
        tab = t.dataset.t as typeof tab;
        b.querySelectorAll('.sqg-tabs button').forEach((x) => x.classList.toggle('on', x === t));
        sound.play('pop', 640);
        if (tab === 'decor') say('sq_free_decorate');
        if (tab === 'finish') say('sq_free_finish');
        drawSub();
      }),
    );
    b.querySelector('#pundo')!.addEventListener('click', () => {
      const s = history.pop();
      if (!s) return;
      d.colors = s.colors;
      d.decor = s.decor;
      d.finish = s.finish;
      sound.play('pop', 300);
      persist();
      view?.invalidate();
      syncUndo();
      drawSub();
    });
    b.querySelector('#pnext')!.addEventListener('click', () => {
      sound.play('bonus');
      stepFace();
    });
    drawSub();
    syncUndo();
    say('sq_paint');
    void mkView();
  }

  // ---------------------------------------------------------------- 5. the face
  function stepFace(): void {
    dotsFor('face');
    onX = leaveToMenu;
    const d = setStep('face').data;
    const b = clear('face');
    b.innerHTML = `<div class="sqg-stage" id="stage"></div>
      <div class="sqg-panel"><div class="sqg-faces" id="fr"></div><div class="sqg-actions"><button type="button" class="sqg-go" id="fnext">הבא ➜</button></div></div>`;
    const stage = b.querySelector<HTMLElement>('#stage')!;
    const rows: { key: 'eyes' | 'mouth' | 'cheeks'; he: string; n: number; draw: (g: CanvasRenderingContext2D, i: number) => void }[] = [
      { key: 'eyes', he: 'עיניים', n: EYES, draw: (g, i) => drawEyes(g, 80, 60, 150, i, 'open', { x: 0, y: 0 }) },
      { key: 'mouth', he: 'פה', n: MOUTHS, draw: (g, i) => drawMouth(g, 80, 22, 260, i, 'open') },
      { key: 'cheeks', he: 'לחיים', n: CHEEKS, draw: (g, i) => (i === 0 ? (g.strokeStyle = '#c9b5c2', g.lineWidth = 6, g.lineCap = 'round', g.beginPath(), g.moveTo(50, 30), g.lineTo(110, 90), g.moveTo(110, 30), g.lineTo(50, 90), g.stroke()) : (drawEyes(g, 80, 42, 100, 0, 'open', { x: 0, y: 0 }), drawCheeks(g, 80, 56, 100, i))) },
    ];
    let ftab = 0;
    const fr = b.querySelector<HTMLElement>('#fr')!;
    const drawRows = (): void => {
      const r = rows[ftab];
      fr.innerHTML = `<div class="sqg-ftabs">${rows.map((x, i) => `<button type="button" data-t="${i}" class="${i === ftab ? 'on' : ''}">${x.he}</button>`).join('')}</div><div class="sqg-fopts">${Array.from({ length: r.n }, (_, i) => `<button type="button" data-i="${i}" class="${d.face[r.key] === i ? 'on' : ''}"><canvas width="160" height="120"></canvas></button>`).join('')}</div>`;
      fr.querySelectorAll<HTMLButtonElement>('.sqg-ftabs button').forEach((t) => t.addEventListener('click', () => ((ftab = Number(t.dataset.t)), sound.play('pop', 640), drawRows())));
      fr.querySelectorAll<HTMLButtonElement>('.sqg-fopts button').forEach((btn, i) => {
        const g = btn.querySelector('canvas')!.getContext('2d')!;
        r.draw(g, i);
        btn.addEventListener('click', () => {
          d.face[r.key] = i;
          sound.play('pop', 560 + i * 40);
          persist();
          view?.invalidate();
          view?.bounce();
          drawRows();
        });
      });
    };
    drawRows();
    say('sq_face');
    b.querySelector('#fnext')!.addEventListener('click', () => (sound.play('bonus'), stepSqueeze()));
    void showView(d, stage);
  }

  // ---------------------------------------------------------------- 6. the squeeze test
  function stepSqueeze(): void {
    dotsFor('squeeze');
    onX = leaveToMenu;
    const d = setStep('squeeze').data;
    const b = clear('squeeze');
    b.innerHTML = `<div class="sqg-stage" id="stage"></div><div class="sqg-panel"><div class="sqg-meter" id="meter"><span>מעכי!</span><i></i><i></i><i></i><i></i><i></i></div><div class="sqg-actions"><button type="button" class="sqg-go" id="snext" hidden>הבא ➜</button></div></div>`;
    const stage = b.querySelector<HTMLElement>('#stage')!;
    say('sq_squeeze');
    const start = async (): Promise<void> => {
      const v = await showView(d, stage);
      v.setMode('squeeze');
      v.onSqueeze = (n) => {
        b.querySelectorAll('#meter i').forEach((el, i) => el.classList.toggle('on', i < Math.min(5, n)));
        if (n === 5) {
          sound.play('bonus');
          say('sq_so_soft');
          b.querySelector<HTMLElement>('#snext')!.hidden = false;
        }
      };
    };
    void start();
    b.querySelector('#snext')!.addEventListener('click', () => (sound.play('bonus'), view?.setMode('idle'), stepFinish()));
  }

  // ---------------------------------------------------------------- 7. the end: a name, what he likes to eat, the shelf
  function stepFinish(): void {
    if (store.draft?.orderId) return stepCheck(store.draft.data, orderById(store.draft.orderId)!);
    dotsFor('finish');
    onX = leaveToMenu;
    const dr = setStep('finish');
    const d = dr.data;
    const b = clear('finish');
    b.innerHTML = `<div class="sqg-stage small" id="stage"></div><div class="sqg-panel" id="fp"></div>`;
    const fp = b.querySelector<HTMLElement>('#fp')!;
    const stage = b.querySelector<HTMLElement>('#stage')!;
    void (async () => {
      const v = await showView(d, stage);
      v.onTap = () => (v.bounce(), sound.play('pop', 640));
    })();
    const name = (): void => {
      say('sq_name');
      fp.innerHTML = `<input id="nm" class="sqg-name" maxlength="12" autocomplete="off" aria-label="שם" value="${esc(d.name)}"><div class="sqg-ideas">${NAME_IDEAS.map((n) => `<button type="button">${n}</button>`).join('')}</div><div class="sqg-actions"><button type="button" class="sqg-go" id="nok">אישור ✔</button></div>`;
      const inp = fp.querySelector<HTMLInputElement>('#nm')!;
      fp.querySelectorAll<HTMLButtonElement>('.sqg-ideas button').forEach((x) => x.addEventListener('click', () => ((inp.value = x.textContent!), sound.play('pop', 600))));
      const ok = (): void => {
        // an empty name is never a lock: the first of the ideas is taken
        const n = cleanName(inp.value) || NAME_IDEAS[0];
        d.name = n;
        persist();
        sound.play('bonus');
        food();
      };
      fp.querySelector('#nok')!.addEventListener('click', ok);
      inp.addEventListener('keydown', (e) => e.key === 'Enter' && ok());
    };
    const food = (): void => {
      say('sq_what_likes');
      fp.innerHTML = `<div class="sqg-foods">${FOODS.map((f) => `<button type="button" data-f="${f}" class="${d.food === f ? 'on' : ''}"><img src="${shapeUrl(f)}" alt="" draggable="false"></button>`).join('')}</div><div class="sqg-actions"><button type="button" class="sqg-go" id="fok" ${d.food ? '' : 'hidden'}>✔ זה האהוב עליו</button></div>`;
      fp.querySelectorAll<HTMLButtonElement>('.sqg-foods button').forEach((x) =>
        x.addEventListener('click', () => {
          d.food = x.dataset.f!;
          sound.play('pop', 640);
          void sayEn(d.food);
          fp.querySelectorAll('.sqg-foods button').forEach((y) => y.classList.toggle('on', y === x));
          fp.querySelector<HTMLElement>('#fok')!.hidden = false;
        }),
      );
      fp.querySelector('#fok')!.addEventListener('click', done);
    };
    const done = (): void => {
      // his favourite colour is the colour of his biggest part
      const areas = shapeInfo(d.shape).areas;
      const big = areas.indexOf(Math.max(...areas));
      d.fav = nearestColorId(fillColors(d)[big]);
      d.created = Date.now();
      store.shelf = [d, ...store.shelf.filter((s) => s.id !== d.id)];
      store.draft = null;
      persist();
      sound.play('fanfare');
      view?.bounce();
      fp.innerHTML = `<div class="sqg-done"><b>${esc(d.name)}</b><span>הסקווישי מוכן! שמרנו אותו על המדף.</span></div><div class="sqg-actions"><button type="button" class="sqg-go" id="dshelf">🪵 המדף שלי</button><button type="button" class="sqg-go alt" id="dnew">עוד סקווישי</button></div>`;
      void sayHe('sq_done').then(() => sayHe('sq_to_shelf'));
      onX = menu;
      fp.querySelector('#dshelf')!.addEventListener('click', () => (sound.play('pop', 640), shelf()));
      fp.querySelector('#dnew')!.addEventListener('click', () => (sound.play('pop', 640), stepMold()));
    };
    name();
  }

  // ---------------------------------------------------------------- order mode: the recipe (SPEC-squishy.md 2.3)
  const jarOf = (id: string): RGB => JARS.find((j) => j.id === id)!.rgb;
  const heName = (id: string): string => JARS.find((j) => j.id === id)?.he ?? id;
  function stepRecipe(rec: Recipe, d: SquishyData): void {
    killView();
    dotsFor('spoons');
    onX = leaveToMenu;
    const b = clear('recipe');
    const finish = (spoons: { id: string; n: number }[]): void => {
      d.spoons = spoons;
      d.base = recipeColor(rec);
      persist();
      sound.play('bonus');
      stepMix();
    };
    say('sq_recipe');
    if (rec.kind === 'spoons') {
      const want = [{ id: rec.color, n: rec.n }, ...(rec.white ? [{ id: 'white', n: rec.white }] : [])];
      const have: Record<string, number> = {};
      b.innerHTML = `<div class="sqg-want">${want.map((w) => `<span class="sqg-chip"><i style="background:${css(jarOf(w.id))}"></i><b>${w.n}</b></span>`).join('<em>+</em>')}</div>
        <div class="sqg-bowlbox" id="bb">${bowlHtml({ ...d, spoons: [] }, 0)}</div>
        <div class="sqg-jars two">${want.map((w) => `<button type="button" class="sqg-jar" data-id="${w.id}" aria-label="${esc(heName(w.id))}"><i style="background:${css(jarOf(w.id))}"></i><b class="cnt">0/${w.n}</b></button>`).join('')}</div>
        <div class="sqg-ask" id="ask" hidden><p>כמה כפות יש בקערה ביחד?</p><div class="sqg-choices">${rec.choices.map((c) => `<button type="button" data-c="${c}">${c}</button>`).join('')}</div></div>`;
      const fill = b.querySelector<HTMLElement>('.sqg-fill')!;
      const paint = (): void => fill.setAttribute('style', bowlStyle({ ...d, spoons: Object.entries(have).map(([id, n]) => ({ id, n })) }, 0));
      b.querySelectorAll<HTMLButtonElement>('.sqg-jar').forEach((j) =>
        j.addEventListener('click', () => {
          const id = j.dataset.id!;
          const w = want.find((x) => x.id === id)!;
          if ((have[id] ?? 0) >= w.n) return void sound.play('pop', 300);
          have[id] = (have[id] ?? 0) + 1;
          j.querySelector('.cnt')!.textContent = `${have[id]}/${w.n}`;
          sound.play('pop', 480 + have[id] * 60);
          void sayNumber(have[id]);
          paint();
          if (want.every((x) => (have[x.id] ?? 0) >= x.n)) {
            later(() => {
              b.querySelector<HTMLElement>('#ask')!.hidden = false;
              say('sq_spoons_total');
            }, 900);
          }
        }),
      );
      // the answer: no penalty and nothing locked. A mistake counts the spoons aloud; after two the right one glows; after three it is chosen for her
      let wrong = 0;
      const right = (c: HTMLElement): void => {
        c.classList.add('right');
        void sayHe('sq_exact');
        later(() => finish(want.map((x) => ({ id: x.id, n: x.n }))), 900);
      };
      const choices = [...b.querySelectorAll<HTMLButtonElement>('.sqg-choices button')];
      choices.forEach((c) =>
        c.addEventListener('click', () => {
          if (Number(c.dataset.c) === rec.total) return right(c);
          wrong++;
          c.classList.add('shake');
          window.setTimeout(() => c.classList.remove('shake'), 400);
          void sayHe('cv_almost').then(async () => { for (let n = 1; n <= Math.min(10, rec.total); n++) { if (dead) return; await sayNumber(n); } });
          const rc = choices.find((x) => Number(x.dataset.c) === rec.total)!;
          if (answerGlows(wrong)) rc.classList.add('glow');
          if (answerAuto(wrong)) later(() => right(rc), 1200);
        }),
      );
      return;
    }
    // the measuring cup (and half and half): hold the tap, let go at the line. The water rises slowly, too little keeps the water where it is, too much is drained a unit at a time, and
    // there is no "wrong": after one mistake a hand shows the line, after two the water stops on the line by itself (measure.ts)
    const stages = rec.kind === 'cup' ? [{ id: rec.color, line: rec.line }] : [{ id: rec.color, line: 5 }, { id: 'white', line: 5 }];
    const STEP = rec.kind === 'half' ? 0.5 : 1;
    let k = 0;
    const stage = (): void => {
      const st = stages[k];
      const cup = newCup(st.line);
      b.innerHTML = `<div class="sqg-want"><span class="sqg-chip"><i style="background:${css(jarOf(st.id))}"></i><b>${rec.kind === 'cup' ? st.line : '½'}</b></span>${stages.length > 1 ? `<em>${k + 1}/${stages.length}</em>` : ''}</div>
        <div class="sqg-cupbox"><div class="sqg-cup" id="cup"><div class="liq" id="liq" style="background:${css(jarOf(st.id))}"></div>${Array.from({ length: 10 }, (_, i) => `<u class="tick ${i + 1 === st.line ? 'goal' : ''}" style="bottom:${(i + 1) * 9.4}%"><span>${i + 1}</span></u>`).join('')}</div>
        <b class="sqg-goalnum" style="bottom:calc(${st.line * 9.4}% + 6px)">${rec.kind === 'cup' ? st.line : '½'}</b><i class="sqg-hand" id="hand" hidden>👈</i></div>
        <div class="sqg-cupacts"><button type="button" class="sqg-tap" id="tap" aria-label="ברז">🚰</button><button type="button" class="sqg-drain" id="drain" aria-label="ניקוז" hidden>⬇ ננקז</button></div><p class="sqg-hint" id="hint" role="status"></p>`;
      const liq = b.querySelector<HTMLElement>('#liq')!;
      const goal = b.querySelector<HTMLElement>('.tick.goal')!;
      const hint = b.querySelector<HTMLElement>('#hint')!;
      const hand = b.querySelector<HTMLElement>('#hand')!;
      const drainBtn = b.querySelector<HTMLButtonElement>('#drain')!;
      let hold = false, raf = 0, last = 0, done = false, lit = false;
      const draw = (): void => {
        liq.style.height = `${cup.lvl * 9.4}%`;
        // the line lights up when the water is on it (a small sound and a buzz, once each time it arrives)
        const on = Math.abs(cup.lvl - cup.goal) <= CUP.TOL;
        goal.classList.toggle('hit', on);
        if (on && !lit) { sound.play('pop', 880); try { navigator.vibrate?.(20); } catch { /* ignore */ } }
        lit = on;
        drainBtn.hidden = cup.lvl < 0.5;
        hand.hidden = !showsHand(cup);
        if (showsHand(cup)) hand.style.bottom = `calc(${st.line * 9.4}% - 14px)`;
      };
      const finishStage = (): void => {
        done = true;
        cup.lvl = cup.goal;
        draw();
        goal.classList.add('hit');
        sound.play('bonus');
        void sayHe('sq_exact');
        hint.textContent = 'בדיוק!';
        later(() => (++k < stages.length ? stage() : finish(rec.kind === 'cup' ? [{ id: rec.color, n: 3 }] : [{ id: rec.color, n: 1 }, { id: 'white', n: 1 }])), 1000);
      };
      const loop = (t: number): void => {
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.05, (t - last) / 1000);
        last = t;
        if (!hold || done) return;
        const stopped = rise(cup, dt);
        draw();
        // after two mistakes the water stops by itself on the line, even if she goes on pressing
        if (stopped) {
          hold = false;
          cancelAnimationFrame(raf);
          finishStage();
        }
      };
      const tap = b.querySelector<HTMLElement>('#tap')!;
      tap.addEventListener('pointerdown', (e) => {
        if (done) return;
        hold = true;
        hint.textContent = '';
        last = performance.now();
        try { tap.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
      });
      const up = (): void => {
        if (!hold || done) return;
        hold = false;
        cancelAnimationFrame(raf);
        const r = release(cup, STEP);
        draw();
        if (r === 'ok') return finishStage();
        // not yet: the water stays where it is (she presses again and it goes on); too much: a button drains one unit at a time
        if (r === 'toomuch') {
          void sayHe('sq_too_much');
          hint.textContent = 'קצת יותר מדי. בואי ננסה שוב.';
          drainBtn.classList.add('call');
        } else {
          void sayHe('sq_not_enough');
          hint.textContent = 'עוד קצת!';
        }
      };
      tap.addEventListener('pointerup', up);
      tap.addEventListener('pointercancel', up);
      drainBtn.addEventListener('click', () => {
        if (done) return;
        sound.play('pop', 360);
        drain(cup);
        drainBtn.classList.remove('call');
        hint.textContent = cup.lvl > cup.goal + CUP.TOL ? 'עוד אחד למטה' : '';
        draw();
      });
      draw();
    };
    stage();
  }

  // ---------------------------------------------------------------- order mode: the check (SPEC-squishy.md 2.8)
  function stepCheck(d: SquishyData, o: Order): void {
    dotsFor('finish');
    onX = leaveToMenu;
    const b = clear('check');
    const r = checkOrder(o, d);
    const rows: { label: string; ok: boolean }[] = [{ label: 'הצורה', ok: r.shape }, { label: 'הצבע', ok: r.color }, ...(r.count !== null ? [{ label: 'המספר', ok: r.count }] : [])];
    b.innerHTML = `<div class="sqg-stage small" id="stage"></div><div class="sqg-panel" id="fp"><div class="sqg-checks">${rows.map((x) => `<div class="chk"><span>${x.label}</span><i class="mark"></i></div>`).join('')}</div><div class="sqg-msg" id="msg"></div><div class="sqg-actions" id="acts"></div></div>`;
    void showView(d, b.querySelector<HTMLElement>('#stage')!).then((v) => (v.onTap = () => v.bounce()));
    void sayHe('sq_check_order').then(() => sayOrder(o));
    const marks = [...b.querySelectorAll<HTMLElement>('.chk .mark')];
    const msg = b.querySelector<HTMLElement>('#msg')!;
    const acts = b.querySelector<HTMLElement>('#acts')!;
    const conclude = (matched: boolean): void => {
      const gain = reward(o, matched);
      store.orders.done.push(o.id);
      store.orders.hearts += gain.hearts;
      if (gain.stars) update((s) => void (s.stars += gain.stars));
      const prev = unlockedMolds(store.orders.done.length - 1).length, now = unlockedMolds(store.orders.done.length);
      store.draft = null;
      persist();
      sound.play('fanfare');
      view?.bounce();
      msg.innerHTML = `${matched ? 'בדיוק מה שהוזמן!' : 'תודה!'} <b>❤️ ${gain.hearts}${gain.stars ? ` ⭐ ${gain.stars}` : ''}</b>${now.length > prev ? `<br>נפתחה תבנית חדשה! <img class="newmold" src="${shapeUrl(now[now.length - 1])}" alt="">` : ''}`;
      void (async () => { if (matched) await sayHe('sq_order_match'); await sayEn('sq_thank_you'); if (now.length > prev) await sayHe('sq_new_mold'); })();
      acts.innerHTML = '<button type="button" class="sqg-go" id="next">הזמנה הבאה</button><button type="button" class="sqg-go alt" id="home">לתפריט</button>';
      onX = menu;
      acts.querySelector('#next')!.addEventListener('click', () => (sound.play('pop', 640), menu()));
      acts.querySelector('#home')!.addEventListener('click', () => (sound.play('pop', 640), menu()));
    };
    rows.forEach((x, i) => later(() => { marks[i].textContent = x.ok ? '✔' : '✖'; marks[i].classList.add(x.ok ? 'ok' : 'no'); sound.play(x.ok ? 'pop' : 'pop', x.ok ? 700 : 300); }, 1800 + i * 800));
    later(() => {
      if (r.all) return conclude(true);
      // not the same: "almost", one button that goes straight back to the step, or give it as it is (one heart, no failure)
      const first = !r.shape ? 'shape' : !r.color ? 'color' : 'count';
      msg.textContent = first === 'shape' ? 'כמעט! הצורה לא מתאימה. רוצה לתקן?' : first === 'color' ? 'כמעט! הצבע לא מתאים. רוצה לתקן?' : 'כמעט! מספר הקישוטים לא מתאים. רוצה לתקן?';
      void sayHe(first === 'shape' ? 'sq_order_shape' : first === 'color' ? 'sq_order_almost' : 'sq_order_count');
      acts.innerHTML = '<button type="button" class="sqg-go" id="fix">🔧 לתקן</button><button type="button" class="sqg-go alt" id="asis">לתת כמו שהוא</button>';
      acts.querySelector('#fix')!.addEventListener('click', () => {
        sound.play('pop', 640);
        if (first === 'shape') { pending = o; store.draft = null; stepMold(); } else stepPaint();
      });
      acts.querySelector('#asis')!.addEventListener('click', () => (sound.play('pop', 500), conclude(false)));
    }, 1800 + rows.length * 800 + 400);
  }

  // ---------------------------------------------------------------- the shelf
  async function thumb(d: SquishyData, size: number): Promise<HTMLCanvasElement> {
    const l = await loadShape(d.shape);
    const big = document.createElement('canvas');
    big.width = big.height = SIZE;
    drawSquishy(big.getContext('2d', { willReadFrequently: true })!, l, d);
    const c = document.createElement('canvas');
    c.width = c.height = size * 2;
    c.style.width = c.style.height = `${size}px`;
    c.getContext('2d')!.drawImage(big, 0, 0, size * 2, size * 2);
    return c;
  }
  function shelf(): void {
    killView();
    setDots(0);
    onX = menu;
    const b = clear('shelf');
    b.innerHTML = `<h2 class="sqg-title small" data-say="sq_shelf">המדף שלי</h2><div class="sqg-shelf" id="sh">${store.shelf.length ? '' : '<p class="sqg-empty">עוד אין סקווישים על המדף. בואי נכין אחד!</p>'}</div><div class="sqg-actions"><button type="button" class="sqg-go" id="snew">יצירה חופשית</button></div>`;
    say('sq_shelf');
    const sh = b.querySelector<HTMLElement>('#sh')!;
    store.shelf.forEach((d) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'sqg-card';
      card.innerHTML = `<span class="sqg-thumb"></span><b>${esc(d.name || 'ללא שם')}</b>`;
      sh.appendChild(card);
      void thumb(d, 112).then((c) => !dead && card.querySelector('.sqg-thumb')!.replaceChildren(c));
      card.addEventListener('click', () => (sound.play('pop', 640), detail(d)));
    });
    b.querySelector('#snew')!.addEventListener('click', () => (sound.play('pop', 640), (store.draft = null), stepMold()));
  }
  /** a squishy of the shelf: it is opened for squeezing, and its name can be changed */
  function detail(d: SquishyData): void {
    setDots(0);
    onX = shelf;
    const b = clear('detail');
    b.innerHTML = `<div class="sqg-stage" id="stage"></div><div class="sqg-panel"><div class="sqg-detailname"><b id="dn">${esc(d.name)}</b><button type="button" class="sqg-round" id="dedit" aria-label="שינוי שם">✏️</button></div><div class="sqg-actions"><button type="button" class="sqg-go" id="dback">⬅ חזרה למדף</button></div></div>`;
    const stage = b.querySelector<HTMLElement>('#stage')!;
    void (async () => {
      const v = await showView(d, stage);
      v.setMode('squeeze');
    })();
    b.querySelector('#dback')!.addEventListener('click', () => shelf());
    b.querySelector('#dedit')!.addEventListener('click', () => {
      const dn = b.querySelector<HTMLElement>('.sqg-detailname')!;
      dn.innerHTML = `<input class="sqg-name" id="nn" maxlength="12" value="${esc(d.name)}" aria-label="שם"><button type="button" class="sqg-round" id="nok" aria-label="אישור">✔</button>`;
      const inp = dn.querySelector<HTMLInputElement>('#nn')!;
      inp.focus();
      const ok = (): void => {
        const n = cleanName(inp.value);
        if (n) {
          d.name = n;
          persist();
        }
        detail(d);
      };
      dn.querySelector('#nok')!.addEventListener('click', ok);
      inp.addEventListener('keydown', (e) => e.key === 'Enter' && ok());
    });
  }

  // ---------------------------------------------------------------- start
  root.querySelector('#sqx')!.addEventListener('click', () => {
    sound.play('pop', 500);
    onX();
  });
  menu();
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__sqgame = { get store() { return store; }, get view() { return view; }, stepMold, stepSpoons, stepMix, stepPour, stepPaint, stepFace, stepSqueeze, stepFinish, shelf, menu };
  void OPEN_MOLDS;
  void STEP_ORDER;
  void imageUrl;
  void COLORS;
  void wait;
  return {
    pause() {
      persist();
    },
    unmount() {
      dead = true;
      persist();
      timers.forEach((t) => (window.clearTimeout(t), window.clearInterval(t)));
      killView();
      root.remove();
    },
  };
}
