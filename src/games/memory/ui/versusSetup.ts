import { MAX_NAME, SECOND_PLAYER_NAMES, cleanName, type Player } from '../versus';
import { mm } from '../lines';

export const AVATARS = ['🦄', '🐱', '🐶', '🐰', '🦊', '🐼', '🐻', '🦁'];
const NAME_LINE: Record<string, string> = { 'אבא': 'mm_dad', 'אמא': 'mm_mum', 'ריי': 'mm_ray' };

/**
 * "בשניים": who plays. The first player is Rani (her name and avatar); the second is dad, mum, Ray or any name; each chooses an avatar.
 */
export function renderVersusSetup(root: HTMLElement, o: { first: Player; onGo(players: [Player, Player]): void; onBack(): void }): void {
  const p: [Player, Player] = [{ ...o.first }, { name: SECOND_PLAYER_NAMES[0], avatar: AVATARS.find((a) => a !== o.first.avatar) ?? '🐻' }];
  let typing = false;
  const paint = (): void => {
    root.innerHTML = `
      <div class="mm-pane mm-setup">
        <div class="mm-top">
          <button class="icon-btn small" id="mm-back" aria-label="חזרה">⬅️</button>
          <h2 data-say="mm_who">${mm.who}</h2>
          <span class="mm-sp"></span>
        </div>
        ${([0, 1] as const).map((k) => `
          <section class="mm-player p${k}">
            <div class="mm-pl-head"><span class="av big">${p[k].avatar}</span><h3 data-say="${k === 0 ? 'mm_player1' : 'mm_player2'}">${k === 0 ? mm.player1 : mm.player2}</h3></div>
            ${
              k === 0
                ? `<input class="mm-name" id="n0" maxlength="${MAX_NAME}" value="${p[0].name}" aria-label="${mm.player1}">`
                : `<div class="mm-names">${SECOND_PLAYER_NAMES.map((n) => `<button class="chip ${!typing && p[1].name === n ? 'on' : ''}" data-n="${n}" data-say="${NAME_LINE[n]}" type="button">${n}</button>`).join('')}<button class="chip ${typing ? 'on' : ''}" id="other" data-say="mm_otherName" type="button">${mm.otherName}</button></div>
                   ${typing ? `<input class="mm-name" id="n1" maxlength="${MAX_NAME}" value="${SECOND_PLAYER_NAMES.includes(p[1].name) ? '' : p[1].name}" placeholder="…" aria-label="${mm.player2}">` : ''}`
            }
            <div class="mm-avatars">${AVATARS.map((a) => `<button class="av-btn ${p[k].avatar === a ? 'on' : ''}" data-k="${k}" data-a="${a}" ${p[1 - k].avatar === a ? 'disabled' : ''} type="button" aria-label="${a}">${a}</button>`).join('')}</div>
          </section>`).join('')}
        <button class="btn big" id="go" data-say="mm_go" type="button">${mm.go}</button>
      </div>`;
    root.querySelector('#mm-back')!.addEventListener('click', o.onBack);
    const n0 = root.querySelector<HTMLInputElement>('#n0')!;
    n0.addEventListener('input', () => (p[0].name = cleanName(n0.value) || p[0].name));
    root.querySelectorAll<HTMLButtonElement>('[data-n]').forEach((b) => b.addEventListener('click', () => ((p[1].name = b.dataset.n!), (typing = false), paint())));
    root.querySelector('#other')!.addEventListener('click', () => ((typing = true), paint(), root.querySelector<HTMLInputElement>('#n1')?.focus()));
    const n1 = root.querySelector<HTMLInputElement>('#n1');
    n1?.addEventListener('input', () => (p[1].name = cleanName(n1.value) || SECOND_PLAYER_NAMES[0]));
    root.querySelectorAll<HTMLButtonElement>('.av-btn').forEach((b) => b.addEventListener('click', () => ((p[Number(b.dataset.k) as 0 | 1].avatar = b.dataset.a!), paint())));
    root.querySelector('#go')!.addEventListener('click', () => {
      const a = { name: cleanName(p[0].name) || 'רני', avatar: p[0].avatar };
      const b2 = { name: cleanName(p[1].name) || SECOND_PLAYER_NAMES[0], avatar: p[1].avatar };
      o.onGo([a, b2]);
    });
  };
  paint();
}
