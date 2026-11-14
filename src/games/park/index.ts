import type { GameContext, GameModule } from '../types';
import { sayLabel, sayLine } from '../english/content/heLines';
import { cheesyImg, getLook, setLook } from '../english/art/cheesy';
import { squishyUrl } from '../english/art/squishies';
import { stopSpeech } from '../english/voice';
import { SESSION_TTL_MS } from '../../access';
import { getState } from '../../storage';
import { sessionTier } from '../../lobby3d/quality';
import { activeLevel } from '../../math/adaptive';
import { levelConfig } from '../../math/levels';
import { Builder, type Piece } from './coaster/builder';
import type { Diagnosis } from './coaster/hints';
import type { Ride3D } from './coaster/ride3d';
import { buildPath, newTrack, type Track } from './coaster/track';
import type { Evaluation, Fail } from './goals';
import { starsFor, type Fun } from './fun';
import { LEVEL_COUNT, ZONES, makeLevel, zoneOf, type Level } from './levels';
import { PARK_TARGETS } from './parkTargets';
import { FUNNY_NAMES, pk } from './lines';
import { emptyProgress, isUnlocked, renderMap, type Progress } from './ui/map';
import './ui/park.css';

interface Saved { pts: { x: number; y: number }[]; loops?: number[]; loopAt?: number | null; parts?: { kind: 'chain' | 'tunnel' | 'splash'; x0: number; x1: number }[]; complete: boolean }
interface Coaster { id: string; name: string; color: string; track: Saved }
interface Session { savedAt: number; track: Saved; level?: number | null; color?: string }
const COLORS = ['#ff5d8f', '#ff9f43', '#ffd23f', '#4cd97b', '#35b6ff', '#b58cff'];
const MAX_COASTERS = 5;
const TRACK_COLOR = COLORS[0];
let ctx: GameContext | null = null;
let root: HTMLElement | null = null;
let builder: Builder | null = null;
let ride3d: Ride3D | null = null;
let sayTimer = 0;
let companionSrc = '';
let lookBefore: ReturnType<typeof getLook> | null = null;
let riderImgs: (HTMLImageElement | null)[] = [];
/** the level that is being played (null: free building) and the colour of the track */
let cur: Level | null = null;
let trackColor = TRACK_COLOR;
/** the first round after the gate is free; the next ones ask the host (which may show the gate) */
let fresh = true;
let lastEnd: { fun: Fun; ev: Evaluation | null } | null = null;
const base = (): string => import.meta.env.BASE_URL;

const icon = `<svg viewBox="0 0 100 100" width="64" height="64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="100" height="100" rx="22" fill="#ffd6f0"/><path d="M8 78 C 28 78 30 24 50 24 C 70 24 72 70 92 70" fill="none" stroke="#ff5d8f" stroke-width="9" stroke-linecap="round"/><rect x="38" y="12" width="26" height="15" rx="6" fill="#ffb84d"/><circle cx="44" cy="30" r="4" fill="#4a3a5a"/><circle cx="58" cy="30" r="4" fill="#4a3a5a"/></svg>`;

const img = (src: string): HTMLImageElement => {
  const i = new Image();
  i.src = src;
  return i;
};

/** The companion she chose in the English game (a squishy friend or Cheesy): read, never written, there. */
function riders(): (HTMLImageElement | null)[] {
  const en = getState().games.english as { buddy?: string | null } | undefined;
  lookBefore ??= { ...getLook() };
  setLook({ buddy: en?.buddy ?? null, accessory: null });
  const first = en?.buddy ? squishyUrl(en.buddy) : `${base()}english/cheesy/happy.webp`;
  companionSrc = first;
  return [img(first), img(`${base()}english/words/mom.webp`), img(`${base()}english/words/dad.webp`)];
}

const esc = (t: string): string => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const line = (id: string): string => pk[id.replace(/^park_/, '') as keyof typeof pk] ?? '';

