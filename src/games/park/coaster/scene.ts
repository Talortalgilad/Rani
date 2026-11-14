/**
 * The 3D scene of the roller coaster (SPEC-park.md 2, 3, 4): the plot with its tiles and the station, the track, the train, the ghost of the next piece,
 * the camera (a fixed slant: a drag moves it, a pinch zooms, "centre" brings it back; nothing else ever moves it while a finger is down),
 * the ride from the first car or from outside, and the balloons. Built on the shared stage of the lobby (one renderer).
 */
import * as T from '../../../lobby3d/lib';
import { disposeTree, setSky, showScene, type SceneEnv, type SceneHandle, type StageScene } from '../../../lobby3d/stage';
import { placeBalloons } from './balloons';
import { decor } from './decor';
import { framesOf, poseAt, wrap, type Frames } from './frames';
import { duration, sample, simulate, type Ride } from './physics';
import { buildTrackGeos, mergeGeos } from './trackMesh';
import { buildTrain, CAR_GAP, type Train } from './trainMesh';
import { N, STATION, T as TILE, Y0, buildCurve, cloneTrack, worldOf, walk, type Curve, type Kind, type Track } from './track';
import type { SoundApi } from '../../../sound';

export interface SceneOpts {
  color: string;
  riders: string[];
  companionUrl: string;
  sound: SoundApi;
  calm: boolean;
  onBalloon(value: number, total: number): void;
  onRideEnd(): void;
  onCheer(): void;
}
export interface ParkScene {
  setTrack(t: Track, landLast?: boolean): void;
  setGhost(k: Kind | null): void;
  setColor(c: string): void;
  /** the plot is shown again after a ride, from where Rani left it */
  startRide(view: 'first' | 'outside'): void;
  setView(view: 'first' | 'outside'): void;
  stopRide(): void;
  home(): void;
  /** the screen position (CSS px) of the end of the track, for the speed meter, or null when it is not in front of the camera */
  endScreen(): { x: number; y: number } | null;
  readonly riding: boolean;
  readonly ride: Ride | null;
  info(): { calls: number; balloons: number; popped: number; view: string };
  dispose(): void;
  handle: SceneHandle;
  /** for the tests and screenshots */
  seek(t: number): void;
  camState(): { x: number; z: number; dist: number };
  setCam(x: number, z: number, dist: number): void;
}

const PLOT = N * TILE;
const PITCH = (58 * Math.PI) / 180;

export async function startScene(host: HTMLElement, o: SceneOpts): Promise<ParkScene> {
  let api!: ParkScene;
  const handle = await showScene(
    (env) => {
      const built = createScene(env, o, host);
      api = built.api;
      return built.scene;
    },
    { autoDowngrade: false, onFallback: () => void 0, minTier: 'medium' },
  );
  api.handle = handle;
  return api;
}

