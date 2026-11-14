/**
 * The speech bubbles of the residents (SPEC-carnival.md 4.4). Pure schedulers, driven by the time that the lobby is open (never by the clock):
 *  - small bubbles: every few seconds one resident (never the same twice) says something short; the sound only when he is near the middle of the screen;
 *  - the "!" bubbles: at most two at once; a new one half a minute after the last one was answered; an ignored one stays.
 */
import { rng } from './gen';

export const MAX_ALERTS = 2;
export const ALERT_WAIT = 30;
export const FIRST_WAIT = 6;

export interface Alert { r: number; seed: number }
export interface AlertState { alerts: Alert[]; /** seconds of lobby time until the next one may appear */ wait: number }
export const freshAlerts = (): AlertState => ({ alerts: [], wait: FIRST_WAIT });

/** Time passes: returns the alert that appeared now, or null. `n` residents, `busy` (a talk is open: nothing new appears). */
export function tickAlerts(s: AlertState, dt: number, n: number, seed: number, busy = false): Alert | null {
  if (busy || s.alerts.length >= MAX_ALERTS || n <= 0) return null;
  s.wait -= dt;
  if (s.wait > 0) return null;
  const free = Array.from({ length: n }, (_, i) => i).filter((i) => !s.alerts.some((a) => a.r === i));
  if (!free.length) return null;
  const r = rng(seed);
  const a: Alert = { r: free[Math.floor(r() * free.length)], seed: Math.floor(r() * 1e9) };
  s.alerts.push(a);
  // the second one, when there is room, half a minute later
  s.wait = ALERT_WAIT;
  return a;
}
/** A talk was answered: its bubble goes, and the next one comes half a minute later. */
export function answered(s: AlertState, r: number): void {
  s.alerts = s.alerts.filter((a) => a.r !== r);
  s.wait = ALERT_WAIT;
}

export interface Chat { text: string; /** a recorded Hebrew line, or English text with the id of its recording */ he?: string; en?: string; enId?: string }
export const CHATS: Chat[] = [
  { text: 'היי רני!', he: 'cv_chat_hi' },
  { text: 'איזה יום יפה!', he: 'cv_chat_day' },
  { text: 'בואי נשחק!', he: 'cv_chat_play' },
  { text: 'כיף לי כאן!', he: 'cv_chat_fun' },
  { text: 'Hello!', en: 'Hello!', enId: 'hello' },
  { text: 'I love pizza!', en: 'I love pizza!', enId: 'carn_i_love_pizza' },
  { text: 'Hi Rani!', en: 'Hi Rani!', enId: 'carn_hi_rani' },
  { text: 'Nice day!', en: 'Nice day!', enId: 'carn_nice_day' },
  { text: "Let's play!", en: "Let's play!", enId: 'carn_lets_play' },
  { text: 'I am hungry!', en: 'I am hungry!', enId: 'carn_i_am_hungry' },
  { text: 'I like ice cream!', en: 'I like ice cream!', enId: 'carn_i_like_ice_cream' },
  { text: 'Look at me!', en: 'Look at me!', enId: 'carn_look_at_me' },
];
export const CHAT_MIN = 4;
export const CHAT_MAX = 8;

export class Chatter {
  private t: number;
  private last = -1;
  constructor(private rand: () => number, first = 3) {
    this.t = first;
  }
  /** One resident says one line now and then; `skip` are the residents that must not (an open talk, a "!" bubble). */
  tick(dt: number, n: number, skip: number[] = []): { r: number; chat: Chat } | null {
    this.t -= dt;
    if (this.t > 0) return null;
    this.t = CHAT_MIN + this.rand() * (CHAT_MAX - CHAT_MIN);
    const ok = Array.from({ length: n }, (_, i) => i).filter((i) => i !== this.last && !skip.includes(i));
    if (!ok.length) return null;
    const r = ok[Math.floor(this.rand() * ok.length)];
    this.last = r;
    return { r, chat: CHATS[Math.floor(this.rand() * CHATS.length)] };
  }
}

/** The sound is for the ones near the middle of the screen. */
export function nearCentre(x: number, y: number, w: number, h: number): boolean {
  return Math.abs(x - w / 2) < w * 0.32 && Math.abs(y - h / 2) < h * 0.3;
}
