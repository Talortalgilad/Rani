import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import '@fontsource/fredoka/hebrew-600.css';
import '@fontsource/fredoka/hebrew-700.css';
import './traffic.css';

const ICONS = {
  undo: '<svg viewBox="0 0 64 64"><path d="M22 18 8 30l14 12V34c14-2 24 2 30 14-2-18-12-26-30-26z" fill="#fff"/></svg>',
  shuffle: '<svg viewBox="0 0 64 64"><circle cx="24" cy="22" r="8" fill="#ffd02b"/><path d="M12 48c0-9 6-14 12-14s12 5 12 14z" fill="#ffd02b"/><circle cx="44" cy="26" r="7" fill="#ff4fb8"/><path d="M34 50c0-8 5-12 10-12s10 4 10 12z" fill="#ff4fb8"/><path d="M10 8h18l-5-5M54 56H36l5 5" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>',
  vip: '<svg viewBox="0 0 64 64"><path d="M10 38c0-6 5-12 10-14l4-8c1-2 3-3 5-3h6c2 0 4 1 5 3l4 8c5 2 10 8 10 14v6H10z" fill="#ff8a1f"/><path d="M26 24l3-6h8l3 6z" fill="#bfe9ff"/><circle cx="22" cy="46" r="5" fill="#2b2833"/><circle cx="46" cy="46" r="5" fill="#2b2833"/><path d="M14 56h36l-4-6H18z" fill="#ffd02b"/><path d="M26 59h12" stroke="#7a5200" stroke-width="3"/></svg>',
  place: '<svg viewBox="0 0 64 64"><rect x="14" y="10" width="36" height="44" rx="9" fill="#2a4fc4"/><path d="M26 44V20h9c6 0 9 3 9 8s-3 8-9 8h-5" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export interface Hud {
  setCount(boarded: number, total: number): void;
  praise(text: string): void;
  overlay(html: string): HTMLElement;
  clearOverlay(): void;
  message(text: string | null): void;
  /** the tutorial sentence under the title (null hides it) */
  caption(text: string | null): void;
  /** the pointing hand, at a point on the screen (null hides it) */
  hand(at: { x: number; y: number } | null): void;
  root: HTMLElement;
}

/** Title, passenger count, helper buttons (no action yet in stage 0) and the pop-up messages. */
export function buildHud(container: HTMLElement, o: { title: string; hard?: boolean; total: number; onHome(): void }): Hud {
  const root = document.createElement('div');
  root.className = 'tr';
  root.innerHTML = `
    <div class="tr-title">${o.hard ? '<span class="tr-hard">קשה מאוד!</span>' : ''}<b>${o.title}</b></div>
    <div class="tr-count"><i></i><span id="tr-n">0/${o.total}</span></div>
    <button class="tr-home" aria-label="בית">🏠</button>
    <div class="tr-caption" id="tr-caption" hidden></div>
    <div class="tr-hand" id="tr-hand" hidden>👆</div>
    <div class="tr-praise" id="tr-praise"></div>
    <div class="tr-boosters">
      <button class="tr-boost" aria-label="ביטול">${ICONS.undo}<span class="tr-badge">3</span></button>
      <button class="tr-boost" aria-label="ערבוב נוסעים">${ICONS.shuffle}<span class="tr-badge">5⭐</span></button>
      <button class="tr-boost" aria-label="VIP">${ICONS.vip}<span class="tr-badge">8⭐</span></button>
      <button class="tr-boost" aria-label="מקום נוסף">${ICONS.place}<span class="tr-badge">5⭐</span></button>
    </div>
    <div class="tr-msg" id="tr-msg" hidden></div>`;
  container.appendChild(root);
  root.querySelector('.tr-home')!.addEventListener('click', o.onHome);
  // the helpers do nothing yet in stage 0: a little wiggle shows they were pressed
  root.querySelectorAll<HTMLElement>('.tr-boost').forEach((b) =>
    b.addEventListener('click', () => {
      b.classList.remove('wiggle');
      void b.offsetWidth;
      b.classList.add('wiggle');
    }),
  );
  const n = root.querySelector('#tr-n') as HTMLElement;
  const pr = root.querySelector('#tr-praise') as HTMLElement;
  const msg = root.querySelector('#tr-msg') as HTMLElement;
  const cap = root.querySelector('#tr-caption') as HTMLElement;
  const hand = root.querySelector('#tr-hand') as HTMLElement;
  let ov: HTMLElement | null = null;
  return {
    root,
    setCount: (b, t) => (n.textContent = `${b}/${t}`),
    praise(text) {
      pr.textContent = text;
      pr.classList.remove('show');
      void pr.offsetWidth;
      pr.classList.add('show');
    },
    overlay(html) {
      ov?.remove();
      ov = document.createElement('div');
      ov.className = 'tr-overlay';
      ov.innerHTML = `<div class="tr-card">${html}</div>`;
      root.appendChild(ov);
      return ov;
    },
    clearOverlay() {
      ov?.remove();
      ov = null;
    },
    caption(text) {
      cap.hidden = !text;
      cap.textContent = text ?? '';
    },
    hand(at) {
      hand.hidden = !at;
      if (at) {
        hand.style.left = `${at.x}px`;
        hand.style.top = `${at.y}px`;
      }
    },
    message(text) {
      msg.hidden = text === null;
      msg.textContent = text ?? '';
    },
  };
}
