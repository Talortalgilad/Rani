/**
 * The carnival scene (SPEC-carnival.md 2): the island, the paths, the plaza with the star jar, the plots of the games with their miniatures,
 * the residents who walk, the sky of the hour (with lights at night). Built on the shared stage of the lobby (one renderer).
 */
import * as T from '../../lobby3d/lib';
import { buildJar } from '../../lobby3d/jar';
import { iconTexture } from '../../lobby3d/islands';
import { clamp } from '../../lobby3d/motion';
import { pickIndex } from '../../lobby3d/pick';
import type { Tier } from '../../lobby3d/quality';
import { Materials, PALETTE, makeLock } from '../../lobby3d/shapes';
import { isNight, skyFor } from '../../lobby3d/sky';
import { disposeTree, setSky, showScene, type SceneEnv, type SceneHandle, type StageScene } from '../../lobby3d/stage';
import type { LobbyIslandHandle } from '../../games/types';
import { bake, staticMeshes } from './bake';
import { clampDist, clampTarget, eye, fitDist, FOV, groundPerPx, isTap, type CamState } from './camera';
import { ISLAND_R, PATH_W, PLAZA_R, PLOT_PAD, PLOT_R, RING_R, plots } from './layout';
import type { Resident } from './residents';
import { makeGraph, rng, Walker } from './walk';

export interface PlotSpec {
  kind: 'game' | 'locked';
  title: string;
  icon?: string;
  color: string;
  lobbyIsland?: (ctx: { shadows: boolean; reduced: boolean }) => LobbyIslandHandle | Promise<LobbyIslandHandle>;
}

export interface CarnivalOpts {
  plots: PlotSpec[];
  residents: Resident[];
  autoDowngrade: boolean;
  /** a game was tapped (a tap, never a drag) and its hop is over */
  onEnter(index: number): void;
  onFallback(): void;
  stars: number;
  shownStars: number;
  onJarShown(n: number): void;
  onStarLand(n: number): void;
  onJarTap(): void;
  /** a resident was tapped: who, and the second time (a giggle) */
  onResident(r: Resident, again: boolean, screen: { x: number; y: number }): void;
  /** the label of a resident follows it: its position on the screen each frame */
  onLabelMove?(screen: { x: number; y: number } | null): void;
}
export interface CarnivalHandle {
  fadeIn(ms: number): void;
  dispose(): void;
  home(): void;
  readonly info: { calls: number; residents: number; plots: number; cam: CamState };
  tapPlot(i: number): void;
}

const ZOOM_MS = 420;

export async function startCarnival(o: CarnivalOpts): Promise<CarnivalHandle> {
  let api!: CarnivalHandle;
  const handle: SceneHandle = await showScene(
    async (env) => {
      const minis = await Promise.all(
        o.plots.map((p) => (p.lobbyIsland ? Promise.resolve().then(() => p.lobbyIsland!({ shadows: env.tier === 'high', reduced: env.reduced })).catch(() => null) : null)),
      );
      const built = await createScene(env, o, minis);
      api = built.api;
      return built.scene;
    },
    { autoDowngrade: o.autoDowngrade, onFallback: o.onFallback },
  );
  return { fadeIn: (ms) => handle.fadeIn(ms), dispose: () => handle.dispose(), home: () => api.home(), get info() { return api.info; }, tapPlot: (i) => api.tapPlot(i) };
}

const loader = new T.TextureLoader();

