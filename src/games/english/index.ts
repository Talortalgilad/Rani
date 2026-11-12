import type { GameContext, GameModule } from '../types';
import { cleanName, showNameScreen } from './ui/nameScreen';
import { showBanner } from './ui/banner';
import { showRescue } from './ui/rescue';
import { runStation } from './ui/quest';
import { showMap, showWorld } from './ui/map';
import { SQUISHIES } from './art/squishies';
import { planStation } from './engine/planner';
import { STATIONS_PER_WORLD, dayNumber, emptyMap, finishStation, markSeen, review, type MapProgress, type Words } from './engine/progress';
import { stopSpeech } from './voice';
import { getState } from '../../storage';
import { he } from './content/lines';
import { preloadWorld } from './art/images';
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
const saveWords = (w: Words): void => ctx!.save('words', w);

function swap(f: () => () => void): void {
  stop?.();
  stopSpeech();
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

/** The map of the worlds (the first screen after the name). */
function showWorlds(): void {
  const name = companion()!.name;
  swap(() => showMap(root!, { name, map: mapState(), sound: ctx!.sound, onWorld: showStations, onHome: () => ctx!.onExit() }));
}

function showStations(world: number): void {
  swap(() => showWorld(root!, { world, map: mapState(), sound: ctx!.sound, onStation: (s) => playStation(world, s), onBack: showWorlds }));
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
  const name = companion()!.name;
  const today = dayNumber();
  const steps = planStation({ world, station, words: words(), today, seed: today * 31 + (mapState().done[world] ?? 0) * 7 + station + Math.floor(Math.random() * 1000) });
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
        ctx!.onRoundEnd({ won: true, stars, score: stars });
        ctx!.save('map', finishStation(mapState(), world, station, stars));
        swap(() => showBanner(root!, stars, name, ctx!.sound, () => (station === STATIONS_PER_WORLD - 1 ? rescue(world, name) : showStations(world))));
      },
    }),
  );
}

function rescue(world: number, name: string): void {
  const sq = SQUISHIES[world];
  if (!rescued().includes(sq.name)) ctx!.save('rescued', [...rescued(), sq.name]);
  swap(() => showRescue(root!, name, sq, ctx!.sound, () => showWorlds()));
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
    root = document.createElement('div');
    root.className = 'english-root';
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
