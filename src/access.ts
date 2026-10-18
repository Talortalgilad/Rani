import { getState } from './storage';

/**
 * Gate access. The only way to start a round is startRound(), and a pass is only
 * granted by the gate screen after all questions are solved. Held in memory only,
 * so a reload or a typed URL always goes back through the gate.
 */
let pass: { gameId: string; rounds: number } | null = null;
let parentOk = false;

export function grantPass(gameId: string): void {
  const f = getState().settings.gateFrequency;
  pass = { gameId, rounds: f === 'every' ? 1 : f === 'entry' ? Infinity : f };
}

/** Consumes one round of the pass. False means the gate must be shown. */
export function startRound(gameId: string): boolean {
  if (pass && pass.gameId === gameId && pass.rounds > 0) {
    pass.rounds--;
    return true;
  }
  return false;
}

export function clearPass(): void {
  pass = null;
}

export function allowParent(): void {
  parentOk = true;
}
export function consumeParent(): boolean {
  const ok = parentOk;
  parentOk = false;
  return ok;
}

/** A paused round saved by a game (key `session`, with `savedAt`) may be resumed without the gate for 10 minutes. */
export const SESSION_TTL_MS = 10 * 60 * 1000;

export function hasFreshSession(gameId: string): boolean {
  const s = (getState().games[gameId] as { session?: { savedAt?: unknown } | null } | undefined)?.session;
  if (!s || typeof s.savedAt !== 'number') return false;
  const age = Date.now() - s.savedAt;
  return age >= 0 && age < SESSION_TTL_MS;
}
