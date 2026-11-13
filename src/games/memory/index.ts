import type { GameContext, GameModule } from '../types';
import { DECKS } from './decks';
import { composeLevel } from './compose';
import { freeDeckById, keysOf, type FreeDeck } from './decks/free';
import { setFamilyUrls } from './decks/pictures';
import { MemoryGame, buildCards, type Card } from './engine';
import { levelConfig } from '../../math/levels';
import { activeLevel } from '../../math/adaptive';
import { sayLabel, sayLine } from '../english/content/heLines';
import { labelOf } from '../english/content/words';
import { speakWord, stopSpeech } from '../english/voice';
import { INK, svg } from './decks/svg';
import { LEVELS } from './levels';
import { getState } from '../../storage';
import { photoUrls, revokeUrls } from './photos';
import { SIZES, pairsOfSize, validSession, type Session, type Spec } from './session';
import { Versus, type Player } from './versus';
import { mountBoard, type Board, type BoardConfig } from './ui/board';
import { renderDecks, LOCK_LINE } from './ui/decks';
import { renderMap, emptyProgress, isUnlocked, type Progress } from './ui/map';
import { renderMenu } from './ui/menu';
import { renderResult, type RoundSummary } from './ui/result';
import { renderSizes } from './ui/sizes';
import { renderVersusSetup } from './ui/versusSetup';
import { renderVersusResult } from './ui/versusResult';
import { mm } from './lines';
import './ui/memory.css';

interface Queued { spec: Spec; at: number }
const QUEUE_TTL_MS = 10 * 60 * 1000;
const EN_FIX: Record<string, string> = { yoyo: 'yo-yo' };

let ctx: GameContext | null = null;
let root: HTMLElement | null = null;
let board: Board | null = null;
/** The round the gate just granted is still unused (first round picked after entering). */
let fresh = true;
/** The photos of the family deck: object URLs (blob:), released when a round is over. */
let famUrls: Map<string, string> | null = null;
let famIds: string[] = [];
let dead = false;
/** The players of the game for two that is being set up or played. */
let players: [Player, Player] | null = null;

const progress = (): Progress => ctx!.load<Progress>('progress', emptyProgress());

function clearBoard(): void {
  board?.destroy();
  board = null;
}

/** (Re)loads the family photos as object URLs; nothing leaves the phone. */
async function loadFamily(): Promise<number> {
  if (famUrls) revokeUrls(famUrls);
  const { ids, urls } = await photoUrls();
  famUrls = urls;
  famIds = ids;
  setFamilyUrls(urls);
  return ids.length;
}

const say = (id: string, name = ''): void => void sayLine(id, name);

function showMenu(): void {
  clearBoard();
  renderMenu(root!, { onJourney: showMap, onVersus: showVersusSetup, onDecks: () => void showDecks('free'), onHome: exitHome });
}

function showMap(): void {
  clearBoard();
  renderMap(root!, progress(), { onPick: (id) => begin({ mode: 'journey', level: id }), onBack: showMenu });
}

function exitHome(): void {
  ctx!.save('queued', null);
  ctx!.save('session', null);
  ctx!.onExit();
}

// ---- free play and the game for two: a deck, then a board size ----

async function showDecks(mode: 'free' | 'versus'): Promise<void> {
  clearBoard();
  const n = await loadFamily();
  if (dead) return;
  renderDecks(root!, {
    progress: progress(),
    photoCount: n,
    photoKeys: famIds.slice(0, 2).map((i) => `fam:${i}`),
    last: ctx!.load<string>('lastDeck', ''),
    onBack: mode === 'versus' ? showVersusSetup : showMenu,
    onLocked: (lock) => window.setTimeout(() => say(LOCK_LINE[lock]), 700),
    onPick: (d) => showSizes(d, mode),
  });
  window.setTimeout(() => say('mm_pickDeck'), 300);
}

function showSizes(deck: FreeDeck, mode: 'free' | 'versus'): void {
  ctx!.save('lastDeck', deck.id);
  renderSizes(root!, {
    deck,
    pictures: deck.kind === 'family' ? famIds.length : deck.keys.length,
    onBack: () => void showDecks(mode),
    onPick: (size) => (mode === 'free' ? begin({ mode: 'free', deck: deck.id, size }) : begin({ mode: 'versus', deck: deck.id, size })),
  });
  window.setTimeout(() => say('mm_pickSize'), 300);
}

function showVersusSetup(): void {
  clearBoard();
  const prof = getState().profile;
  const first: Player = { name: prof.name || 'רני', avatar: prof.avatar || '🦄' };
  renderVersusSetup(root!, {
    first,
    onBack: showMenu,
    onGo: (p) => {
      players = p;
      void showDecks('versus');
    },
  });
  window.setTimeout(() => say('mm_who'), 300);
}

