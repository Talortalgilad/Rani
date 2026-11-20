/**
 * One voice for the whole carnival: at any moment ONE speech clip plays, and nothing else (greetings, banners, quests, the bubbles of the squishies, English sentences, windows, cards).
 * The order of importance: what she tapped (it cuts what plays), then the banner of the entry, then the other banners, then one squishy.
 *  - a tap cuts what plays and clears the squishies' and the banners' lines that wait (the banner of the entry stays);
 *  - the squishies' own talk (English sentences, wishes, a small bubble) is spontaneous: at most one every 8 seconds, only from a squishy who is on the screen, and when there is no room it is
 *    THROWN AWAY, never put in a line (so nothing piles up);
 *  - in the first 5 seconds after the entry only the banner of the entry speaks, and no squishy;
 *  - a short effect (a hop, a heart, confetti) is not here: it never waits, and the sound module lets at most three sound together.
 * Pure (a clock and an engine are given), so a test can run a whole entry on a fake clock.
 */
import { stopSpeech } from '../../games/english/voice';

export type Prio = 'tap' | 'entry' | 'banner' | 'resident';
export interface SayOpts {
  prio?: Prio;
  /** the squishy's own talk (not an answer to a tap): at most one every 8 s, and thrown away when there is no room */
  spont?: boolean;
  /** the squishy who talks is on the screen (false: his line is thrown away) */
  onScreen?: boolean;
}
export interface Engine {
  now(): number;
  /** cuts what plays (and what has not started yet) */
  stop(): void;
  after(ms: number, f: () => void): void;
}
interface Job { id: number; prio: Prio; run: () => Promise<unknown>; resolve: (played: boolean) => void }
const RANK: Record<Prio, number> = { tap: 4, entry: 3, banner: 2, resident: 1 };
export const QUIET_MS = 5000;
export const SPONT_GAP_MS = 8000;

export class VoiceQueue {
  private current: Job | null = null;
  private queue: Job[] = [];
  private n = 0;
  private startedAt = -Infinity;
  private lastSpont = -Infinity;
  /** what happened (the tests and the measurements read it): clips that were asked, started, thrown away, cut */
  readonly stats = { asked: 0, started: 0, dropped: 0, cut: 0 };
  /** every start and end, with the time (for a test that looks for two clips that overlap) */
  readonly log: { t: number; ev: 'start' | 'end'; prio: Prio; id: number }[] = [];
  constructor(private eng: Engine) {}

  /** the entry into the carnival: the quiet window of 5 seconds begins, nothing waits from before */
  begin(): void {
    this.startedAt = this.eng.now();
    this.lastSpont = -Infinity;
    this.queue.forEach((j) => this.drop(j));
    this.queue = [];
  }
  private quiet(): boolean {
    return this.eng.now() - this.startedAt < QUIET_MS;
  }
  private drop(j: Job): void {
    this.stats.dropped++;
    j.resolve(false);
  }
  /** says something (`run` plays it and ends when it is over); resolves true when it was played, false when it was thrown away or cut */
  request(run: () => Promise<unknown>, o: SayOpts = {}): Promise<boolean> {
    const prio = o.prio ?? 'tap';
    this.stats.asked++;
    return new Promise((resolve) => {
      const job: Job = { id: ++this.n, prio, run, resolve };
      if (prio === 'resident') {
        // a squishy: never in the quiet window, never off the screen; spontaneous talk only when nothing plays and nothing waits, one every 8 s
        if (o.onScreen === false || this.quiet()) return this.drop(job);
        if (o.spont) {
          if (this.current || this.queue.length || this.eng.now() - this.lastSpont < SPONT_GAP_MS) return this.drop(job);
          this.lastSpont = this.eng.now();
          return this.start(job);
        }
        // an answer of a squishy (a baby's hello, a friend's line): one waits at the most (the newest)
        for (const q of this.queue.filter((x) => x.prio === 'resident')) (this.queue.splice(this.queue.indexOf(q), 1), this.drop(q));
        this.queue.push(job);
        return this.pump();
      }
      if (prio === 'tap') {
        // what she tapped comes first and cuts what plays; the lines of the squishies and the other banners that waited are over
        for (const q of this.queue.filter((x) => x.prio !== 'entry')) (this.queue.splice(this.queue.indexOf(q), 1), this.drop(q));
        return this.start(job, true);
      }
      // the banners: the entry first; each kind waits in a line of a few
      const same = this.queue.filter((x) => x.prio === prio);
      if (same.length >= 4) (this.queue.splice(this.queue.indexOf(same[0]), 1), this.drop(same[0]));
      this.queue.push(job);
      if (prio === 'entry' && this.current && RANK[this.current.prio] < RANK.entry) return this.start(this.takeNext()!, true);
      this.pump();
    });
  }
  private takeNext(): Job | null {
    // the quiet window holds the banners that are not the entry's
    const ok = this.queue.filter((j) => j.prio === 'entry' || !this.quiet());
    if (!ok.length) return null;
    const best = ok.reduce((a, b) => (RANK[b.prio] > RANK[a.prio] ? b : a));
    this.queue.splice(this.queue.indexOf(best), 1);
    return best;
  }
  private pump(): void {
    if (this.current) return;
    const next = this.takeNext();
    if (next) return this.start(next);
    // only banners that wait for the end of the quiet window: come back then
    if (this.queue.some((j) => j.prio !== 'resident')) this.eng.after(Math.max(0, QUIET_MS - (this.eng.now() - this.startedAt)) + 1, () => this.pump());
    else if (this.queue.length) this.queue.splice(0).forEach((j) => this.drop(j));
  }
  private start(job: Job, cut = false): void {
    if (this.current) {
      // (a cut: the old one is over)
      this.stats.cut++;
      const old = this.current;
      this.current = null;
      this.log.push({ t: this.eng.now(), ev: 'end', prio: old.prio, id: old.id });
      old.resolve(false);
    }
    if (cut) this.eng.stop();
    this.current = job;
    this.stats.started++;
    this.log.push({ t: this.eng.now(), ev: 'start', prio: job.prio, id: job.id });
    const done = (): void => {
      if (this.current !== job) return;
      this.current = null;
      this.log.push({ t: this.eng.now(), ev: 'end', prio: job.prio, id: job.id });
      job.resolve(true);
      this.pump();
    };
    job.run().then(done, done);
  }
}

/** the real one: the clock of the page, and the stop of the speech */
export const voice = new VoiceQueue({ now: () => Date.now(), stop: () => stopSpeech(), after: (ms, f) => void window.setTimeout(f, ms) });
