/** Two players on one phone (SPEC-memory.md section 3). Pure: no DOM, no timers. The board tells it what happened. */

export interface Player { name: string; avatar: string }
export type Winner = 0 | 1 | 'tie';

export interface VersusState { players: [Player, Player]; scores: [number, number]; turn: 0 | 1; /** pairs found in a row by the player whose turn it is (just for the cheer) */ streak: number }

export class Versus {
  scores: [number, number] = [0, 0];
  turn: 0 | 1 = 0;
  streak = 0;
  constructor(readonly players: [Player, Player], state?: Partial<Pick<VersusState, 'scores' | 'turn' | 'streak'>>) {
    if (state?.scores) this.scores = [state.scores[0] | 0, state.scores[1] | 0];
    if (state?.turn === 1) this.turn = 1;
    this.streak = state?.streak ?? 0;
  }

  get current(): Player { return this.players[this.turn]; }

  /** The player whose turn it is found a pair (or a triple): a point, and the turn stays. Returns who scored. */
  match(): 0 | 1 {
    const who = this.turn;
    this.scores[who] += 1;
    this.streak += 1;
    return who;
  }

  /** A miss: the turn passes to the other player. */
  miss(): 0 | 1 {
    this.turn = this.turn === 0 ? 1 : 0;
    this.streak = 0;
    return this.turn;
  }

  /** Who has more; a tie is a tie (and is celebrated just the same). */
  winner(): Winner {
    if (this.scores[0] === this.scores[1]) return 'tie';
    return this.scores[0] > this.scores[1] ? 0 : 1;
  }

  snapshot(): VersusState {
    return { players: [{ ...this.players[0] }, { ...this.players[1] }], scores: [...this.scores], turn: this.turn, streak: this.streak };
  }
  static restore(s: VersusState): Versus | null {
    if (!s || !Array.isArray(s.players) || s.players.length !== 2 || !Array.isArray(s.scores) || s.scores.length !== 2) return null;
    return new Versus([{ ...s.players[0] }, { ...s.players[1] }], s);
  }
}

/** The names that are offered for the second player (SPEC: dad, mum, Ray, or any name). */
export const SECOND_PLAYER_NAMES = ['אבא', 'אמא', 'ריי'];
export const MAX_NAME = 12;
export const cleanName = (s: string): string => s.replace(/[<>&"]/g, '').trim().slice(0, MAX_NAME);
