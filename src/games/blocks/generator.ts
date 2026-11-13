import { Board, N } from './board';
import { pool, sizeOf, type Piece } from './pieces';

/**
 * The fair and merciful generator of trays (SPEC-blocks.md 3.2). Deterministic for a seed. The iron rule: at least one shape of a new tray
 * fits on the board (30 draws, then an easy shape that fits is put in by force).
 */
export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE: Record<Piece['group'], number> = { easy: 3, medium: 4, large: 2, late: 1.5 };

/** How many shapes of a tray fit on the board. */
export const fitCount = (board: Board, tray: Piece[]): number => tray.filter((p) => board.fits(p)).length;

/** Shapes that complete a row, a column or a square if put in the right place (the "help" of 30% of the trays). */
export function completers(board: Board, shapes: Piece[]): Piece[] {
  return shapes.filter((p) => board.placements(p).some(([r, c]) => board.preview(p, r, c).units > 0));
}

export interface GeneratorOptions { late?: boolean }

export class Generator {
  private rand: () => number;
  /** the ids of the shapes of the last trays, newest first */
  history: string[][] = [];
  constructor(seed: number, private opts: GeneratorOptions = {}) {
    this.rand = mulberry(seed);
  }

  private weight(p: Piece, fullness: number): number {
    let w = BASE[p.group];
    if (fullness > 0.6) w *= p.group === 'easy' ? 3 : p.group === 'large' ? 0.35 : 1;
    // the same shape in each of the last three trays is not dealt a fourth time
    if (this.history.length >= 3 && this.history.slice(0, 3).every((t) => t.includes(p.id))) w = 0;
    return w;
  }

  private pick(shapes: Piece[], fullness: number, exclude: Piece[]): Piece {
    const ws = shapes.map((p) => (exclude.filter((e) => e.id === p.id).length >= 2 ? 0 : this.weight(p, fullness)));
    let total = ws.reduce((a, b) => a + b, 0);
    if (total <= 0) return shapes[Math.floor(this.rand() * shapes.length)];
    let x = this.rand() * total;
    for (let i = 0; i < shapes.length; i++) {
      x -= ws[i];
      if (x <= 0) return shapes[i];
    }
    return shapes[shapes.length - 1];
  }

  /** A new tray of three shapes for this board. */
  next(board: Board): Piece[] {
    const shapes = pool(this.opts.late);
    const full = board.fullness;
    const need = full > 0.75 ? 2 : 1;
    // the shape that helps is also under the rule of variety (not a fourth tray in a row with it)
    const helper = this.rand() < 0.3 ? completers(board, shapes).filter((p) => this.weight(p, full) > 0) : [];
    let tray: Piece[] = [];
    for (let attempt = 0; attempt < 30; attempt++) {
      tray = [];
      if (helper.length) tray.push(helper[Math.floor(this.rand() * helper.length)]);
      while (tray.length < 3) tray.push(this.pick(shapes, full, tray));
      // shuffle so that the helping shape is not always the first
      tray.sort(() => this.rand() - 0.5);
      if (fitCount(board, tray) >= need) break;
      if (attempt === 29) tray = this.force(board, tray, need, shapes);
    }
    this.history.unshift(tray.map((p) => p.id));
    this.history = this.history.slice(0, 3);
    return tray;
  }

  /** After 30 tries: easy shapes that fit are put in by force until the tray has enough that fit. */
  private force(board: Board, tray: Piece[], need: number, shapes: Piece[]): Piece[] {
    const easy = shapes.filter((p) => p.group === 'easy' && board.fits(p));
    // the smallest shape of all is the last resort (a dot fits whenever there is an empty cell)
    const options = easy.length ? easy : shapes.filter((p) => sizeOf(p) === 1 && board.fits(p));
    const out = [...tray];
    for (let i = 0; i < out.length && fitCount(board, out) < need && options.length; i++) {
      if (!board.fits(out[i])) out[i] = options[Math.floor(this.rand() * options.length)];
    }
    return out;
  }
}

/** The cell that is empty most inside: not needed by the generator, kept here for the tests of "board is full" (no shape fits at all). */
export const boardIsFullFor = (board: Board, tray: (Piece | null)[]): boolean => tray.every((p) => !p || !board.fits(p));
export { N };
