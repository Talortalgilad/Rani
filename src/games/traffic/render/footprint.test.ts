import { describe, expect, it } from 'vitest';
import { SIZES } from '../engine/state';
import { vehicleGeometry } from './toykit';

describe('vehicle meshes fit their footprint (so the layout test is the truth on screen)', () => {
  for (const type of ['car', 'van', 'bus'] as const) {
    it(`${type}: the whole mesh, wheels and mirrors included, stays inside the footprint`, () => {
      const g = vehicleGeometry(type, '#ff0000');
      g.computeBoundingBox();
      const b = g.boundingBox!;
      expect(b.max.x - b.min.x).toBeLessThanOrEqual(SIZES[type].len);
      expect(b.max.z - b.min.z).toBeLessThanOrEqual(SIZES[type].wid);
    });
  }
});
