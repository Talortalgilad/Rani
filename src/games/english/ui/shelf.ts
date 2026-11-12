import { ACCESSORIES, accessorySvg, type Accessory } from '../art/accessories';
import { cheesyUrl } from '../art/cheesy';
import { SQUISHIES, squishyImg } from '../art/squishies';
import { he } from '../content/lines';
import { speakEn } from '../voice';
import type { SoundApi } from '../../../sound';

export interface ShelfOptions {
  rescued: string[];
  /** the squishy that is her friend for the adventure (its id), or null: Cheesy */
  buddy: string | null;
  /** what Cheesy wears (an accessory id) or null */
  accessory: string | null;
  unlocked: Accessory[];
  sound: SoundApi;
  onBuddy(id: string | null): void;
  onAccessory(id: string | null): void;
  onBack(): void;
}

/**
 * The shelf of squishies: the ones that were rescued are in colour (tap one: it squashes and says its name; the "friend" button
 * makes it her companion for the adventure), the others are shadows. Under the shelf: what Cheesy wears.
 */
export function showShelf(root: HTMLElement, o: ShelfOptions): () => void {
  const have = (name: string): boolean => o.rescued.includes(name);
  const wearing = (id: string): boolean => o.unlocked.some((a) => a.id === id);
  root.innerHTML = `
    <div class="en-screen en-shelf">
      <div class="en-sky"></div>
      <header class="q-top"><button class="q-home" id="sb" type="button" aria-label="${he.home}">⬅️</button><h1 class="map-title">🧸 ${he.shelfTitle}</h1><span class="q-say" style="visibility:hidden"></span></header>
      <div class="shelf-count">${he.squishyCount(o.rescued.length, SQUISHIES.length)}</div>
      <div class="shelf-grid">
        <div class="shelf-slot have cheesy-slot ${o.buddy === null ? 'buddy' : ''}">
          <button class="shelf-sq" data-name="Cheesy" type="button" aria-label="Cheesy"><span class="cheesy-wrap"><img class="squishy-img" src="${cheesyUrl('happy')}" alt="" draggable="false">${o.buddy === null && o.accessory ? accessorySvg(ACCESSORIES.find((a) => a.id === o.accessory)!) : ''}</span></button>
          <div class="shelf-board"></div>
          <small>Cheesy</small>
          <button class="shelf-pick" data-pick="" type="button">${o.buddy === null ? `✔ ${he.buddyNow}` : he.buddyPick}</button>
        </div>
        ${SQUISHIES.map(
          (s) => `<div class="shelf-slot ${have(s.name) ? 'have' : 'lost'} ${o.buddy === s.id ? 'buddy' : ''}">
            <button class="shelf-sq" data-name="${s.name}" type="button" aria-label="${have(s.name) ? s.name : '?'}">${squishyImg(s.id)}${have(s.name) ? '' : '<b class="shelf-q">?</b>'}</button>
            <div class="shelf-board"></div>
            <small>${have(s.name) ? s.name : '???'}</small>
            ${have(s.name) ? `<button class="shelf-pick" data-pick="${s.id}" type="button">${o.buddy === s.id ? `✔ ${he.buddyNow}` : he.buddyPick}</button>` : ''}
          </div>`,
        ).join('')}
      </div>
      <div class="acc-bar">
        <div class="acc-title">${he.accessories}</div>
        <div class="acc-row">
          ${ACCESSORIES.map((a) => {
            const got = wearing(a.id);
            return `<button class="acc ${got ? '' : 'locked'} ${o.accessory === a.id ? 'on' : ''}" data-acc="${a.id}" type="button" aria-label="${a.he}" ${got ? '' : 'aria-disabled="true"'}>
              ${got ? `<span class="acc-prev">${accessorySvg(a)}<img src="${cheesyUrl('happy')}" alt="" draggable="false"></span>` : '<span class="acc-lock">🔒</span>'}
              <small>${got ? a.he : he.accessoryLocked(a.world)}</small>
            </button>`;
          }).join('')}
        </div>
        ${o.buddy ? `<div class="acc-note">${he.accessoryNote}</div>` : ''}
      </div>
    </div>`;
  root.querySelector('#sb')!.addEventListener('click', o.onBack);
  const again = (): void => void showShelf(root, o);
  root.querySelectorAll<HTMLButtonElement>('.shelf-sq').forEach((b) =>
    b.addEventListener('click', () => {
      const name = b.dataset.name!;
      b.classList.remove('squish');
      void b.offsetWidth;
      b.classList.add('squish');
      if (name === 'Cheesy' || have(name)) {
        o.sound.play('pop', 520);
        void speakEn(`I'm ${name}!`, 0.8);
      } else o.sound.play('tick', 200);
    }),
  );
  root.querySelectorAll<HTMLButtonElement>('.shelf-pick').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.pick || null;
      o.buddy = id;
      o.onBuddy(id);
      o.sound.play('bonus');
      again();
    }),
  );
  root.querySelectorAll<HTMLButtonElement>('.acc').forEach((b) =>
    b.addEventListener('click', () => {
      const a = ACCESSORIES.find((x) => x.id === b.dataset.acc)!;
      if (!wearing(a.id)) {
        o.sound.play('tick', 200);
        return;
      }
      o.accessory = o.accessory === a.id ? null : a.id;
      o.onAccessory(o.accessory);
      o.sound.play('pop', 600);
      again();
    }),
  );
  return () => {};
}
