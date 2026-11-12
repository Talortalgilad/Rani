import { mountCheesy } from '../art/cheesy';
import { WORLDS } from '../content/worlds';
import { STATIONS_PER_WORLD, stationOpen, worldOpen, type MapProgress } from '../engine/progress';
import { mixed } from './text';
import { he } from '../content/lines';
import type { SoundApi } from '../../../sound';

const worldStars = (map: MapProgress, n: number): number => Array.from({ length: STATIONS_PER_WORLD }, (_, s) => map.stars[`${n}-${s}`] ?? 0).reduce((a, b) => a + b, 0);

/** The map of the worlds: a winding path, a world on each bend. A world opens when the one before it is finished. */
export function showMap(root: HTMLElement, o: { name: string; map: MapProgress; sound: SoundApi; onWorld(n: number): void; onShelf(): void; onHome(): void }): () => void {
  const open = WORLDS.map((w) => w.ready && worldOpen(o.map, w.n));
  const current = WORLDS.findIndex((w, i) => open[i] && (o.map.done[w.n] ?? 0) < STATIONS_PER_WORLD);
  root.innerHTML = `
    <div class="en-screen en-map">
      <div class="en-sky"></div>
      <header class="q-top"><button class="q-home" id="mh" type="button" aria-label="${he.home}">🏠</button><h1 class="map-title">${mixed(he.islandTitle(o.name))}</h1><button class="q-say" id="msh" type="button" aria-label="${he.shelfTitle}">🧸</button></header>
      <div class="map-scroll" id="scroll">
        <div class="map-path">
          ${WORLDS.map((w, i) => {
            const x = i % 2 === 0 ? 4 : 32;
            const done = (o.map.done[w.n] ?? 0) >= STATIONS_PER_WORLD;
            const stars = worldStars(o.map, w.n);
            return `<button class="map-world ${open[i] ? 'open' : 'locked'} ${done ? 'done' : ''} ${i === current ? 'current' : ''}" data-n="${w.n}" style="margin-inline-start:${x}%;--c:${w.color}" type="button" ${open[i] ? '' : 'aria-disabled="true"'}>
              <span class="mw-ball">${open[i] ? w.emoji : '🔒'}</span>
              <span class="mw-name"><b>${w.name}</b><small>${w.ready ? w.he : 'בקרוב'}</small></span>
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
  root.querySelectorAll<HTMLButtonElement>('.map-world').forEach((b) =>
    b.addEventListener('click', () => {
      const n = Number(b.dataset.n);
      if (!b.classList.contains('open')) {
        b.classList.remove('shake');
        void b.offsetWidth;
        b.classList.add('shake');
        c.set('thinking');
        return;
      }
      c.set('dance');
      o.sound.play('bonus');
      window.setTimeout(() => o.onWorld(n), 350);
    }),
  );
  // the current world is brought into view
  window.setTimeout(() => root.querySelector('.map-world.current')?.scrollIntoView({ block: 'center', behavior: 'auto' }), 50);
  return () => {};
}

/** The stations of a world: five places on a path, the last one the rescue. */
export function showWorld(root: HTMLElement, o: { world: number; map: MapProgress; sound: SoundApi; onStation(s: number): void; onBack(): void }): () => void {
  const w = WORLDS[o.world - 1];
  root.innerHTML = `
    <div class="en-screen en-world" style="--c:${w.color}">
      <div class="en-sky"></div>
      <header class="q-top"><button class="q-home" id="wb" type="button" aria-label="${he.home}">⬅️</button><h1 class="map-title">${w.emoji} ${w.name}</h1><span class="q-say" style="visibility:hidden"></span></header>
      <div class="station-path">
        ${Array.from({ length: STATIONS_PER_WORLD }, (_, s) => {
          const op = stationOpen(o.map, o.world, s);
          const stars = o.map.stars[`${o.world}-${s}`] ?? 0;
          const cur = s === (o.map.done[o.world] ?? 0);
          const rescue = s === STATIONS_PER_WORLD - 1;
          return `<button class="station ${op ? 'open' : 'locked'} ${stars ? 'done' : ''} ${cur ? 'current' : ''} ${rescue ? 'rescue' : ''}" data-s="${s}" style="margin-inline-start:${s % 2 === 0 ? 20 : 62}%" type="button">
            <span class="st-ball">${rescue ? '🎁' : s + 1}</span>
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
