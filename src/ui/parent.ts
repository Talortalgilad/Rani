import { go } from '../router';

// Stage 5 will implement the parent area.
export function renderParent(root: HTMLElement): () => void {
  root.innerHTML = `
    <div class="screen placeholder">
      <div class="placeholder-emoji">👨‍👩‍👧</div>
      <div class="placeholder-text">אזור הורים — בקרוב</div>
      <button class="btn" id="back">🏠 בית</button>
    </div>`;
  root.querySelector('#back')!.addEventListener('click', () => go({ name: 'home' }));
  return () => {};
}
