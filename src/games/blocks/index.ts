import type { GameContext, GameModule } from '../types';
import { sayLabel, sayLine } from '../english/content/heLines';
import { stopSpeech } from '../english/voice';
import { counter, fraction } from '../../ui/counter';
import { SESSION_TTL_MS } from '../../access';
import { getState } from '../../storage';
import { BlockGame } from './game';
import { bk } from './lines';
import { PIECES, pieceById } from './pieces';
import { HELPERS, HELPER_COST, priceOf, whyNot, type FreeUsed, type Helper } from './helpers';
import { validSaved, type SavedGame } from './save';
import { boardStars } from './stars';
import { LEVELS, levelById, worldOf } from './levels';
import { ITEMS, type GoalView, type Level } from './journey';
import { STAR_TARGETS } from './starTargets';
import { getLook, mountCheesy, setLook, type Expression } from '../english/art/cheesy';
import { emptyProgress, isUnlocked, renderMap, type Progress } from './ui/map';
import './ui/blocks.css';

const dayKey = (d = new Date()): string => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

let game: BlockGame | null = null;
let root: HTMLElement | null = null;
let best = 0;
let bestAtStart = 0;
let ctx: GameContext | null = null;
let comboTimer = 0;
let sayTimer = 0;
/** The first board after the gate is free; the next ones ask the host (which may show the gate). */
let fresh = true;
/** The game on the table is over (a level done or a full board): it is not saved any more. */
let over = false;
let level: Level | null = null;
/** the companion Rani chose in the English game (a squishy friend, or Cheesy), sitting on the corner of the board */
let comp: { set(e: Expression): void; squish(): void; hop(): void } | null = null;
let compTimer = 0;
let tense = false;
let lookBefore: ReturnType<typeof getLook> | null = null;
const base = (): string => import.meta.env.BASE_URL;

const icon = `<svg viewBox="0 0 100 100" width="64" height="64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="100" height="100" rx="22" fill="#f6dfb2"/><rect x="14" y="14" width="34" height="34" rx="9" fill="#ff5a6a"/><rect x="52" y="14" width="34" height="34" rx="9" fill="#58b8ff"/><rect x="14" y="52" width="34" height="34" rx="9" fill="#ffd23c"/><rect x="52" y="52" width="34" height="34" rx="9" fill="#7ed957"/></svg>`;
const HELPER_ICON: Record<Helper, string> = {
  swap: '<svg viewBox="0 0 48 48"><g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 20a14 14 0 0 1 24-7l4 4"/><path d="M38 8v9h-9"/><path d="M38 28a14 14 0 0 1-24 7l-4-4"/><path d="M10 40v-9h9"/></g></svg>',
  rotate: '<svg viewBox="0 0 48 48"><g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M38 24a14 14 0 1 1-5-10.7"/><path d="M36 6v10H26"/></g></svg>',
  hammer: '',
};
const NAME: Record<Helper, string> = { swap: bk.swap, rotate: bk.rotate, hammer: bk.hammer };
const itemUrl = (name: string): string => `${base()}${name === 'candy' || name === 'star' ? 'english/words/' : 'blocks/items/'}${name}.${'webp'}`;

const progress = (): Progress => ctx!.load<Progress>('journey', emptyProgress());

function save(): void {
  if (game && ctx && !over) ctx.save('session', game.snapshot());
}
const onHide = (): void => save();

// ---- the companion ----

/** The look of the companion: the squishy friend she chose in the English game, or Cheesy (read, never written, there). */
function applyCompanionLook(): void {
  const en = getState().games.english as { buddy?: string | null } | undefined;
  lookBefore ??= { ...getLook() };
  setLook({ buddy: en?.buddy ?? null, accessory: null });
}

/** A mood for a moment, then back to waiting (worried while the board is over 70% full, happy otherwise). */
function mood(e: Expression, ms = 1600): void {
  comp?.set(e);
  comp?.hop();
  window.clearTimeout(compTimer);
  compTimer = window.setTimeout(() => comp?.set(tense ? 'thinking' : 'happy'), ms);
}

