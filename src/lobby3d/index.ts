import type { LobbyIslandHandle } from '../games/types';
import { Carousel } from './carousel';
import { buildJar } from './jar';
import { buildGameIsland, buildLockedIsland, type Island, type IslandSpec } from './islands';
import { clamp, Spring, squashStretch } from './motion';
import { pickIndex } from './pick';
import type { Tier } from './quality';
import { Birds, isNight, skyFor } from './sky';
import { Materials, makeCloud } from './shapes';
import * as T from './lib';
import { disposeTree, setSky, showScene, type SceneEnv, type SceneHandle, type StageScene } from './stage';

export interface LobbyOpts {
  islands: IslandSpec[];
  /** Island to start on (the game the child played last). */
  startIndex: number;
  autoDowngrade: boolean;
  /** The island in the middle changed (for the name, the best score and the dots). */
  onFront(index: number): void;
  /** The centre island was tapped and the zoom finished: time to open the gate. */
  onEnter(index: number): void;
  onFallback(): void;
  /** Stars earned in total, and how many the jar has shown so far (the difference falls in). */
  stars: number;
  shownStars: number;
  onJarShown(n: number): void;
  /** A star landed in the jar (one small sound each). */
  onStarLand(n: number): void;
  onJarTap(): void;
  /** An island passed the middle (called at most every 60 ms), with a running count for rising pitch. */
  onTick?(n: number): void;
  /** The ring came to rest after moving. */
  onSettle?(): void;
}

export interface LobbyHandle {
  fadeIn(ms: number): void;
  dispose(): void;
  readonly info: { front: number; rotation: number; entering: number | null; jarStars: number; birds: number };
  tapIsland(i: number): void;
}

const RX = 3.7; // ring radius sideways
const RZ = 2.3; // ... and toward the camera: an ellipse keeps neighbours from hiding each other
const FOV = 48;
const ZOOM_MS = 500;

/** Builds the lobby on the shared stage. Resolves when the scene is ready (the canvas is still transparent). */
export async function startLobby(o: LobbyOpts): Promise<LobbyHandle> {
  let handle: SceneHandle;
  let api!: LobbyHandle;
  handle = await showScene(
    async (env) => {
      // each game's own miniature, if it has one; a failure only costs that game its fancy island
      const minis = await Promise.all(
        o.islands.map((spec) =>
          spec.lobbyIsland
            ? Promise.resolve()
                .then(() => spec.lobbyIsland!({ shadows: env.tier === 'high', reduced: env.reduced }))
                .catch(() => null)
            : null,
        ),
      );
      const built = createLobbyScene(env, o, minis);
      api = built.api;
      return built.scene;
    },
    { autoDowngrade: o.autoDowngrade, onFallback: o.onFallback },
  );
  return {
    fadeIn: (ms) => handle.fadeIn(ms),
    dispose: () => handle.dispose(),
    get info() {
      return api.info;
    },
    tapIsland: (i) => api.tapIsland(i),
  };
}