// ---- starting a round ----

/** A round of the journey or of free play: the first one after the gate is free, later ones ask the host (which may show the gate). The game for two has no gate between rounds (only at the entrance). */
function begin(spec: Spec): void {
  if (spec.mode === 'versus' || fresh) {
    fresh = false;
    void play(spec);
    return;
  }
  ctx!.save<Queued>('queued', { spec, at: Date.now() });
  ctx!.requestRound(() => {
    ctx!.save('queued', null);
    void play(spec);
  });
}

interface Prepared { cfg: BoardConfig; cards: Card[]; deckId: string; english: boolean }

/** The deck, the size and the cards of a round. */
function prepare(spec: Spec): Prepared | null {
  if (spec.mode === 'journey') {
    const level = LEVELS.find((l) => l.id === spec.level);
    if (!level) return null;
    const d = DECKS[level.deck];
    return { cfg: { back: d.back, frame: d.frame, cols: level.cols, rows: level.rows, group: level.group }, cards: composeLevel(level, levelConfig(activeLevel()).max), deckId: level.deck, english: false };
  }
  const deck = freeDeckById(spec.deck);
  if (!deck) return null;
  const { cols, rows } = SIZES[spec.size];
  const keys = keysOf(deck, famIds);
  if (keys.length < pairsOfSize(spec.size)) return null;
  return { cfg: { back: deck.back, frame: deck.frame, cols, rows, group: 2 }, cards: buildCards(keys, pairsOfSize(spec.size)), deckId: deck.id, english: deck.kind === 'english' };
}

/** Saves the round as it is (after every calm moment, and when the page is hidden): it can go on for 10 minutes after a reload. */
function saveNow(spec: Spec): void {
  if (!ctx || !board || board.game.done) return;
  const v = board.versus ? board.versus.snapshot() : undefined;
  // a miss that is still showing: the turn has already passed on in what is saved
  if (v && board.game.resolving) {
    v.turn = v.turn === 0 ? 1 : 0;
    v.streak = 0;
  }
  ctx.save<Session>('session', { spec, game: board.game.snapshot(), ...(v ? { versus: v } : {}), savedAt: Date.now() });
}

async function play(spec: Spec, saved?: Session): Promise<void> {
  clearBoard();
  if (spec.mode !== 'journey' && spec.deck === 'family') await loadFamily();
  if (dead) return;
  const prep = prepare(spec);
  if (!prep) return void (spec.mode === 'journey' ? showMap() : showMenu());
  const restored = saved ? MemoryGame.restore(saved.game) : null;
  const versus = spec.mode === 'versus' ? (saved?.versus ? Versus.restore(saved.versus) : players ? new Versus(players) : null) : null;
  if (spec.mode === 'versus' && !versus) return void showMenu();
  if (versus) players = versus.players;
  const back = spec.mode === 'journey' ? showMap : spec.mode === 'free' ? () => void showDecks('free') : () => void showDecks('versus');
  board = mountBoard(root!, prep.cfg, restored?.cards ?? prep.cards, {
    sound: ctx!.sound,
    // the star card is a feature of the journey: in free play and for two the stars do not go into the jar
    onStar: () => (spec.mode === 'journey' ? ctx!.addStars(1) : undefined),
    onBack: back,
    ...(restored ? { game: restored } : {}),
    ...(versus ? { versus } : {}),
    onChange: () => saveNow(spec),
    onFound: (art) => {
      if (!art.startsWith('en:')) return;
      const id = art.slice(3);
      window.setTimeout(() => void speakWord(EN_FIX[id] ?? labelOf(id)), 450); // "Cat!"
    },
    onTurn: (kind, p) => {
      if (kind === 'again' && prep.english) return; // the English word is being said
      window.setTimeout(() => say(kind === 'turn' ? 'mm_turnOf' : 'mm_pairAgain', p.name), kind === 'turn' ? 300 : 900);
    },
    onFinish: (r) => finish(spec, prep, r),
  });
  if (saved && restored) {
    // after a reload: the round waits for a tap ("המשך")
    const o = document.createElement('div');
    o.className = 'mm-overlay-resume';
    o.innerHTML = `<button class="btn big" id="mm-resume" data-say="mm_resume" type="button">▶ ${mm.resume}</button>`;
    root!.appendChild(o);
    o.querySelector('#mm-resume')!.addEventListener('click', () => o.remove());
  } else if (versus) window.setTimeout(() => say('mm_turnOf', versus.current.name), 900);
}