/** A friendly line over the stage: written, and said aloud, with the companion. */
function say(id: string): void {
  const el = root?.querySelector<HTMLElement>('.pk-bubble');
  if (!el) return;
  el.innerHTML = `<span class="pk-who">${cheesyImg('thinking')}</span><span>${esc(line(id))}</span>`;
  el.classList.remove('on');
  void el.offsetWidth;
  el.classList.add('on');
  window.clearTimeout(sayTimer);
  sayTimer = window.setTimeout(() => el.classList.remove('on'), 4600);
  void sayLine(id);
}

const toSaved = (t: Track): Saved => ({ pts: t.pts.map((p) => ({ ...p })), loops: [...t.loops], parts: t.parts.map((p) => ({ ...p })), complete: t.complete });
const fromSaved = (s: Saved | null | undefined): Track | null => {
  if (!s || !Array.isArray(s.pts) || s.pts.length < 1 || !s.pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
  // (a track saved before there were several loops has one loopAt)
  const loops = Array.isArray(s.loops) ? s.loops.filter((l) => Number.isInteger(l)) : typeof s.loopAt === 'number' ? [s.loopAt] : [];
  return { pts: s.pts.map((p) => ({ ...p })), loops, parts: Array.isArray(s.parts) ? s.parts.map((p) => ({ ...p })) : [], complete: !!s.complete };
};
function save(t: Track): void {
  if (!ctx) return;
  if (!cur) ctx.save('track', toSaved(t));
  ctx.save('session', { savedAt: Date.now(), track: toSaved(t), level: cur?.id ?? null, color: trackColor } satisfies Session);
}
const onHide = (): void => {
  if (builder) save(builder.track);
};

// ---- the data: the journey and my coasters ----

const progress = (): Progress => ctx!.load<Progress>('journey', emptyProgress());
const coasters = (): Coaster[] => ctx!.load<Coaster[]>('coasters', []).filter((c) => fromSaved(c.track));
/** The maths level of the child bounds the numbers that are counted and taken away in the challenges. */
const levelOf = (id: number): Level => makeLevel(id, levelConfig(activeLevel()).max);

// ---- the screens ----

const btn = (cls: string, say: string, label: string, ico: string): string => `<button class="pk-btn ${cls}" type="button" data-say="park_${say}" aria-label="${label}"><span class="ico">${ico}</span><span class="lbl">${label}</span></button>`;
const PART_ICON: Record<Piece, string> = { loop: '🔁', chain: '⛓️', tunnel: '🚇', splash: '💦' };
const PARTS: Piece[] = ['loop', 'chain', 'tunnel', 'splash'];
const PART_LABEL: Record<Piece, string> = { loop: pk.loop, chain: pk.chain, tunnel: pk.tunnel, splash: pk.splash };

function screen(cls: string, html: string): HTMLElement {
  closeScreen();
  const s = document.createElement('div');
  s.className = `pk-screen ${cls}`;
  s.style.setProperty('--pk-bg', `url(${base()}park/bg/${cls === 'menu' || cls === 'mine' ? 'candy' : 'candy'}.webp)`);
  s.innerHTML = html;
  root!.appendChild(s);
  return s;
}
function closeScreen(): void {
  root?.querySelectorAll('.pk-screen').forEach((e) => e.remove());
}

function showMenu(): void {
  const s = screen('menu', `<div class="pk-mtop"><button class="pk-round" id="pk-home2" type="button" aria-label="home">🏠</button><h2 data-say="park_title">${pk.title}</h2><span class="pk-sp"></span></div>
    <div class="pk-menu">
      <button class="pk-big" id="pk-ch" data-say="park_menuChallenges" type="button" style="background:#e0568a"><span class="ico">🗺️</span>${pk.menuChallenges}</button>
      <button class="pk-big" id="pk-fr" data-say="park_menuFree" type="button" style="background:#2aa98f"><span class="ico">🎢</span>${pk.menuFree}</button>
      <button class="pk-big" id="pk-mi" data-say="park_menuMine" type="button" style="background:#7a5ae0"><span class="ico">📒</span>${pk.menuMine}</button>
    </div>`);
  s.querySelector('#pk-home2')!.addEventListener('click', () => ctx!.onExit());
  s.querySelector('#pk-ch')!.addEventListener('click', showMap);
  s.querySelector('#pk-fr')!.addEventListener('click', () => begin(() => startFree(null)));
  s.querySelector('#pk-mi')!.addEventListener('click', showCoasters);
  s.addEventListener('pointerdown', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-say]');
    if (el?.dataset.say) void sayLabel(el.dataset.say, '');
  });
  window.setTimeout(() => void sayLine('park_title'), 300);
}