/** The companion comes to the middle for the rescue, and bows out. */
function compStage(e: Expression, ms: number): void {
  const el = root?.querySelector<HTMLElement>('.bk-comp');
  if (!el) return;
  el.classList.add('center');
  mood(e, ms);
  window.setTimeout(() => el.classList.remove('center'), ms);
}

/** A companion inside an end window. */
function compIn(el: HTMLElement | null, e: Expression): void {
  if (el) mountCheesy(el, e);
}

// ---- the effects over the stage ----

function showCombo(text: string, kind: 'combo' | 'clean'): void {
  const el = root?.querySelector<HTMLElement>('.bk-combo');
  if (!el) return;
  el.textContent = text;
  el.className = `bk-combo ${kind === 'clean' ? 'clean' : ''}`;
  mood(kind === 'clean' || text === 'קסם!' || text === 'וואו!' ? 'dance' : 'cheer', kind === 'clean' ? 2800 : 1800);
  void el.offsetWidth;
  el.classList.add('go');
  window.clearTimeout(comboTimer);
  comboTimer = window.setTimeout(() => el.classList.remove('go'), 1100);
}

function showGain(points: number, x: number, y: number, big: boolean): void {
  const stage = root?.querySelector('.bk-stage');
  if (!stage || points <= 0) return;
  const el = document.createElement('div');
  el.className = `bk-gain${big ? ' big' : ''}`;
  el.textContent = `+${points}`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  stage.appendChild(el);
  window.setTimeout(() => el.remove(), 950);
}

/** A friendly line over the stage: written, and said aloud. */
function say(id: string): void {
  const el = root?.querySelector<HTMLElement>('.bk-say');
  if (!el) return;
  const key = id.replace(/^blk_/, '') as keyof typeof bk;
  el.textContent = bk[key] ?? '';
  el.classList.remove('on');
  void el.offsetWidth;
  el.classList.add('on');
  window.clearTimeout(sayTimer);
  sayTimer = window.setTimeout(() => el.classList.remove('on'), id === 'blk_idea' || id.startsWith('blk_tut') ? 3200 : 2000);
  void sayLine(id);
  if (id === 'blk_idea') compStage('surprised', 2600);
}

/** Over 70% full she is worried and encourages once; under 60% she is calm again. */
function watchBoard(fullness: number): void {
  if (!tense && fullness > 0.7) {
    tense = true;
    comp?.set('thinking');
    say('blk_cheer');
  } else if (tense && fullness < 0.6) {
    tense = false;
    comp?.set('happy');
  }
}

function setScore(total: number, mult: number): void {
  if (!root) return;
  root.querySelector('.bk-score')!.textContent = String(total);
  const s = root.querySelector('.bk-streak')!;
  s.classList.toggle('on', mult > 1);
  s.textContent = `🔥 ×${mult}`;
  if (total > best && !level) {
    best = total;
    ctx?.save('best', best);
  }
  const b = root.querySelector('.bk-best');
  if (b) b.innerHTML = `👑 ${counter(String(best))}`;
}

/** The goal of the level, at the top: a picture and a counter ("🐞 3/5"). */
function setGoal(v: GoalView): void {
  const el = root?.querySelector<HTMLElement>('.bk-goal');
  if (!el || !level) return;
  const g = level.goal;
  const pic =
    g.kind === 'collect' ? `<img src="${itemUrl(g.item)}" alt="">` : g.kind === 'score' ? '<span class="ic">🎯</span>' : g.kind === 'clears' ? '<span class="ic">💥</span>' : `<img src="${itemUrl(level.world === 2 ? 'ice' : level.world === 3 ? 'crate' : 'padlock')}" alt="">`;
  el.innerHTML = `${pic}${fraction(v.cur, v.target)}`;
  el.classList.toggle('done', v.done);
}

// ---- the row of helpers ----

function buildHelpers(): string {
  return HELPERS.map(
    (h) => `<button class="bk-help" data-h="${h}" data-say="blk_${h}" type="button" aria-label="${NAME[h]}">${h === 'hammer' ? `<img src="${base()}blocks/items/hammer.webp" alt="" draggable="false">` : HELPER_ICON[h]}<span class="bk-badge"></span></button>`,
  ).join('');
}

