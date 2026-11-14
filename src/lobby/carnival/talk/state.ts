/** What the carnival remembers (hearts, which bubbles wait, what to ask next): localStorage, with a version. It does not depend on the clock. */
import type { TalkKind, Subject } from './gen';
import { freshAlerts, type AlertState } from './alerts';

export interface CarnivalSave {
  v: 1;
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
export const emptySave = (): CarnivalSave => ({ v: 1, hearts: 0, answers: 0, last: null, retry: [], alerts: freshAlerts(), count: 0 });

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const mem = (): Store | null => (typeof localStorage === 'undefined' ? null : localStorage);

/** Reads the save; anything unreadable (or from another version) starts again from nothing. */
export function loadSave(store: Store | null = mem()): CarnivalSave {
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return emptySave();
    const s = JSON.parse(raw) as Partial<CarnivalSave>;
    if (s.v !== 1) return emptySave();
    const base = emptySave();
    return {
      ...base,
      hearts: Math.max(0, Number(s.hearts) || 0),
      answers: Math.max(0, Number(s.answers) || 0),
      last: s.last === 'math' || s.last === 'english' ? s.last : null,
      retry: Array.isArray(s.retry) ? (s.retry.filter((k) => typeof k === 'string') as TalkKind[]).slice(0, 6) : [],
      alerts: { alerts: Array.isArray(s.alerts?.alerts) ? s.alerts!.alerts.filter((a) => Number.isInteger(a.r) && Number.isFinite(a.seed)).slice(0, 2) : [], wait: Number.isFinite(s.alerts?.wait) ? Math.min(30, Math.max(0, s.alerts!.wait)) : base.alerts.wait },
      count: Math.max(0, Number(s.count) || 0),
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
