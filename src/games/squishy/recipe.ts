/** The recipes of the orders (SPEC-squishy.md 2.3): pure. By the maths level of Rani: spoons (levels 1-2), the measuring cup (3), half and half (4-5). Every recipe has one right answer. */
import { mixSpoons } from './mix';
import type { RGB } from './paint';
import { PALETTE } from './paint';
import { paletteId } from './orders';

export type Recipe =
  | { kind: 'spoons'; color: string; n: number; white: number; total: number; choices: number[] }
  | { kind: 'cup'; color: string; line: number }
  | { kind: 'half'; color: string };

export const recipeKind = (level: number): Recipe['kind'] => (level <= 2 ? 'spoons' : level === 3 ? 'cup' : 'half');
const colorRgb = (id: string): RGB => PALETTE.find((p) => p.id === id)!.rgb;

export function makeRecipe(level: number, color: string, r: () => number = Math.random): Recipe {
  const k = recipeKind(level);
  if (k === 'cup') return { kind: 'cup', color, line: 2 + Math.floor(r() * 8) };
  if (k === 'half') return { kind: 'half', color };
  // spoons: level 1 only the colour (1-3 spoons), level 2 the colour and one or two spoons of white (never more white than half of the colour, so the colour stays that colour)
  const n = level <= 1 ? 1 + Math.floor(r() * 3) : 2 + Math.floor(r() * 4);
  const white = level <= 1 ? 0 : Math.min(Math.floor(n / 2), 1 + Math.floor(r() * 2));
  const total = n + white;
  const set = new Set<number>([total]);
  while (set.size < 3) {
    const c = total + (Math.floor(r() * 5) - 2) || total + 3;
    if (c >= 1 && c <= 10) set.add(c);
  }
  const choices = [...set].sort(() => r() - 0.5);
  return { kind: 'spoons', color, n, white, total, choices };
}
/** the colour that comes out of the bowl for a recipe that was followed */
export function recipeColor(rec: Recipe): RGB {
  if (rec.kind === 'spoons') return mixSpoons([{ id: rec.color, n: rec.n }, { id: 'white', n: rec.white }]);
  if (rec.kind === 'cup') return colorRgb(rec.color);
  return mixSpoons([{ id: rec.color, n: 1 }, { id: 'white', n: 1 }]);
}
export const recipeIsRight = (rec: Recipe): boolean => paletteId(recipeColor(rec)) === rec.color;
