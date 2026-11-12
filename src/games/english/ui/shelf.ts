import { SQUISHIES, squishyImg } from '../art/squishies';
import { he } from '../content/lines';
import { speakEn } from '../voice';
import type { SoundApi } from '../../../sound';

/** The shelf of squishies: the ones that were rescued are in colour (tap one: it squashes and says its name), the others are shadows. */
export function showShelf(root: HTMLElement, o: { rescued: string[]; sound: SoundApi; onBack(): void }): () => void {
  const have = (name: string): boolean => o.rescued.includes(name);
  root.innerHTML = `
    <div class="en-screen en-shelf">
      <div class="en-sky"></div>
      <header class="q-top"><button class="q-home" id="sb" type="button" aria-label="${he.home}">⬅️</button><h1 class="map-title">🧸 ${he.shelfTitle}</h1><span class="q-say" style="visibility:hidden"></span></header>
      <div class="shelf-count">${o.rescued.length} / ${SQUISHIES.length}</div>
      <div class="shelf-grid">
        ${SQUISHIES.map(
          (s) => `<div class="shelf-slot ${have(s.name) ? 'have' : 'lost'}">
            <button class="shelf-sq" data-name="${s.name}" type="button" aria-label="${have(s.name) ? s.name : '?'}">${squishyImg(s.id)}${have(s.name) ? '' : '<b class="shelf-q">?</b>'}</button>
            <div class="shelf-board"></div>
            <small>${have(s.name) ? s.name : '???'}</small>
          </div>`,
        ).join('')}
      </div>
    </div>`;
  root.querySelector('#sb')!.addEventListener('click', o.onBack);
  root.querySelectorAll<HTMLButtonElement>('.shelf-sq').forEach((b) =>
    b.addEventListener('click', () => {
      const name = b.dataset.name!;
      b.classList.remove('squish');
      void b.offsetWidth;
      b.classList.add('squish');
      if (have(name)) {
        o.sound.play('pop', 520);
        void speakEn(`I'm ${name}!`, 0.8);
      } else o.sound.play('tick', 200);
    }),
  );
  return () => {};
}
