/**
 * Wishes and characters (SPEC-carnival.md 4.1, 4.3): every resident has a character that decides what he wants and how he moves, a wish appears now and then
 * (never more than one), and a wish is filled by a matching stall or ride. Nothing here is ever negative: a wish that is not filled just waits. Pure.
 */
import type { Item, WishKind } from './catalog';

export type Personality = 'hungry' | 'playful' | 'sleepy' | 'curious';
/** a wish: the kind that a stall fills, or "play" (a game that he wants to play with Rani: he waits near its plot) */
export type Wish = { kind: WishKind } | { kind: 'play'; game: string };
export type WishType = Wish['kind'];

export const PERSONALITY_HE: Record<Personality, string> = { hungry: 'רעבתן', playful: 'שובב', sleepy: 'ישנוני', curious: 'סקרן' };

interface Trait {
  /** the weights of the kinds of wish */
  weights: Record<WishType, number>;
  /** how fast he walks (1 = the usual) */
  speed: number;
  /** how often he wants something: seconds between wishes, the least and the most */
  gap: [number, number];
  /** how much he calls Rani for a talk (1 = the usual) */
  calls: number;
}
export const TRAITS: Record<Personality, Trait> = {
  hungry: { weights: { food: 5, drink: 2, fun: 1, rest: 1, play: 1 }, speed: 0.8, gap: [45, 90], calls: 1 },
  playful: { weights: { food: 1, drink: 1, fun: 4, rest: 1, play: 3 }, speed: 1.3, gap: [45, 100], calls: 1 },
  sleepy: { weights: { food: 1.5, drink: 1.5, fun: 1, rest: 5, play: 1 }, speed: 0.9, gap: [60, 120], calls: 0.8 },
  curious: { weights: { food: 2, drink: 2, fun: 2.5, rest: 1.5, play: 2 }, speed: 1, gap: [45, 95], calls: 1.6 },
};

/** Picks a kind of wish by the character; `r` is a number in [0, 1). Kinds that cannot happen yet are not asked for by the caller (`allowed`). */
export function pickKind(p: Personality, r: number, allowed: WishType[] = ['food', 'drink', 'fun', 'rest', 'play']): WishType {
  const w = TRAITS[p].weights;
  const kinds = allowed.filter((k) => w[k] > 0);
  const total = kinds.reduce((a, k) => a + w[k], 0);
  let x = r * total;
  for (const k of kinds) {
    x -= w[k];
    if (x < 0) return k;
  }
  return kinds[kinds.length - 1] ?? 'food';
}
export const nextGap = (p: Personality, r: number): number => TRAITS[p].gap[0] + r * (TRAITS[p].gap[1] - TRAITS[p].gap[0]);

/** What fills a wish: the built items with the matching `fills` (a "play" wish is filled by a round of that game, not by an item). */
export const fillers = (wish: Wish, built: Item[]): Item[] => (wish.kind === 'play' ? [] : built.filter((i) => i.fills === wish.kind));

export const WISH_ICON: Record<WishType, string> = { food: '🍕', drink: '🧃', fun: '🎈', rest: '💤', play: '🎮' };
/** the hint that the resident gives when he is tapped and nothing fills his wish ("Maybe you will open a juice stall?") */
export const SUGGEST_LINE: Record<WishType, string> = { food: 'cs_suggest_food', drink: 'cs_suggest_drink', fun: 'cs_suggest_ride', rest: 'cs_suggest_rest', play: 'cs_wish_play' };
export const WISH_LINE: Record<WishType, string> = { food: 'cs_wish_food', drink: 'cs_wish_drink', fun: 'cs_wish_ride', rest: 'cs_wish_rest', play: 'cs_wish_play' };
