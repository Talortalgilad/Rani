import * as T from './lib';
import { Spring } from './motion';
import { JAR_CAPACITY, jarSlots, Materials, PALETTE, starGeometry } from './shapes';

export interface JarCallbacks {
  /** Number of stars now resting in the jar (so the lobby can remember how many were shown). */
  onShown(n: number): void;
  /** One star landed: a small sound per star. */
  onLand(n: number): void;
}

export interface Jar {
  group: T.Group;
  count(): number;
  update(dt: number): void;
  /** The stars inside hop. */
  hop(): void;
  dispose(): void;
}

const HEIGHT = 1.3;

/**
 * The glass star jar. Stars already earned sit inside; stars earned since the last visit fall in one by one.
 * It fills visually up to 100 stars and then simply stays full.
 */
export function buildJar(mats: Materials, total: number, shown: number, reduced: boolean, cb: JarCallbacks): Jar {
  const group = new T.Group();
  const glass = new T.Mesh(new T.CylinderGeometry(0.52, 0.47, HEIGHT, 24, 1, true), mats.get(PALETTE.glass, { rough: 0.1, opacity: 0.26 }));
  (glass.material as T.MeshStandardMaterial).depthWrite = false;
  glass.renderOrder = 2;
  glass.position.y = HEIGHT / 2 - 0.1;
  const bottom = new T.Mesh(new T.CylinderGeometry(0.47, 0.47, 0.06, 24), mats.get(PALETTE.glass, { rough: 0.1, opacity: 0.45 }));
  bottom.position.y = -0.13;
  bottom.renderOrder = 2;
  const rim = new T.Mesh(new T.TorusGeometry(0.52, 0.04, 8, 24), mats.get(PALETTE.glass, { rough: 0.2, opacity: 0.6 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = HEIGHT - 0.1;
  const lid = new T.Mesh(new T.CylinderGeometry(0.44, 0.48, 0.14, 20), mats.get(PALETTE.gold, { rough: 0.35, metal: 0.5 }));
  lid.position.y = HEIGHT + 0.02;
  const hit = new T.Mesh(new T.CylinderGeometry(0.75, 0.75, 1.9, 8), new T.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.5;
  group.add(glass, bottom, rim, lid, hit);

  const cap = Math.min(total, JAR_CAPACITY);
  const slots = jarSlots(JAR_CAPACITY);
  const stars = new T.InstancedMesh(starGeometry(0.11, 0.05, 0.05), mats.get(PALETTE.gold, { rough: 0.35, metal: 0.3, emissive: '#7a4f00' }), JAR_CAPACITY);
  stars.frustumCulled = false;
  group.add(stars);
  const dummy = new T.Object3D();
  const startShown = Math.min(shown, cap);

  const items = Array.from({ length: JAR_CAPACITY }, (_, i) => {
    const rest = slots[i].y + 0.12;
    const isNew = i >= startShown && i < cap;
    const fall = new Spring(rest, 70, 7);
    if (isNew && !reduced) fall.value = rest + 2.4;
    return {
      fall,
      hop: new Spring(0, 170, 8),
      delay: isNew ? 0.5 + (i - startShown) * 0.22 : 0,
      started: !isNew,
      landed: !isNew,
      spin: Math.random() * 6,
      shown: i < startShown || (isNew && reduced),
    };
  });
  let clock = 0;
  let landedCount = startShown;
  let hopping = 0; // seconds of hopping left
  const place = (i: number) => {
    const sl = slots[i];
    const it = items[i];
    dummy.position.set(sl.x, it.fall.value + it.hop.value, sl.z);
    dummy.rotation.set(0.5, it.spin + sl.x * 3, 0.2);
    dummy.scale.setScalar(it.shown ? 1 : 0.0001);
    dummy.updateMatrix();
    stars.setMatrixAt(i, dummy.matrix);
  };
  for (let i = 0; i < JAR_CAPACITY; i++) place(i);
  stars.instanceMatrix.needsUpdate = true;

  // reduced motion: new stars simply appear; nothing to wait for
  if (reduced) {
    landedCount = cap;
    cb.onShown(Math.max(total, cap));
  } else if (cap === startShown) cb.onShown(total);

  return {
    group,
    count: () => landedCount,
    update(dt) {
      clock += dt;
      let dirty = false;
      for (let i = startShown; i < cap && !reduced; i++) {
        const it = items[i];
        if (!it.started) {
          if (clock < it.delay) continue;
          it.started = true;
          it.shown = true;
        }
        if (it.landed) continue;
        it.fall.step(dt);
        place(i);
        dirty = true;
        if (it.fall.settled) {
          it.landed = true;
          landedCount++;
          cb.onLand(landedCount);
          cb.onShown(landedCount);
        }
      }
      if (hopping > 0) {
        hopping -= dt;
        for (let i = 0; i < JAR_CAPACITY; i++) {
          if (!items[i].shown) continue;
          items[i].hop.step(dt);
          place(i);
        }
        dirty = true;
        if (hopping <= 0) items.forEach((it) => it.hop.snap());
      }
      if (dirty) stars.instanceMatrix.needsUpdate = true;
    },
    hop() {
      if (reduced) return;
      items.forEach((it) => {
        it.hop.target = 0;
        it.hop.velocity = 2.2 + Math.random() * 2.2;
      });
      hopping = 1.2;
    },
    dispose() {
      stars.dispose();
    },
  };
}