function finish(spec: Spec, prep: Prepared, r: RoundSummary & { winner?: import('./versus').Winner }): void {
  ctx!.save('session', null);
  const overlay = document.createElement('div');
  overlay.className = 'mm-overlay';
  root!.appendChild(overlay);
  if (spec.mode === 'journey') return finishJourney(spec.level, r, overlay);

  // free play and the game for two: no stars into the jar (stars: 0), no progress of the journey
  ctx!.onRoundEnd({ won: true, stars: 0, score: r.attempts });
  if (spec.mode === 'free') {
    ctx!.sound.play('melody1');
    renderResult(overlay, r, undefined, false, { onNext: () => undefined, onAgain: () => begin(spec), onLevels: () => void showDecks('free'), onHome: exitHome }, true);
    return;
  }
  ctx!.sound.play('win');
  const v = board!.versus!;
  const winner = r.winner ?? v.winner();
  const winName = winner === 'tie' ? '' : v.players[winner].name;
  window.setTimeout(() => say(winner === 'tie' ? 'mm_tie' : 'mm_wins', winName), 500);
  renderVersusResult(overlay, { players: v.players, scores: [...v.scores] as [number, number], winner, onAgain: () => begin(spec), onDecks: () => void showDecks('versus'), onHome: exitHome });
  void prep;
}

function finishJourney(id: number, r: RoundSummary, overlay: HTMLElement): void {
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
  const next = LEVELS.find((l) => l.id === id + 1);
  renderResult(overlay, r, prev, !!next && isUnlocked(p, id + 1), {
    onNext: () => begin({ mode: 'journey', level: id + 1 }),
    onAgain: () => begin({ mode: 'journey', level: id }),
    onLevels: showMap,
    onHome: exitHome,
  });
}

/** Home-screen icon: a card with the cow on it. */
const cow = DECKS.farm.art.cow;
const icon = `<svg viewBox="0 0 100 100" width="64" height="64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="12" y="6" width="76" height="88" rx="14" fill="#fff" stroke="${INK}" stroke-width="5"/>
  <g transform="translate(22 20) scale(.56)">${svg(cow).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g></svg>`;

const onHide = (): void => {
  const s = ctx?.load<Session | null>('session', null);
  if (board && s) saveNow(s.spec);
};

const memory: GameModule = {
  id: 'memory',
  title: 'זיכרון',
  icon,
  color: '#1fb5a8',

  async mount(c: GameContext) {
    ctx = c;
    dead = false;
    root = document.createElement('div');
    root.className = 'mm';
    c.container.appendChild(root);
    // every button, title and hint with data-say is read aloud when it is pressed (recording, or the voice of the phone)
    root.addEventListener('pointerdown', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-say]');
      if (el?.dataset.say) void sayLabel(el.dataset.say, '');
    });
    window.addEventListener('pagehide', onHide);
    fresh = !c.resuming;
    const saved = c.resuming ? c.load<Session | null>('session', null) : null;
    if (!c.resuming) c.save('session', null);
    const queuedRaw = c.load<Queued | { level: number; at: number } | null>('queued', null);
    c.save('queued', null);
    // a round saved in the middle (less than 10 minutes ago: access.ts opened the game without the gate)
    if (saved) {
      if (saved.spec?.mode !== 'journey' && (saved.spec as { deck?: string }).deck === 'family') await loadFamily();
      if (validSession(saved, (art) => !art.startsWith('fam:') || famUrls?.has(art) === true)) {
        fresh = false;
        return void play(saved.spec, saved);
      }
      c.save('session', null);
    }
    const queued = queuedRaw && 'spec' in queuedRaw ? queuedRaw : queuedRaw ? { spec: { mode: 'journey' as const, level: queuedRaw.level }, at: queuedRaw.at } : null;
    if (queued && Date.now() - queued.at < QUEUE_TTL_MS && (queued.spec.mode !== 'journey' || (LEVELS.some((l) => l.id === (queued.spec as { level: number }).level) && isUnlocked(progress(), (queued.spec as { level: number }).level)))) {
      begin(queued.spec);
    } else showMenu();
  },

  /** Nothing runs on a clock here, so any moment is fine except while a miss is showing. */
  canInterrupt: () => !board?.busy(),
  pause() {},
  resume() {},

  unmount() {
    dead = true;
    window.removeEventListener('pagehide', onHide);
    clearBoard();
    stopSpeech();
    ctx?.save('session', null);
    if (famUrls) revokeUrls(famUrls);
    famUrls = null;
    setFamilyUrls(new Map());
    root?.remove();
    root = null;
    ctx = null;
  },
};

export default memory;
