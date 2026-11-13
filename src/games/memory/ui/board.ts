import type { SoundApi } from '../../../sound';
import { speak } from '../../../speech';
import { MemoryGame, starsFor, type Card } from '../engine';
import { ASPECT, cardWidth } from '../layout';
import type { Player, Versus, Winner } from '../versus';
import { frontFace } from './faces';
import type { RoundSummary } from './result';

const FLIP_MS = 300;
const MISS_MS = 900;
const PEEK_MS = 1500;
const BELL_BASE = 523.25;

/** What a board needs to know about its deck and its size: the journey, a free game and a game for two all use it. */
export interface BoardConfig { back: string; frame: string; cols: number; rows: number; group: 2 | 3 }

export interface BoardDeps {
  sound: SoundApi;
  onStar(): void;
  onBack(): void;
  onFinish(r: RoundSummary & { winner?: Winner }): void;
  /** a round that was saved in the middle (restored: found cards are gone, open cards are open) */
  game?: MemoryGame;
  /** two players: the turns, the scores, and the pairs that fly to the side of the one who found them */
  versus?: Versus;
  /** the state changed and is calm (no miss showing): the moment to save it */
  onChange?(): void;
  /** a group was found: its picture key (the English decks say the word) */
  onFound?(art: string): void;
  /** versus: whose turn it is now ('turn'), or that the same player goes on after a pair ('again') */
  onTurn?(kind: 'turn' | 'again', player: Player): void;
}

export interface Board {
  game: MemoryGame;
  versus?: Versus;
  /** True while a miss, a peek, a shuffle or the closing celebration is going on (a bad moment to interrupt). */
  busy(): boolean;
  destroy(): void;
}

