import { mm } from '../lines';

/** Opening screen of the game: three big buttons (SPEC-memory.md 2.1). */
export function renderMenu(root: HTMLElement, cb: { onJourney(): void; onVersus(): void; onDecks(): void; onHome(): void }): void {
  root.innerHTML = `
    <div class="mm-pane">
      <div class="mm-top">
        <button class="icon-btn small" id="mm-home" aria-label="בית">🏠</button>
        <h2 data-say="mm_title">${mm.title}</h2>
        <span class="mm-sp"></span>
      </div>
      <div class="mm-menu">
        <button class="mm-big" id="mm-journey" data-say="mm_journey" style="background:#1fb5a8"><span class="mm-ico">🗺️</span>${mm.journey}</button>
        <button class="mm-big" id="mm-versus" data-say="mm_versus" style="background:#ff7d3c"><span class="mm-ico">👫</span>${mm.versus}</button>
        <button class="mm-big" id="mm-decks" data-say="mm_decks" style="background:#8e5cf0"><span class="mm-ico">🎨</span>${mm.decks}</button>
      </div>
    </div>`;
  root.querySelector('#mm-home')!.addEventListener('click', cb.onHome);
  root.querySelector('#mm-journey')!.addEventListener('click', cb.onJourney);
  root.querySelector('#mm-versus')!.addEventListener('click', cb.onVersus);
  root.querySelector('#mm-decks')!.addEventListener('click', cb.onDecks);
}
