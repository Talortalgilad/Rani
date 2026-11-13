/** The rescue of a full board (SPEC-blocks.md 3.6): the fullest 3 x 3 square bursts by magic, with no points. Pure. */
import { Board, EMPTY, idx } from './board';

/** The square (0-8) that is the fullest; the first of them when several are equally full. Returns its cells. */
export function fullestSquare(board: Board): { square: number; cells: number[] } {
  const fill = board.squareFill();
  let square = 0;
  fill.forEach((n, s) => {
    if (n > fill[square]) square = s;
  });
  const r0 = Math.floor(square / 3) * 3;
  const c0 = (square % 3) * 3;
  const cells: number[] = [];
  for (let r = r0; r < r0 + 3; r++) for (let c = c0; c < c0 + 3; c++) if (board.get(r, c) !== EMPTY) cells.push(idx(r, c));
  return { square, cells };
}

/** Does the magic square free the board, and is it done once per board? Empties the cells and returns them. */
export function rescue(board: Board): number[] {
  const { cells } = fullestSquare(board);
  cells.forEach((i) => (board.cells[i] = EMPTY));
  return cells;
}
