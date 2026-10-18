import { LEVELS, WORLDS, pairsOf } from '../levels';

export interface LevelProgress { stars: number; bestAttempts: number; bestStreak: number }
export interface Progress { levels: Record<number, LevelProgress> }

export const emptyProgress = (): Progress => ({ levels: {} });

/** A level opens once the previous one is finished. */
export const isUnlocked = (p: Progress, id: number): boolean => id === 1 || (p.levels[id - 1]?.stars ?? 0) > 0;

/** Level select for the worlds that exist so far (the illustrated map comes in stage 2). */
export function renderMap(root: HTMLElement, p: Progress, cb: { onPick(id: number): void; onBack(): void }): void {
  root.innerHTML = `
    <div class="mm-pane">
      <div class="mm-top">
        <button class="icon-btn small" id="mm-back" aria-label="חזרה">⬅️</button>
        <h2>מסע</h2>
        <span class="mm-sp"></span>
      </div>
      ${WORLDS.map((w) => `
        <section class="mm-world">
          <h3>${w.icon} ${w.name}</h3>
          <div class="mm-lvls">${LEVELS.filter((l) => l.world === w.id).map((l) => {
            if (!isUnlocked(p, l.id)) return `<button class="mm-lvl locked" data-id="${l.id}" aria-label="נעול"><b>🔒</b></button>`;
            const st = p.levels[l.id]?.stars ?? 0;
            return `<button class="mm-lvl ${l.boss ? 'boss' : ''}" data-id="${l.id}"><b>${l.id}</b>
              <span class="mm-stars">${[1, 2, 3].map((s) => `<i class="${s <= st ? 'on' : ''}">⭐</i>`).join('')}</span>
              <small dir="ltr">${l.cols}×${l.rows} · ${pairsOf(l)}</small></button>`;
          }).join('')}</div>
        </section>`).join('')}
    </div>`;
  root.querySelector('#mm-back')!.addEventListener('click', cb.onBack);
  root.querySelectorAll<HTMLButtonElement>('.mm-lvl').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.classList.contains('locked')) {
        b.classList.remove('wiggle');
        void b.offsetWidth;
        b.classList.add('wiggle');
      } else cb.onPick(Number(b.dataset.id));
    }),
  );
}
