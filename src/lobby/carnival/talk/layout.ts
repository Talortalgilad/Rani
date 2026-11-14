/**
 * How much room a talk takes (SPEC-carnival.md 4.4: no scrolling in a talk, on a screen of 360 x 640). The same numbers go into the page (as CSS
 * variables), and the tests check every question of every level against the room that there is. Pure.
 */
import type { Talk } from './gen';

export const VIEW = { w: 360, h: 640 };
/** the frame of the talk screen: padding (top + bottom), the share of the height of the resident, the line of messages, the gap between things */
export const FRAME = { pad: 24, who: 0.3, msg: 34, gap: 10 };
export interface Board { size: number; gap: number; cols: number }
/** The things to count: 36 px with 8 px between, 5 in a row; over 15 on the board: 28 px with 6 px between, 7 in a row. */
export const boardFor = (total: number): Board => (total > 15 ? { size: 28, gap: 6, cols: 7 } : { size: 36, gap: 8, cols: 5 });
/** "Give me exactly": the things to tap are 48 px, 5 in a row, and the pile is 12 things at most. */
export const PILE: Board = { size: 48, gap: 8, cols: 5 };
export const PILE_MAX = 12;
export const PLATE: Board = { size: 36, gap: 8, cols: 5 };
const BOARD_PAD = 20;
const OPTS = 76;
const PLUS = 30;

const gridH = (n: number, b: Board): number => (n <= 0 ? 0 : Math.ceil(n / b.cols) * b.size + (Math.ceil(n / b.cols) - 1) * b.gap);
const gridW = (n: number, b: Board): number => Math.min(n, b.cols) * b.size + (Math.min(n, b.cols) - 1) * b.gap;

/** The room that the action area has. */
export const availableHeight = (h = VIEW.h): number => h - FRAME.pad - h * FRAME.who - FRAME.msg - FRAME.gap;

/** The height of what a talk puts in the action area (at most: for "give me exactly", the pile and the empty plate, the biggest it gets). */
export function contentHeight(t: Talk): number {
  const g = FRAME.gap;
  switch (t.kind) {
    case 'together': {
      const b = boardFor(t.a + t.b);
      return BOARD_PAD + gridH(t.a, b) + PLUS + gridH(t.b, b) + g + OPTS;
    }
    case 'missing':
      return BOARD_PAD + gridH(t.a, boardFor(t.a)) + g + OPTS;
    case 'more': {
      const b = boardFor(t.a + t.b);
      return BOARD_PAD + gridH(t.a, b) + BOARD_PAD + gridH(t.b, b) + 12 + 2 * 10;
    }
    case 'exact':
      return BOARD_PAD + gridH(t.pile, PILE) + g + (gridH(t.n, PLATE) + 24) + g + OPTS;
    case 'can':
      return 112 + 0;
    case 'what':
      return 130 + g + OPTS + g + 56;
    case 'hello':
      return OPTS;
  }
}
/** The width of the widest thing. */
export function contentWidth(t: Talk): number {
  switch (t.kind) {
    case 'together':
    case 'missing': {
      const b = boardFor(t.kind === 'together' ? t.a + t.b : t.a);
      return 28 + Math.max(gridW(t.kind === 'together' ? t.a : t.a, b), t.kind === 'together' ? gridW(t.b, b) : 0);
    }
    case 'more':
      return 20 + gridW(Math.max(t.a, t.b), boardFor(t.a + t.b));
    case 'exact':
      return 20 + gridW(t.pile, PILE);
    case 'can':
      return 3 * 96 + 2 * 12;
    case 'what':
      return 2 * 100 + 12;
    case 'hello':
      return 3 * 100 + 2 * 12;
  }
}
