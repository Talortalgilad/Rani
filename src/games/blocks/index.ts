import type { GameContext, GameModule } from '../types';
import { sayLabel, sayLine } from '../english/content/heLines';
import { stopSpeech } from '../english/voice';
import { counter } from '../../ui/counter';
import { BlockGame } from './game';
import { bk } from './lines';
import { PIECES, pieceById } from './pieces';
import './ui/blocks.css';

let game: BlockGame | null = null;
let root: HTMLElement | null = null;
let best = 0;
let ctx: GameContext | null = null;
let comboTimer = 0;

const icon = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="22" fill="#f6dfb2"/><rect x="14" y="14" width="34" height="34" rx="9" fill="#ff5a6a"/><rect x="52" y="14" width="34" height="34" rx="9" fill="#58b8ff"/><rect x="14" y="52" width="34" height="34" rx="9" fill="#ffd23c"/><rect x="52" y="52" width="34" height="34" rx="9" fill="#7ed957"/></svg>`;

function onHide(): void {}

function showCombo(text: string, kind: 'combo' | 'clean'): void {
  const el = root?.querySelector<HTMLElement>('.bk-combo');
  if (!el) return;
  el.textContent = text;
  el.className = `bk-combo ${kind === 'clean' ? 'clean' : ''}`;
  void el.offsetWidth;
  el.classList.add('go');
  window.clearTimeout(comboTimer);
  comboTimer = window.setTimeout(() => el.classList.remove('go'), 1100);
}

function showGain(points: number, x: number, y: number): void {
  const stage = root?.querySelector('.bk-stage');
  if (!stage || points <= 0) return;
  const el = document.createElement('div');
  el.className = 'bk-gain';
  el.textContent = `+${points}`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  stage.appendChild(el);
  window.setTimeout(() => el.remove(), 950);
}

function setScore(total: number, mult: number, streak: number): void {
  if (!root) return;
  root.querySelector('.bk-score')!.textContent = String(total);
  const s = root.querySelector('.bk-streak')!;
  s.classList.toggle('on', mult > 1);
  s.textContent = `🔥 ×${mult}`;
  void streak;
  if (total > best) {
    best = total;
    ctx?.save('best', best);
  }
  root.querySelector('.bk-best')!.innerHTML = `👑 ${counter(String(best))}`;
}

function showFull(score: number): void {
  if (!root) return;
  const o = document.createElement('div');
  o.className = 'bk-over';
  o.innerHTML = `<h2 data-say="blk_full">${bk.full}</h2><div class="big">${counter(String(score))}</div>
    <div class="row"><button class="btn big" id="bk-new" data-say="blk_newBoard" type="button">${bk.newBoard}</button><button class="btn" id="bk-exit" type="button">🏠</button></div>`;
  root.querySelector('.bk-stage')!.appendChild(o);
  void sayLine('blk_full');
  o.querySelector('#bk-new')!.addEventListener('click', () => {
    o.remove();
    game?.restart();
  });
  o.querySelector('#bk-exit')!.addEventListener('click', () => ctx!.onExit());
}

const blocks: GameModule = {
  id: 'blocks',
  title: bk.title,
  icon,
  color: '#e0568a',
  noGate: false,

  mount(c: GameContext) {
    ctx = c;
    best = c.load<number>('best', 0);
    root = document.createElement('div');
    root.className = 'bk';
    root.innerHTML = `<div class="bk-top"><button class="bk-home" type="button" aria-label="home">🏠</button><div class="bk-score">0</div><div class="bk-best"></div></div>
      <div class="bk-streak"></div><div class="bk-stage"><canvas class="bk-canvas"></canvas><div class="bk-combo"></div></div>`;
    c.container.appendChild(root);
    root.querySelector('.bk-home')!.addEventListener('click', () => c.onExit());
    root.addEventListener('pointerdown', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-say]');
      if (el?.dataset.say) void sayLabel(el.dataset.say, '');
    });
    const r = root;
    game = new BlockGame(r.querySelector('canvas')!, {
      sound: c.sound,
      say: (id) => void sayLine(id),
      onScore: setScore,
      onCombo: showCombo,
      onGain: showGain,
      onFull: showFull,
      onShake: () => {
        r.classList.remove('shake');
        void r.offsetWidth;
        r.classList.add('shake');
      },
      best: () => best,
    });
    setScore(0, 1, 0);
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__bk = { game, PIECES, pieceById };
    window.addEventListener('pagehide', onHide);
  },

  canInterrupt: () => true,
  pause() {},
  resume() {},

  unmount() {
    window.removeEventListener('pagehide', onHide);
    game?.destroy();
    game = null;
    stopSpeech();
    root?.remove();
    root = null;
    ctx = null;
  },
};

export default blocks;
