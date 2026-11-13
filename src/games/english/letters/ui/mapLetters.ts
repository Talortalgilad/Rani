import { mountCheesy } from '../../art/cheesy';
import { he } from '../../content/lines';
import { STATIONS_PER_WORLD, stationOpen, type MapProgress } from '../../engine/progress';
import { bindJourneyTabs, journeyTabs, type Journey } from '../../ui/journeyTabs';
import { mixed } from '../../ui/text';
import { ISLANDS, islandInfo } from '../journey';
import type { SoundApi } from '../../../../sound';

/** An island opens when the one before it is finished; the first one is open from the start (it does not need the words journey). */
export const islandOpen = (map: MapProgress, n: number, openAll = false): boolean => openAll || n === 1 || (map.done[n - 1] ?? 0) >= STATIONS_PER_WORLD;

const islandStars = (map: MapProgress, n: number): number => Array.from({ length: STATIONS_PER_WORLD }, (_, s) => map.stars[`${n}-${s}`] ?? 0).reduce((a, b) => a + b, 0);

/** The map of the letters journey: six islands. */
export function showLettersMap(root: HTMLElement, o: { name: string; openAll?: boolean; map: MapProgress; sound: SoundApi; onIsland(n: number): void; onJourney(j: Journey): void; onShelf(): void; onBook(): void; onHome(): void }): () => void {
  const open = ISLANDS.map((i) => i.ready && islandOpen(o.map, i.n, o.openAll));
  const current = ISLANDS.findIndex((i, k) => open[k] && (o.map.done[i.n] ?? 0) < STATIONS_PER_WORLD);
  root.innerHTML = `
    <div class="en-screen en-map en-letters">
      <div class="en-sky"></div>
      <header class="q-top"><button class="q-home" id="mh" type="button" aria-label="${he.home}">🏠</button><h1 class="map-title" data-say="letters_title">${mixed(he.lettersTitle)}</h1><span class="q-pair"><button class="q-say" id="mbk" data-say="wordbook" type="button" aria-label="${he.wordbook}">📖</button><button class="q-say" id="msh" data-say="shelf_title" type="button" aria-label="${he.shelfTitle}">🧸</button></span></header>
      ${journeyTabs('letters')}
      <div class="map-scroll" id="scroll">
        <div class="map-path">
          ${ISLANDS.map((isl, i) => {
            const x = i % 2 === 0 ? 4 : 32;
            const done = (o.map.done[isl.n] ?? 0) >= STATIONS_PER_WORLD;
            const stars = islandStars(o.map, isl.n);
            return `<button class="map-world ${open[i] ? 'open' : 'locked'} ${done ? 'done' : ''} ${i === current ? 'current' : ''}" data-n="${isl.n}" data-say="island_${isl.n}" style="margin-inline-start:${x}%;--c:${isl.color}" type="button" ${open[i] ? '' : 'aria-disabled="true"'}>
              <span class="mw-ball">${open[i] ? isl.emoji : isl.ready ? '🔒' : '🔒'}</span>
              <span class="mw-name"><b>${isl.name}</b><small>${isl.ready ? isl.he : he.soon} · ${isl.letters.join(' ')}</small></span>
              ${open[i] ? `<span class="mw-stars">${done ? '✅ ' : ''}${stars ? `⭐ ${stars}` : ''}</span>` : ''}
            </button>`;
          }).join('')}
        </div>
      </div>
      <div class="map-cheesy" id="ch"></div>
    </div>`;
  const c = mountCheesy(root.querySelector<HTMLElement>('#ch')!, 'happy', () => o.sound.play('pop', 520));
  root.querySelector('#mh')!.addEventListener('click', o.onHome);
  root.querySelector('#msh')!.addEventListener('click', o.onShelf);
  root.querySelector('#mbk')!.addEventListener('click', o.onBook);
  bindJourneyTabs(root, 'letters', o.onJourney);
  root.querySelectorAll<HTMLButtonElement>('.map-world').forEach((b) =>
    b.addEventListener('click', () => {
      if (!b.classList.contains('open')) {
        b.classList.remove('shake');
        void b.offsetWidth;
        b.classList.add('shake');
        c.set('thinking');
        return;
      }
      c.set('dance');
      o.sound.play('bonus');
      window.setTimeout(() => o.onIsland(Number(b.dataset.n)), 350);
    }),
  );
  window.setTimeout(() => root.querySelector('.map-world.current')?.scrollIntoView({ block: 'center', behavior: 'auto' }), 50);
  return () => {};
}

/** The stations of an island: one for each letter, then the words station (with the rescue of the letter squishy at its end). */
export function showIsland(root: HTMLElement, o: { island: number; openAll?: boolean; map: MapProgress; sound: SoundApi; onStation(s: number): void; onBack(): void }): () => void {
  const isl = islandInfo(o.island);
  root.innerHTML = `
    <div class="en-screen en-world" style="--c:${isl.color}">
      <div class="en-sky"></div>
      <header class="q-top"><button class="q-home" id="wb" type="button" aria-label="${he.home}">⬅️</button><h1 class="map-title" data-say="island_${isl.n}">${isl.emoji} ${isl.name}</h1><span class="q-say" style="visibility:hidden"></span></header>
      <div class="station-path">
        ${Array.from({ length: STATIONS_PER_WORLD }, (_, s) => {
          const op = stationOpen(o.map, o.island, s, o.openAll);
          const stars = o.map.stars[`${o.island}-${s}`] ?? 0;
          const cur = s === (o.map.done[o.island] ?? 0);
          const words = s === STATIONS_PER_WORLD - 1;
          return `<button class="station ${op ? 'open' : 'locked'} ${stars ? 'done' : ''} ${cur ? 'current' : ''} ${words ? 'rescue' : ''}" data-s="${s}" ${words ? 'data-say="words_station"' : ''} style="margin-inline-start:${s % 2 === 0 ? 20 : 62}%" type="button">
            <span class="st-ball">${words ? '🔤' : `<b class="st-letter" dir="ltr">${isl.letters[s].toUpperCase()}${isl.letters[s]}</b>`}</span>
            <span class="st-stars">${[1, 2, 3].map((k) => `<i class="${k <= stars ? 'on' : ''}">★</i>`).join('')}</span>
          </button>`;
        }).join('')}
      </div>
    </div>`;
  root.querySelector('#wb')!.addEventListener('click', o.onBack);
  root.querySelectorAll<HTMLButtonElement>('.station').forEach((b) =>
    b.addEventListener('click', () => {
      if (!b.classList.contains('open')) {
        b.classList.remove('shake');
        void b.offsetWidth;
        b.classList.add('shake');
        return;
      }
      o.sound.play('pop', 520);
      o.onStation(Number(b.dataset.s));
    }),
  );
  return () => {};
}
