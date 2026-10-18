/** Opening screen of the game: three big buttons. Only the journey exists in stage 1. */
export function renderMenu(root: HTMLElement, cb: { onJourney(): void; onHome(): void }): void {
  root.innerHTML = `
    <div class="mm-pane">
      <div class="mm-top">
        <button class="icon-btn small" id="mm-home" aria-label="בית">🏠</button>
        <h2>זיכרון</h2>
        <span class="mm-sp"></span>
      </div>
      <div class="mm-menu">
        <button class="mm-big" id="mm-journey" style="background:#1fb5a8"><span class="mm-ico">🗺️</span>מסע</button>
        <button class="mm-big locked" data-soon aria-label="בקרוב"><span class="mm-ico">👫</span>בשניים 🔒</button>
        <button class="mm-big locked" data-soon aria-label="בקרוב"><span class="mm-ico">🎨</span>ערכות 🔒</button>
      </div>
    </div>`;
  root.querySelector('#mm-home')!.addEventListener('click', cb.onHome);
  root.querySelector('#mm-journey')!.addEventListener('click', cb.onJourney);
  root.querySelectorAll<HTMLElement>('[data-soon]').forEach((b) =>
    b.addEventListener('click', () => {
      b.classList.remove('wiggle');
      void b.offsetWidth;
      b.classList.add('wiggle');
    }),
  );
}
