import { games, comingSoon } from '../games/registry';
import { getState } from '../storage';
import { sound } from '../sound';
import { go } from '../router';

const LONG_PRESS_MS = 3000;

export function renderHome(root: HTMLElement): () => void {
  const st = getState();
  root.innerHTML = '';

  const screen = document.createElement('div');
  screen.className = 'screen home';

  const header = document.createElement('header');
  header.className = 'home-header';
  header.innerHTML = `
    <div class="avatar" aria-hidden="true">${st.profile.avatar}</div>
    <h1 class="title">המשחקים של ${escapeHtml(st.profile.name)}</h1>
  `;

  const muteBtn = document.createElement('button');
  muteBtn.className = 'icon-btn mute';
  const paintMute = () => {
    muteBtn.textContent = sound.isMuted() ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-label', sound.isMuted() ? 'הפעלת צליל' : 'השתקה');
  };
  paintMute();
  muteBtn.addEventListener('click', () => {
    sound.setMuted(!sound.isMuted());
    paintMute();
  });

  const stars = document.createElement('div');
  stars.className = 'stars';
  stars.textContent = `⭐ ${st.stars}`;

  const grid = document.createElement('div');
  grid.className = 'grid';

  for (const g of games) {
    const best = (st.games[g.id] as { best?: number } | undefined)?.best;
    const card = document.createElement('button');
    card.className = 'card';
    card.style.background = g.color;
    card.innerHTML = `
      <span class="card-icon">${g.icon}</span>
      <span class="card-title">${escapeHtml(g.title)}</span>
      ${best ? `<span class="card-best">🏆 ${best}</span>` : ''}
    `;
    card.addEventListener('click', () => go({ name: 'gate', gameId: g.id }));
    grid.appendChild(card);
  }

  for (const c of comingSoon) {
    const card = document.createElement('button');
    card.className = 'card locked';
    card.style.background = c.color;
    card.innerHTML = `<span class="card-icon">🔒</span><span class="card-title">${c.title}</span>`;
    card.addEventListener('click', () => {
      card.classList.remove('wiggle');
      void card.offsetWidth;
      card.classList.add('wiggle');
    });
    grid.appendChild(card);
  }

  screen.append(muteBtn, header, stars, grid);
  root.appendChild(screen);

  // Parent area: hold the title for 3 seconds. No visible button.
  let timer: number | undefined;
  const cancel = () => {
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
    }
  };
  const title = header.querySelector('.title') as HTMLElement;
  title.addEventListener('pointerdown', () => {
    cancel();
    timer = window.setTimeout(() => go({ name: 'parent' }), LONG_PRESS_MS);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) {
    title.addEventListener(ev, cancel);
  }
  title.addEventListener('contextmenu', (e) => e.preventDefault());

  return cancel;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
