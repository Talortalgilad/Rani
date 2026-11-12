/**
 * The picture of the body (a boy with his arms out, for "touch your head", "clap your hands"...) and the places that can be tapped,
 * as percentages of the picture: [left, top, right, bottom]. A part can have two places (two hands, two feet).
 */
export const BODY_FILE = 'english/body.webp';
export type BodyPart = 'head' | 'hands' | 'feet' | 'eyes' | 'mouth' | 'legs' | 'arms';
export type Box = [number, number, number, number];

export const BODY_REGIONS: Record<BodyPart, Box[]> = {
  eyes: [[35.5, 27.0, 64.3, 35.3]],
  mouth: [[43.3, 34.9, 57.5, 41.7]],
  head: [[24.6, 1.8, 77.0, 45.0]],
  hands: [[3.6, 47.1, 16.8, 53.3], [85.3, 46.4, 97.0, 52.9]],
  arms: [[16.8, 45.3, 30.3, 54.3], [71.0, 45.0, 85.3, 53.6]],
  feet: [[33.3, 86.4, 48.0, 97.2], [52.4, 86.4, 67.1, 97.2]],
  legs: [[35.0, 78.8, 47.2, 87.1], [53.2, 78.8, 66.2, 87.1]],
};

/** The small parts come first, so that the eyes win over the head they are in. */
const ORDER: BodyPart[] = ['eyes', 'mouth', 'hands', 'feet', 'arms', 'legs', 'head'];

/** Which part is at this place of the picture (percentages), or null. */
export function partAt(xPct: number, yPct: number): BodyPart | null {
  for (const part of ORDER) {
    if (BODY_REGIONS[part].some(([l, t, r, b]) => xPct >= l && xPct <= r && yPct >= t && yPct <= b)) return part;
  }
  return null;
}