function showMap(): void {
  const s = screen('map', '');
  renderMap(s, progress(), { onPick: (id) => begin(() => startLevel(levelOf(id)), id), onBack: showMenu });
  s.addEventListener('pointerdown', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-say]');
    if (el?.dataset.say) void sayLabel(el.dataset.say, '');
  });
}

/** The line of a track, small, for the card of a saved coaster. */
function previewSvg(t: Track, color: string): string {
  const p = buildPath(t);
  let d = '';
  for (let i = 0; i < p.n; i += 6) d += `${i ? 'L' : 'M'}${(2 + (p.x[i] / 24) * 106).toFixed(1)} ${(44 - (p.y[i] / 10) * 40).toFixed(1)} `;
  return `<svg viewBox="0 0 110 46" aria-hidden="true"><path d="${d}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function showCoasters(): void {
  const list = coasters();
  const s = screen('mine', `<div class="pk-mtop"><button class="pk-round" id="pk-mb" type="button" aria-label="back">⬅️</button><h2 data-say="park_menuMine">${pk.menuMine}</h2><span class="pk-sp"></span></div>
    <div class="pk-mine">${list.length ? list.map((c) => `<div class="pk-coaster" data-id="${c.id}">${previewSvg(fromSaved(c.track)!, c.color)}<span class="nm">${esc(c.name)}</span><button class="open" type="button" aria-label="${pk.open}">▶</button><button class="del" type="button" aria-label="${pk.remove}">🗑️</button></div>`).join('') : `<div class="pk-empty" data-say="park_empty">${pk.empty}</div>`}</div>`);
  s.querySelector('#pk-mb')!.addEventListener('click', showMenu);
  s.querySelectorAll<HTMLElement>('.pk-coaster').forEach((el) => {
    const c = list.find((x) => x.id === el.dataset.id)!;
    el.querySelector('.open')!.addEventListener('click', () => begin(() => startFree(c)));
    el.querySelector('.del')!.addEventListener('click', () => {
      ctx!.save('coasters', coasters().filter((x) => x.id !== c.id));
      showCoasters();
    });
  });
  s.addEventListener('pointerdown', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-say]');
    if (el?.dataset.say) void sayLabel(el.dataset.say, '');
  });
}

/** A new round: the first one after the gate is free, later ones ask the host (which may show the gate). */
function begin(go: () => void, levelId?: number): void {
  if (levelId && !isUnlocked(progress(), levelId)) return;
  if (fresh) {
    fresh = false;
    go();
  } else ctx!.requestRound(go);
}

function setColor(c: string): void {
  trackColor = c;
  builder?.setLook({ track: c, riders: riderImgs });
}

function startLevel(lv: Level): void {
  if (!root || !builder) return;
  closeScreen();
  leave3d();
  cur = lv;
  lastEnd = null;
  root.classList.add('level');
  root.classList.remove('ended');
  setColor(TRACK_COLOR);
  builder.setLevel({ goals: lv.goals, solution: lv.solution, allow: lv.allow, zoneBg: zoneOf(lv.id).bg, tutorial: lv.tutorial > 0 });
  builder.restart();
  hideEnd();
  paintGoals();
  paint();
  save(builder.track);
  if (lv.tutorial) window.setTimeout(() => say(`park_tut${lv.tutorial}`), 700);
}

function startFree(c: Coaster | null): void {
  if (!root || !builder) return;
  closeScreen();
  leave3d();
  cur = null;
  lastEnd = null;
  root.classList.remove('level', 'ended');
  builder.setLevel(null);
  const t = c ? fromSaved(c.track) : fromSaved(ctx!.load<Saved | null>('track', null));
  builder.setTrack(t ?? newTrack());
  setColor(c?.color ?? TRACK_COLOR);
  hideEnd();
  paintGoals();
  paint();
}

// ---- the goals on the screen ----

const OB_ICON = { rock: '🪨', palm: '🌴', pine: '🌲', bridge: '🌉' } as const;

/** The chips of the goals in the top bar: an icon and a few words, read aloud when touched. */
function paintGoals(failed: Fail[] = []): void {
  const box = root?.querySelector<HTMLElement>('.pk-goals');
  if (!box || !builder) return;
  if (!cur) {
    box.innerHTML = '';
    return;
  }
  const b = builder;
  const g = cur.goals;
  const chips: { ico: string; text: string; say: string; done: boolean; fail: boolean }[] = [];
  const failed_ = (k: Fail['kind']): boolean => failed.some((f) => f.kind === k);
  const checked = !!b.evalRes;
  if (g.stars.length) {
    const got = b.evalRes ? b.evalRes.stars.filter(Boolean).length : b.collected.filter(Boolean).length;
    chips.push({ ico: '⭐', text: `${got}/${g.stars.length}`, say: 'goalStars', done: got === g.stars.length, fail: failed_('stars') });
  }
  if (g.obstacles.length) {
    const kinds = [...new Set(g.obstacles.map((o) => o.kind))];
    chips.push({ ico: kinds.map((k) => OB_ICON[k]).join(''), text: '', say: 'goalAvoid', done: checked && !failed_('obstacle'), fail: failed_('obstacle') });
  }
  if (g.speed) chips.push({ ico: g.speed.mode === 'fast' ? '🐇' : '🐢', text: '', say: g.speed.mode === 'fast' ? 'goalFast' : 'goalSlow', done: checked && !failed_('gate'), fail: failed_('gate') });
  if (g.height) chips.push({ ico: '📏', text: g.height.kind === 'peak' ? `${g.height.h}` : `−${g.height.d}`, say: g.height.kind === 'peak' ? 'goalPeak' : 'goalLower', done: checked && !failed_('height'), fail: failed_('height') });
  for (const q of g.parts) {
    const have = q.kind === 'loop' ? b.track.loops.length : b.track.parts.filter((p) => p.kind === q.kind).length;
    chips.push({ ico: PART_ICON[q.kind], text: q.n > 1 ? `${have}/${q.n}` : '', say: q.kind, done: have >= q.n, fail: failed.some((f) => f.kind === 'part' && f.part === q.kind) });
  }
  if (!chips.length) chips.push({ ico: '🏁', text: '', say: 'goalFinish', done: false, fail: false });
  box.innerHTML = chips.map((c) => `<span class="pk-chip ${c.done ? 'done' : ''} ${c.fail ? 'fail' : ''}" data-say="park_${c.say}">${c.ico}${c.text ? ` ${c.text}` : ''}</span>`).join('');
}

/** What to say when the ride finished but a goal was missed (the first one). */
function failLine(f: Fail): string {
  if (f.kind === 'gate') return `park_fail_gate_${f.why}`;
  if (f.kind === 'part') return `park_fail_part_${f.part}`;
  return `park_fail_${f.kind}`;
}

// ---- the end of a ride ----

function hideEnd(): void {
  root?.querySelector('.pk-end')?.classList.remove('on');
  root?.classList.remove('ended');
}

const bar = (ico: string, label: string, v: number): string => `<div class="pk-bar"><span class="ic">${ico}</span><span class="lb">${label}</span><span class="tr"><i style="width:0" data-w="${Math.round(v * 100)}"></i></span></div>`;

/** The end of a good ride: the stars of the challenge, the fun meter, and what to do next. */
function showEnd(fun: Fun, ev: Evaluation | null): void {
  if (!root || !ctx || !builder) return;
  lastEnd = { fun, ev };
  const lv = cur;
  let stars: 1 | 2 | 3 | 0 = 0;
  if (lv) {
    stars = starsFor(fun.score, PARK_TARGETS[lv.id]);
    const p = progress();
    const prev = p.levels[lv.id] ?? 0;
    p.levels[lv.id] = Math.max(prev, stars);
    ctx.save('journey', p);
    const gained = Math.max(0, stars - prev);
    if (gained > 0) ctx.onRoundEnd({ won: true, stars: Math.min(3, gained) as 1 | 2 | 3, score: fun.score });
  }
  const next = lv && lv.id < LEVEL_COUNT ? lv.id + 1 : null;
  const box = root.querySelector<HTMLElement>('.pk-end')!;
  box.innerHTML = `${lv?.boss ? `<img class="prize" src="${base()}park/items/starstatue.webp" alt="" data-say="park_prize">` : ''}
    <h2 data-say="${lv ? (lv.boss ? 'park_prize' : 'park_levelDone') : 'park_great'}">${lv ? (lv.boss ? pk.prize : pk.levelDone) : pk.great}</h2>
    ${lv ? `<div class="pk-bigstars">${[1, 2, 3].map((n) => `<span class="${n <= stars ? 'on' : ''}" style="animation-delay:${n * 0.18}s">⭐</span>`).join('')}</div>` : ''}
    <div class="pk-meter"><h4 data-say="park_fun"><span>${pk.fun}</span><b>${fun.score}</b></h4>
      ${bar('⬇️', pk.funDrop, fun.bars.drop)}${bar('🎈', pk.funFloat, fun.bars.float)}${bar('🔁', pk.funLoops, fun.bars.loops)}${bar('⚡', pk.funSpeed, fun.bars.speed)}</div>
    <div class="pk-endrow">
      ${btn('pk-e3d big', 'ride', pk.ride, '🎢')}${btn('pk-eagain', 'again', pk.again, '↺')}
      ${next ? btn('pk-enext', 'next', pk.next, '➡️') : ''}${lv ? btn('pk-emap round', 'map', pk.map, '🗺️') : `${btn('pk-esave round', 'save', pk.save, '💾')}${btn('pk-emenu round', 'menuFree', pk.menuFree, '☰')}`}
    </div>`;
  box.classList.add('on');
  root.classList.add('ended');
  box.querySelectorAll<HTMLElement>('.pk-bar i').forEach((i) => window.setTimeout(() => (i.style.width = `${i.dataset.w}%`), 60));
  box.querySelector('.pk-e3d')!.addEventListener('click', () => void go3d());
  box.querySelector('.pk-eagain')!.addEventListener('click', () => {
    hideEnd();
    builder!.rideOk = false;
    builder!.startRide();
  });
  box.querySelector('.pk-enext')?.addEventListener('click', () => begin(() => startLevel(levelOf(next!)), next!));
  box.querySelector('.pk-emap')?.addEventListener('click', () => {
    hideEnd();
    showMap();
  });
  box.querySelector('.pk-esave')?.addEventListener('click', openSave);
  box.querySelector('.pk-emenu')?.addEventListener('click', () => {
    hideEnd();
    showMenu();
  });
  void sayLine(lv?.boss ? 'park_prize' : lv ? 'park_levelDone' : 'park_great');
}

/** Naming a coaster, and choosing its colour: up to five are kept. */
function openSave(): void {
  if (!root || !ctx || !builder) return;
  if (coasters().length >= MAX_COASTERS) {
    say('park_full5');
    return;
  }
  const box = root.querySelector<HTMLElement>('.pk-save')!;
  let color = trackColor;
  const first = line(`park_${FUNNY_NAMES[Math.floor(Math.random() * FUNNY_NAMES.length)]}`);
  box.innerHTML = `<div class="pk-card"><h3 data-say="park_nameIt">${pk.nameIt}</h3>
      <input maxlength="14" value="${esc(first)}" aria-label="${pk.nameIt}">
      <div class="pk-names">${FUNNY_NAMES.map((n) => `<button type="button" data-say="park_${n}">${line(`park_${n}`)}</button>`).join('')}</div>
      <h3 data-say="park_pickColor">${pk.pickColor}</h3>
      <div class="pk-colors">${COLORS.map((c) => `<button type="button" style="background:${c}" data-c="${c}" class="${c === color ? 'on' : ''}" aria-label="${c}"></button>`).join('')}</div>
      <button class="pk-btn big" id="pk-dosave" type="button" data-say="park_save"><span class="ico">💾</span><span class="lbl">${pk.save}</span></button></div>`;
  box.classList.add('on');
  const input = box.querySelector('input')!;
  box.querySelectorAll<HTMLElement>('.pk-names button').forEach((b) => b.addEventListener('click', () => (input.value = b.textContent ?? '')));
  box.querySelectorAll<HTMLElement>('.pk-colors button').forEach((b) =>
    b.addEventListener('click', () => {
      color = b.dataset.c!;
      box.querySelectorAll('.pk-colors button').forEach((x) => x.classList.toggle('on', x === b));
    }),
  );
  box.addEventListener('pointerdown', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-say]');
    if (el?.dataset.say) void sayLabel(el.dataset.say, '');
  });
  box.querySelector('#pk-dosave')!.addEventListener('click', () => {
    const name = input.value.trim() || first;
    ctx!.save('coasters', [...coasters(), { id: Date.now().toString(36), name, color, track: toSaved(builder!.track) } satisfies Coaster]);
    setColor(color);
    box.classList.remove('on');
    say('park_saved');
  });
}

// ---- the buttons ----

function setUi(mode: 'build' | 'ride', hasRide: boolean): void {
  if (!root) return;
  const r = root;
  r.classList.toggle('riding', mode === 'ride');
  r.classList.toggle('hasride', hasRide);
  if (mode === 'ride') hideEnd();
  paint();
}

/** Which buttons are on: the go button when there is a track, "fix it" after three tries that did not work, the pieces that this challenge has. */
function paint(): void {
  if (!root || !builder) return;
  const b = builder;
  const riding = root.classList.contains('riding');
  const in3d = !!ride3d;
  root.querySelector('.pk-go')!.classList.toggle('off', !b.canRide() || riding || in3d);
  root.querySelector('.pk-fix')!.classList.toggle('on', (!!b.diag || b.goalFailed) && b.attempts >= 3 && !riding);
  root.querySelector('.pk-tools')!.classList.toggle('hide', riding || in3d || b.rideOk);
  for (const part of PARTS) {
    const el = root.querySelector<HTMLElement>(`.pk-part[data-part="${part}"]`)!;
    const allowed = part === 'loop' ? b.allow.loops > 0 : b.allow.parts.includes(part);
    el.classList.toggle('hide', !allowed);
    el.classList.toggle('placed', b.has(part));
    const badge = el.querySelector<HTMLElement>('.badge');
    if (badge) badge.textContent = part === 'loop' && b.allow.loops > 1 ? `${b.track.loops.length}/${b.allow.loops}` : '';
    if (badge) badge.style.display = badge.textContent ? '' : 'none';
  }
  paintGoals(b.evalRes && !b.evalRes.ok ? b.evalRes.fails : []);
}

async function go3d(): Promise<void> {
  if (!root || !builder || !ctx) return;
  const cur3 = builder.currentRide();
  const pref = getState().settings.lobby;
  const tier = sessionTier(pref);
  // without 3D (or in the plain tier) the ride is shown again from the side, close up
  if (!cur3 || tier === '2d') {
    hideEnd();
    builder.startRide();
    return;
  }
  hideEnd();
  const holder = root.querySelector<HTMLElement>('.pk-three')!;
  holder.classList.add('on');
  root.classList.add('in3d');
  const fx = root.querySelector<HTMLElement>('.pk-fx')!;
  const { path } = cur3;
  try {
    const { startRide3d } = await import('./coaster/ride3d');
    ride3d = await startRide3d(holder, cur3.path, cur3.ride, {
      calm: ctx.load<boolean>('calm', false),
      tier,
      color: trackColor,
      companionUrl: companionSrc,
      seed: Math.round(cur3.path.s[cur3.path.n - 1] * 100),
      sound: ctx.sound,
      onEnd: () => root?.classList.add('ride3d-done'),
      onSlow: () => void 0,
      // the dark of a tunnel, and the water of a splash on the screen
      onFrame: (s) => {
        fx.classList.toggle('dark', path.tunnels.some(([a, b]) => s >= a && s <= b));
        fx.classList.toggle('water', path.splashes.some((d) => Math.abs(s - d) < 0.9));
        fx.classList.toggle('on', fx.classList.contains('dark') || fx.classList.contains('water'));
      },
    });
    paint();
  } catch {
    leave3d();
    builder.startRide();
  }
}

function leave3d(): void {
  ride3d?.dispose();
  ride3d = null;
  const holder = root?.querySelector<HTMLElement>('.pk-three');
  holder?.classList.remove('on');
  root?.querySelector('.pk-fx')?.classList.remove('on', 'dark', 'water');
  root?.classList.remove('in3d', 'ride3d-done', 'cam-side');
  paint();
}

const park: GameModule = {
  id: 'park',
  title: pk.title,
  icon,
  color: '#ff5d8f',
  /** Out of the game and back within 10 minutes: the same track, without the gate. */
  resumeWithoutGate: true,

  mount(c: GameContext) {
    ctx = c;
    fresh = true;
    cur = null;
    root = document.createElement('div');
    root.className = 'pk';
    root.innerHTML = `<div class="pk-top"><button class="pk-round pk-home" type="button" aria-label="home">☰</button><h1 data-say="park_title">${pk.title}</h1><div class="pk-goals"></div><span class="pk-sp"></span></div>
      <div class="pk-stage"><canvas class="pk-canvas"></canvas><div class="pk-bubble"></div><div class="pk-three"></div><div class="pk-fx"></div>
        <div class="pk-parts">${PARTS.map((p) => `<button class="pk-part" type="button" data-part="${p}" data-say="park_${p}" aria-label="${PART_LABEL[p]}">${PART_ICON[p]}<span class="badge"></span></button>`).join('')}</div>
        <div class="pk-end"></div>
        <div class="pk-3d-ui">${btn('pk-cam round', 'carView', pk.carView, '🎥')}${btn('pk-backb round', 'back', pk.back, '⬅️')}${btn('pk-again3 round', 'again', pk.again, '↺')}</div>
      </div>
      <div class="pk-tools">
        ${btn('pk-del', 'del', pk.del, '🗑️')}${btn('pk-restart', 'restart', pk.restart, '🧹')}${btn('pk-fix', 'fixMe', pk.fixMe, '🪄')}
        ${btn('pk-go big off', 'go', pk.go, '▶')}
      </div><div class="pk-save"></div>`;
    c.container.appendChild(root);
    const r = root;
    r.addEventListener('pointerdown', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-say]');
      if (el?.dataset.say) void sayLabel(el.dataset.say, '');
    });
    // the button at the top left goes to the menu (it saves the track first)
    r.querySelector('.pk-home')!.addEventListener('click', () => {
      if (builder) save(builder.track);
      leave3d();
      builder?.stopRide();
      showMenu();
    });
    riderImgs = riders();
    builder = new Builder(
      r.querySelector('canvas')!,
      {
        sound: c.sound,
        onChange: (t) => {
          save(t);
          paint();
        },
        onFailed: (d: Diagnosis, attempts: number) => {
          say(`park_hint_${d.kind}`);
          if (attempts >= 3) r.querySelector('.pk-fix')!.classList.add('on');
          paint();
        },
        onFinished: (ev, fun) => {
          if (ev && !ev.ok) {
            // the car got to the end, but a goal was missed
            say(failLine(ev.fails[0]));
            paint();
            return;
          }
          paint();
          showEnd(fun, ev);
        },
        onStar: () => paintGoals(),
        onMode: setUi,
        onLayout: (bottom) => r.style.setProperty('--pk-map-bottom', `${bottom + 8}px`),
        onRefused: (what) => {
          const l = r.querySelector(`.pk-part[data-part="${what}"]`);
          if (!l) return;
          l.classList.remove('bounce');
          void (l as HTMLElement).offsetWidth;
          l.classList.add('bounce');
        },
      },
      { track: TRACK_COLOR, riders: riderImgs },
      newTrack(),
    );
    const b = builder;
    r.querySelector('.pk-go')!.addEventListener('click', () => b.startRide());
    r.querySelector('.pk-del')!.addEventListener('click', () => b.deleteEnd());
    r.querySelector('.pk-restart')!.addEventListener('click', () => b.restart());
    r.querySelector('.pk-fix')!.addEventListener('click', () => {
      b.fixIt();
      paint();
    });
    r.querySelector('.pk-again3')!.addEventListener('click', () => {
      leave3d();
      b.rideOk = false;
      b.startRide();
    });
    r.querySelector('.pk-backb')!.addEventListener('click', () => {
      leave3d();
      b.stopRide();
      b.rideOk = true;
      paint();
      if (lastEnd) showEnd(lastEnd.fun, lastEnd.ev);
    });
    r.querySelector('.pk-cam')!.addEventListener('click', () => {
      const side = r.classList.toggle('cam-side');
      ride3d?.setCamera(side ? 'side' : 'first');
    });
    r.querySelector('.pk-three')!.addEventListener('pointerdown', () => ride3d?.cheer());
    // the pieces are dragged out of the column onto the track (a tap on one that is on the track takes it off)
    r.querySelectorAll<HTMLElement>('.pk-part').forEach((el) => {
      const part = el.dataset.part as Piece;
      el.addEventListener('pointerdown', (e) => {
        if (b.has(part) && (part !== 'loop' || b.full(part))) {
          b.removePiece(part);
          paint();
          return;
        }
        el.setPointerCapture(e.pointerId);
        b.beginPartDrag(part, e.clientX, e.clientY);
      });
      el.addEventListener('pointermove', (e) => b.movePartDrag(e.clientX, e.clientY));
      el.addEventListener('pointerup', () => {
        b.endPartDrag();
        paint();
      });
      el.addEventListener('pointercancel', () => b.endPartDrag());
    });
    window.addEventListener('pagehide', onHide);
    // a track left less than 10 minutes ago goes on (the gate was skipped by the host); otherwise the menu
    const session = c.load<Session | null>('session', null);
    const freshTrack = session && Date.now() - session.savedAt < SESSION_TTL_MS ? fromSaved(session.track) : null;
    if (freshTrack && session) {
      fresh = false;
      const lv = session.level ? levelOf(session.level) : null;
      if (lv && session.level! <= LEVEL_COUNT) {
        startLevel(lv);
        b.setTrack(freshTrack);
      } else {
        startFree(null);
        b.setTrack(freshTrack);
      }
      if (session.color) setColor(session.color);
    } else showMenu();
    paint();
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__pk = { builder, go3d, leave3d, begin, startLevel, startFree, showMap, showMenu, showCoasters, openSave, levelOf, get ride3d() { return ride3d; } };
  },

  canInterrupt: () => !builder || !root?.classList.contains('riding'),
  pause() {},
  resume() {},

  unmount() {
    window.removeEventListener('pagehide', onHide);
    if (builder) save(builder.track);
    leave3d();
    builder?.destroy();
    builder = null;
    stopSpeech();
    window.clearTimeout(sayTimer);
    if (lookBefore) setLook(lookBefore);
    lookBefore = null;
    root?.remove();
    root = null;
    ctx = null;
  },
};

export default park;
export { ZONES };
