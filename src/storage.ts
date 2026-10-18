const KEY = 'rani-games-v1';
const VERSION = 1;

export type QuestionType = 'count' | 'add' | 'sub' | 'missing' | 'compare' | 'sequence' | 'bonds10';

export interface AppState {
  version: number;
  profile: { name: string; avatar: string };
  stars: number;
  settings: {
    gateQuestions: number;
    gateFrequency: 'every' | 2 | 3 | 'entry';
    mathLevel: 'auto' | 1 | 2 | 3 | 4 | 5;
    enabledTypes: QuestionType[];
    tts: boolean;
    sound: boolean;
    dailyLimitMin: number | null;
    /** Brick breaker ball speed; wired to the parent area in stage 5. */
    ballSpeed: 'slow' | 'normal' | 'fast';
  };
  math: {
    currentLevel: number;
    recent: boolean[];
    answeredAtLevel: number;
    log: { date: string; type: QuestionType; correct: boolean; attempts: number }[];
  };
  games: Record<string, unknown>;
  usage: { date: string; minutes: number };
}

function defaults(): AppState {
  return {
    version: VERSION,
    profile: { name: 'רני', avatar: '🦄' },
    stars: 0,
    settings: {
      gateQuestions: 3,
      gateFrequency: 'every',
      mathLevel: 'auto',
      enabledTypes: ['count', 'add', 'sub', 'missing', 'compare', 'sequence', 'bonds10'],
      tts: true,
      sound: true,
      dailyLimitMin: null,
      ballSpeed: 'normal',
    },
    math: { currentLevel: 1, recent: [], answeredAtLevel: 0, log: [] },
    games: {},
    usage: { date: '', minutes: 0 },
  };
}

let state: AppState | null = null;

export function getState(): AppState {
  if (state) return state;
  const base = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<AppState>;
      state = {
        ...base,
        ...saved,
        profile: { ...base.profile, ...saved.profile },
        settings: { ...base.settings, ...saved.settings },
        math: { ...base.math, ...saved.math },
        usage: { ...base.usage, ...saved.usage },
        version: VERSION,
      };
      return state;
    }
  } catch {
    /* fall through to defaults */
  }
  state = base;
  return state;
}

export function saveState(): void {
  if (!state) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: keep working in memory */
  }
}

export function update(fn: (s: AppState) => void): void {
  fn(getState());
  saveState();
}

/** Per-game namespaced storage, used by GameContext. */
export function gameStore(gameId: string) {
  return {
    save<T>(key: string, value: T): void {
      update((s) => {
        const ns = (s.games[gameId] as Record<string, unknown> | undefined) ?? {};
        ns[key] = value;
        s.games[gameId] = ns;
      });
    },
    load<T>(key: string, fallback: T): T {
      const ns = getState().games[gameId] as Record<string, unknown> | undefined;
      return ns && key in ns ? (ns[key] as T) : fallback;
    },
  };
}
