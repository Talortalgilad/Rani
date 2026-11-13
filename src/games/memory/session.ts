import type { Card, GameSnapshot } from './engine';
import type { VersusState } from './versus';

/** What a round is: a level of the journey, a free game with a deck and a board size, or a game for two. */
export type Size = 'small' | 'medium' | 'large';
export const SIZES: Record<Size, { cols: number; rows: number; he: string }> = {
  small: { cols: 3, rows: 4, he: 'קטן' },
  medium: { cols: 4, rows: 4, he: 'בינוני' },
  large: { cols: 4, rows: 5, he: 'גדול' },
};
export const SIZE_ORDER: Size[] = ['small', 'medium', 'large'];
export const pairsOfSize = (s: Size): number => (SIZES[s].cols * SIZES[s].rows) / 2;

export type Spec =
  | { mode: 'journey'; level: number }
  | { mode: 'free'; deck: string; size: Size }
  | { mode: 'versus'; deck: string; size: Size };

/** A round in the middle, saved so that it can go on after a reload (for at most 10 minutes: access.ts decides, by `savedAt`). */
export interface Session {
  spec: Spec;
  game: GameSnapshot;
  versus?: VersusState;
  savedAt: number;
}

export const SESSION_VERSION_KEYS = ['spec', 'game', 'savedAt'] as const;

/** A session that can be trusted: the right shape, a known mode, and only cards that still exist (`has` knows the pictures: a deleted family photo makes it void). */
export function validSession(s: unknown, has: (art: string) => boolean): s is Session {
  const x = s as Session | null;
  if (!x || typeof x !== 'object' || typeof x.savedAt !== 'number' || !x.spec || !x.game || !Array.isArray(x.game.cards)) return false;
  if (!['journey', 'free', 'versus'].includes(x.spec.mode)) return false;
  if (x.spec.mode === 'versus' && !x.versus) return false;
  return (x.game.cards as Card[]).every((c) => c.face || has(c.art));
}
