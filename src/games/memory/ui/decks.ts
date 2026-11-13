import { ALL_FREE_DECKS, lockOf, type FreeDeck, type Lock } from '../decks/free';
import { pictureHtml } from '../decks/pictures';
import { mm } from '../lines';
import type { Progress } from './map';

/** The line (id) of the name of each deck, so that it can be read aloud. */
export const DECK_LINE: Record<string, string> = {
  farm: 'mm_farm', sea: 'mm_sea', space: 'mm_space', sweets: 'mm_journeySweets',
  'en-animals': 'mm_animals', 'en-food': 'mm_food', 'en-sweets': 'mm_sweets', 'en-toys': 'mm_toys', 'en-clothes': 'mm_clothes', 'en-weather': 'mm_weather', 'en-music': 'mm_music',
  family: 'mm_family',
};
export const LOCK_LINE: Record<Exclude<Lock, null>, string> = { world: 'mm_lockWorld', photos: 'mm_lockPhotos' };
export const LOCK_TEXT: Record<Exclude<Lock, null>, string> = { world: mm.lockWorld, photos: mm.lockPhotos };

/** The gate picture of a deck: its card back with two of its pictures leaning on it (the family deck: the first photos, or hearts until there are some). */
function cover(d: FreeDeck, photos: string[]): string {
  const pics = d.kind === 'family' ? photos.slice(0, 2) : d.cover;
  return `<div class="mm-cover" style="--c:${d.color}"><span class="mm-cv back">${d.back}</span>${pics.map((k, i) => `<span class="mm-cv f${i}">${pictureHtml(k)}</span>`).join('')}</div>`;
}

/** "ערכות": a card for each deck. Locked ones (a journey deck whose world is not finished, the family deck with fewer than six photos) show a lock and say why. */
export function renderDecks(root: HTMLElement, o: { progress: Progress; photoCount: number; photoKeys: string[]; last?: string; title?: string; onPick(d: FreeDeck): void; onLocked?(lock: Exclude<Lock, null>): void; onBack(): void }): void {
  root.innerHTML = `
    <div class="mm-pane mm-decks">
      <div class="mm-top">
        <button class="icon-btn small" id="mm-back" aria-label="חזרה">⬅️</button>
        <h2 data-say="mm_pickDeck">${o.title ?? mm.pickDeck}</h2>
        <span class="mm-sp"></span>
      </div>
      <div class="mm-deckgrid">
        ${ALL_FREE_DECKS.map((d) => {
          const lock = lockOf(d, o.progress, o.photoCount);
          return `<button class="mm-deck ${lock ? 'locked' : ''} ${o.last === d.id ? 'last' : ''}" data-id="${d.id}" data-say="${DECK_LINE[d.id]}" type="button" aria-label="${d.he}">
            ${cover(d, o.photoKeys)}
            <span class="mm-dname">${d.he}</span>
            ${lock ? `<span class="mm-lock" aria-hidden="true">🔒</span><small class="mm-why">${LOCK_TEXT[lock]}</small>` : ''}
          </button>`;
        }).join('')}
      </div>
    </div>`;
  root.querySelector('#mm-back')!.addEventListener('click', o.onBack);
  root.querySelectorAll<HTMLButtonElement>('.mm-deck').forEach((b) =>
    b.addEventListener('click', () => {
      const d = ALL_FREE_DECKS.find((x) => x.id === b.dataset.id)!;
      const lock = lockOf(d, o.progress, o.photoCount);
      if (lock) {
        b.classList.remove('wiggle');
        void b.offsetWidth;
        b.classList.add('wiggle');
        o.onLocked?.(lock);
        return;
      }
      o.onPick(d);
    }),
  );
}
