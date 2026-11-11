import { DECKS, artSvg } from '../games/memory/decks';
import * as T from './lib';
import { Materials, PALETTE } from './materials';
import { clamp, Spring, squashStretch } from './motion';
import { Particles } from './particles';
import { pickIndex } from './pick';
import { JAR_CAPACITY, jarSlots, makeCloud, makeLock, roundedBox, starGeometry } from './shapes';
import { skyFor } from './sky';
import { disposeTree, setSky, type SceneEnv, type StageScene } from './stage';
import { svgToTexture } from './textures';
import type { Tier } from './quality';

export type IslandKind = 'brick' | 'memory' | 'locked' | 'generic';

export interface HomeSceneOpts {
  kinds: IslandKind[];
  tints: string[];
  stars: number;
  shownStars: number;
  onPick(index: number): void;
  onJarShown(n: number): void;
}

export interface HomeScene extends StageScene {
  /** Same as tapping island i. */
  tapIsland(i: number): void;
  readonly info: { rotation: number; selected: number | null; jarStars: number };
}

const RX = 3.7; // carousel radius sideways
const RZ = 2.3; // ... and toward the camera (an ellipse keeps neighbours from hiding each other)
const FOV = 48;
const ZOOM_MS = 450;

interface Island {
  group: T.Group;
  kind: IslandKind;
  update(dt: number, t: number): void;
  tap(): void;
  setTier(tier: Tier): void;
  jump: { t: number };
  dispose(): void;
}

