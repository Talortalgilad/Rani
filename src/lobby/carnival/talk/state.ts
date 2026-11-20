/** What the carnival remembers (hearts, which bubbles wait, what to ask next): localStorage, with a version. It does not depend on the clock. */
import type { TalkKind, Subject } from './gen';
import { freshAlerts, type AlertState } from './alerts';

/** What the stalls, levels and quests of stage 2 add (SPEC-carnival.md 5, 7). Stages 3 and 4 add their own keys under `extra` (or new fields with a default here), and old saves still load. */
export interface WorldSave {
  /** what stands on each place: slot id -> item id */
  built: Record<string, string>;
  /** the new residents that arrived, in order (the ids of residents.json) */
  arrived: string[];
  /** the last level that was celebrated (its prize given) */
  levelDone: number;
  /** the quests that are done, and the counters that they read */
  quests: { done: string[]; counts: Record<string, number> };
  /** the guide of the first stall was shown and finished */
  guided: boolean;
  /** the worlds whose new stalls were already announced ("new stalls opened!") */
  worldsSeen: number[];
  /** rounds of games that were played while the carnival was not on the screen: the residents who waited for them give a double heart when she is back */
  pendingRounds: string[];
}
export interface CarnivalSave extends WorldSave {
  v: 2;
  /** whatever a later stage saved, kept as it is */
  extra: Record<string, unknown>;
  hearts: number;
  /** the number of right answers (every fifth gives a star too) */
  answers: number;
  last: Subject | null;
  retry: TalkKind[];
  alerts: AlertState;
  /** how many talks were started (the seed of the next) */
  count: number;
}
const KEY = 'rani-carnival-v1';
export const emptyWorld = (): WorldSave => ({ built: {}, arrived: [], levelDone: 1, quests: { done: [], counts: {} }, guided: false, worldsSeen: [], pendingRounds: [] });
export const emptySave = (): CarnivalSave => ({ v: 2, hearts: 0, answers: 0, last: null, retry: [], alerts: freshAlerts(), count: 0, ...emptyWorld(), extra: {} });

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const mem = (): Store | null => (typeof localStorage === 'undefined' ? null : localStorage);

/** Reads the save; anything unreadable (or from another version) starts again from nothing. */
export function loadSave(store: Store | null = mem()): CarnivalSave {
  try {
    const text = store?.getItem(KEY);
    if (!text) return emptySave();
    const s = JSON.parse(text) as Partial<CarnivalSave>;
    // version 1 (the talks only) loads as it is, with the new fields at their start
    if ((s.v as number) !== 1 && (s.v as number) !== 2) return emptySave();
    const raw = s as Record<string, unknown>;
    const base = emptySave();
    const w = (raw as Partial<WorldSave>) ?? {};
    const known = new Set(['v', 'hearts', 'answers', 'last', 'retry', 'alerts', 'count', 'built', 'arrived', 'levelDone', 'quests', 'guided', 'worldsSeen', 'pendingRounds', 'extra']);
    const extra: Record<string, unknown> = { ...(typeof raw.extra === 'object' && raw.extra ? (raw.extra as Record<string, unknown>) : {}) };
    for (const k of Object.keys(raw)) if (!known.has(k)) extra[k] = raw[k];
    return {
      ...base,
      hearts: Math.max(0, Number(s.hearts) || 0),
      answers: Math.max(0, Number(s.answers) || 0),
      last: s.last === 'math' || s.last === 'english' ? s.last : null,
      retry: Array.isArray(s.retry) ? (s.retry.filter((k) => typeof k === 'string') as TalkKind[]).slice(0, 6) : [],
      alerts: { alerts: Array.isArray(s.alerts?.alerts) ? s.alerts!.alerts.filter((a) => Number.isInteger(a.r) && Number.isFinite(a.seed)).slice(0, 2) : [], wait: Number.isFinite(s.alerts?.wait) ? Math.min(30, Math.max(0, s.alerts!.wait)) : base.alerts.wait },
      count: Math.max(0, Number(s.count) || 0),
      built: Object.fromEntries(Object.entries(w.built && typeof w.built === 'object' ? w.built : {}).filter(([k, v]) => typeof k === 'string' && typeof v === 'string')) as Record<string, string>,
      arrived: Array.isArray(w.arrived) ? w.arrived.filter((x) => typeof x === 'string').slice(0, 30) : [],
      levelDone: Math.max(1, Math.min(20, Number(w.levelDone) || 1)),
      quests: {
        done: Array.isArray(w.quests?.done) ? w.quests!.done.filter((x) => typeof x === 'string') : [],
        counts: Object.fromEntries(Object.entries(w.quests?.counts ?? {}).filter(([, v]) => Number.isFinite(v)).map(([k, v]) => [k, Math.max(0, Number(v))])),
      },
      guided: w.guided === true,
      worldsSeen: Array.isArray(w.worldsSeen) ? w.worldsSeen.filter((x) => Number.isInteger(x)) : [],
      pendingRounds: Array.isArray(w.pendingRounds) ? w.pendingRounds.filter((x) => typeof x === 'string').slice(0, 40) : [],
      extra,
    };
  } catch {
    return emptySave();
  }
}
export function writeSave(s: CarnivalSave, store: Store | null = mem()): void {
  try {
    store?.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
