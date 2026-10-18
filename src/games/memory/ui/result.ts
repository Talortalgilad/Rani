import type { LevelProgress } from './map';

export interface RoundSummary { stars: 1 | 2 | 3; attempts: number; bestStreak: number }

export function renderResult(
  overlay: HTMLElement,
  r: RoundSummary,
  prev: LevelProgress | undefined,
  hasNext: boolean,
  cb: { onNext(): void; onAgain(): void; onLevels(): void; onHome(): void },
): void {
  const record = !prev || prev.bestAttempts === 0 || r.attempts < prev.bestAttempts;
  const best = Math.min(r.attempts, prev?.bestAttempts || r.attempts);
  overlay.innerHTML = `
    <div class="mm-card">
      <div class="mm-bigstars">${[1, 2, 3].map((i) => `<span class="${i <= r.stars ? 'on' : ''}">⭐</span>`).join('')}</div>
      <div class="mm-facts">
        <div><b>${r.attempts}</b><span>ניסיונות</span></div>
        <div><b>${r.bestStreak}</b><span>רצף ארוך</span></div>
        <div><b>${best}</b><span>שיא אישי</span></div>
      </div>
      ${record ? '<div class="mm-best">🏆 שיא חדש!</div>' : ''}
      ${hasNext ? '<button class="btn big" id="mm-next">▶ השלב הבא</button>' : ''}
      <button class="btn ${hasNext ? 'alt' : 'big'}" id="mm-again">🔁 שוב</button>
      <div class="mm-row"><button class="btn alt" id="mm-levels">🔢 שלבים</button><button class="btn alt" id="mm-home">🏠 בית</button></div>
    </div>`;
  overlay.hidden = false;
  overlay.querySelector('#mm-next')?.addEventListener('click', cb.onNext);
  overlay.querySelector('#mm-again')!.addEventListener('click', cb.onAgain);
  overlay.querySelector('#mm-levels')!.addEventListener('click', cb.onLevels);
  overlay.querySelector('#mm-home')!.addEventListener('click', cb.onHome);
}
