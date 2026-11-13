import type { GameContext, GameModule } from '../types';
import { cleanName, showNameScreen } from './ui/nameScreen';
import { showBanner } from './ui/banner';
import { showRescue } from './ui/rescue';
import { runStation } from './ui/quest';
import { showMap, showWorld } from './ui/map';
import { ACCESSORIES, accessoryOf, unlockedAccessories } from './art/accessories';
import { SQUISHIES, squishyOfWorld } from './art/squishies';
import { showWordbook } from './ui/wordbook';
import type { Journey } from './ui/journeyTabs';
import { showIsland, showLettersMap } from './letters/ui/mapLetters';
import { letterSquishyArt } from './letters/ui/glyph';
import { SQUISHY_LETTER, stationsOf } from './letters/progress';
import { ISLANDS, islandInfo } from './letters/journey';
import { learnedBefore, planLetterStation } from './letters/plan';
import { songTaskStep } from './engine/steps';
import { showShelf } from './ui/shelf';
import { preloadCheesy, setLook } from './art/cheesy';
import { planStation } from './engine/planner';
import { preloadVoice, sayLabel, sayLine } from './content/heLines';
import { likeIds } from './content/likes';
import { STATIONS_PER_WORLD, addPlay, dayNumber, emptyMap, finishStation, markSeen, review, type MapProgress, type Words } from './engine/progress';
import { labelBusy, recognitionAvailable, stopSpeech } from './voice';
import { getState } from '../../storage';
import { he } from './content/lines';
import { preloadLetters, preloadWorld } from './art/images';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import '@fontsource/fredoka/hebrew-600.css';
import '@fontsource/fredoka/hebrew-700.css';
import './ui/english.css';

interface Companion { name: string }
interface Verbs { [verb: string]: number }

let ctx: GameContext | null = null;
let root: HTMLElement | null = null;
let stop: (() => void) | null = null;

const companion = (): Companion | null => ctx!.load<Companion | null>('companion', null);
const verbs = (): Verbs => ctx!.load<Verbs>('verbs', {});
const rescued = (): string[] => ctx!.load<string[]>('rescued', []);
const words = (): Words => ctx!.load<Words>('words', {});
const mapState = (): MapProgress => ctx!.load<MapProgress>('map', emptyMap());
/** a parent setting (off): every world and station is open */
const openAll = (): boolean => ctx!.load<boolean>('openAll', false);
/** the second journey (SPEC-letters.md): its own progress and its own rescued letters */
const lmap = (): MapProgress => ctx!.load<MapProgress>('lmap', emptyMap());
const rescuedLetters = (): string[] => ctx!.load<string[]>('rescuedLetters', []);
const journey = (): Journey => ctx!.load<Journey>('journey', 'words');
const buddy = (): string | null => ctx!.load<string | null>('buddy', null);
const accessory = (): string | null => ctx!.load<string | null>('accessory', null);
const unlocked = () => unlockedAccessories(mapState().done, STATIONS_PER_WORLD);
/** What Cheesy and the others call the companion: Cheesy's own name, or the name of the squishy she chose as her friend. */
const displayName = (): string => SQUISHIES.find((s) => s.id === buddy())?.name ?? companion()!.name;
/** The accessory is worn only while it is won (a reset of the map takes it away). */
const applyLook = (): void => setLook({ buddy: buddy(), accessory: unlocked().some((a) => a.id === accessory()) ? accessory() : null });
const saveWords = (w: Words): void => ctx!.save('words', w);

function swap(f: () => () => void): void {
  stop?.();
  stopSpeech(false);
  stop = f();
}

function enter(): void {
  const c = companion();
  if (!c?.name) {
    swap(() => showNameScreen(root!, ctx!.sound, (name) => {
      ctx!.save('companion', { name: cleanName(name) });
      showWorlds();
    }));
  } else showWorlds();
}

/** A screen says its title when it opens (not over a label that was just pressed). */
const announce = (id: string, name = ''): void => void (!labelBusy() && sayLine(id, name));

function showShelfScreen(): void {
  swap(() =>
    showShelf(root!, {
      rescued: rescued(),
      buddy: buddy(),
      accessory: accessory(),
      unlocked: unlocked(),
      letters: ISLANDS.map((i) => ({ id: SQUISHY_LETTER[i.n], art: letterSquishyArt(SQUISHY_LETTER[i.n], i.color), have: rescuedLetters().includes(SQUISHY_LETTER[i.n]) })),
      sound: ctx!.sound,
      onBuddy: (id) => (ctx!.save('buddy', id), applyLook()),
      onAccessory: (id) => (ctx!.save('accessory', id), applyLook()),
      onBack: showWorlds,
    }),
  );
  announce('shelf_title');
}

