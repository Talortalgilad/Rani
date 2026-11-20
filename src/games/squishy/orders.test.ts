import HE_MANIFEST from '../../../public/english/voice/he/manifest.json';
import EN_MANIFEST from '../../../public/english/voice/en/manifest.json';
import { describe, expect, it } from 'vitest';
import ORDERS from './squishy-orders.json';
import { PALETTE } from './paint';
import { SHAPES } from './shapes';

const manifest = (lang: string): Record<string, true> => Object.fromEntries(((lang === 'he' ? HE_MANIFEST : EN_MANIFEST) as { clips: string[] }).clips.map((c) => [c, true]));

/** The recorded lines of the workshop that are not orders (voice-takes-squishy.json): 34 in Hebrew and 7 in English; they are not connected yet in stage 0, but they must be there. */
const HE = ['sq_title', 'sq_order_mode', 'sq_free_mode', 'sq_shelf', 'sq_new_order', 'sq_listen_again', 'sq_pick_mold', 'sq_recipe', 'sq_spoons_total', 'sq_fill_line', 'sq_too_much', 'sq_not_enough', 'sq_exact', 'sq_mix', 'sq_pour', 'sq_wait', 'sq_pop', 'sq_paint', 'sq_decorate', 'sq_count_right', 'sq_face', 'sq_squeeze', 'sq_so_soft', 'sq_name', 'sq_done', 'sq_check_order', 'sq_order_match', 'sq_order_almost', 'sq_order_count', 'sq_to_carnival', 'sq_to_shelf', 'sq_new_mold', 'sq_what_likes', 'sq_gift_toy'];
const EN = ['sq_thank_you', 'sq_so_squishy', 'sq_squeeze_me', 'sq_so_cute', 'sq_one_more', 'sq_heart', 'sq_hearts'];

describe('the orders of the squishy workshop (squishy-orders.json)', () => {
  const colors = PALETTE.map((p) => p.id);
  it('40 orders in 3 tiers, with the ids o01..o40 and the clips sq_order_01..40', () => {
    expect(ORDERS.orders).toHaveLength(40);
    ORDERS.orders.forEach((o, i) => {
      expect(o.id).toBe(`o${String(i + 1).padStart(2, '0')}`);
      expect(o.clip).toBe(`sq_order_${String(i + 1).padStart(2, '0')}`);
    });
    expect(ORDERS.orders.filter((o) => o.tier === 1)).toHaveLength(14);
    expect(ORDERS.orders.filter((o) => o.tier === 2)).toHaveLength(14);
    expect(ORDERS.orders.filter((o) => o.tier === 3)).toHaveLength(12);
  });

  it('every order can be made: a shape of the 18, colours of the palette, and (tier 2) a decoration with a count; tier 3 has two different colours', () => {
    expect(ORDERS.colors).toEqual(colors);
    for (const o of ORDERS.orders) {
      expect(SHAPES, o.id).toContain(o.shape);
      expect(o.colors.length, o.id).toBe(o.tier === 3 ? 2 : 1);
      for (const c of o.colors) expect(colors, o.id).toContain(c);
      if (o.tier === 3) expect(o.colors[0]).not.toBe(o.colors[1]);
      const d = (o as { decor?: { kind: string; count: number } }).decor;
      if (o.tier === 2) {
        expect(ORDERS.decor, o.id).toContain(d!.kind);
        expect(d!.count, o.id).toBeGreaterThanOrEqual(2);
        expect(d!.count, o.id).toBeLessThanOrEqual(6);
      } else expect(d, o.id).toBeUndefined();
    }
  });

  it('every order has its clip in the English manifest, and the sentence matches the shape and the colours', () => {
    const en = manifest('en');
    for (const o of ORDERS.orders) {
      expect(en[o.clip], o.clip).toBeTruthy();
      expect(o.text, o.id).toContain(o.shape === 'icecream' ? 'ice cream' : o.shape);
      for (const c of o.colors) expect(o.text, o.id).toContain(c);
    }
  });

  it('the other lines of the workshop are recorded too (34 in Hebrew, 7 in English)', () => {
    const he = manifest('he');
    const en = manifest('en');
    expect(HE).toHaveLength(34);
    expect(EN).toHaveLength(7);
    for (const id of HE) expect(he[id], id).toBeTruthy();
    for (const id of EN) expect(en[id], id).toBeTruthy();
  });
});