function paintHelpers(used: FreeUsed): void {
  if (!root || !game) return;
  const stars = getState().stars;
  for (const h of HELPERS) {
    const b = root.querySelector<HTMLElement>(`.bk-help[data-h="${h}"]`);
    if (!b) continue;
    const price = priceOf(h, used);
    b.querySelector('.bk-badge')!.innerHTML = price.free ? bk.free : `${counter(String(HELPER_COST[h]))}⭐`;
    b.classList.toggle('free', price.free);
    b.classList.toggle('dim', !!whyNot(h, { stars, used, board: game.board, tray: game.tray.map((t) => t?.piece ?? null) }));
  }
}

// ---- the end of a board (free play) ----

function dailyGiven(): number {
  const d = ctx!.load<{ day: string; n: number }>('daily', { day: '', n: 0 });
  return d.day === dayKey() ? d.n : 0;
}

function showFull(score: number): void {
  if (!root || !ctx) return;
  over = true;
  ctx.save('session', null);
  const broke = bestAtStart > 0 && score > bestAtStart;
  const stars = boardStars(score, broke, dailyGiven());
  if (stars > 0) {
    ctx.save('daily', { day: dayKey(), n: dailyGiven() + stars });
    ctx.onRoundEnd({ won: true, stars: Math.min(3, stars) as 1 | 2 | 3, score });
  }
  const [l1, l2] = bk.full.split(/,\s*/);
  const o = document.createElement('div');
  o.className = 'bk-over';
  o.innerHTML = `<div class="who"></div><h2 data-say="blk_full"><span class="l1">${l1},</span><span class="l2">${l2}</span></h2>
    <div class="big">${counter(String(score))}</div>
    ${broke ? `<div class="newbest" data-say="blk_best">👑 ${bk.best}</div>` : ''}
    ${stars > 0 ? `<div class="earned">${'⭐'.repeat(stars)}</div>` : ''}
    <div class="row"><button class="bk-btn" id="bk-new" data-say="blk_newBoard" type="button">${bk.newBoard}</button><button class="bk-btn round" id="bk-menu" type="button" aria-label="menu">☰</button></div>`;
  root.querySelector('.bk-stage')!.appendChild(o);
  compIn(o.querySelector('.who'), 'cheer');
  void sayLine(broke ? 'blk_best' : 'blk_full');
  o.querySelector('#bk-new')!.addEventListener('click', () => ctx!.requestRound(() => startFree()));
  o.querySelector('#bk-menu')!.addEventListener('click', showMenu);
}

// ---- the end of a level (journey) ----

function showLevelDone(r: { stars: 1 | 2 | 3; trays: number; score: number }): void {
  if (!root || !ctx || !level) return;
  over = true;
  ctx.save('session', null);
  const lv = level;
  const p = progress();
  const prev = p.levels[lv.id] ?? 0;
  p.levels[lv.id] = Math.max(prev, r.stars);
  ctx.save('journey', p);
  const gained = Math.max(0, r.stars - prev);
  if (gained > 0) ctx.onRoundEnd({ won: true, stars: Math.min(3, gained) as 1 | 2 | 3, score: r.score });
  const next = LEVELS.find((l) => l.id === lv.id + 1);
  const o = document.createElement('div');
  o.className = 'bk-over';
  o.innerHTML = `<div class="who"></div>${lv.boss ? `<img class="prize" src="${itemUrl('gem')}" alt="" data-say="blk_prize">` : ''}<h2 data-say="blk_levelDone">${bk.levelDone}</h2>
    <div class="bigstars">${[1, 2, 3].map((s) => `<span class="${s <= r.stars ? 'on' : ''}">⭐</span>`).join('')}</div>
    <div class="row">${next ? `<button class="bk-btn" id="bk-next" data-say="blk_next" type="button">${bk.next}</button>` : ''}<button class="bk-btn round" id="bk-again" data-say="blk_again" type="button" aria-label="${bk.again}">↻</button><button class="bk-btn round" id="bk-map" data-say="blk_map" type="button" aria-label="${bk.map}">🗺️</button></div>`;
  root.querySelector('.bk-stage')!.appendChild(o);
  compIn(o.querySelector('.who'), 'dance');
  void sayLine(lv.boss ? 'blk_prize' : 'blk_levelDone');
  o.querySelector('#bk-next')?.addEventListener('click', () => begin(next!));
  o.querySelector('#bk-again')!.addEventListener('click', () => begin(lv));
  o.querySelector('#bk-map')!.addEventListener('click', showMap);
}