export function createHomeScene(env: SceneEnv, o: HomeSceneOpts): HomeScene {
  const mats = new Materials();
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(FOV, env.width / env.height, 0.1, 80);
  scene.add(camera);
  const reduced = env.reduced;
  let tier = env.tier;
  let width = env.width;
  let height = env.height;

  // ---- light and sky
  const sky = skyFor(new Date());
  setSky(sky.top, sky.bottom);
  // physically based units: these need to be bigger than they look
  const hemi = new T.HemisphereLight('#ffffff', '#b8a99a', 2.6);
  const sun = new T.DirectionalLight(sky.light, sky.intensity * 1.9);
  scene.fog = new T.Fog(sky.bottom, 13, 30);
  sun.position.set(3, 7, 5);
  sun.castShadow = tier === 'high';
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 20 });
  sun.shadow.bias = -0.0008;
  scene.add(hemi, sun);

  // ---- drifting clouds far behind the islands
  const sunClouds = [0, 1, 2].map((i) => {
    const c = makeCloud(mats, 0.9 + i * 0.25);
    c.position.set(-6 + i * 6, 2.6 + i * 0.7, -RZ * 3.2 - i * 2);
    scene.add(c);
    return c;
  });

  // ---- islands
  const ring = new T.Group();
  ring.position.z = -RZ;
  scene.add(ring);
  const islands: Island[] = o.kinds.map((kind, i) => buildIsland(kind, i, o.tints[i] ?? PALETTE.purple, mats, tier, reduced));
  islands.forEach((isl, i) => {
    isl.group.userData.index = i;
    ring.add(isl.group);
  });
  const step = (Math.PI * 2) / islands.length;

  // ---- star jar, pinned to the camera so it always sits in the same corner of the screen
  const jar = buildJar(mats, o.stars, o.shownStars, reduced, o.onJarShown);
  camera.add(jar.group);

  // ---- state
  const rot = new Spring(0, 90, 12);
  const zoom = new Spring(reduced ? 0 : 0.7, 130, 16); // starts pulled in and eases back out (coming home)
  zoom.target = 0;
  let selected: number | null = null;
  let pickTimer = 0;
  let camDist = 9;

  function layout(): void {
    const aspect = width / height;
    camera.aspect = aspect;
    const half = Math.tan((FOV / 2) * (Math.PI / 180));
    camDist = Math.max(2.5 / (half * Math.min(aspect, 1.3)), 7.2);
    camera.updateProjectionMatrix();
    const d = 6;
    const halfH = half * d;
    const halfW = halfH * aspect;
    jar.group.position.set(halfW * 0.66, -halfH * 0.66, -d);
    jar.group.scale.setScalar(clamp(Math.min(halfW, halfH) * 0.26, 0.45, 1.2));
  }
  layout();

  // ---- touch: drag to turn the carousel, tap an island to open it
  const canvas = env.canvas;
  let down: { x: number; y: number; t: number; startRot: number; id: number } | null = null;
  let lastX = 0;
  let lastT = 0;
  let vel = 0;
  const onDown = (e: PointerEvent) => {
    if (selected !== null) return;
    canvas.setPointerCapture(e.pointerId);
    down = { x: e.clientX, y: e.clientY, t: performance.now(), startRot: rot.value, id: e.pointerId };
    lastX = e.clientX;
    lastT = performance.now();
    vel = 0;
  };
  const onMove = (e: PointerEvent) => {
    if (!down || selected !== null) return;
    const dx = e.clientX - down.x;
    rot.value = down.startRot + (dx / width) * Math.PI * 1.1;
    rot.velocity = 0;
    rot.target = rot.value;
    const now = performance.now();
    vel = ((e.clientX - lastX) / width) * Math.PI * 1.1 / Math.max(0.001, (now - lastT) / 1000);
    lastX = e.clientX;
    lastT = now;
  };
  const onUp = (e: PointerEvent) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 400;
    down = null;
    if (moved < 10 && quick) {
      const idx = pickIndex(camera, canvas, e.clientX, e.clientY, islands.map((i) => i.group));
      if (idx !== null) {
        tapIsland(idx);
        return;
      }
    }
    snap(vel);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  /** Spring to the nearest island, carrying the throw. */
  function snap(velocity: number): void {
    const k = Math.round(-(rot.value + clamp(velocity, -6, 6) * 0.18) / step);
    rot.target = -k * step;
    if (reduced) rot.snap();
  }

  function tapIsland(i: number): void {
    if (selected !== null || i < 0 || i >= islands.length) return;
    const isl = islands[i];
    isl.tap();
    if (isl.kind === 'locked') return;
    selected = i;
    isl.jump.t = reduced ? 1 : 0;
    // bring it to the front while the camera moves in
    const k = Math.round((-rot.value - i * step) / (Math.PI * 2));
    rot.target = -(i * step) - k * Math.PI * 2;
    zoom.target = 1;
    if (reduced) {
      rot.snap();
      zoom.snap();
      o.onPick(i);
    } else pickTimer = window.setTimeout(() => o.onPick(i), ZOOM_MS);
  }

  const lookAt = new T.Vector3(0, 0.35, 0);
  function update(dt: number, time: number): void {
    rot.step(dt);
    zoom.step(dt);
    if (down === null && !reduced && Math.abs(rot.target - rot.value) < 1e-4 && selected === null) rot.snap();

    islands.forEach((isl, i) => {
      const a = i * step + rot.value;
      const front = Math.cos(a);
      isl.group.position.set(Math.sin(a) * RX, reduced ? 0 : Math.sin(time * 1.3 + i * 1.7) * 0.07, Math.cos(a) * RZ);
      const s = 0.86 + 0.14 * (front * 0.5 + 0.5);
      const j = isl.jump;
      if (selected === i || j.t < 1) {
        if (!reduced && j.t < 1) j.t = Math.min(1, j.t + dt / 0.5);
        const q = squashStretch(j.t);
        isl.group.scale.set(s * q.sx, s * q.sy, s * q.sz);
        isl.group.position.y += q.lift * 0.5;
      } else isl.group.scale.setScalar(s);
      isl.update(dt, reduced ? 0 : time);
    });

    sunClouds.forEach((c, i) => {
      if (!reduced) c.position.x = ((((time * (0.15 + i * 0.05) + i * 6 + 9) % 18) + 18) % 18) - 9;
    });

    // camera: slightly above, looking at the front island; zoom moves it toward the island
    const zz = zoom.value;
    camera.position.set(0, camDist * 0.3 - zz * 0.8, camDist - zz * (camDist - 4.2));
    camera.lookAt(lookAt);
    jar.update(dt);
  }

  const api: HomeScene = {
    scene,
    camera,
    update,
    resize(w, h) {
      width = w;
      height = h;
      layout();
    },
    setTier(t) {
      tier = t;
      sun.castShadow = t === 'high';
      islands.forEach((i) => i.setTier(t));
    },
    tapIsland,
    get info() {
      return { rotation: rot.value, selected, jarStars: jar.count() };
    },
    dispose() {
      window.clearTimeout(pickTimer);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      islands.forEach((i) => i.dispose());
      jar.dispose();
      sun.dispose(); // frees the shadow map
      hemi.dispose();
      disposeTree(scene);
      mats.dispose();
    },
  };
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__home = api;
  return api;
}

