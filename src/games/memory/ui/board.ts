import type { SoundApi } from '../../../sound';
import { DECKS } from '../decks';
import { svg } from '../decks/svg';
import { MemoryGame, buildCards, starsFor } from '../engine';
import type { Level } from '../levels';
import { pairsOf } from '../levels';
import type { RoundSummary } from './result';

const GAP = 8;
const ASPECT = 0.8; // card width / height
const MIN_CARD = 56;
const FLIP_MS = 300;
const MISS_MS = 900;

export interface Board {
  game: MemoryGame;
  /** True while a miss is showing or the last pair is celebrating (not a good moment to interrupt). */
  busy(): boolean;
  destroy(): void;
}

export function mountBoard(
  root: HTMLElement,
  level: Level,
  deps: { sound: SoundApi; onBack(): void; onFinish(r: RoundSummary): void },
): Board {
  const deck = DECKS[level.deck];
  const game = new MemoryGame(buildCards(deck.keys, pairsOf(level), level.group), level.group);
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };
  let finishing = false;

  root.innerHTML = `
    <div class="mm-game">
      <div class="mm-hud">
        <button class="icon-btn small" id="mm-back" aria-label="שלבים">🔢</button>
        <div class="mm-attempts" aria-label="ניסיונות">🔄 <b id="mm-n">0</b></div>
        <span class="mm-sp"></span>
      </div>
      <div class="mm-board"><div class="mm-grid" style="--frame:${deck.frame}"></div></div>
    </div>`;
  const boardEl = root.querySelector('.mm-board') as HTMLElement;
  const grid = root.querySelector('.mm-grid') as HTMLElement;
  const counter = root.querySelector('#mm-n') as HTMLElement;
  root.querySelector('#mm-back')!.addEventListener('click', deps.onBack);

  grid.innerHTML = game.cards
    .map(
      (c, i) => `
      <button class="mcard" data-i="${i}" aria-label="קלף" style="animation-delay:${i * 40}ms">
        <span class="mcard-inner">
          <span class="face back">${deck.back}</span>
          <span class="face front">${svg(deck.art[c.art])}</span>
        </span>
      </button>`,
    )
    .join('');
  const els = [...grid.querySelectorAll<HTMLElement>('.mcard')];

  /** Card size fills the screen but never drops below 56px. */
  function layout(): void {
    const r = boardEl.getBoundingClientRect();
    const w = r.width - 16;
    const h = r.height - 16;
    const cw = Math.max(
      MIN_CARD,
      Math.min((w - GAP * (level.cols - 1)) / level.cols, ((h - GAP * (level.rows - 1)) / level.rows) * ASPECT),
    );
    grid.style.setProperty('--cw', `${cw}px`);
    grid.style.setProperty('--ch', `${cw / ASPECT}px`);
    grid.style.gridTemplateColumns = `repeat(${level.cols}, ${cw}px)`;
  }
  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(boardEl);

  const setFlipped = (i: number, up: boolean) => els[i].classList.toggle('flipped', up);

  // soft synthesized cues; richer sounds arrive with the shared sound module in stage 2
  const sfx = {
    flip: () => deps.sound.play('pop', 1400),
    hop: () => deps.sound.play('pop', 392),
    pair: () => {
      deps.sound.play('pop', 784);
      later(() => deps.sound.play('pop', 1047), 110);
    },
  };

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

  grid.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.mcard');
    if (!el || finishing) return;
    const res = game.flip(Number(el.dataset.i));
    if (res.kind === 'ignored') return;
    const idx = res.kind === 'open' ? res.index : res.indices[res.indices.length - 1];
    setFlipped(idx, true);
    sfx.flip();
    counter.textContent = String(game.attempts);

    if (res.kind === 'match') {
      later(() => {
        sfx.pair();
        res.indices.forEach((j) => {
          els[j].classList.add('match');
          sparkle(els[j]);
        });
      }, FLIP_MS);
      later(() => res.indices.forEach((j) => els[j].classList.add('gone')), FLIP_MS + 800);
      if (game.done) {
        finishing = true;
        later(() => deps.onFinish({ stars: starsFor(game.attempts, game.pairs), attempts: game.attempts, bestStreak: game.bestStreak }), FLIP_MS + 1500);
      }
    } else if (res.kind === 'miss') {
      later(() => {
        game.unflip().forEach((j) => setFlipped(j, false));
        sfx.hop();
      }, MISS_MS + FLIP_MS);
    }
  });

  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__mm = { game, els };

  return {
    game,
    busy: () => game.resolving || finishing,
    destroy() {
      timers.forEach(clearTimeout);
      timers.clear();
      ro.disconnect();
    },
  };
}
