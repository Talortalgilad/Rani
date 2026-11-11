import type { GameContext, GameModule } from '../types';
import { DECKS } from './decks';
import { composeLevel } from './compose';
import { levelConfig } from '../../math/levels';
import { activeLevel } from '../../math/adaptive';
import { INK, svg } from './decks/svg';
import { LEVELS } from './levels';
import { mountBoard, type Board } from './ui/board';
import { renderMap, emptyProgress, isUnlocked, type Progress } from './ui/map';
import { renderMenu } from './ui/menu';
import { renderResult, type RoundSummary } from './ui/result';
import './ui/memory.css';

interface Queued { level: number; at: number }
const QUEUE_TTL_MS = 10 * 60 * 1000;

let ctx: GameContext | null = null;
let root: HTMLElement | null = null;
let board: Board | null = null;
/** The round the gate just granted is still unused (first level picked after entering). */
let fresh = true;

const progress = (): Progress => ctx!.load<Progress>('progress', emptyProgress());

function clearBoard(): void {
  board?.destroy();
  board = null;
}

function showMenu(): void {
  clearBoard();
  renderMenu(root!, { onJourney: showMap, onHome: exitHome });
}

function showMap(): void {
  clearBoard();
  renderMap(root!, progress(), { onPick: begin, onBack: showMenu });
}

function exitHome(): void {
  ctx!.save('queued', null);
  ctx!.onExit();
}

/** Start a round: the first one after the gate is free, later ones ask the host (which may show the gate). */
function begin(id: number): void {
  if (fresh) {
    fresh = false;
    play(id);
    return;
  }
  ctx!.save<Queued>('queued', { level: id, at: Date.now() });
  ctx!.requestRound(() => {
    ctx!.save('queued', null);
    play(id);
  });
}

function play(id: number): void {
  clearBoard();
  const level = LEVELS.find((l) => l.id === id)!;
  const cards = composeLevel(level, levelConfig(activeLevel()).max);
  board = mountBoard(root!, level, cards, {
    sound: ctx!.sound,
    onStar: () => ctx!.addStars(1),
    onBack: showMap,
    onFinish: (r) => finish(id, r),
  });
}

function finish(id: number, r: RoundSummary): void {
  const p = progress();
  const prev = p.levels[id];
  p.levels[id] = {
    stars: Math.max(prev?.stars ?? 0, r.stars),
    bestAttempts: prev?.bestAttempts ? Math.min(prev.bestAttempts, r.attempts) : r.attempts,
    bestStreak: Math.max(prev?.bestStreak ?? 0, r.bestStreak),
  };
  ctx!.save('progress', p);
  ctx!.save('best', Object.values(p.levels).reduce((s, l) => s + l.stars, 0));
  ctx!.onRoundEnd({ won: true, stars: r.stars, score: r.attempts });
  const worldTune = (['melody1', 'melody2', 'melody3', 'melody4'] as const)[(LEVELS.find((l) => l.id === id)?.world ?? 1) - 1];
  ctx!.sound.play(worldTune);

  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  root!.appendChild(overlay);
  const next = LEVELS.find((l) => l.id === id + 1);
  renderResult(overlay, r, prev, !!next && isUnlocked(p, id + 1), {
    onNext: () => begin(id + 1),
    onAgain: () => begin(id),
    onLevels: showMap,
    onHome: exitHome,
  });
}

/** Home-screen icon: a card with the cow on it. */
const cow = DECKS.farm.art.cow;
const icon = `<svg viewBox="0 0 100 100" width="64" height="64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="12" y="6" width="76" height="88" rx="14" fill="#fff" stroke="${INK}" stroke-width="5"/>
  <g transform="translate(22 20) scale(.56)">${svg(cow).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g></svg>`;

const memory: GameModule = {
  id: 'memory',
  title: 'זיכרון',
  icon,
  color: '#1fb5a8',

  mount(c: GameContext) {
    ctx = c;
    root = document.createElement('div');
    root.className = 'mm';
    c.container.appendChild(root);
    fresh = !c.resuming;
    if (!c.resuming) c.save('session', null);
    const queued = c.load<Queued | null>('queued', null);
    c.save('queued', null);
    if (queued && Date.now() - queued.at < QUEUE_TTL_MS && LEVELS.some((l) => l.id === queued.level) && isUnlocked(progress(), queued.level)) {
      begin(queued.level);
    } else showMenu();
  },

  /** Nothing runs on a clock here, so any moment is fine except while a miss is showing. */
  canInterrupt: () => !board?.busy(),
  pause() {},
  resume() {},

  unmount() {
    clearBoard();
    root?.remove();
    root = null;
    ctx = null;
  },
};

export default memory;