// ---- the screens ----

function showMenu(): void {
  teardownGame();
  const r = root!;
  r.className = 'bk';
  r.style.setProperty('--bk-bg', `url(${base()}blocks/bg/candy.webp)`);
  r.innerHTML = `<div class="bk-pane">
      <div class="bk-mtop"><button class="bk-round" id="bk-home" aria-label="home">🏠</button><h2 data-say="blk_title">${bk.title}</h2><span class="bk-sp"></span></div>
      <div class="bk-menu">
        <button class="bk-big" id="bk-journey" data-say="blk_journey" type="button" style="background:#e0568a"><span class="ico">🗺️</span>${bk.journey}</button>
        <button class="bk-big" id="bk-free" data-say="blk_freePlay" type="button" style="background:#2aa98f"><span class="ico">♾️</span>${bk.freePlay}</button>
      </div></div>`;
  r.querySelector('#bk-home')!.addEventListener('click', () => ctx!.onExit());
  r.querySelector('#bk-journey')!.addEventListener('click', showMap);
  r.querySelector('#bk-free')!.addEventListener('click', () => begin(null));
  window.setTimeout(() => void sayLine('blk_title'), 300);
}

function showMap(): void {
  teardownGame();
  const r = root!;
  r.className = 'bk';
  r.style.setProperty('--bk-bg', `url(${base()}blocks/bg/candy.webp)`);
  renderMap(r, progress(), { onPick: (id) => begin(levelById(id)), onBack: showMenu });
}

function teardownGame(): void {
  comp = null;
  game?.destroy();
  game = null;
  over = true;
}

/** A new board or level: the first one after the gate is free, later ones ask the host (which may show the gate). */
function begin(lv: Level | null): void {
  const go = (): void => (lv ? startLevel(lv) : startFree());
  if (lv && !isUnlocked(progress(), lv.id)) return;
  if (fresh) {
    fresh = false;
    go();
  } else ctx!.requestRound(go);
}

function startFree(): void {
  level = null;
  bestAtStart = best;
  ctx!.save('boardBest', best);
  play(null, null);
}

function startLevel(lv: Level): void {
  level = lv;
  play(lv, null);
}

