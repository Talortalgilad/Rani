/** The shapes of the block game (SPEC-blocks.md 3.1). There is no rotation: every direction is a shape of its own. Pure: no DOM. */
export type Group = 'easy' | 'medium' | 'large' | 'late';
export type Cell = [number, number]; // [row, col] inside the shape's box
export interface Piece { id: string; name: string; cells: Cell[]; w: number; h: number; group: Group }

const parse = (art: string[]): Cell[] => art.flatMap((row, r) => [...row].flatMap((ch, c) => (ch === '#' ? ([[r, c]] as Cell[]) : [])));
const norm = (cells: Cell[]): Cell[] => {
  const r0 = Math.min(...cells.map((c) => c[0]));
  const c0 = Math.min(...cells.map((c) => c[1]));
  return cells.map(([r, c]): Cell => [r - r0, c - c0]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
};
const key = (cells: Cell[]): string => cells.map((c) => c.join(',')).join(';');
const rot = (cells: Cell[]): Cell[] => norm(cells.map(([r, c]): Cell => [c, -r]));
const mirror = (cells: Cell[]): Cell[] => norm(cells.map(([r, c]): Cell => [r, -c]));

function variants(cells: Cell[], rotations: boolean, mirrored: boolean): Cell[][] {
  const seen = new Map<string, Cell[]>();
  const add = (x: Cell[]): void => void (!seen.has(key(x)) && seen.set(key(x), x));
  let cur = norm(cells);
  for (let i = 0; i < (rotations ? 4 : 1); i++) {
    add(cur);
    if (mirrored) add(mirror(cur));
    cur = rot(cur);
  }
  return [...seen.values()];
}

interface Def { name: string; group: Group; art: string[]; rotate?: boolean; mirror?: boolean }
const DEFS: Def[] = [
  { name: 'dot', group: 'easy', art: ['#'] },
  { name: 'line2', group: 'easy', art: ['##'], rotate: true },
  { name: 'square2', group: 'easy', art: ['##', '##'] },
  { name: 'l3', group: 'easy', art: ['#.', '##'], rotate: true },
  { name: 'line3', group: 'medium', art: ['###'], rotate: true },
  { name: 'line4', group: 'medium', art: ['####'], rotate: true },
  { name: 'l4', group: 'medium', art: ['#.', '#.', '##'], rotate: true, mirror: true },
  { name: 't', group: 'medium', art: ['###', '.#.'], rotate: true },
  { name: 's', group: 'medium', art: ['.##', '##.'], rotate: true },
  { name: 'z', group: 'medium', art: ['##.', '.##'], rotate: true },
  { name: 'line5', group: 'large', art: ['#####'], rotate: true },
  { name: 'square3', group: 'large', art: ['###', '###', '###'] },
  { name: 'l5', group: 'large', art: ['#..', '#..', '###'], rotate: true },
  // diagonals: only after level 20 of the journey (SPEC-blocks.md 3.1)
  { name: 'diag2', group: 'late', art: ['#.', '.#'], rotate: true },
  { name: 'diag3', group: 'late', art: ['#..', '.#.', '..#'], rotate: true },
];

/** Every shape in every direction. */
export const PIECES: Piece[] = DEFS.flatMap((d) =>
  variants(parse(d.art), !!d.rotate, !!d.mirror).map((cells, i): Piece => ({ id: `${d.name}-${i}`, name: d.name, cells, w: Math.max(...cells.map((c) => c[1])) + 1, h: Math.max(...cells.map((c) => c[0])) + 1, group: d.group })),
);
export const pieceById = (id: string): Piece => PIECES.find((p) => p.id === id) ?? PIECES[0];
/** The shapes that may be dealt (the diagonals only when `late` is on). */
export const pool = (late = false): Piece[] => PIECES.filter((p) => late || p.group !== 'late');
export const sizeOf = (p: Piece): number => p.cells.length;

/** The 90-degree turn of a shape (the "rotate" helper of the game, SPEC 3.5): the same shape, turned clockwise, as one of the shapes above. */
export function turned(p: Piece): Piece {
  const k = key(rot(p.cells));
  return PIECES.find((q) => q.name === p.name && key(q.cells) === k) ?? p;
}
