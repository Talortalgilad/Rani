import type { SoundApi } from '../../../sound';
import { speak } from '../../../speech';
import { DECKS } from '../decks';
import { MemoryGame, starsFor, type Card } from '../engine';
import { ASPECT, cardWidth } from '../layout';
import type { Level } from '../levels';
import { groupsOf } from '../levels';
import { frontFace } from './faces';
import type { RoundSummary } from './result';

const FLIP_MS = 300;
const MISS_MS = 900;
const PEEK_MS = 1500;
const BELL_BASE = 523.25;

export interface Board {
  game: MemoryGame;
  /** True while a miss, a peek, a shuffle or the closing celebration is going on (a bad moment to interrupt). */
  busy(): boolean;
  destroy(): void;
}

export function mountBoard(
  root: HTMLElement,
  level: Level,
  cards: Card[],
  deps: { sound: SoundApi; onStar(): void; onBack(): void; onFinish(r: RoundSummary): void },
): Board {
  const deck = DECKS[level.deck];
  const game = new MemoryGame(cards, level.group);
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
        <div class="mm-attempts" aria-label="ניסיונות">🔄 <b id="mm-n">0</b></div>
        <button class="icon-btn small mm-bulb" id="mm-bulb" aria-label="עזרה" hidden>💡</button>
      </div>
      <div class="mm-board">
        <div class="mm-combo" id="mm-combo" dir="ltr" hidden></div>
        <div class="mm-grid" id="mm-grid"></div>
      </div>
    </div>`;
  const boardEl = root.querySelector('.mm-board') as HTMLElement;
  const grid = root.querySelector('#mm-grid') as HTMLElement;
  const counter = root.querySelector('#mm-n') as HTMLElement;
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
    const cw = cardWidth(r.width - 16, r.height - 16, level.cols, level.rows);
    grid.style.setProperty('--cw', `${cw}px`);
    grid.style.setProperty('--ch', `${cw / ASPECT}px`);
    grid.style.gridTemplateColumns = `repeat(${level.cols}, ${cw}px)`;
  }
  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(boardEl);

  // "dealt from a deck": every card starts at the centre of the board and flies to its place
  function deal(): void {
    const b = grid.getBoundingClientRect();
    const cx = b.left + b.width / 2;
    const cy = b.top + b.height / 2;
    els.forEach((el, i) => {
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
    bulb.hidden = !game.hintAvailable;
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
      }, FLIP_MS);
      later(() => res.indices.forEach((j) => els[j].classList.add('gone')), FLIP_MS + 800);
      if (game.done) {
        finishing = true;
        later(() => deps.onFinish({ stars: starsFor(game.attempts, groupsOf(level)), attempts: game.attempts, bestStreak: game.bestStreak }), FLIP_MS + 1500);
      } else if (res.special === 'peek') later(peek, FLIP_MS + 900);
      else if (res.special === 'shuffle') later(shuffleCards, FLIP_MS + 900);
      hold(FLIP_MS + 900);
    } else if (res.kind === 'miss') {
      hold(MISS_MS + FLIP_MS);
      later(() => {
        game.unflip().forEach((j) => setFlipped(j, false));
        deps.sound.play('pop', 392);
        showCombo();
        updateBulb();
      }, MISS_MS + FLIP_MS);
    }
  });

  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__mm = { game, els, level };

  return {
    game,
    busy: () => game.resolving || game.locked || finishing || busyCount > 0,
    destroy() {
      timers.forEach(clearTimeout);
      timers.clear();
      ro.disconnect();
    },
  };
}
