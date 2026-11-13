import type { Object3D } from 'three'; // type only: nothing of Three.js ends up in the regular app
import type { SoundApi } from '../sound';
import type { AppState } from '../storage';

export interface RoundResult {
  won: boolean;
  stars: 0 | 1 | 2 | 3;
  score: number;
}

export interface GameContext {
  container: HTMLElement;
  /** True when the host restored this game after a reload without the gate; the game should come back paused. */
  resuming: boolean;
  onExit(): void;
  onRoundEnd(result: RoundResult): void;
  /** Ask the host to start another round; it may show the math gate first. Call `start` only when allowed. */
  requestRound(start: () => void): void;
  sound: SoundApi;
  /** Adds stars straight to the shared counter on the home screen. */
  addStars(n: number): void;
  getSettings(): AppState['settings'];
  save<T>(key: string, value: T): void;
  load<T>(key: string, fallback: T): T;
}

export interface GameModule {
  id: string;
  title: string;
  icon: string;
  color: string;
  mount(ctx: GameContext): void;
  /** The game is learning in itself: no maths gate before it. */
  noGate?: boolean;
  /** A game saved less than 10 minutes ago (`session.savedAt`) goes on without the gate when the player comes back from the lobby too, not only after a reload. */
  resumeWithoutGate?: boolean;
  /** True when a friendly full-screen message can appear without cutting off a move (ball stuck, round over, paused, menus). */
  canInterrupt?(): boolean;
  pause(): void;
  resume(): void;
  unmount(): void;
  /**
   * Optional: the game's own living miniature for the 3D lobby. Without it the lobby builds a basic island
   * (a hill in the game's colour with its icon on a board), so a new game never breaks the lobby.
   */
  lobbyIsland?: (ctx: LobbyIslandCtx) => LobbyIslandHandle | Promise<LobbyIslandHandle>;
}

export interface LobbyIslandCtx {
  shadows: boolean;
  /** Less motion was asked for: keep the miniature still. */
  reduced: boolean;
}

/** A game's miniature for the lobby: the object to stand on its island, and how to animate and free it. */
export interface LobbyIslandHandle {
  object: Object3D;
  update(dt: number, time: number): void;
  /** Reaction to a tap that does not open the game. */
  tap?(): void;
  dispose(): void;
}