function showBook(tab?: 'words' | 'songs'): void {
  swap(() => showWordbook(root!, { words: words(), map: mapState(), sound: ctx!.sound, onSong: singSong, onBack: showWorlds }, tab));
  announce(tab === 'songs' ? 'songs' : 'wordbook');
}

/** A song of a finished world, sung again from the book. */
function singSong(world: number): void {
  void preloadWorld(world).then(() => {
    if (!root) return;
    swap(() => runStation(root!, { name: displayName(), world, steps: [songTaskStep(world)], sound: ctx!.sound, verbs: verbs(), onVerb: () => {}, onScore: () => {}, onSeen: () => {}, onHome: () => showBook('songs'), onFinish: () => showBook('songs') }));
  });
}

/** The map of the worlds (the first screen after the name). */
function showWorlds(): void {
  if (journey() === 'letters') return showLetters();
  const name = displayName();
  swap(() => showMap(root!, { name, openAll: openAll(), map: mapState(), sound: ctx!.sound, onWorld: showStations, onShelf: showShelfScreen, onBook: () => showBook(), onJourney: pickJourney, onHome: () => ctx!.onExit() }));
  announce('island_title', name);
}

function pickJourney(j: Journey): void {
  ctx!.save('journey', j);
  showWorlds();
}

/** The map of the letters journey. */
function showLetters(): void {
  const name = displayName();
  swap(() => showLettersMap(root!, { name, openAll: openAll(), map: lmap(), sound: ctx!.sound, onIsland: showIslandStations, onJourney: pickJourney, onShelf: showShelfScreen, onBook: () => showBook(), onHome: () => ctx!.onExit() }));
  announce('letters_title');
}

function showIslandStations(island: number): void {
  swap(() => showIsland(root!, { island, openAll: openAll(), map: lmap(), sound: ctx!.sound, onStation: (s) => playLetterStation(island, s), onBack: showLetters }));
  announce(`island_${island}`);
}

function playLetterStation(island: number, station: number): void {
  const wait = document.createElement('div');
  wait.className = 'en-loading';
  wait.textContent = '⏳';
  root!.appendChild(wait);
  void preloadLetters(island).then(() => {
    wait.remove();
    if (root) startLetterStation(island, station);
  });
}

function startLetterStation(island: number, station: number): void {
  const name = displayName();
  const today = dayNumber();
  const t0 = Date.now();
  const isl = islandInfo(island);
  const steps = planLetterStation({ island, station, learned: learnedBefore(island, station), seed: today * 31 + station * 7 + island + Math.floor(Math.random() * 1000) });
  swap(() =>
    runStation(root!, {
      name,
      world: 3,
      bg: 3,
      accent: isl.color === '#ffc83a' ? '#ff7a2e' : isl.color,
      steps,
      sound: ctx!.sound,
      verbs: verbs(),
      onVerb: () => {},
      onScore: (ws, firstTry) => saveWords(ws.reduce((acc, id) => review(acc, id, firstTry, today), words())),
      onSeen: (key) => saveWords(markSeen(words(), key, today)),
      onHome: () => showIslandStations(island),
      onFinish: (stars) => {
        ctx!.save('playlog', addPlay(ctx!.load('playlog', {}), today, Math.min(20, Math.max(1, Math.round((Date.now() - t0) / 60000)))));
        ctx!.onRoundEnd({ won: true, stars, score: stars });
        ctx!.save('lmap', finishStation(lmap(), island, station, stars));
        swap(() => showBanner(root!, stars, name, ctx!.sound, () => (station === stationsOf(island) - 1 ? rescueLetter(island, name) : showIslandStations(island))));
      },
    }),
  );
}

/** The squishy letter of an island is rescued at the end of its words station. */
function rescueLetter(island: number, name: string): void {
  const isl = islandInfo(island);
  const id = SQUISHY_LETTER[island];
  if (!rescuedLetters().includes(id)) ctx!.save('rescuedLetters', [...rescuedLetters(), id]);
  const sq = { id: `letter-${id}`, name: `${id.toUpperCase()}`, world: island, he: isl.he };
  swap(() => showRescue(root!, name, sq, ctx!.sound, (toShelf) => (toShelf ? showShelfScreen() : showLetters()), { art: letterSquishyArt(id, isl.color) }));
}

function showStations(world: number): void {
  swap(() => showWorld(root!, { world, openAll: openAll(), map: mapState(), sound: ctx!.sound, onStation: (s) => playStation(world, s), onBack: showWorlds }));
  announce(`world_${world}`);
}

/** The pictures of the world are fetched now, when it is entered; the service worker keeps them for offline. */
function playStation(world: number, station: number): void {
  const wait = document.createElement('div');
  wait.className = 'en-loading';
  wait.textContent = '⏳';
  root!.appendChild(wait);
  void preloadWorld(world).then(() => {
    wait.remove();
    if (root) startStation(world, station);
  });
}

