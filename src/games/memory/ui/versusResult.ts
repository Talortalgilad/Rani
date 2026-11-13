import type { Player, Winner } from '../versus';
import { mm } from '../lines';

/** The end of a game for two: the winner with confetti, or a tie, celebrated just the same. */
export function renderVersusResult(overlay: HTMLElement, o: { players: [Player, Player]; scores: [number, number]; winner: Winner; onAgain(): void; onDecks(): void; onHome(): void }): void {
  const tie = o.winner === 'tie';
  const w = o.winner === 'tie' ? null : o.players[o.winner];
  const colors = ['#ff5d73', '#ffd23f', '#3fb56b', '#3fa0ff', '#8e5cf0', '#ff8fd0'];
  overlay.innerHTML = `
    <div class="mm-card mm-vsres">
      <div class="mm-confetti" aria-hidden="true">${Array.from({ length: 36 }, (_, i) => `<i style="left:${(i * 29) % 100}%;background:${colors[i % 6]};animation-delay:${(i % 9) * 0.12}s"></i>`).join('')}</div>
      <div class="mm-winners">${tie ? o.players.map((p) => `<span class="av big win">${p.avatar}</span>`).join('') : `<span class="av huge win">${w!.avatar}</span>`}</div>
      <h2 class="mm-vstitle" data-say="${tie ? 'mm_tie' : 'mm_wins'}">${tie ? mm.tie : mm.wins(w!.name)}</h2>
      <div class="mm-vsscores" dir="ltr">${o.players.map((p, k) => `<div class="${o.winner === k ? 'top' : ''}"><span class="av">${p.avatar}</span><span class="nm">${p.name}</span><b>${o.scores[k]}</b></div>`).join('')}</div>
      <button class="btn big" id="mm-again" data-say="mm_newGame" type="button">🔁 ${mm.newGame}</button>
      <div class="mm-row"><button class="btn alt" id="mm-decks" data-say="mm_decks" type="button">🎨 ${mm.decks}</button><button class="btn alt" id="mm-home" data-say="home" type="button">🏠 בית</button></div>
    </div>`;
  overlay.hidden = false;
  overlay.querySelector('#mm-again')!.addEventListener('click', o.onAgain);
  overlay.querySelector('#mm-decks')!.addEventListener('click', o.onDecks);
  overlay.querySelector('#mm-home')!.addEventListener('click', o.onHome);
}
