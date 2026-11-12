import { mountCheesy } from '../art/cheesy';
import { he } from '../content/lines';
import { mixed } from './text';
import { speakEn, speakHe } from '../voice';
import type { SoundApi } from '../../../sound';

/** The island's front door: the companion greets, and one big button starts the station. */
export function showStart(root: HTMLElement, name: string, rescued: string[], sound: SoundApi, o: { onPlay(): void; onHome(): void }): () => void {
  root.innerHTML = `
    <div class="en-screen en-start">
      <div class="en-sky"></div>
      <button class="q-home" id="sh" type="button" aria-label="${he.home}">🏠</button>
      <h1 class="start-title">${mixed(he.islandTitle(name))}</h1>
      <div class="start-stage"><div class="cheesy-big" id="ch"></div><div class="bubble big" id="bub">${he.start}</div></div>
      <div class="start-world">🛏️ My room</div>
      <button class="en-btn go huge" id="play" type="button">▶ ${he.start}</button>
      <div class="start-shelf">${rescued.length ? `⭐ ${rescued.map((r) => r).join(', ')}` : ''}</div>
    </div>`;
  const c = mountCheesy(root.querySelector<HTMLElement>('#ch')!, 'happy', () => sound.play('pop', 520));
  void speakHe(he.start);
  root.querySelector('#play')!.addEventListener('click', () => {
    c.set('dance');
    sound.play('bonus');
    void speakEn('Let’s go!', 0.85);
    window.setTimeout(o.onPlay, 500);
  });
  root.querySelector('#sh')!.addEventListener('click', o.onHome);
  return () => {};
}