// ---------------------------------------------------------------------------------------------------------

function baseIsland(mats: Materials, tint: string, shadows: boolean): T.Group {
  const g = new T.Group();
  const rock = new T.Mesh(new T.ConeGeometry(1.5, 1.9, 7), mats.get(PALETTE.rock, { rough: 0.9, flat: true }));
  rock.rotation.x = Math.PI;
  rock.position.y = -1.12;
  const grass = new T.Mesh(new T.CylinderGeometry(1.65, 1.5, 0.34, 28), mats.get(tint, { rough: 0.8 }));
  grass.position.y = -0.17;
  grass.receiveShadow = shadows;
  const hit = new T.Mesh(new T.CylinderGeometry(1.9, 1.9, 3.4, 10), new T.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.4;
  g.add(rock, grass, hit);
  return g;
}

function dotShadow(mats: Materials): T.Mesh {
  const m = new T.Mesh(new T.CircleGeometry(0.16, 14), new T.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.22 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.012;
  void mats;
  return m;
}

function sparkGeo(): T.SphereGeometry {
  return new T.SphereGeometry(1, 6, 5);
}

function buildIsland(kind: IslandKind, index: number, tint: string, mats: Materials, tier: Tier, reduced: boolean): Island {
  const shadows = tier === 'high';
  const group = baseIsland(mats, kind === 'locked' ? '#b9c7b5' : kind === 'generic' ? tint : PALETTE.grass, shadows);
  const jump = { t: 1 };
  const sparksMax = tier === 'high' ? 40 : 20;
  const sparks = new Particles(sparksMax, sparkGeo(), new T.MeshBasicMaterial({ color: '#ffffff' }));
  group.add(sparks.mesh);
  const disposers: (() => void)[] = [() => sparks.dispose()];
  let extra: (dt: number, t: number) => void = () => {};
  let tapFn: () => void = () => {};

  if (kind === 'brick') {
    const COLS = 6;
    const ROWS = 3;
    const rowColors = [PALETTE.red, PALETTE.yellow, PALETTE.green];
    const bricks = new T.InstancedMesh(roundedBox(0.46, 0.22, 0.24, 0.07), mats.get('#ffffff', { rough: 0.35 }), COLS * ROWS);
    bricks.castShadow = shadows;
    const pos: T.Vector3[] = [];
    const color = new T.Color();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        pos.push(new T.Vector3((c - (COLS - 1) / 2) * 0.5, 0.14 + r * 0.25, -0.5));
        bricks.setColorAt(i, color.set(rowColors[r]));
      }
    }
    group.add(bricks);
    const alive = pos.map(() => 1); // 1 = shown, falling to 0 = popped
    const respawnAt = pos.map(() => 0);
    const ball = new T.Mesh(new T.SphereGeometry(0.13, 16, 12), mats.get('#ffffff', { rough: 0.25 }));
    ball.castShadow = shadows;
    const shade = dotShadow(mats);
    const paddle = new T.Mesh(roundedBox(0.75, 0.14, 0.2, 0.06), mats.get(PALETTE.paddle, { rough: 0.4 }));
    paddle.castShadow = shadows;
    paddle.position.set(0, 0.07, 0.95);
    group.add(ball, shade, paddle);
    const dummy = new T.Object3D();
    const paddleX = new Spring(0, 60, 10);
    let from = new T.Vector3(0, 0.3, 0.95);
    let target = 4;
    let phase = 0; // 0..1 out, 1..2 back
    let popped = false;
    const place = (i: number, s: number) => {
      dummy.position.copy(pos[i]);
      dummy.scale.setScalar(Math.max(0.0001, s));
      dummy.updateMatrix();
      bricks.setMatrixAt(i, dummy.matrix);
    };
    pos.forEach((_, i) => place(i, 1));
    extra = (dt, t) => {
      if (reduced) {
        ball.position.set(0, 0.2, 0.95);
        shade.position.x = 0;
        shade.position.z = 0.95;
        return;
      }
      phase += dt / 0.7;
      if (phase >= 2) {
        phase = 0;
        popped = false;
        target = Math.floor(Math.random() * pos.length);
        let tries = 0;
        while (alive[target] < 0.5 && tries++ < 12) target = Math.floor(Math.random() * pos.length);
        from = new T.Vector3(paddleX.value, 0.3, 0.95);
      }
      const goal = pos[target];
      const out = phase < 1;
      const u = out ? phase : phase - 1;
      const a = out ? from : goal;
      const b = out ? goal : new T.Vector3(goal.x * 0.5, 0.3, 0.95);
      ball.position.lerpVectors(a, b, u);
      ball.position.y += Math.sin(u * Math.PI) * 0.35 * (out ? 1 : 0.6);
      if (!out) paddleX.target = goal.x * 0.5;
      paddleX.step(dt);
      paddle.position.x = paddleX.value;
      shade.position.set(ball.position.x, 0.012, ball.position.z);
      shade.scale.setScalar(clamp(1.2 - ball.position.y * 0.5, 0.4, 1.2));
      if (out && u > 0.97 && !popped) {
        popped = true;
        alive[target] = 0.999;
        respawnAt[target] = t + 1.8;
        sparks.emit(pos[target], 8, { colors: [rowColors[Math.floor(target / COLS)], '#ffffff'], speed: 1.2, size: 0.05, life: 0.7 });
      }
      for (let i = 0; i < pos.length; i++) {
        if (alive[i] < 1 && respawnAt[i] > 0) {
          if (t >= respawnAt[i]) {
            alive[i] = 1;
            respawnAt[i] = 0;
            place(i, 1);
          } else place(i, alive[i] === 0.999 ? 0.0001 : 1);
        }
      }
      bricks.instanceMatrix.needsUpdate = true;
      if (bricks.instanceColor) bricks.instanceColor.needsUpdate = true;
    };
    disposers.push(() => bricks.dispose());
    tapFn = () => sparks.emit(new T.Vector3(0, 1.2, 0), 10, { colors: ['#ffffff', PALETTE.yellow], speed: 1.4, size: 0.05 });
  }

  if (kind === 'memory') {
    const deck = DECKS.farm;
    const arts = ['farm:cow', 'farm:pig', 'farm:sheep', 'farm:pig'];
    const cards = arts.map((_, i) => {
      const g = new T.Group();
      const body = new T.Mesh(roundedBox(0.5, 0.68, 0.05, 0.06), mats.get('#fffaf2', { rough: 0.5 }));
      body.castShadow = shadows;
      const faceMat = (c: string) => new T.MeshBasicMaterial({ color: c });
      const back = new T.Mesh(new T.PlaneGeometry(0.44, 0.62), faceMat('#8bd45b'));
      back.position.z = 0.03;
      const front = new T.Mesh(new T.PlaneGeometry(0.44, 0.62), faceMat('#ffffff'));
      front.position.z = -0.03;
      front.rotation.y = Math.PI;
      g.add(body, back, front);
      g.position.set((i - 1.5) * 0.6, 0.38, 0.1);
      group.add(g);
      return { g, back, front, rot: new Spring(0, 110, 11), hop: new Spring(0, 140, 12) };
    });
    // real pictures from the existing SVG art (a coloured fallback shows until they are drawn)
    void svgToTexture(deck.back, 128, 160).then((tex) => {
      cards.forEach((c) => {
        (c.back.material as T.MeshBasicMaterial).map = tex;
        (c.back.material as T.MeshBasicMaterial).color.set('#ffffff');
        (c.back.material as T.MeshBasicMaterial).needsUpdate = true;
      });
      disposers.push(() => tex.dispose());
    });
    arts.forEach((a, i) => {
      void svgToTexture(artSvg(a), 128, 160, '#ffffff').then((tex) => {
        const m = cards[i].front.material as T.MeshBasicMaterial;
        m.map = tex;
        m.color.set('#ffffff');
        m.needsUpdate = true;
        disposers.push(() => tex.dispose());
      });
    });
    const L = 7;
    let lastTl = 0;
    extra = (dt, t) => {
      const tl = t % L;
      const up = (i: number) => {
        const flips: [number, number, number][] = [[0, 0.6, 2.6], [2, 1.4, 2.6], [1, 3.4, 6.2], [3, 4.0, 6.2]];
        const f = flips.find(([c]) => c === i)!;
        return tl >= f[1] && tl < f[2];
      };
      cards.forEach((c, i) => {
        c.rot.target = up(i) ? Math.PI : 0;
        const matched = (i === 1 || i === 3) && tl >= 4.8 && tl < 5.7;
        c.hop.target = matched ? 0.22 : 0;
        c.rot.step(dt);
        c.hop.step(dt);
        c.g.rotation.y = c.rot.value;
        c.g.position.y = 0.38 + Math.max(0, c.hop.value);
      });
      if (lastTl < 4.8 && tl >= 4.8 && !reduced) {
        sparks.emit(new T.Vector3(-0.3, 0.9, 0.2), 10, { colors: ['#ffd23f', '#ffffff'], speed: 1.3, size: 0.045, life: 0.9 });
        sparks.emit(new T.Vector3(0.9, 0.9, 0.2), 10, { colors: ['#ffd23f', '#ffffff'], speed: 1.3, size: 0.045, life: 0.9 });
      }
      lastTl = tl;
    };
    tapFn = () => sparks.emit(new T.Vector3(0, 1.1, 0.2), 10, { colors: ['#ffd23f', '#ffffff'], speed: 1.4, size: 0.05 });
  }

  if (kind === 'locked') {
    const clouds = [0, 1, 2, 3].map((i) => {
      const c = makeCloud(mats, 0.85);
      const a = (i / 4) * Math.PI * 2;
      c.position.set(Math.cos(a) * 0.7, 0.55 + (i % 2) * 0.12, Math.sin(a) * 0.7);
      group.add(c);
      return c;
    });
    const { group: lock } = makeLock(mats);
    lock.position.set(0, 1.2, 0.2);
    lock.scale.setScalar(1.15);
    group.add(lock);
    const puff = new Spring(1, 110, 8);
    const rattle = new Spring(0, 200, 6);
    extra = (dt, t) => {
      puff.step(dt);
      rattle.step(dt);
      clouds.forEach((c, i) => c.scale.setScalar(0.85 * puff.value * (1 + (reduced ? 0 : Math.sin(t * 1.4 + i) * 0.03))));
      lock.rotation.z = (reduced ? 0 : Math.sin(t * 2.4 + index) * 0.1) + rattle.value;
      lock.position.y = 1.2 + (reduced ? 0 : Math.sin(t * 1.6) * 0.04);
    };
    tapFn = () => {
      if (reduced) return;
      puff.value = 1.28;
      puff.velocity = 0;
      rattle.value = 0.5;
      rattle.velocity = 0;
      sparks.emit(new T.Vector3(0, 1, 0), 14, { colors: ['#ffffff'], speed: 1.2, size: 0.09, life: 0.8, gravity: 0.5 });
    };
  }

  if (kind === 'generic') {
    const cube = new T.Mesh(roundedBox(0.8, 0.8, 0.8, 0.14), mats.get(tint, { rough: 0.4 }));
    cube.position.y = 0.6;
    group.add(cube);
    extra = (_, t) => (cube.rotation.y = t * 0.6);
  }

  return {
    group,
    kind,
    jump,
    update: (dt, t) => {
      extra(dt, t);
      sparks.update(dt);
    },
    tap: tapFn,
    setTier: () => {},
    dispose: () => disposers.forEach((d) => d()),
  };
}

