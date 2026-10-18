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