export function mountBoard(root: HTMLElement, cfg: BoardConfig, cards: Card[], deps: BoardDeps): Board {
  const deck = { back: cfg.back, frame: cfg.frame };
  const game = deps.game ?? new MemoryGame(cards, cfg.group);
  const versus = deps.versus;
  cards = game.cards;
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };
  let finishing = false;
  let busyCount = 0;
  const hold = (ms: number) => {
    busyCount++;
    later(() => busyCount--, ms);
  };

  root.innerHTML = `
    <div class="mm-game">
      <div class="mm-hud">
        <button class="icon-btn small" id="mm-back" aria-label="חזרה">🔢</button>
        ${
          versus
            ? `<div class="mm-vs">${([0, 1] as const).map((k) => `<div class="mm-pl p${k}" id="mm-p${k}" aria-label="${versus.players[k].name}"><span class="av">${versus.players[k].avatar}</span><span class="nm">${versus.players[k].name}</span><b>${versus.scores[k]}</b></div>`).join('')}</div>`
            : `<div class="mm-attempts" aria-label="ניסיונות">🔄 <b id="mm-n">0</b></div>`
        }
        <button class="icon-btn small mm-bulb" id="mm-bulb" aria-label="עזרה" hidden>💡</button>
      </div>
      <div class="mm-board">
        <div class="mm-combo" id="mm-combo" dir="ltr" hidden></div>
        <div class="mm-grid" id="mm-grid"></div>
      </div>
    </div>`;
  const boardEl = root.querySelector('.mm-board') as HTMLElement;
  const grid = root.querySelector('#mm-grid') as HTMLElement;
  const counter = (root.querySelector('#mm-n') ?? document.createElement('b')) as HTMLElement;
  counter.textContent = String(game.attempts);
  const panel = (k: 0 | 1): HTMLElement | null => root.querySelector<HTMLElement>(`#mm-p${k}`);
  /** versus: the score of both and who is up (the player whose turn it is glows) */
  function paintVersus(): void {
    if (!versus) return;
    ([0, 1] as const).forEach((k) => {
      const p = panel(k);
      if (!p) return;
      p.querySelector('b')!.textContent = String(versus.scores[k]);
      p.classList.toggle('on', versus.turn === k);
    });
  }
  paintVersus();
  const bulb = root.querySelector('#mm-bulb') as HTMLButtonElement;
  const comboEl = root.querySelector('#mm-combo') as HTMLElement;
  root.querySelector('#mm-back')!.addEventListener('click', deps.onBack);

  grid.innerHTML = cards
    .map(
      (_, i) => `
      <button class="mcard" data-i="${i}" aria-label="קלף">
        <span class="mcard-inner">
          <span class="face back">${deck.back}</span>
          <span class="face front"></span>
        </span>
      </button>`,
    )
    .join('');
  const els = [...grid.querySelectorAll<HTMLElement>('.mcard')];

  /** (Re)draws the face-up side of card i from the current game state. */
  function paintFront(i: number): void {
    const f = frontFace(game.cards[i], deck.frame);
    const front = els[i].querySelector('.front') as HTMLElement;
    front.innerHTML = f.html;
    front.style.setProperty('--frame', f.frame);
    front.classList.toggle('plain', !game.cards[i].face);
  }
  cards.forEach((_, i) => paintFront(i));

  function layout(): void {
    const r = boardEl.getBoundingClientRect();
    const cw = cardWidth(r.width - 16, r.height - 16, cfg.cols, cfg.rows);
    grid.style.setProperty('--cw', `${cw}px`);
    grid.style.setProperty('--ch', `${cw / ASPECT}px`);
    grid.style.gridTemplateColumns = `repeat(${cfg.cols}, ${cw}px)`;
  }
  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(boardEl);

  // "dealt from a deck": every card starts at the centre of the board and flies to its place
  // a restored round: the found cards are gone and the open card (if one) is face up
  els.forEach((el, i) => {
    if (game.matched[i]) el.classList.add('gone');
    else if (game.open.includes(i)) el.classList.add('flipped');
  });

  function deal(): void {
    const b = grid.getBoundingClientRect();
    const cx = b.left + b.width / 2;
    const cy = b.top + b.height / 2;
    els.forEach((el, i) => {
      if (game.matched[i]) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--dx', `${cx - (r.left + r.width / 2)}px`);
      el.style.setProperty('--dy', `${cy - (r.top + r.height / 2)}px`);
      el.style.animationDelay = `${i * 45}ms`;
      el.classList.add('dealing');
    });
    hold(els.length * 45 + 450);
    later(() => els.forEach((el) => el.classList.remove('dealing')), els.length * 45 + 500);
  }
  deal();

  const setFlipped = (i: number, up: boolean) => els[i].classList.toggle('flipped', up);

  function sparkle(el: HTMLElement): void {
    for (let n = 0; n < 6; n++) {
      const s = document.createElement('i');
      s.className = 'spark';
      const a = (n / 6) * Math.PI * 2;
      s.style.setProperty('--dx', `${Math.cos(a) * 46}px`);
      s.style.setProperty('--dy', `${Math.sin(a) * 46}px`);
      el.appendChild(s);
      later(() => s.remove(), 800);
    }
  }

  function showCombo(): void {
    if (game.streak < 2) {
      comboEl.hidden = true;
      return;
    }
    comboEl.textContent = `×${game.streak}`;
    comboEl.hidden = false;
    comboEl.classList.remove('pop');
    void comboEl.offsetWidth;
    comboEl.classList.add('pop');
  }

  function updateBulb(): void {
    bulb.hidden = !!versus || !game.hintAvailable;
  }
  bulb.addEventListener('click', () => {
    const i = game.useHint();
    if (i < 0) return;
    bulb.hidden = true;
    els[i].classList.add('hint');
    later(() => els[i].classList.remove('hint'), 1600);
  });

  function peek(): void {
    const idx = els.map((_, i) => i).filter((i) => !game.matched[i] && !game.open.includes(i));
    game.locked = true;
    hold(PEEK_MS + FLIP_MS * 2);
    idx.forEach((i) => setFlipped(i, true));
    deps.sound.play('flip');
    later(() => {
      idx.forEach((i) => setFlipped(i, false));
      game.locked = false;
    }, PEEK_MS + FLIP_MS);
  }

  function shuffleCards(): void {
    game.locked = true;
    hold(1000);
    const idx = game.shuffleRemaining();
    idx.forEach((i) => els[i].classList.add('shuf'));
    deps.sound.play('flip');
    later(() => idx.forEach(paintFront), 350);
    later(() => {
      idx.forEach((i) => els[i].classList.remove('shuf'));
      game.locked = false;
    }, 800);
  }

  grid.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.mcard');
    if (!el || finishing) return;
    const i = Number(el.dataset.i);
    const res = game.flip(i);
    if (res.kind === 'ignored') return;
    const idx = res.kind === 'open' ? res.index : res.indices[res.indices.length - 1];
    setFlipped(idx, true);
    deps.sound.play('flip');
    counter.textContent = String(game.attempts);
    const face = game.cards[idx].face;
    if (face?.kind === 'word') speak(face.word);

    if (res.kind === 'match') {
      const pitch = BELL_BASE * 2 ** ((Math.min(game.streak, 8) - 1) / 6);
      later(() => {
        deps.sound.play('bell', pitch);
        res.indices.forEach((j) => {
          els[j].classList.add('match');
          sparkle(els[j]);
        });
        showCombo();
        updateBulb();
        if (res.special === 'star') deps.onStar();
        deps.onFound?.(game.cards[res.indices[0]].art);
      }, FLIP_MS);
      // versus: the pair flies to the side of the player who found it; solo: it fades away
      const who = versus ? versus.match() : 0;
      if (versus) {
        later(() => {
          paintVersus();
          deps.onTurn?.('again', versus.current);
        }, FLIP_MS + 100);
        later(() => {
          const t = panel(who)?.getBoundingClientRect();
          res.indices.forEach((j) => {
            const r = els[j].getBoundingClientRect();
            if (t) {
              els[j].style.setProperty('--fx', `${t.left + t.width / 2 - (r.left + r.width / 2)}px`);
              els[j].style.setProperty('--fy', `${t.top + t.height / 2 - (r.top + r.height / 2)}px`);
            }
            els[j].classList.add('fly');
          });
        }, FLIP_MS + 650);
        later(() => panel(who)?.classList.add('got'), FLIP_MS + 1250);
        later(() => panel(who)?.classList.remove('got'), FLIP_MS + 1700);
      } else later(() => res.indices.forEach((j) => els[j].classList.add('gone')), FLIP_MS + 800);
      later(() => deps.onChange?.(), FLIP_MS + 50);
      if (game.done) {
        finishing = true;
        later(() => deps.onFinish({ stars: starsFor(game.attempts, game.pairs, cfg.group), attempts: game.attempts, bestStreak: game.bestStreak, ...(versus ? { winner: versus.winner() } : {}) }), FLIP_MS + (versus ? 2100 : 1500));
      } else if (res.special === 'peek') later(peek, FLIP_MS + 900);
      else if (res.special === 'shuffle') later(shuffleCards, FLIP_MS + 900);
      hold(FLIP_MS + (versus ? 1500 : 900));
    } else if (res.kind === 'miss') {
      hold(MISS_MS + FLIP_MS);
      later(() => {
        game.unflip().forEach((j) => setFlipped(j, false));
        deps.sound.play('pop', 392);
        showCombo();
        updateBulb();
        if (versus) {
          versus.miss();
          paintVersus();
          deps.onTurn?.('turn', versus.current);
        }
        deps.onChange?.();
      }, MISS_MS + FLIP_MS);
    } else if (res.kind === 'open') deps.onChange?.();
  });

  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__mm = { game, els, cfg, versus };

  return {
    game,
    versus,
    busy: () => game.resolving || game.locked || finishing || busyCount > 0,
    destroy() {
      timers.forEach(clearTimeout);
      timers.clear();
      ro.disconnect();
    },
  };
}