// ---------------------------------------------------------------------------------------------------------

/** The glass star jar: stars already earned sit inside; new ones drop in one by one. */
function buildJar(mats: Materials, total: number, shown: number, reduced: boolean, onShown: (n: number) => void) {
  const group = new T.Group();
  const H = 1.1;
  const glass = new T.Mesh(
    new T.CylinderGeometry(0.5, 0.45, H, 22, 1, true),
    mats.get(PALETTE.glass, { rough: 0.1, opacity: 0.28 }),
  );
  glass.renderOrder = 2;
  (glass.material as T.MeshStandardMaterial).depthWrite = false;
  glass.position.y = H / 2 - 0.1;
  const bottom = new T.Mesh(new T.CylinderGeometry(0.45, 0.45, 0.06, 22), mats.get(PALETTE.glass, { rough: 0.1, opacity: 0.45 }));
  bottom.position.y = -0.13;
  bottom.renderOrder = 2;
  const rim = new T.Mesh(new T.TorusGeometry(0.5, 0.04, 8, 24), mats.get(PALETTE.glass, { rough: 0.2, opacity: 0.6 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = H - 0.1;
  const lid = new T.Mesh(new T.CylinderGeometry(0.42, 0.46, 0.14, 20), mats.get(PALETTE.gold, { rough: 0.35, metal: 0.5 }));
  lid.position.y = H + 0.02;
  group.add(glass, bottom, rim, lid);

  const cap = Math.min(total, JAR_CAPACITY);
  const slots = jarSlots(JAR_CAPACITY);
  const stars = new T.InstancedMesh(starGeometry(0.11, 0.05, 0.05), mats.get(PALETTE.gold, { rough: 0.35, metal: 0.3, emissive: '#7a4f00' }), JAR_CAPACITY);
  stars.frustumCulled = false;
  group.add(stars);
  const dummy = new T.Object3D();
  const startShown = Math.min(shown, cap);
  const fall = Array.from({ length: JAR_CAPACITY }, (_, i) => {
    const s = new Spring(slots[i].y + 0.12, 70, 7);
    const isNew = i >= startShown && i < cap;
    if (isNew) {
      s.value = (reduced ? 0 : 2.3) + slots[i].y;
      s.target = slots[i].y + 0.12;
      if (reduced) s.snap();
    }
    return { y: s, delay: isNew ? 0.6 + (i - startShown) * 0.22 : 0, started: !isNew, landed: !isNew, spin: Math.random() * 6 };
  });
  let t0 = 0;
  let landedCount = startShown;
  if (total > shown && startShown === cap) onShown(total); // jar already full: nothing to animate
  else if (total <= shown) onShown(total);

  const place = (i: number, visible: boolean) => {
    const sl = slots[i];
    dummy.position.set(sl.x, fall[i].y.value, sl.z);
    dummy.rotation.set(0.5, fall[i].spin + sl.x * 3, 0.2);
    dummy.scale.setScalar(visible ? 1 : 0.0001);
    dummy.updateMatrix();
    stars.setMatrixAt(i, dummy.matrix);
  };
  for (let i = 0; i < JAR_CAPACITY; i++) place(i, i < cap && i < startShown);

  return {
    group,
    count: () => landedCount,
    update(dt: number) {
      t0 += dt;
      let dirty = false;
      for (let i = startShown; i < cap; i++) {
        const f = fall[i];
        if (!f.started) {
          if (t0 < f.delay) continue;
          f.started = true;
        }
        f.y.step(dt);
        place(i, true);
        dirty = true;
        if (!f.landed && f.y.settled) {
          f.landed = true;
          landedCount++;
          onShown(landedCount);
        }
      }
      if (dirty) stars.instanceMatrix.needsUpdate = true;
      if (!dirty) stars.instanceMatrix.needsUpdate = false;
    },
    dispose() {
      stars.dispose();
    },
  };
}