async function signTexture(text: string, color: string, icon: HTMLCanvasElement | null): Promise<T.CanvasTexture> {
  await document.fonts.ready;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fffaf2';
  g.beginPath();
  g.roundRect(6, 118, 500, 132, 34);
  g.fill();
  g.lineWidth = 10;
  g.strokeStyle = color;
  g.stroke();
  if (icon) g.drawImage(icon, 192, 0, 128, 128);
  g.fillStyle = '#3a2f4b';
  let size = 72;
  g.font = `800 ${size}px Rubik, system-ui, sans-serif`;
  while (g.measureText(text).width > 440 && size > 30) {
    size -= 4;
    g.font = `800 ${size}px Rubik, system-ui, sans-serif`;
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 188);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

async function createScene(env: SceneEnv, o: CarnivalOpts, minis: (LobbyIslandHandle | null)[]): Promise<{ scene: StageScene; api: CarnivalHandle }> {
  const mats = new Materials();
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(FOV, env.width / env.height, 0.5, 160);
  const reduced = env.reduced;
  let tier: Tier = env.tier;
  let width = env.width;
  let height = env.height;
  const owned: { dispose(): void }[] = [];
  const keep = <X extends { dispose(): void }>(x: X): X => (owned.push(x), x);

  // ---- light and sky of the hour
  const now = new Date();
  const sky = skyFor(now);
  const night = isNight(now) || now.getHours() >= 19;
  setSky(sky.top, sky.bottom);
  const hemi = new T.HemisphereLight('#ffffff', '#c9b79f', night ? 1.5 : 2.5);
  const sun = new T.DirectionalLight(sky.light, sky.intensity * (night ? 1.2 : 1.9));
  sun.position.set(8, 16, 9);
  sun.castShadow = tier === 'high';
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 4, far: 40 });
  sun.shadow.bias = -0.0008;
  scene.add(hemi, sun);
  scene.fog = new T.Fog(sky.bottom, 40, 90);

  // ---- the island, the water, the paths, the plaza
  const water = new T.Mesh(keep(new T.CircleGeometry(48, 24)), keep(new T.MeshBasicMaterial({ color: '#62c2ea' })));
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.9;
  const foam = new T.Mesh(keep(new T.RingGeometry(ISLAND_R + 0.2, ISLAND_R + 1.1, 40)), mats.get('#d9f4ff', { rough: 0.6 }));
  foam.rotation.x = -Math.PI / 2;
  foam.position.y = -0.88;
  const cliff = new T.Mesh(keep(new T.CylinderGeometry(ISLAND_R, ISLAND_R - 1.2, 1.8, 36)), mats.get('#c49a6c', { rough: 0.9 }));
  cliff.position.y = -0.9;
  const grass = new T.Mesh(keep(new T.CylinderGeometry(ISLAND_R, ISLAND_R, 0.12, 36)), mats.get(PALETTE.grass, { rough: 0.85 }));
  grass.position.y = -0.06;
  grass.receiveShadow = tier === 'high';
  const sandMat = mats.get('#f6dba0', { rough: 0.95 });
  const ring = new T.Mesh(keep(new T.RingGeometry(RING_R - PATH_W / 2, RING_R + PATH_W / 2, 64)), sandMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.012;
  const crossGeo = keep(new T.PlaneGeometry(PATH_W, (RING_R + PATH_W) * 2));
  const cross1 = new T.Mesh(crossGeo, sandMat);
  cross1.rotation.x = -Math.PI / 2;
  cross1.position.y = 0.011;
  const cross2 = new T.Mesh(crossGeo, sandMat);
  cross2.rotation.x = -Math.PI / 2;
  cross2.rotation.z = Math.PI / 2;
  cross2.position.y = 0.011;
  const plaza = new T.Mesh(keep(new T.CircleGeometry(PLAZA_R + 0.5, 40)), mats.get('#f2cf86', { rough: 0.95 }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.02;
  const plazaEdge = new T.Mesh(keep(new T.RingGeometry(PLAZA_R + 0.5, PLAZA_R + 0.75, 40)), mats.get('#d9a35a', { rough: 0.9 }));
  plazaEdge.rotation.x = -Math.PI / 2;
  plazaEdge.position.y = 0.025;
  scene.add(water, foam, cliff, grass, ring, cross1, cross2, plaza, plazaEdge);

  const m4 = new T.Matrix4();
  const c4 = new T.Color();
  // clouds drift by day: all the puffs are one instanced mesh
  const puffs = new T.InstancedMesh(keep(new T.SphereGeometry(1, 8, 6)), keep(new T.MeshLambertMaterial({ color: '#ffffff' })), 12);
  puffs.visible = !night;
  puffs.frustumCulled = false;
  const cloudAt = (i: number, time: number): void => {
    const base = ((((time * (0.5 + i * 0.15) + i * 14 + 30) % 80) + 80) % 80) - 40;
    const cy = 12 + i * 2, cz = -18 - i * 5, sc = 1.7 + i * 0.3;
    [[0, 0, 1], [1.1, -0.15, 0.75], [-1.1, -0.1, 0.8], [0.4, 0.5, 0.7]].forEach(([dx, dy, k], j) => {
      m4.compose(new T.Vector3(base + dx * sc, cy + dy * sc, cz), new T.Quaternion(), new T.Vector3(sc * k * 1.3, sc * k * 0.8, sc * k));
      puffs.setMatrixAt(i * 4 + j, m4);
    });
    puffs.instanceMatrix.needsUpdate = true;
  };
  scene.add(puffs);

  // trees and bushes on the rim of the island (instanced), outside the plots
  const rand = rng(11);
  const treeCount = 20;
  const trunks = new T.InstancedMesh(keep(new T.CylinderGeometry(0.12, 0.16, 1, 6)), keep(new T.MeshLambertMaterial({ color: '#9a6b3f' })), treeCount);
  const crowns = new T.InstancedMesh(keep(new T.SphereGeometry(0.62, 8, 6)), keep(new T.MeshLambertMaterial({ color: '#ffffff' })), treeCount);
  const cols = ['#4fbf6a', '#6fd16a', '#ff9bb8', '#ffb84d', '#59c9b8'];
  for (let i = 0; i < treeCount; i++) {
    const a = (i / treeCount) * Math.PI * 2 + rand() * 0.15;
    const r = ISLAND_R - 0.55 - rand() * 0.25;
    const x = Math.sin(a) * r, z = -Math.cos(a) * r;
    const h = 1.1 + rand() * 0.6;
    m4.compose(new T.Vector3(x, h / 2, z), new T.Quaternion(), new T.Vector3(1, h, 1));
    trunks.setMatrixAt(i, m4);
    const s = 0.8 + rand() * 0.5;
    m4.compose(new T.Vector3(x, h + 0.35, z), new T.Quaternion(), new T.Vector3(s, s, s));
    crowns.setMatrixAt(i, m4);
    crowns.setColorAt(i, c4.set(cols[i % cols.length]));
  }
  scene.add(trunks, crowns);

  // ---- the plaza: a pedestal with the star jar
  const ped = new T.Mesh(keep(new T.CylinderGeometry(0.95, 1.1, 0.55, 24)), mats.get('#fff4d6', { rough: 0.5 }));
  ped.position.y = 0.3;
  const pedTop = new T.Mesh(keep(new T.CylinderGeometry(0.8, 0.8, 0.1, 24)), mats.get(PALETTE.gold, { rough: 0.35, metal: 0.4 }));
  pedTop.position.y = 0.62;
  const jar = buildJar(mats, o.stars, o.shownStars, reduced, { onShown: o.onJarShown, onLand: o.onStarLand });
  jar.group.userData.index = -1;
  jar.group.position.y = 0.7;
  jar.group.scale.setScalar(1.15);
  scene.add(ped, pedTop, jar.group);

  // ---- the plots of the games: a pad, the miniature (or a tent), a sign and flags
  const ps = plots(o.plots.length);
  const pads = o.plots.map((spec, i) => {
    const g = new T.Group();
    g.position.set(ps[i].x, 0, ps[i].z);
    g.rotation.y = Math.atan2(-ps[i].x, -ps[i].z) + Math.PI; // facing the middle
    g.userData.index = i;
    const pad = new T.Mesh(keep(new T.CylinderGeometry(PLOT_PAD, PLOT_PAD + 0.08, 0.16, 28)), mats.get('#fff3d1', { rough: 0.85 }));
    pad.position.y = 0.04;
    pad.receiveShadow = tier === 'high';
    const edge = new T.Mesh(keep(new T.TorusGeometry(PLOT_PAD, 0.07, 6, 28)), mats.get(spec.color, { rough: 0.6 }));
    edge.rotation.x = Math.PI / 2;
    edge.position.y = 0.13;
    const hit = new T.Mesh(keep(new T.CylinderGeometry(PLOT_PAD + 0.2, PLOT_PAD + 0.2, 4, 10)), new T.MeshBasicMaterial({ visible: false }));
    hit.position.y = 1.7;
    g.add(pad, edge, hit);
    const inner = new T.Group();
    inner.position.y = 0.1;
    g.add(inner);
    return { g, inner, jump: 1, spec };
  });
  const updaters: ((dt: number, t: number) => void)[] = [];
  pads.forEach((p, i) => {
    const mini = minis[i];
    if (mini) {
      p.inner.add(mini.object);
      p.inner.scale.setScalar(1.05);
      updaters.push((dt, t) => mini.update(dt, reduced ? 0 : t));
      owned.push({ dispose: () => mini.dispose() });
    } else if (p.spec.kind === 'game') p.inner.add(tent(p.spec.color, false));
    else {
      p.inner.add(tent('#c9c4cf', true));
      const { group: lock } = makeLock(mats);
      lock.position.set(0, 1.9, 0.2);
      lock.scale.setScalar(1.1);
      p.inner.add(lock);
      updaters.push((_dt, t) => (lock.rotation.z = reduced ? 0 : Math.sin(t * 2.4 + i) * 0.1));
    }
    scene.add(p.g);
  });
  function tent(color: string, closed: boolean): T.Group {
    const g = new T.Group();
    const body = new T.Mesh(keep(new T.CylinderGeometry(0.95, 1.05, 0.8, 8)), mats.get('#ffffff', { rough: 0.8 }));
    body.position.y = 0.5;
    const band = new T.Mesh(keep(new T.CylinderGeometry(1.0, 1.07, 0.3, 8)), mats.get(color, { rough: 0.8 }));
    band.position.y = 0.3;
    const roof = new T.Mesh(keep(new T.ConeGeometry(1.25, 0.9, 8, 1)), mats.get(color, { rough: 0.8 }));
    roof.position.y = 1.35;
    g.add(body, band, roof);
    if (closed) {
      const door = new T.Mesh(keep(new T.PlaneGeometry(0.6, 0.7)), mats.get('#8a7f99', { rough: 0.9 }));
      door.position.set(0, 0.45, 1.03);
      g.add(door);
    }
    return g;
  }
  // signs (a sprite each: always facing the camera, so that it can be read; the icon is on the sign) and flags (two instanced meshes)
  const signs: T.Sprite[] = [];
  let disposed = false;
  const flagPoles = new T.InstancedMesh(keep(new T.CylinderGeometry(0.04, 0.04, 2.2, 5)), mats.get('#ffffff'), pads.length * 2);
  const flagCloths = new T.InstancedMesh(keep(new T.PlaneGeometry(0.62, 0.38)), new T.MeshLambertMaterial({ side: T.DoubleSide }), pads.length * 2);
  keep(flagCloths.material as T.MeshLambertMaterial);
  const flagPos: { x: number; z: number }[] = [];
  pads.forEach((p, i) => {
    const title = p.spec.kind === 'locked' ? 'בקרוב' : p.spec.title;
    const draw = async (): Promise<void> => {
      let iconCanvas: HTMLCanvasElement | null = null;
      if (p.spec.kind === 'game') {
        const it = await iconTexture(p.spec.icon ?? '🎮');
        if (it) {
          iconCanvas = it.image as HTMLCanvasElement;
        }
      }
      const tex = await signTexture(title, p.spec.color, iconCanvas);
      if (disposed) return tex.dispose();
      owned.push(tex);
      const sp = new T.Sprite(keep(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })));
      sp.scale.set(3.1, 1.55, 1);
      sp.position.set(ps[i].x, 4.0, ps[i].z);
      scene.add(sp);
      signs.push(sp);
    };
    void draw();
    for (const side of [-1, 1]) {
      const ang = Math.atan2(ps[i].x, -ps[i].z);
      const cx = ps[i].x + Math.cos(ang) * side * (PLOT_PAD - 0.15), cz = ps[i].z + Math.sin(ang) * side * (PLOT_PAD - 0.15);
      const k = flagPos.push({ x: cx, z: cz }) - 1;
      m4.compose(new T.Vector3(cx, 1.25, cz), new T.Quaternion(), new T.Vector3(1, 1, 1));
      flagPoles.setMatrixAt(k, m4);
      flagCloths.setColorAt(k, c4.set(p.spec.color));
    }
  });
  scene.add(flagPoles, flagCloths);
  const flagQ = new T.Quaternion();
  const flagAt = (time: number): void => {
    flagPos.forEach((f, k) => {
      flagQ.setFromAxisAngle(new T.Vector3(0, 1, 0), reduced ? 0 : Math.sin(time * 3 + k) * 0.25);
      m4.compose(new T.Vector3(f.x + 0.32, 2.15, f.z), flagQ, new T.Vector3(reduced ? 1 : 0.92 + Math.sin(time * 5 + k) * 0.08, 1, 1));
      flagCloths.setMatrixAt(k, m4);
    });
    flagCloths.instanceMatrix.needsUpdate = true;
  };
  // fewer draw calls: everything that stands still is merged (the island, the pads, the tents, the pedestal, and what is still in the games' miniatures)
  const statics = staticMeshes(scene, (step) => {
    updaters.forEach((f) => f(step * 0.4, step * 1.7));
  });
  bake(statics, scene);

  // lights at night: strings of bulbs along the ring
  let bulbs: T.InstancedMesh | null = null;
  if (night) {
    const n = 32;
    bulbs = new T.InstancedMesh(keep(new T.SphereGeometry(0.11, 6, 5)), new T.MeshBasicMaterial({ color: '#ffffff' }), n);
    const lc = ['#ffd23f', '#ff6b8f', '#6fd1ff', '#8fe36b'];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = RING_R + PATH_W / 2 + 0.25;
      m4.compose(new T.Vector3(Math.sin(a) * r, 0.9 + Math.sin(i * 1.7) * 0.08, -Math.cos(a) * r), new T.Quaternion(), new T.Vector3(1, 1, 1));
      bulbs.setMatrixAt(i, m4);
      bulbs.setColorAt(i, c4.set(lc[i % 4]));
    }
    scene.add(bulbs);
    const posts = new T.InstancedMesh(keep(new T.CylinderGeometry(0.03, 0.03, 0.9, 4)), mats.get('#6b5a4a'), 16);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = RING_R + PATH_W / 2 + 0.25;
      m4.compose(new T.Vector3(Math.sin(a) * r, 0.45, -Math.cos(a) * r), new T.Quaternion(), new T.Vector3(1, 1, 1));
      posts.setMatrixAt(i, m4);
    }
    scene.add(posts);
    const stars = new T.InstancedMesh(keep(new T.SphereGeometry(0.12, 5, 4)), new T.MeshBasicMaterial({ color: '#ffffff', fog: false }), 60);
    for (let i = 0; i < 60; i++) {
      m4.compose(new T.Vector3((rand() - 0.5) * 120, 15 + rand() * 30, -40 - rand() * 20), new T.Quaternion(), new T.Vector3(1, 1, 1).multiplyScalar(0.5 + rand()));
      stars.setMatrixAt(i, m4);
    }
    stars.frustumCulled = false;
    scene.add(stars);
  }

  // ---- the residents: sprites that walk the paths, with a round shadow
  const graph = makeGraph();
  const shadowMesh = new T.InstancedMesh(keep(new T.CircleGeometry(0.34, 12)), keep(new T.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.22, depthWrite: false })), o.residents.length);
  shadowMesh.frustumCulled = false;
  scene.add(shadowMesh);
  const shQ = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2);
  const people = o.residents.map((r, i) => {
    const w = new Walker(graph, (i * 7 + 1) % graph.nodes.length, rng(100 + i), 1.15 + (i % 3) * 0.12);
    const mat = new T.SpriteMaterial({ transparent: true, depthWrite: false });
    keep(mat);
    loader.load(r.img, (tex: T.Texture) => {
      if (disposed) return tex.dispose();
      tex.colorSpace = T.SRGBColorSpace;
      owned.push(tex);
      mat.map = tex;
      mat.needsUpdate = true;
    });
    const sp = new T.Sprite(mat);
    sp.scale.set(1.15, 1.15, 1);
    sp.userData.index = 1000 + i;
    scene.add(sp);
    return { r, w, sp, hop: 0, tapped: 0, taps: 0, phase: i * 1.3 };
  });

  // ---- the camera: a fixed slant; the finger moves it (and nothing else does)
  let cam: CamState = { x: 0, z: 0.8, dist: 30 };
  const home = (): CamState => ({ x: 0, z: 0.8, dist: fitDist(width / height, 9.6) });
  const lookAt = new T.Vector3();
  function layout(): void {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  layout();
  cam = home();
  let goal: CamState = { ...cam };
  let homing = false;

  const canvas = env.canvas;
  const pts = new Map<number, { x: number; y: number }>();
  let downAt: { x: number; y: number; t: number; id: number } | null = null;
  let dragged = 0;
  let pinch: { d0: number; dist0: number } | null = null;
  let entering: number | null = null;
  let enterTimer = 0;
  const onDown = (e: PointerEvent): void => {
    if (entering !== null) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointer */
    }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    homing = false;
    if (pts.size === 1) {
      downAt = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      dragged = 0;
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), dist0: goal.dist };
      dragged = 999;
    }
  };
  const onMove = (e: PointerEvent): void => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pts.size >= 2 && pinch) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      goal = clampTarget({ ...goal, dist: clampDist((pinch.dist0 * pinch.d0) / Math.max(20, d)) });
      return;
    }
    if (downAt) dragged += Math.hypot(dx, dy);
    // the ground follows the finger: the screen's vertical is shortened by the slant
    const k = groundPerPx(goal.dist, height);
    goal = clampTarget({ ...goal, x: goal.x - dx * k, z: goal.z - (dy * k) / Math.sin((54 * Math.PI) / 180) });
  };
  const onUp = (e: PointerEvent): void => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    const d = downAt;
    if (!d || d.id !== e.pointerId) return;
    downAt = null;
    const moved = Math.max(dragged, Math.hypot(e.clientX - d.x, e.clientY - d.y));
    if (!isTap(moved, performance.now() - d.t)) return;
    tapAt(e.clientX, e.clientY);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  function screenOf(v: T.Vector3): { x: number; y: number } {
    const p = v.clone().project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }
  let labelOf: number | null = null;
  function tapAt(x: number, y: number): void {
    const targets: T.Object3D[] = [...pads.map((p) => p.g), jar.group, ...people.map((p) => p.sp)];
    const i = pickIndex(camera, canvas, x, y, targets);
    if (i === null) return;
    if (i === -1) {
      jar.hop();
      o.onJarTap();
      return;
    }
    if (i >= 1000) {
      const p = people[i - 1000];
      p.taps = p.tapped > 0 ? p.taps + 1 : 1;
      const again = p.tapped > 0;
      p.tapped = 3.2;
      p.hop = 1;
      p.w.held = true;
      labelOf = i - 1000;
      o.onResident(p.r, again, screenOf(p.sp.position));
      return;
    }
    tapPlot(i);
  }
  function tapPlot(i: number): void {
    if (entering !== null || i < 0 || i >= pads.length) return;
    const p = pads[i];
    p.jump = 0;
    if (p.spec.kind === 'locked') return;
    entering = i;
    if (reduced) o.onEnter(i);
    else enterTimer = window.setTimeout(() => o.onEnter(i), ZOOM_MS);
  }

  function update(dt: number, time: number): void {
    // the camera eases to where the finger (or "home") put it
    if (homing) goal = home();
    const k = 1 - Math.exp(-dt * (reduced ? 40 : 14));
    cam = { x: cam.x + (goal.x - cam.x) * k, z: cam.z + (goal.z - cam.z) * k, dist: cam.dist + (goal.dist - cam.dist) * k };
    // a plot that is entered: the camera comes a little closer
    let c2 = cam;
    if (entering !== null) {
      const p = ps[entering];
      c2 = { x: cam.x + (p.x - cam.x) * 0.18, z: cam.z + (p.z - cam.z) * 0.18, dist: cam.dist * 0.82 };
    }
    const e = eye(c2);
    camera.position.set(e.x, e.y, e.z);
    lookAt.set(c2.x, 0, c2.z);
    camera.lookAt(lookAt);

    updaters.forEach((f) => f(dt, time));
    pads.forEach((p) => {
      if (p.jump < 1) {
        p.jump = Math.min(1, p.jump + dt / 0.45);
        const s = 1 + Math.sin(p.jump * Math.PI) * 0.12 * (1 - p.jump);
        p.inner.scale.setScalar((minis[pads.indexOf(p)] ? 1.05 : 1) * s);
        p.inner.position.y = 0.1 + Math.sin(p.jump * Math.PI) * 0.35 * (1 - p.jump);
      }
    });
    people.forEach((p) => {
      if (p.tapped > 0) {
        p.tapped -= dt;
        if (p.tapped <= 0) {
          p.w.held = false;
          if (labelOf === people.indexOf(p)) labelOf = null;
        }
      }
      p.w.update(dt);
      p.hop = Math.max(0, p.hop - dt * 2.2);
      const bob = reduced ? 0 : p.w.walking ? Math.abs(Math.sin(time * 9 + p.phase)) * 0.14 : Math.sin(time * 2 + p.phase) * 0.02;
      const jump = Math.sin(p.hop * Math.PI) * 0.5;
      p.sp.position.set(p.w.x, 0.58 + bob + jump, p.w.z);
      p.sp.scale.set(1.15 * p.w.face, 1.15 * (1 + (p.w.walking && !reduced ? Math.sin(time * 18 + p.phase) * 0.03 : 0)), 1);
      m4.compose(new T.Vector3(p.w.x, 0.04, p.w.z), shQ, new T.Vector3(1 - jump * 0.4, 1 - jump * 0.4, 1));
      shadowMesh.setMatrixAt(people.indexOf(p), m4);
    });
    shadowMesh.instanceMatrix.needsUpdate = true;
    o.onLabelMove?.(labelOf !== null ? screenOf(people[labelOf].sp.position.clone().add(new T.Vector3(0, 0.75, 0))) : null);
    flagAt(time);
    if (puffs.visible) for (let i = 0; i < 3; i++) cloudAt(i, reduced ? 0 : time);
    jar.update(dt);
    if (bulbs && !reduced) bulbs.rotation.y = 0;
  }

  const stage: StageScene = {
    scene,
    camera,
    update,
    resize(w, h) {
      width = w;
      height = h;
      layout();
      if (!downAt) goal = { ...goal, dist: clampDist(goal.dist) };
    },
    setTier(t) {
      tier = t;
      sun.castShadow = t === 'high';
      puffs.visible = !night;
    },
    dispose() {
      disposed = true;
      window.clearTimeout(enterTimer);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      jar.dispose();
      sun.dispose();
      hemi.dispose();
      disposeTree(scene);
      owned.forEach((d) => d.dispose());
      mats.dispose();
      o.onLabelMove?.(null);
    },
  };
  const info = (): CarnivalHandle['info'] => ({ calls: env.renderer.info.render.calls, residents: people.length, plots: pads.length, cam });
  const api: CarnivalHandle = {
    fadeIn: () => {},
    dispose: () => {},
    home: () => {
      homing = true;
    },
    get info() {
      return info();
    },
    tapPlot,
  };
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__carnival = { api, cam: () => cam, setCam: (c: CamState) => (goal = c), tapAt, people, scene, project: (x: number, y: number, z: number) => screenOf(new T.Vector3(x, y, z)), plotAt: (i: number) => ps[i], count: () => { const out: Record<string, number> = {}; scene.traverse((ob) => { const m = ob as T.Mesh; if (m.isMesh || (ob as T.Sprite).isSprite) { let top: T.Object3D = ob; while (top.parent && top.parent !== scene) top = top.parent; const k = `${top.type}:${top.userData.index ?? top.name ?? ''}`; out[k] = (out[k] ?? 0) + 1; } }); return out; } };
  void clamp;
  void ISLAND_R;
  void PLOT_R;
  return { scene: stage, api };
}
