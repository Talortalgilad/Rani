import { describe, expect, it } from 'vitest';
import ANCHORS from './anchors.json';
import { ACC_BOX, anchorOf, fitProblems, heightAtWidth, imageKey, place, type Anchor } from './dress';
import { ACCESSORIES, SHAPE_CANNOT_WEAR } from './friends';
import { RESIDENT_INFO } from './residents';

const keys = Object.keys(ANCHORS);
describe('where the accessories sit on every resident', () => {
  it('there are anchors for all the pictures of the 22 residents (the companion uses Cheesy)', () => {
    const imgs = ['cheesy', 'pizza', 'panda', 'cookie', ...RESIDENT_INFO.slice(4).map((r) => r.id)];
    expect(imgs.length).toBe(22);
    for (const k of imgs) expect(keys, k).toContain(k);
    expect(imageKey('/english/cheesy/happy.webp')).toBe('cheesy');
    expect(imageKey('/park/squishies/donut.webp?x=1')).toBe('donut');
  });
  it('every accessory has a box and no accessory hides the eyes or the mouth, goes below the feet or beyond the body, on any resident', () => {
    const bad: string[] = [];
    // the cupcake has its face at the very bottom of the picture (under the frosting, on the cup): there is no neck and no room under the mouth for a scarf or a cape (they stay tiny, and the sheet marks him)
    const KNOWN = new Set(['cupcake/scarf', 'cupcake/cape', ...Object.entries(SHAPE_CANNOT_WEAR).flatMap(([sh, l]) => l.map((a) => `shape:${sh}/${a}`))]);
    for (const k of keys) for (const a of ACCESSORIES) { expect(ACC_BOX[a.id], a.id).toBeTruthy(); if (KNOWN.has(`${k}/${a.id}`)) continue; for (const p of fitProblems(a.id, anchorOf(k))) bad.push(`${k}/${a.id}: ${p}`); }
    expect(bad).toEqual([]);
  });
  it('a hat sits on the head: its base is where the head is as wide as the hat, and above the eyes', () => {
    for (const k of keys) {
      const a = anchorOf(k) as Anchor;
      const y = heightAtWidth(a, 0.3);
      expect(y).toBeGreaterThanOrEqual(a.top - 0.001);
      expect(y).toBeLessThan(a.eyeY + 0.2);
      for (const id of ['crown', 'flowercrown', 'partyhat']) {
        const p = place(id, a), box = ACC_BOX[id];
        expect(p.v + (box.b - 0.5) * p.s, `${k}/${id}`).toBeLessThanOrEqual(a.eyeY - 0.05 + 1e-6);
      }
    }
  });
});
