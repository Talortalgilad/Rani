import type { GameContext, GameModule } from '../types';

let root: HTMLElement | null = null;

const brickBreaker: GameModule = {
  id: 'brick-breaker',
  title: 'שובר שורות',
  icon: '🧱',
  color: '#8e5cf0',
  mount(ctx: GameContext) {
    // Temporary placeholder screen until stage 3.
    root = document.createElement('div');
    root.className = 'placeholder';
    root.innerHTML = `<div class="placeholder-emoji">🧱</div><div class="placeholder-text">בקרוב!</div>`;
    const home = document.createElement('button');
    home.className = 'btn';
    home.textContent = '🏠 בית';
    home.addEventListener('click', () => ctx.onExit());
    const again = document.createElement('button');
    again.className = 'btn';
    again.id = 'again';
    again.textContent = '🔁 שוב';
    again.addEventListener('click', () => ctx.requestRound(() => {}));
    root.append(again, home);
    ctx.container.appendChild(root);
  },
  pause() {},
  resume() {},
  unmount() {
    root?.remove();
    root = null;
  },
};

export default brickBreaker;
