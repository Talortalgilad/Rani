import { mountCheesy } from '../art/cheesy';
import { itemImg } from '../art/images';
import { he } from '../content/lines';
import { counter } from '../../../ui/counter';
import { SONGS } from '../content/songs';
import { WORDS, labelOf } from '../content/words';
import { WORLDS } from '../content/worlds';
import { KNOWN_LEVEL, STATIONS_PER_WORLD, isKnown, type MapProgress, type Words } from '../engine/progress';
import { speakLetterSound, speakWord } from '../voice';
import { LETTERS, letterById } from '../letters/journey';
import { alphabet } from '../letters/abc';
import { letterState } from '../letters/stats';
import { toyLetter } from '../letters/ui/glyph';
import type { SoundApi } from '../../../sound';

/** The words that were met, from the book: known ones first (level 4 and up, or marked by a parent), then the ones in learning. */
export function bookWords(words: Words): { id: string; known: boolean; level: number }[] {
  return WORDS.filter((w) => words[w.id]?.seen)
    .map((w) => ({ id: w.id, known: isKnown(words[w.id]), level: words[w.id]?.level ?? 0 }))
    .sort((a, b) => Number(b.known) - Number(a.known) || b.level - a.level);
}

/**
 * The word book (SPEC-english.md section 6): every word she has met. A tap says the word and Cheesy shows it (hops with joy).
 * The second page keeps the songs of the worlds she finished, to sing again.
 */
export type BookTab = 'words' | 'letters' | 'songs';
export function showWordbook(root: HTMLElement, o: { words: Words; map: MapProgress; sound: SoundApi; onSong(world: number): void; /** the ABC song can be sung again once the journey of letters is done */ abcOpen?: boolean; onAbc?(): void; onBack(): void }, tab: BookTab = 'words'): () => void {
  const list = bookWords(o.words);
  const known = list.filter((x) => x.known).length;
  const learnedN = LETTERS.filter((l) => letterState(o.words, l.id) !== 'new').length;
  const songWorlds = WORLDS.filter((w) => (o.map.done[w.n] ?? 0) >= STATIONS_PER_WORLD && SONGS[w.n]);
  root.innerHTML = `
    <div class="en-screen en-book">
      <div class="en-sky"></div>
      <header class="q-top"><button class="q-home" id="bb" type="button" aria-label="${he.home}">⬅️</button><h1 class="map-title" data-say="wordbook">📖 ${he.wordbook}</h1><span class="q-say" style="visibility:hidden"></span></header>
      <div class="book-tabs"><button class="book-tab ${tab === 'words' ? 'on' : ''}" data-t="words" data-say="wordbook" type="button">🔤 ${counter(he.wordCount(known, WORDS.length))}</button><button class="book-tab ${tab === 'letters' ? 'on' : ''}" data-t="letters" data-say="my_letters" type="button">🅰️ ${counter(he.letterCount(learnedN, LETTERS.length))}</button><button class="book-tab ${tab === 'songs' ? 'on' : ''}" data-t="songs" data-say="songs" type="button">♪ ${counter(he.songCount(songWorlds.length, WORLDS.length))}</button></div>
      <div class="book-cheesy" id="bch"></div>
      ${
        tab === 'letters'
          ? `<div class="book-letters">${alphabet().map((id) => { const st = letterState(o.words, id); return `<button class="book-letter ${st}" data-l="${id}" type="button" aria-label="${id.toUpperCase()}" ${st === 'new' ? 'aria-disabled="true"' : ''}>${toyLetter(id.toUpperCase())}${toyLetter(id, 'small')}</button>`; }).join('')}</div>${o.abcOpen ? `<button class="book-abc" id="abc" data-say="abc_song" type="button">♪ ${he.abcSong}</button>` : ''}`
        : tab === 'words'
          ? `<div class="book-grid">${
              list.length
                ? list.map((x) => `<button class="book-word ${x.known ? 'known' : ''}" data-id="${x.id}" type="button" aria-label="${labelOf(x.id)}">${itemImg(x.id)}<b dir="ltr">${labelOf(x.id)}</b><span class="book-lv" aria-hidden="true">${Array.from({ length: KNOWN_LEVEL }, (_, i) => `<i class="${i < Math.min(KNOWN_LEVEL, x.level) || x.known ? 'on' : ''}"></i>`).join('')}</span></button>`).join('')
                : '<div class="book-empty">🌱</div>'
            }</div>`
          : `<div class="book-songs">${songWorlds.length ? songWorlds.map((w) => `<button class="book-song" data-w="${w.n}" type="button"><span>${w.emoji}</span><b dir="ltr">${SONGS[w.n].title}</b><span>▶</span></button>`).join('') : '<div class="book-empty">♪</div>'}</div>`
      }
    </div>`;
  const ch = mountCheesy(root.querySelector<HTMLElement>('#bch')!, 'happy', () => o.sound.play('pop', 520));
  root.querySelector('#bb')!.addEventListener('click', o.onBack);
  root.querySelectorAll<HTMLButtonElement>('.book-tab').forEach((b) => b.addEventListener('click', () => void showWordbook(root, o, b.dataset.t as BookTab)));
  root.querySelectorAll<HTMLButtonElement>('.book-word').forEach((b) =>
    b.addEventListener('click', () => {
      o.sound.play('pop', 560);
      ch.set('cheer');
      ch.hop();
      void speakWord(labelOf(b.dataset.id!)).then(() => ch.set('happy'));
    }),
  );
  root.querySelectorAll<HTMLButtonElement>('.book-letter').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.l!;
      if (b.classList.contains('new')) return void o.sound.play('tick', 200); // not learned yet: a shadow
      o.sound.play('pop', 560);
      ch.set('cheer');
      ch.hop();
      // the name, the sound, the word: "S ... /s/ ... sun"
      void speakWord(id.toUpperCase()).then(() => speakLetterSound(id, letterById(id).label)).then(() => speakWord(letterById(id).label)).then(() => ch.set('happy'));
    }),
  );
  root.querySelector('#abc')?.addEventListener('click', () => o.onAbc?.());
  root.querySelectorAll<HTMLButtonElement>('.book-song').forEach((b) => b.addEventListener('click', () => o.onSong(Number(b.dataset.w))));
  return () => {};
}