function play(lv: Level | null, saved: SavedGame | null): void {
  teardownGame();
  level = lv;
  over = false;
  const r = root!;
  const c = ctx!;
  const bg = lv ? worldOf(lv.world).bg : 'candy';
  r.className = `bk${lv ? ` w${lv.world}` : ''}`;
  r.style.setProperty('--bk-bg', `url(${base()}blocks/bg/${bg}.webp)`);
  const mid = lv ? `<div class="bk-goal"></div>` : `<div class="bk-best"></div>`;
  r.innerHTML = `<div class="bk-top"><button class="bk-home" type="button" aria-label="home">🏠</button><div class="bk-score">0</div>${mid}</div>
      <div class="bk-streak"></div><div class="bk-stage"><canvas class="bk-canvas"></canvas><div class="bk-combo"></div><div class="bk-say"></div><div class="bk-comp"></div><div class="bk-helpers">${buildHelpers()}</div></div>`;
  r.querySelector('.bk-home')!.addEventListener('click', () => c.onExit());
  r.querySelectorAll<HTMLElement>('.bk-help').forEach((b) =>
    b.addEventListener('click', () => {
      void sayLabel(`blk_${b.dataset.h}`, '');
      game?.useHelper(b.dataset.h as Helper);
    }),
  );
  game = new BlockGame(
    r.querySelector('canvas')!,
    {
      sound: c.sound,
      say: (id) => void sayLine(id),
      onScore: setScore,
      onCombo: showCombo,
      onGain: showGain,
      onFull: showFull,
      onShake: () => {
        r.classList.remove('shake');
        void r.offsetWidth;
        r.classList.add('shake');
      },
      best: () => best,
      onLayout: (top, cell, boardTop, boardX, boardW) => {
        const cp = r.querySelector<HTMLElement>('.bk-comp');
        if (cp) {
          // she sits on the top edge of the board, at the right corner
          cp.style.width = `${cell * 1.35}px`;
          cp.style.height = `${cell * 1.28}px`;
          cp.style.top = `${boardTop - cell * 1.22}px`;
          cp.style.left = `${boardX + boardW - cell * 1.5}px`;
        }
        const h = r.querySelector<HTMLElement>('.bk-helpers')!;
        h.style.top = `${top}px`;
        h.style.setProperty('--cell', `${cell}px`);
      },
      onMoveDone: () => {
        save();
        if (game) {
          paintHelpers(game.free);
          watchBoard(game.board.fullness);
        }
      },
      onMode: (m) => r.querySelectorAll('.bk-help').forEach((b) => b.classList.toggle('active', (b as HTMLElement).dataset.h === m)),
      onHelpers: (f) => paintHelpers(f),
      onSay: say,
      stars: () => getState().stars,
      spend: (n) => c.addStars(-n),
      onGoal: setGoal,
      onLevelDone: showLevelDone,
      goalPos: () => {
        const img = r.querySelector('.bk-goal');
        const cv = r.querySelector('canvas');
        if (!img || !cv) return null;
        const a = img.getBoundingClientRect();
        const b = cv.getBoundingClientRect();
        return { x: a.left + 24 - b.left, y: a.top + a.height / 2 - b.top };
      },
    },
    Date.now() % 1e9,
    saved,
    lv,
  );
  tense = false;
  const cel = r.querySelector<HTMLElement>('.bk-comp');
  comp = cel ? mountCheesy(cel, 'happy') : null;
  setScore(saved?.score.total ?? 0, game.score.multiplier);
  paintHelpers(game.free);
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__bk = { game, PIECES, pieceById, STAR_TARGETS, ITEMS, levelById };
}

const blocks: GameModule = {
  id: 'blocks',
  title: bk.title,
  icon,
  color: '#e0568a',
  /** Out of the game and back within 10 minutes: the same board, without the gate (like the memory game after a reload). */
  resumeWithoutGate: true,

  mount(c: GameContext) {
    ctx = c;
    applyCompanionLook();
    best = c.load<number>('best', 0);
    bestAtStart = best;
    fresh = true;
    over = true;
    level = null;
    root = document.createElement('div');
    root.className = 'bk';
    c.container.appendChild(root);
    root.addEventListener('pointerdown', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-say]');
      if (el?.dataset.say && !el.classList.contains('bk-help') && !el.classList.contains('bk-stop')) void sayLabel(el.dataset.say, '');
    });
    window.addEventListener('pagehide', onHide);
    // a game saved less than 10 minutes ago goes on
    const saved = validSaved(c.load('session', null));
    const goOn = saved && Date.now() - saved.savedAt < SESSION_TTL_MS && (!saved.journey || LEVELS.some((l) => l.id === saved.journey!.level)) ? saved : null;
    if (goOn) {
      fresh = false;
      bestAtStart = c.load<number>('boardBest', best);
      play(goOn.journey ? levelById(goOn.journey.level) : null, goOn);
    } else {
      c.save('session', null);
      showMenu();
    }
  },

  canInterrupt: () => true,
  pause() {},
  resume() {},

  unmount() {
    window.removeEventListener('pagehide', onHide);
    save();
    game?.destroy();
    game = null;
    stopSpeech();
    window.clearTimeout(sayTimer);
    window.clearTimeout(compTimer);
    comp = null;
    if (lookBefore) setLook(lookBefore);
    lookBefore = null;
    root?.remove();
    root = null;
    ctx = null;
  },
};

export default blocks;
