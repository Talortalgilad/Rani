import { go } from '../router';

// Stage 2 will implement the math gate. For now it passes straight through.
export function renderGate(root: HTMLElement, gameId: string): () => void {
  root.innerHTML = '';
  go({ name: 'game', gameId });
  return () => {};
}
