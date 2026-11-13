import { SIZES, SIZE_ORDER, pairsOfSize, type Size } from '../session';
import { mm } from '../lines';
import type { FreeDeck } from '../decks/free';

/** "בחרי גודל לוח": small (3 x 4), medium (4 x 4) or large (4 x 5). A deck with too few pictures (the family deck) cannot fill the bigger boards. */
export function renderSizes(root: HTMLElement, o: { deck: FreeDeck; pictures: number; title?: string; onPick(s: Size): void; onBack(): void }): void {
  const LINE: Record<Size, string> = { small: 'mm_small', medium: 'mm_medium', large: 'mm_large' };
  root.innerHTML = `
    <div class="mm-pane mm-sizes">
      <div class="mm-top">
        <button class="icon-btn small" id="mm-back" aria-label="חזרה">⬅️</button>
        <h2 data-say="mm_pickSize">${o.title ?? mm.pickSize}</h2>
        <span class="mm-sp"></span>
      </div>
      <div class="mm-chosen" style="--c:${o.deck.color}"><span class="mm-cv back">${o.deck.back}</span><b>${o.deck.he}</b></div>
      <div class="mm-sizelist">
        ${SIZE_ORDER.map((s) => {
          const { cols, rows, he } = SIZES[s];
          const ok = pairsOfSize(s) <= o.pictures;
          return `<button class="mm-size ${ok ? '' : 'locked'}" data-size="${s}" data-say="${LINE[s]}" type="button">
            <span class="mm-mini" dir="ltr" style="grid-template-columns:repeat(${cols},1fr)">${Array.from({ length: cols * rows }, () => '<i></i>').join('')}</span>
            <b>${he}</b><small dir="ltr">${cols}×${rows}</small>
            ${ok ? '' : `<small class="mm-why" data-say="mm_needPhotos">${mm.needPhotos}</small>`}
          </button>`;
        }).join('')}
      </div>
    </div>`;
  root.querySelector('#mm-back')!.addEventListener('click', o.onBack);
  root.querySelectorAll<HTMLButtonElement>('.mm-size').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.classList.contains('locked')) {
        b.classList.remove('wiggle');
        void b.offsetWidth;
        b.classList.add('wiggle');
        return;
      }
      o.onPick(b.dataset.size as Size);
    }),
  );
}
