/** Recognising the circle a child draws around a picture. Pure maths, no DOM. */

export interface Pt { x: number; y: number }
/** A picture on the screen: its centre and half the size of its square. */
export interface Target { id: string; x: number; y: number; r: number }

export const MIN_POINTS = 12;
/** The end of the line has to come back to within this share of the size of the drawing to count as a closed circle. */
export const CLOSE_SHARE = 0.25;
/** A drawing smaller than this (in screen points) is a dot, not a circle. */
export const MIN_SIZE = 36;

export function bounds(pts: Pt[]): { minX: number; minY: number; maxX: number; maxY: number; size: number } {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, size: Math.max(maxX - minX, maxY - minY) };
}

/** Is the drawing a (more or less) closed loop? Forgiving: a wobbly or oval shape is fine, as long as the end meets the start. */
export function isClosed(pts: Pt[]): boolean {
  if (pts.length < MIN_POINTS) return false;
  const b = bounds(pts);
  if (b.size < MIN_SIZE) return false;
  const a = pts[0];
  const z = pts[pts.length - 1];
  if (Math.hypot(a.x - z.x, a.y - z.y) <= b.size * CLOSE_SHARE) return true;
  return crossesItself(pts);
}

function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt): number => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

/** A line that goes past where it began and crosses itself is a loop too (children overshoot). */
export function crossesItself(pts: Pt[]): boolean {
  const n = pts.length;
  for (let i = Math.floor(n * 0.55); i < n - 1; i++) {
    for (let j = 0; j < Math.floor(n * 0.45); j++) {
      if (segmentsCross(pts[i], pts[i + 1], pts[j], pts[j + 1])) return true;
    }
  }
  return false;
}

/** Even-odd rule: is the point inside the polygon (the loop closed by a straight line from its end to its start)? */
export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** The picture is wholly inside the loop (its middle and eight points of its edge). */
export function fullyInside(t: Target, poly: Pt[]): boolean {
  if (!pointInPolygon(t, poly)) return false;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    if (!pointInPolygon({ x: t.x + Math.cos(a) * t.r, y: t.y + Math.sin(a) * t.r }, poly)) return false;
  }
  return true;
}

export interface LassoResult {
  closed: boolean;
  /** pictures whose middle is inside the loop */
  inside: string[];
  /** the right picture is inside and no wrong picture is wholly inside */
  ok: boolean;
}

/**
 * The circle works when the middle of the right picture is inside it and no wrong picture is completely inside it. A picture that
 * the line only cuts through does not count against the child: a seven-year-old does not draw perfect circles.
 */
export function judgeLasso(pts: Pt[], targets: Target[], rightId: string): LassoResult {
  const closed = isClosed(pts);
  if (!closed) return { closed, inside: [], ok: false };
  const inside = targets.filter((t) => pointInPolygon(t, pts)).map((t) => t.id);
  const right = targets.find((t) => t.id === rightId);
  const wrongWhole = targets.some((t) => t.id !== rightId && fullyInside(t, pts));
  return { closed, inside, ok: !!right && inside.includes(rightId) && !wrongWhole };
}