function createScene(env: SceneEnv, o: SceneOpts, host: HTMLElement): { scene: StageScene; api: ParkScene } {
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(46, env.width / env.height, 0.3, 200);
  scene.add(camera);
  const reduced = env.reduced || o.calm;
  let width = env.width;
  let height = env.height;
  const owned: { dispose(): void }[] = [];
  const keep = <X extends { dispose(): void }>(x: X): X => (owned.push(x), x);
  setSky('#8fd3ff', '#eaf8ff');
  scene.fog = new T.Fog('#eaf8ff', 70, 140);
  scene.add(new T.HemisphereLight('#ffffff', '#cfe7c0', 2.4));
  const sun = new T.DirectionalLight('#fff4e0', 2.3);
  sun.position.set(14, 30, 8);
  scene.add(sun);

  // ---- the ground: grass, the tiles of the plot, the station
  const lambert = (c: string): T.MeshLambertMaterial => keep(new T.MeshLambertMaterial({ color: c }));
  const ground = new T.Mesh(keep(new T.CircleGeometry(70, 32)), lambert('#8fe07a'));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(PLOT / 2, -0.02, PLOT / 2);
  scene.add(ground);
  const tiles = new T.InstancedMesh(keep(new T.PlaneGeometry(TILE * 0.96, TILE * 0.96)), lambert('#ffffff'), N * N);
  const m4 = new T.Matrix4();
  const col = new T.Color();
  const qFlat = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    m4.compose(new T.Vector3((c + 0.5) * TILE, 0.01, (r + 0.5) * TILE), qFlat, new T.Vector3(1, 1, 1));
    tiles.setMatrixAt(r * N + c, m4);
    tiles.setColorAt(r * N + c, col.set((r + c) % 2 ? '#a5ec8c' : '#98e47f'));
  }
  scene.add(tiles);
  // the station: a platform, four posts and a striped roof
  const stationG = new T.Group();
  const sx = (STATION.c + 0.5) * TILE, sz = (STATION.r + 0.5) * TILE;
  const platform = new T.Mesh(keep(new T.BoxGeometry(TILE * 0.98, 0.3, TILE * 0.98)), lambert('#f0cf9a'));
  platform.position.set(sx, 0.15, sz);
  // a board with stripes standing at the back of the platform (a roof over it would hide the train from the camera)
  const board = new T.Mesh(keep(new T.BoxGeometry(TILE * 1.05, 0.95, 0.18)), lambert('#ff5d73'));
  board.position.set(sx, 1.9, sz - 1.45);
  const boardStripe = new T.Mesh(keep(new T.BoxGeometry(TILE * 1.06, 0.3, 0.2)), lambert('#ffffff'));
  boardStripe.position.set(sx, 1.9, sz - 1.45);
  stationG.add(platform, board, boardStripe);
  for (const dx of [-1, 1]) {
    const post = new T.Mesh(keep(new T.CylinderGeometry(0.1, 0.1, 1.9, 6)), lambert('#ffffff'));
    post.position.set(sx + dx * 1.3, 0.95, sz - 1.45);
    stationG.add(post);
  }
  scene.add(stationG);
  // the things round the plot (all outside the corridor of the track)
  const things = decor();
  const trunks = new T.InstancedMesh(keep(new T.CylinderGeometry(0.15, 0.2, 1, 6)), lambert('#9a6b3f'), things.length);
  const crowns = new T.InstancedMesh(keep(new T.SphereGeometry(0.8, 8, 6)), lambert('#ffffff'), things.length);
  things.forEach((th, i) => {
    const h = th.kind === 'tree' ? 1.6 * th.s : th.kind === 'bush' ? 0.3 : 0.15;
    const r = th.kind === 'tree' ? th.s : th.kind === 'bush' ? 0.7 * th.s : 0.35 * th.s;
    m4.compose(new T.Vector3(th.x, h / 2, th.z), new T.Quaternion(), new T.Vector3(1, h, 1));
    trunks.setMatrixAt(i, m4);
    m4.compose(new T.Vector3(th.x, th.kind === 'tree' ? h + 0.4 * th.s : 0.35 * th.s, th.z), new T.Quaternion(), new T.Vector3(r, r, r));
    crowns.setMatrixAt(i, m4);
    crowns.setColorAt(i, col.set(th.color));
  });
  scene.add(trunks, crowns);

  // ---- the track
  const matRails = keep(new T.MeshStandardMaterial({ color: o.color, roughness: 0.32, metalness: 0.15 }));
  const matSpine = keep(new T.MeshStandardMaterial({ color: '#7b6f9a', roughness: 0.6 }));
  const matWood = keep(new T.MeshStandardMaterial({ color: '#ffe9f2', roughness: 0.7 }));
  const matLegs = keep(new T.MeshStandardMaterial({ color: '#e6d8f5', roughness: 0.7 }));
  const matChain = keep(new T.MeshStandardMaterial({ color: '#3d3d4d', roughness: 0.5 }));
  const matGhost = keep(new T.MeshBasicMaterial({ color: '#5ad1ff', transparent: true, opacity: 0.75, depthWrite: false }));
  const staticG = new T.Group();
  const lastG = new T.Group();
  const ghostG = new T.Group();
  scene.add(staticG, lastG, ghostG);
  const clear = (g: T.Group): void => {
    for (const ch of [...g.children]) {
      g.remove(ch);
      (ch as T.Mesh).geometry?.dispose();
    }
  };
  const addSet = (g: T.Group, geos: ReturnType<typeof buildTrackGeos>): void => {
    g.add(new T.Mesh(geos.rails, matRails), new T.Mesh(geos.spine, matSpine), new T.Mesh(geos.wood, matWood), new T.Mesh(geos.legs, matLegs), new T.Mesh(geos.chain, matChain));
  };
  let track: Track = { pieces: [] };
  let curve: Curve = buildCurve(track);
  let frames: Frames = framesOf(curve);
  let landT = 1;
  let ride: Ride | null = null;

  function setTrack(t: Track, landLast = false): void {
    track = cloneTrack(t);
    // an open track is drawn up to its end (the run after it is only for the energy); a closed one all round
    curve = buildCurve(track);
    frames = framesOf(curve);
    clear(staticG);
    clear(lastG);
    const n = track.pieces.length;
    const end = curve.piecesEnd;
    if (n === 0) {
      ride = null;
      return;
    }
    const lastS = curve.pieceS[n - 1];
    if (landLast) {
      addSet(staticG, buildTrackGeos(curve, frames, 0, lastS));
      addSet(lastG, buildTrackGeos(curve, frames, lastS - 0.05, curve.complete ? curve.length : end));
      landT = 0;
    } else {
      addSet(staticG, buildTrackGeos(curve, frames, 0, curve.complete ? curve.length : end));
      landT = 1;
    }
    ride = null;
  }
  function setGhost(k: Kind | null): void {
    clear(ghostG);
    if (!k) return;
    const t2 = cloneTrack(track);
    t2.pieces.push(k);
    const c2 = buildCurve(t2);
    const f2 = framesOf(c2);
    const n = t2.pieces.length;
    const g = mergeGeos(buildTrackGeos(c2, f2, c2.pieceS[n - 1], c2.complete ? c2.length : c2.piecesEnd));
    ghostG.add(new T.Mesh(g, matGhost));
  }

  // ---- the train
  const train: Train = buildTrain(o.riders);
  keep({ dispose: () => train.dispose() });
  train.cars.forEach((c) => scene.add(c));
  train.riders.forEach((r) => scene.add(r));
  const placeTrain = (s: number): void => {
    train.cars.forEach((car, k) => {
      const q = poseAt(curve.complete ? curve : curve, frames, s - k * CAR_GAP, curve.complete);
      const mm = new T.Matrix4().makeBasis(new T.Vector3(...q.t), new T.Vector3(...q.u), new T.Vector3(...q.r));
      car.quaternion.setFromRotationMatrix(mm);
      car.position.set(q.p[0] + q.u[0] * 0.42, q.p[1] + q.u[1] * 0.42, q.p[2] + q.u[2] * 0.42);
      train.riders[k].position.set(q.p[0] + q.u[0] * 1.35 - q.t[0] * 0.2, q.p[1] + q.u[1] * 1.35 - q.t[1] * 0.2, q.p[2] + q.u[2] * 1.35 - q.t[2] * 0.2);
    });
  };

  // ---- the camera: a fixed slant, moved only by a finger
  type Cam = { x: number; z: number; dist: number };
  const fit = (): Cam => ({ x: PLOT / 2, z: PLOT / 2 + 2, dist: Math.min(70, Math.max(26, (PLOT * 0.57) / (Math.tan((46 / 2) * (Math.PI / 180)) * Math.min(width / height, 1.2)))) });
  let cam: Cam = fit();
  let goal: Cam = { ...cam };
  let homing = false;
  const lookAt = new T.Vector3();
  const clampCam = (c: Cam): Cam => ({ x: Math.min(PLOT + 4, Math.max(-4, c.x)), z: Math.min(PLOT + 4, Math.max(-4, c.z)), dist: Math.min(70, Math.max(14, c.dist)) });

  // ---- the ride
  type View = 'first' | 'outside';
  let view: View = 'first';
  let riding = false;
  let t = 0;
  let dur = 0;
  let endAt = -1;
  let balloons: ReturnType<typeof placeBalloons> = [];
  const alive: boolean[] = [];
  let popped = 0;
  let total = 0;
  let hands = 0;
  let tick = 0;
  const balloonMesh = new T.InstancedMesh(keep(new T.SphereGeometry(0.6, 10, 8)), keep(new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25 })), 80);
  const stringMesh = new T.InstancedMesh(keep(new T.CylinderGeometry(0.012, 0.012, 1, 3)), lambert('#ffffff'), 80);
  balloonMesh.frustumCulled = false;
  stringMesh.frustumCulled = false;
  balloonMesh.count = stringMesh.count = 0;
  scene.add(balloonMesh, stringMesh);
  const parts = new T.InstancedMesh(keep(new T.BoxGeometry(0.1, 0.1, 0.1)), keep(new T.MeshBasicMaterial({ color: '#ffffff' })), 80);
  parts.frustumCulled = false;
  parts.count = 0;
  scene.add(parts);
  const bits: { p: T.Vector3; v: T.Vector3; life: number; c: T.Color }[] = [];
  const cockpit = new T.Group();
  const nose = new T.Mesh(keep(new T.RoundedBoxGeometry(0.8, 0.4, 0.55, 3, 0.1)), keep(new T.MeshStandardMaterial({ color: '#ff7aa8', roughness: 0.3 })));
  nose.scale.set(1.5, 1.0, 1.7);
  nose.position.set(0, -1.0, -1.5);
  cockpit.add(nose);
  const comp = new T.Sprite(keep(new T.SpriteMaterial({ transparent: true, depthWrite: false })));
  comp.scale.set(0.6, 0.6, 1);
  comp.position.set(0, -0.62, -1.15);
  new T.TextureLoader().load(o.companionUrl, (tex: T.Texture) => {
    tex.colorSpace = T.SRGBColorSpace;
    owned.push(tex);
    (comp.material as T.SpriteMaterial).map = tex;
    comp.material.needsUpdate = true;
  });
  cockpit.add(comp);
  cockpit.visible = false;
  camera.add(cockpit);

  function layoutBalloons(): void {
    balloons = placeBalloons(curve, curve.pieceS.length * 7 + 1);
    alive.length = 0;
    const dummy = new T.Object3D();
    balloons.forEach((b, i) => {
      alive.push(true);
      dummy.position.set(b.x, b.y, b.z);
      dummy.scale.set(1, 1.18, 1);
      dummy.updateMatrix();
      balloonMesh.setMatrixAt(i, dummy.matrix);
      balloonMesh.setColorAt(i, col.set(b.color));
      dummy.position.set(b.x, b.y - 1.35, b.z);
      dummy.scale.set(1, 1.5, 1);
      dummy.updateMatrix();
      stringMesh.setMatrixAt(i, dummy.matrix);
    });
    balloonMesh.count = stringMesh.count = balloons.length;
    balloonMesh.instanceMatrix.needsUpdate = stringMesh.instanceMatrix.needsUpdate = true;
    if (balloonMesh.instanceColor) balloonMesh.instanceColor.needsUpdate = true;
    popped = 0;
  }
  function hideBalloons(): void {
    balloonMesh.count = stringMesh.count = 0;
    balloons = [];
  }
  function popBalloon(i: number): void {
    alive[i] = false;
    const b = balloons[i];
    const zero = new T.Matrix4().makeScale(0, 0, 0);
    balloonMesh.setMatrixAt(i, zero);
    stringMesh.setMatrixAt(i, zero);
    balloonMesh.instanceMatrix.needsUpdate = stringMesh.instanceMatrix.needsUpdate = true;
    popped++;
    total += b.value;
    o.sound.play('pop', 520 + Math.random() * 300);
    for (let k = 0; k < 16; k++) bits.push({ p: new T.Vector3(b.x, b.y, b.z), v: new T.Vector3((Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5), life: 0.9, c: new T.Color(k % 3 === 0 ? '#ffffff' : b.color) });
    o.onBalloon(b.value, total);
  }

  function startRide(v: View): void {
    if (!curve.complete) return;
    ride = simulate(curve);
    dur = duration(ride);
    t = 0;
    endAt = -1;
    view = v;
    riding = true;
    hands = 0;
    layoutBalloons();
    ghostG.visible = false;
    tiles.visible = true;
  }
  function stopRide(): void {
    riding = false;
    cockpit.visible = false;
    hideBalloons();
    ghostG.visible = true;
    placeTrain(1.2);
  }

  // ---- fingers
  const canvas = env.canvas;
  const pts = new Map<number, { x: number; y: number }>();
  let down: { x: number; y: number; t: number; id: number } | null = null;
  let moved = 0;
  let pinch: { d0: number; dist0: number } | null = null;
  const onDown = (e: PointerEvent): void => {
    if (e.target !== host) return;
    try {
      host.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic */
    }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    homing = false;
    if (pts.size === 1) {
      down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      moved = 0;
    } else if (pts.size === 2 && !riding) {
      const [a, b] = [...pts.values()];
      pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), dist0: goal.dist };
      moved = 999;
    }
  };
  const onMove = (e: PointerEvent): void => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (down) moved += Math.hypot(dx, dy);
    if (riding) return;
    if (pts.size >= 2 && pinch) {
      const [a, b] = [...pts.values()];
      goal = clampCam({ ...goal, dist: (pinch.dist0 * pinch.d0) / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)) });
      return;
    }
    const k = (2 * Math.tan((46 / 2) * (Math.PI / 180)) * goal.dist) / height;
    goal = clampCam({ ...goal, x: goal.x - dx * k, z: goal.z - (dy * k) / Math.sin(PITCH) });
  };
  const onUp = (e: PointerEvent): void => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    const d = down;
    if (!d || d.id !== e.pointerId) return;
    down = null;
    if (riding && Math.max(moved, Math.hypot(e.clientX - d.x, e.clientY - d.y)) <= 12 && performance.now() - d.t < 500) tapRide(e.clientX, e.clientY);
  };
  host.addEventListener('pointerdown', onDown);
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerup', onUp);
  host.addEventListener('pointercancel', onUp);
  // the canvas is under the page: the host gets the touches that the page lets through
  const proj = (x: number, y: number, z: number): { x: number; y: number; z: number } => {
    const v = new T.Vector3(x, y, z).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, z: v.z };
  };
  function tapRide(x: number, y: number): void {
    let best = -1, bd = 54;
    balloons.forEach((b, i) => {
      if (!alive[i]) return;
      const p = proj(b.x, b.y, b.z);
      if (p.z > 1 || p.z < -1) return;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best >= 0) popBalloon(best);
    else {
      hands = 1;
      o.sound.play('wheee');
      o.onCheer();
    }
  }

  // ---- every frame
  const sideCam = new T.Vector3();
  function update(dt: number, time: number): void {
    // the tracks that land: a hop from above and a small bounce
    if (landT < 1) {
      landT = Math.min(1, landT + dt / 0.42);
      const e = landT < 0.7 ? 1 - (landT / 0.7) ** 2 : Math.sin(((landT - 0.7) / 0.3) * Math.PI) * 0.12;
      lastG.position.y = reduced ? 0 : e * 3.2;
      if (landT >= 1) lastG.position.y = 0;
    }
    if (riding && ride) {
      t = Math.min(dur, t + dt);
      const { s, v } = sample(ride, t);
      placeTrain(s);
      const sp = Math.abs(v);
      const q = poseAt(curve, frames, s, true);
      if (view === 'first') {
        cockpit.visible = true;
        nose.visible = true;
        train.cars[0].visible = false;
        train.riders[0].visible = false;
        camera.fov = 70 + (o.calm ? 0 : Math.min(14, sp * 1.1)) + hands * 6;
        camera.updateProjectionMatrix();
        const shake = o.calm ? 0 : Math.min(0.03, sp * 0.003);
        camera.position.set(q.p[0] + q.u[0] * 1.35 + (Math.random() - 0.5) * shake, q.p[1] + q.u[1] * 1.35 + (Math.random() - 0.5) * shake, q.p[2] + q.u[2] * 1.35);
        const ah = poseAt(curve, frames, s + 4.2, true);
        camera.up.set(q.u[0], q.u[1], q.u[2]);
        camera.lookAt(ah.p[0] + ah.u[0] * 0.5, ah.p[1] + ah.u[1] * 0.5, ah.p[2] + ah.u[2] * 0.5);
      } else {
        cockpit.visible = false;
        train.cars[0].visible = true;
        train.riders[0].visible = true;
        camera.fov = 52;
        camera.updateProjectionMatrix();
        camera.up.set(0, 1, 0);
        const target = new T.Vector3(q.p[0], q.p[1], q.p[2]);
        sideCam.lerp(new T.Vector3(target.x - 7, target.y + 5.5, target.z + 8), 1 - Math.exp(-dt * 3));
        if (sideCam.lengthSq() < 1) sideCam.copy(target).add(new T.Vector3(-7, 5.5, 8));
        camera.position.copy(sideCam);
        camera.lookAt(target);
      }
      hands = Math.max(0, hands - dt * 1.5);
      tick += dt;
      if (tick > 0.2 && t < dur) {
        tick = 0;
        if (s < curve.crestS) o.sound.play('chain');
        else if (sp > 4) o.sound.play('wind', 120 + sp * 45);
      }
      if (t >= dur && endAt < 0) {
        endAt = time;
        o.sound.play('fanfare');
      }
      if (endAt >= 0 && time - endAt > 1.6 && endAt !== Infinity) {
        endAt = Infinity;
        o.onRideEnd();
      }
      // the balloons bob a little
      if (!reduced && balloons.length) {
        const dummy = new T.Object3D();
        balloons.forEach((b, i) => {
          if (!alive[i]) return;
          dummy.position.set(b.x, b.y + Math.sin(time * 1.6 + i) * 0.08, b.z);
          dummy.scale.set(1, 1.18, 1);
          dummy.updateMatrix();
          balloonMesh.setMatrixAt(i, dummy.matrix);
        });
        balloonMesh.instanceMatrix.needsUpdate = true;
      }
    } else {
      // building: the camera eases to where the finger put it
      if (homing) goal = fit();
      const k = 1 - Math.exp(-dt * (reduced ? 40 : 14));
      cam = { x: cam.x + (goal.x - cam.x) * k, z: cam.z + (goal.z - cam.z) * k, dist: cam.dist + (goal.dist - cam.dist) * k };
      camera.fov = 46;
      camera.updateProjectionMatrix();
      camera.up.set(0, 1, 0);
      camera.position.set(cam.x, Math.sin(PITCH) * cam.dist, cam.z + Math.cos(PITCH) * cam.dist);
      lookAt.set(cam.x, 0, cam.z);
      camera.lookAt(lookAt);
      cockpit.visible = false;
      train.cars[0].visible = true;
      train.riders[0].visible = true;
      // the train waits in the station, and moves a little (a hop) when it is just alive
      placeTrain(1.2);
    }
    // confetti of a popped balloon
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.life -= dt;
      b.v.y -= 9 * dt;
      b.p.addScaledVector(b.v, dt);
      if (b.life <= 0) bits.splice(i, 1);
    }
    parts.count = Math.min(80, bits.length);
    bits.slice(0, 80).forEach((b, i) => {
      m4.compose(b.p, new T.Quaternion(), new T.Vector3(1, 1, 1).multiplyScalar(Math.max(0.1, b.life)));
      parts.setMatrixAt(i, m4);
      parts.setColorAt(i, b.c);
    });
    parts.instanceMatrix.needsUpdate = true;
    if (parts.instanceColor) parts.instanceColor.needsUpdate = true;
    void time;
  }

  const stage: StageScene = {
    scene,
    camera,
    update,
    resize(w, h) {
      width = w;
      height = h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (!down && !riding) {
        cam = fit();
        goal = { ...cam };
      }
    },
    dispose() {
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerup', onUp);
      host.removeEventListener('pointercancel', onUp);
      clear(staticG);
      clear(lastG);
      clear(ghostG);
      disposeTree(scene);
      owned.forEach((d) => d.dispose());
    },
  };
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  cam = fit();
  goal = { ...cam };
  placeTrain(1.2);
  const api: ParkScene = {
    setTrack,
    setGhost,
    setColor(c) {
      matRails.color.set(c);
    },
    startRide,
    setView: (v) => void (view = v),
    stopRide,
    home: () => void (homing = true),
    endScreen() {
      const w = walk(track);
      const p = worldOf(w.end);
      const s = proj(p[0], p[1] + 1.2, p[2]);
      return s.z > 1 || s.z < -1 ? null : { x: s.x, y: s.y };
    },
    get riding() {
      return riding;
    },
    get ride() {
      return ride;
    },
    info: () => ({ calls: env.renderer.info.render.calls, balloons: balloons.length, popped, view }),
    dispose: () => {},
    handle: undefined as unknown as SceneHandle,
    seek: (x) => void (t = Math.min(dur, Math.max(0, x))),
    camState: () => cam,
    setCam: (x, z, d) => void (goal = clampCam({ x, z, dist: d })),
  };
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__park3d = { api, camera, balloons: () => balloons, pop: (i: number) => popBalloon(i), proj, placeTrain, get curve() { return curve; } };
  void Y0;
  void wrap;
  return { scene: stage, api };
}
