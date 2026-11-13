import { mm } from '../lines';
import type { LevelProgress } from './map';

export interface RoundSummary { stars: 1 | 2 | 3; attempts: number; bestStreak: number }

export function renderResult(
  overlay: HTMLElement,
  r: RoundSummary,
  prev: LevelProgress | undefined,
  hasNext: boolean,
  cb: { onNext(): void; onAgain(): void; onLevels(): void; onHome(): void },
  /** a free game (the stars are shown but do not go into the jar; no personal best) */
  free = false,
): void {
  const record = !prev || prev.bestAttempts === 0 || r.attempts < prev.bestAttempts;
  const best = Math.min(r.attempts, prev?.bestAttempts || r.attempts);
  overlay.innerHTML = `
    <div class="mm-card">
      <div class="mm-bigstars">${[1, 2, 3].map((i) => `<span class="${i <= r.stars ? 'on' : ''}">⭐</span>`).join('')}</div>
      <div class="mm-facts" style="grid-template-columns:repeat(${free ? 2 : 3},1fr)">
        <div data-say="mm_attempts"><b>${r.attempts}</b><span>${mm.attempts}</span></div>
        <div data-say="mm_streak"><b>${r.bestStreak}</b><span>${mm.streak}</span></div>
        ${free ? '' : `<div data-say="mm_best"><b>${best}</b><span>${mm.best}</span></div>`}
      </div>
      ${record && !free ? `<div class="mm-best" data-say="mm_record">🏆 ${mm.record}</div>` : ''}
      ${hasNext ? `<button class="btn big" id="mm-next" data-say="mm_next">▶ ${mm.next}</button>` : ''}
      <button class="btn ${hasNext ? 'alt' : 'big'}" id="mm-again" data-say="mm_again">🔁 ${mm.again}</button>
      <div class="mm-row"><button class="btn alt" id="mm-levels" data-say="${free ? 'mm_decks' : 'mm_levels'}">${free ? `🎨 ${mm.decks}` : `🔢 ${mm.levels}`}</button><button class="btn alt" id="mm-home" data-say="home">🏠 בית</button></div>
    </div>`;
  overlay.hidden = false;
  overlay.querySelector('#mm-next')?.addEventListener('click', cb.onNext);
  overlay.querySelector('#mm-again')!.addEventListener('click', cb.onAgain);
  overlay.querySelector('#mm-levels')!.addEventListener('click', cb.onLevels);
  overlay.querySelector('#mm-home')!.addEventListener('click', cb.onHome);
}