function startStation(world: number, station: number): void {
  const name = displayName();
  const today = dayNumber();
  const t0 = Date.now();
  const steps = planStation({ world, station, words: words(), today, likes: ctx!.load<string[]>('likes', likeIds), say: ctx!.load<boolean>('say', false) && recognitionAvailable(), seed: today * 31 + (mapState().done[world] ?? 0) * 7 + station + Math.floor(Math.random() * 1000) });
  swap(() =>
    runStation(root!, {
      name,
      world,
      steps,
      sound: ctx!.sound,
      verbs: verbs(),
      onVerb: (v) => ctx!.save('verbs', { ...verbs(), [v]: (verbs()[v] ?? 0) + 1 }),
      onScore: (ws, firstTry) => saveWords(ws.reduce((acc, id) => review(acc, id, firstTry, today), words())),
      onSeen: (key) => saveWords(markSeen(words(), key, today)),
      onHome: () => showStations(world),
      onFinish: (stars) => {
        ctx!.save('playlog', addPlay(ctx!.load('playlog', {}), today, Math.min(20, Math.max(1, Math.round((Date.now() - t0) / 60000)))));
        ctx!.onRoundEnd({ won: true, stars, score: stars });
        ctx!.save('map', finishStation(mapState(), world, station, stars));
        swap(() => showBanner(root!, stars, name, ctx!.sound, () => (station === STATIONS_PER_WORLD - 1 ? rescue(world, name) : showStations(world))));
      },
    }),
  );
}

function rescue(world: number, name: string): void {
  const sq = squishyOfWorld(world);
  if (!rescued().includes(sq.name)) ctx!.save('rescued', [...rescued(), sq.name]);
  // every third world brings an accessory for Cheesy (it is worn at once)
  const prize = ACCESSORIES.find((a) => a.world === world);
  if (prize && !accessory()) ctx!.save('accessory', prize.id);
  applyLook();
  swap(() => showRescue(root!, name, sq, ctx!.sound, (toShelf) => (toShelf ? showShelfScreen() : showWorlds()), { prize: accessoryOf(prize?.id), finale: world === 12 }));
}

const icon = `<svg viewBox="0 0 100 100" width="64" height="64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <polygon points="50,24 22,76 78,76" fill="#3a2f4b" stroke="#3a2f4b" stroke-width="22" stroke-linejoin="round"/>
  <polygon points="50,24 22,76 78,76" fill="#ffc83a" stroke="#ffc83a" stroke-width="16" stroke-linejoin="round"/>
  <circle cx="42" cy="58" r="6" fill="#fff" stroke="#3a2f4b" stroke-width="2.5"/><circle cx="58" cy="58" r="6" fill="#fff" stroke="#3a2f4b" stroke-width="2.5"/>
  <circle cx="43.5" cy="59.5" r="3.2" fill="#3a2f4b"/><circle cx="59.5" cy="59.5" r="3.2" fill="#3a2f4b"/>
  <path d="M44 68 Q50 74 56 68" fill="none" stroke="#3a2f4b" stroke-width="3" stroke-linecap="round"/></svg>`;

const mod: GameModule = {
  id: 'english',
  /** the lobby shows "the adventures of ___" with the name Rani gave the squishy (before she names it: the plain title) */
  get title(): string {
    const name = (getState().games.english as { companion?: { name?: string } } | undefined)?.companion?.name;
    return name ? he.islandTitle(name) : 'אנגלית עם צ׳יזי';
  },
  icon,
  color: '#ffb52e',
  /** English is learning in itself: no maths gate in front of it (a parent setting later) */
  noGate: true,
  mount(c: GameContext) {
    ctx = c;
    applyLook();
    preloadCheesy();
    void preloadVoice(0);
    if (import.meta.env.DEV) (window as unknown as { __enRescueLetter?: (n: number) => void }).__enRescueLetter = (n) => rescueLetter(n, displayName());
    if (import.meta.env.DEV) (window as unknown as { __enRescue?: (w: number) => void }).__enRescue = (w) => rescue(w, displayName());
    root = document.createElement('div');
    root.className = 'english-root';
    // anything with data-say is read when it is pressed (a button, a title, a hint): the recording of its text, or the phone's voice
    root.addEventListener('pointerdown', (e) => {
      const id = (e.target as HTMLElement).closest<HTMLElement>('[data-say]')?.dataset.say;
      if (id) void sayLabel(id, ['island_title', 'i_am', 'proud', 'rescued'].includes(id) ? displayName() : '');
    });
    c.container.appendChild(root);
    enter();
  },
  canInterrupt: () => true,
  pause() {
    stopSpeech();
  },
  resume() {},
  unmount() {
    stop?.();
    stopSpeech();
    root?.remove();
    root = null;
    ctx = null;
    stop = null;
  },
};
export default mod;
