import { go } from '../router';

let el: HTMLElement | null = null;

export function isTimeUpShown(): boolean {
  return el !== null;
}

/** Friendly full-screen "see you tomorrow" card; the only way out is home. */
export function showTimeUp(): void {
  if (el) return;
  el = document.createElement('div');
  el.className = 'timeup';
  el.innerHTML = `
    <div class="timeup-card">
      <div class="timeup-emoji">🌙</div>
      <h2>נגמר הזמן להיום,<br />נתראה מחר! ⭐</h2>
      <button class="btn big" id="timeup-home">🏠 בית</button>
    </div>`;
  document.body.appendChild(el);
  el.querySelector('#timeup-home')!.addEventListener('click', () => {
    hideTimeUp();
    go({ name: 'home' });
  });
}

export function hideTimeUp(): void {
  el?.remove();
  el = null;
}