function createLobbyScene(env: SceneEnv, o: LobbyOpts, minis: (LobbyIslandHandle | null)[]): { scene: StageScene; api: LobbyHandle } {
  const mats = new Materials();
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(FOV, env.width / env.height, 0.1, 80);
  scene.add(camera);
  const reduced = env.reduced;
  let tier: Tier = env.tier;
  let width = env.width;
  let height = env.height;

  // ---- light and sky
  const now = new Date();
  const sky = skyFor(now);
  setSky(sky.top, sky.bottom);
  const hemi = new T.HemisphereLight('#ffffff', '#b8a99a', 2.6); // physically based units: bigger than they look
  const sun = new T.DirectionalLight(sky.light, sky.intensity * 1.9);
  sun.position.set(3, 7, 5);
  sun.castShadow = tier === 'high';
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 20 });
  sun.shadow.bias = -0.0008;
  scene.add(hemi, sun);
  scene.fog = new T.Fog(sky.bottom, 13, 30);

  // stars at night, drifting clouds by day
  const starMesh = isNight(now) ? makeStars(scene) : null;
  const drift = [0, 1, 2].map((i) => {
    const c = makeCloud(mats, 0.9 + i * 0.25);
    c.position.set(-6 + i * 6, 2.6 + i * 0.7, -RZ * 3.2 - i * 2);
    c.visible = !isNight(now) && (tier === 'high' || i === 0);
    scene.add(c);
    return c;
  });

  // ---- the ring of islands
  const ring = new T.Group();
  ring.position.z = -RZ;
  scene.add(ring);
  let locked = 0;
  const islands: Island[] = o.islands.map((spec, i) => {
    const isl = spec.kind === 'locked' ? buildLockedIsland(mats, locked++) : buildGameIsland(spec, mats, tier === 'high', minis[i]);
    isl.group.userData.index = i;
    ring.add(isl.group);
    return isl;
  });
  // ---- birds now and then, and the star jar pinned to the corner of the screen
  const birds = new Birds(tier === 'high' && !reduced);
  scene.add(birds.group);
  const jar = buildJar(mats, o.stars, o.shownStars, reduced, { onShown: o.onJarShown, onLand: o.onStarLand });
  jar.group.userData.index = -1;
  camera.add(jar.group);

  const carousel = new Carousel(islands.length, reduced, clamp(o.startIndex, 0, islands.length - 1));
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__lobbyGoTo = (i: number) => carousel.goTo(i);
  let lastFront = -1;
  let wasMoving = false;
  let lastTick = 0;
  let tickN = 0;

  const zoom = new Spring(reduced ? 0 : 0.6, 130, 16); // starts a little close and eases back (coming home)
  zoom.target = 0;
  let entering: number | null = null;
  let enterTimer = 0;
  let camDist = 9;
  const lookAt = new T.Vector3(0, 0.35, 0);

  function layout(): void {
    const aspect = width / height;
    camera.aspect = aspect;
    const half = Math.tan((FOV / 2) * (Math.PI / 180));
    camDist = Math.max(2.5 / (half * Math.min(aspect, 1.3)), 7.2);
    camera.updateProjectionMatrix();
    const d = 6;
    const halfH = half * d;
    const halfW = halfH * aspect;
    jar.group.position.set(halfW * 0.62, -halfH * 0.68, -d);
    jar.group.scale.setScalar(clamp(Math.min(halfW, halfH) * 0.25, 0.45, 1.2));
  }
  layout();

  // ---- touch: drag to turn, flick to skip, tap to open or to bring a side island to the middle
  const canvas = env.canvas;
  let down: { x: number; y: number; t: number } | null = null;
  let lastX = 0;
  let lastT = 0;
  let vel = 0;
  const TURN_PER_SCREEN = Math.PI; // dragging across the whole screen turns the ring about two islands
  const onDown = (e: PointerEvent) => {
    if (entering !== null) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic or already-ended pointer: dragging still works without capture */
    }
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
    lastX = e.clientX;
    lastT = performance.now();
    vel = 0;
    carousel.dragStart();
  };
  const onMove = (e: PointerEvent) => {
    if (!down || entering !== null) return;
    const now2 = performance.now();
    const v = (((e.clientX - lastX) / width) * TURN_PER_SCREEN) / Math.max(0.001, (now2 - lastT) / 1000);
    vel = vel * 0.6 + v * 0.4;
    lastX = e.clientX;
    lastT = now2;
    carousel.dragBy(((e.clientX - down.x) / width) * TURN_PER_SCREEN, vel);
  };
  const onUp = (e: PointerEvent) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 400;
    down = null;
    if (moved < 10 && quick) {
      carousel.release(0);
      const i = pickIndex(camera, canvas, e.clientX, e.clientY, [...islands.map((x) => x.group), jar.group]);
      if (i === -1) {
        jar.hop();
        o.onJarTap();
        return;
      }
      if (i !== null) {
        tapIsland(i);
        return;
      }
    }
    carousel.release(vel);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  function tapIsland(i: number): void {
    if (entering !== null || i < 0 || i >= islands.length) return;
    const isl = islands[i];
    if (carousel.tap(i) === 'rotate') return; // a side island: turn it to the middle
    isl.tap(reduced);
    if (isl.kind === 'locked') return;
    entering = i;
    isl.jump.t = reduced ? 1 : 0;
    zoom.target = 1;
    if (reduced) {
      zoom.snap();
      o.onEnter(i);
    } else enterTimer = window.setTimeout(() => o.onEnter(i), ZOOM_MS);
  }

  function update(dt: number, time: number): void {
    carousel.update(dt);
    zoom.step(dt);
    const front = carousel.nearest;
    if (front !== lastFront) {
      if (lastFront >= 0 && performance.now() - lastTick > 60) {
        lastTick = performance.now();
        o.onTick?.(tickN++);
      }
      lastFront = front;
      o.onFront(front);
    }
    if (!carousel.settled) wasMoving = true;
    else if (wasMoving) {
      wasMoving = false;
      tickN = 0;
      if (!reduced && entering === null) o.onSettle?.();
    }
    const t = reduced ? 0 : time;
    islands.forEach((isl, i) => {
      const a = carousel.angleOf(i);
      isl.group.position.set(Math.sin(a) * RX, reduced ? 0 : Math.sin(time * 1.3 + i * 1.7) * 0.07, Math.cos(a) * RZ);
      isl.group.rotation.z = carousel.lean * 0.6; // lean toward the way the ring is moving
      const s = 0.86 + 0.14 * (Math.cos(a) * 0.5 + 0.5);
      if (entering === i || isl.jump.t < 1) {
        if (!reduced && isl.jump.t < 1) isl.jump.t = Math.min(1, isl.jump.t + dt / 0.5);
        const q = squashStretch(isl.jump.t);
        isl.group.scale.set(s * q.sx, s * q.sy, s * q.sz);
        isl.group.position.y += q.lift * 0.5;
      } else isl.group.scale.setScalar(s);
      isl.update(dt, t, reduced);
    });
    drift.forEach((c, i) => {
      if (!reduced) c.position.x = ((((time * (0.15 + i * 0.05) + i * 6 + 9) % 18) + 18) % 18) - 9;
    });
    jar.update(dt);
    birds.update(dt, time);
    if (starMesh && !reduced) starMesh.rotation.z = Math.sin(time * 0.05) * 0.02;
    const zz = zoom.value;
    camera.position.set(0, camDist * 0.3 - zz * 0.8, camDist - zz * (camDist - 4.2));
    camera.lookAt(lookAt);
  }

  const stage: StageScene = {
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
      drift.forEach((c, i) => (c.visible = !isNight(now) && (t === 'high' || i === 0)));
      birds.setTier(t);
    },
    dispose() {
      window.clearTimeout(enterTimer);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      islands.forEach((i) => i.dispose());
      jar.dispose();
      birds.dispose();
      sun.dispose(); // frees the shadow map
      hemi.dispose();
      disposeTree(scene);
      mats.dispose();
    },
  };
  const api: LobbyHandle = {
    fadeIn: () => {},
    dispose: () => {},
    get info() {
      return { front: carousel.nearest, rotation: carousel.rot.value, entering, jarStars: jar.count(), birds: birds.flying };
    },
    tapIsland,
  };
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__lobby = api;
  return { scene: stage, api };
}

/** A few dozen small stars on a far, wide dome. */
function makeStars(scene: T.Scene): T.InstancedMesh {
  const n = 70;
  const mesh = new T.InstancedMesh(new T.SphereGeometry(0.07, 6, 5), new T.MeshBasicMaterial({ color: '#ffffff', fog: false }), n);
  const d = new T.Object3D();
  for (let i = 0; i < n; i++) {
    d.position.set((Math.random() - 0.5) * 36, 1 + Math.random() * 12, -18 - Math.random() * 10);
    d.scale.setScalar(0.5 + Math.random());
    d.updateMatrix();
    mesh.setMatrixAt(i, d.matrix);
  }
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}
