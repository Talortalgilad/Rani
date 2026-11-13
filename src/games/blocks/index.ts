import type { GameContext, GameModule } from '../types';
import { sayLabel, sayLine } from '../english/content/heLines';
import { stopSpeech } from '../english/voice';
import { counter } from '../../ui/counter';
import { SESSION_TTL_MS } from '../../access';
import { getState } from '../../storage';
import { BlockGame } from './game';
import { bk } from './lines';
import { PIECES, pieceById } from './pieces';
import { HELPERS, HELPER_COST, priceOf, whyNot, type FreeUsed, type Helper } from './helpers';
import { validSaved } from './save';
import { boardStars } from './stars';
import './ui/blocks.css';

const dayKey = (d = new Date()): string => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

let game: BlockGame | null = null;
let root: HTMLElement | null = null;
let best = 0;
let bestAtStart = 0;
let ctx: GameContext | null = null;
let comboTimer = 0;
let sayTimer = 0;
const base = (): string => import.meta.env.BASE_URL;

const icon = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="22" fill="#f6dfb2"/><rect x="14" y="14" width="34" height="34" rx="9" fill="#ff5a6a"/><rect x="52" y="14" width="34" height="34" rx="9" fill="#58b8ff"/><rect x="14" y="52" width="34" height="34" rx="9" fill="#ffd23c"/><rect x="52" y="52" width="34" height="34" rx="9" fill="#7ed957"/></svg>`;
const HELPER_ICON: Record<Helper, string> = {
  swap: '<svg viewBox="0 0 48 48"><g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 20a14 14 0 0 1 24-7l4 4"/><path d="M38 8v9h-9"/><path d="M38 28a14 14 0 0 1-24 7l-4-4"/><path d="M10 40v-9h9"/></g></svg>',
  rotate: '<svg viewBox="0 0 48 48"><g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M38 24a14 14 0 1 1-5-10.7"/><path d="M36 6v10H26"/></g></svg>',
  hammer: '',
};
const NAME: Record<Helper, string> = { swap: bk.swap, rotate: bk.rotate, hammer: bk.hammer };

function save(): void {
  if (game && ctx) ctx.save('session', game.snapshot());
}
const onHide = (): void => save();

function showCombo(text: string, kind: 'combo' | 'clean'): void {
  const el = root?.querySelector<HTMLElement>('.bk-combo');
  if (!el) return;
  el.textContent = text;
  el.className = `bk-combo ${kind === 'clean' ? 'clean' : ''}`;
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
  const avatar = id === 'blk_idea' ? `${getState().profile.avatar || '🦄'} ` : '';
  el.textContent = `${avatar}${bk[key] ?? ''}`;
  el.classList.remove('on');
  void el.offsetWidth;
  el.classList.add('on');
  window.clearTimeout(sayTimer);
  sayTimer = window.setTimeout(() => el.classList.remove('on'), id === 'blk_idea' ? 2600 : 2000);
  void sayLine(id);
}

function setScore(total: number, mult: number): void {
  if (!root) return;
  root.querySelector('.bk-score')!.textContent = String(total);
  const s = root.querySelector('.bk-streak')!;
  s.classList.toggle('on', mult > 1);
  s.textContent = `🔥 ×${mult}`;
  if (total > best) {
    best = total;
    ctx?.save('best', best);
  }
  root.querySelector('.bk-best')!.innerHTML = `👑 ${counter(String(best))}`;
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

// ---- the end of a board ----

function dailyGiven(): number {
  const d = ctx!.load<{ day: string; n: number }>('daily', { day: '', n: 0 });
  return d.day === dayKey() ? d.n : 0;
}

function showFull(score: number): void {
  if (!root || !ctx) return;
  ctx.save('session', null);
  const broke = bestAtStart > 0 && score > bestAtStart;
  const stars = boardStars(score, broke, dailyGiven());
  if (stars > 0) {
    ctx.save('daily', { day: dayKey(), n: dailyGiven() + stars });
    ctx.onRoundEnd({ won: true, stars: Math.min(3, stars) as 1 | 2 | 3, score });
  }
  const o = document.createElement('div');
  o.className = 'bk-over';
  o.innerHTML = `<h2 data-say="blk_full">${bk.full}</h2>
    <div class="big">${counter(String(score))}</div>
    ${broke ? `<div class="newbest" data-say="blk_best">👑 ${bk.best}</div>` : ''}
    ${stars > 0 ? `<div class="earned">${'⭐'.repeat(stars)}</div>` : ''}
    <div class="row"><button class="bk-btn" id="bk-new" data-say="blk_newBoard" type="button">${bk.newBoard}</button><button class="bk-btn round" id="bk-exit" type="button" aria-label="home">🏠</button></div>`;
  root.querySelector('.bk-stage')!.appendChild(o);
  void sayLine(broke ? 'blk_best' : 'blk_full');
  o.querySelector('#bk-new')!.addEventListener('click', () => {
    // a new board is a new round: the host may show the gate (the first board after entering is free)
    ctx!.requestRound(() => {
      o.remove();
      bestAtStart = best;
      ctx?.save('boardBest', best);
      game?.restart();
      save();
    });
  });
  o.querySelector('#bk-exit')!.addEventListener('click', () => ctx!.onExit());
}

const blocks: GameModule = {
  id: 'blocks',
  title: bk.title,
  icon,
  color: '#e0568a',

  mount(c: GameContext) {
    ctx = c;
    best = c.load<number>('best', 0);
    bestAtStart = best;
    root = document.createElement('div');
    root.className = 'bk';
    // the candy background of the free game: fetched when the game opens, kept for offline by the runtime cache
    root.style.setProperty('--bk-bg', `url(${base()}blocks/bg/candy.webp)`);
    root.innerHTML = `<div class="bk-top"><button class="bk-home" type="button" aria-label="home">🏠</button><div class="bk-score">0</div><div class="bk-best"></div></div>
      <div class="bk-streak"></div><div class="bk-stage"><canvas class="bk-canvas"></canvas><div class="bk-combo"></div><div class="bk-say"></div><div class="bk-helpers">${buildHelpers()}</div></div>`;
    c.container.appendChild(root);
    const r = root;
    r.querySelector('.bk-home')!.addEventListener('click', () => c.onExit());
    r.addEventListener('pointerdown', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-say]');
      if (el?.dataset.say && !el.classList.contains('bk-help')) void sayLabel(el.dataset.say, '');
    });
    r.querySelectorAll<HTMLElement>('.bk-help').forEach((b) => b.addEventListener('click', () => game?.useHelper(b.dataset.h as Helper)));
    // a game saved less than 10 minutes ago goes on (without the gate when the app was reloaded)
    const saved = validSaved(c.load('session', null));
    const goOn = saved && Date.now() - saved.savedAt < SESSION_TTL_MS ? saved : null;
    // the best score before this board began (a new best is celebrated at its end)
    if (goOn) bestAtStart = c.load<number>('boardBest', best);
    else {
      c.save('session', null);
      c.save('boardBest', best);
    }
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
        onLayout: (top, cell) => {
          const h = r.querySelector<HTMLElement>('.bk-helpers')!;
          h.style.top = `${top}px`;
          h.style.setProperty('--cell', `${cell}px`);
        },
        onMoveDone: () => {
          save();
          if (game) paintHelpers(game.free);
        },
        onMode: (m) => r.querySelectorAll('.bk-help').forEach((b) => b.classList.toggle('active', (b as HTMLElement).dataset.h === m)),
        onHelpers: (f) => paintHelpers(f),
        onSay: say,
        stars: () => getState().stars,
        spend: (n) => c.addStars(-n),
      },
      Date.now() % 1e9,
      goOn,
    );
    paintHelpers(game.free);
    setScore(goOn?.score.total ?? 0, game.score.multiplier);
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__bk = { game, PIECES, pieceById };
    window.addEventListener('pagehide', onHide);
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
    root?.remove();
    root = null;
    ctx = null;
  },
};

export default blocks;
