import type { SoundApi } from '../sound';

export interface RoundResult {
  won: boolean;
  stars: 0 | 1 | 2 | 3;
  score: number;
}

export interface GameContext {
  container: HTMLElement;
  onExit(): void;
  onRoundEnd(result: RoundResult): void;
  /** Ask the host to start another round; it may show the math gate first. Call `start` only when allowed. */
  requestRound(start: () => void): void;
  sound: SoundApi;
  save<T>(key: string, value: T): void;
  load<T>(key: string, fallback: T): T;
}

export interface GameModule {
  id: string;
  title: string;
  icon: string;
  color: string;
  mount(ctx: GameContext): void;
  pause(): void;
  resume(): void;
  unmount(): void;
}
