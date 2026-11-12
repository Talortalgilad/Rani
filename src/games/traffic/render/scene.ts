import * as T from '../../../lobby3d/lib';
import { Spring } from '../../../lobby3d/motion';
import { setSky, disposeTree, type SceneEnv, type StageScene } from '../../../lobby3d/stage';
import type { Tier } from '../../../lobby3d/quality';
import { corners, rad } from '../engine/geometry';
import { BELT_PITCH, BELT_WIDTH, REGULAR_SLOTS, SIZES, TURNTABLE, type BeltDef, type ColorId, type VehicleDef } from '../engine/state';
import { Timeline, easeInOutCubic, easeOutBack, easeOutQuad } from './animations';
import { buildWorld, type WorldKind } from './dioramas';
import { frameCamera, nearestVehicle, type HitShape, type SafeArea } from './framing';
import { Fx } from './fx';
import { COLOR_HEX, COLOR_SHAPE, shapePoints } from './palette';
import { BLACK_HEX, makeVehicle, PASSENGER_SCALE, passengerGeometry, plasticMaterial, roofY, stickerGeometry, vehicleGeometry } from './toykit';

const SPACING = 0.46;
/** Camera angle above the floor. */
export const CAMERA_ELEVATION = 48;
/** How long a press on a vehicle that turns must last to send it. */
export const LONG_PRESS_MS = 450;
const SEE_AHEAD = 30; // passengers farther back than this wait out of sight, inside the cabana

interface Lot { halfW: number; halfH: number }
export interface SyncState {
  vehicles: { id: number; status: string; slot: number | null; color: ColorId; filled: number; revealed: boolean; x: number; z: number; heading: number }[];
  boarded: number;
  queue: ColorId[];
  slots: number;
}

export interface LevelView { vehicles: VehicleDef[]; queue: ColorId[]; lot: Lot; world: WorldKind; belts?: BeltDef[] }

interface VehicleView {
  def: VehicleDef;
  root: T.Group;
  mesh: T.Mesh;
  /** station place (0..3) while parked in the station */
  slot: number | null;
  badge: T.Sprite | null;
  hop: Spring;
  pitch: Spring;
  squash: Spring;
  jitter: { x: number; z: number; until: number };
  q: T.Mesh | null;
}

interface PassengerView {
  color: ColorId;
  inst: number; // the passenger's number in the queue (its shadow instance); the figure itself uses a ring slot
  on?: boolean;
  stick: { mesh: T.InstancedMesh; idx: number };
  s: number;
  target: number;
  delay: number;
  hop: number; // 0..1 while stepping forward
  flight: { t: number; dur: number; from: T.Vector3; to: T.Vector3; done: () => void } | null;
  gone: boolean;
}

const rbox = (w: number, h: number, d: number, r: number, seg = 1) => new T.RoundedBoxGeometry(w, h, d, seg, r);

function blobTexture(): T.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(55,30,8,0.8)');
  grad.addColorStop(0.5, 'rgba(55,30,8,0.5)');
  grad.addColorStop(1, 'rgba(55,30,8,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new T.CanvasTexture(c);
}

/** A soft dark rounded rectangle: the contact shadow of a vehicle (its core is about 72% of the square). */
function rectShadowTexture(): T.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.shadowColor = 'rgba(45,24,6,0.95)';
  g.shadowBlur = 16;
  g.fillStyle = 'rgba(45,24,6,0.88)';
  g.beginPath();
  g.roundRect(18, 18, 92, 92, 22);
  g.fill();
  return new T.CanvasTexture(c);
}

function glyphTexture(draw: (g: CanvasRenderingContext2D) => void, w = 128, h = 256): T.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

const badgeCache = new Map<string, T.CanvasTexture>();
/** "3 seats left" badge with the colour's shape sticker: the maths of the game, in the game. */
function badgeTexture(color: ColorId, n: number): T.CanvasTexture {
  const key = `${color}${n}`;
  let t = badgeCache.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = 192;
    c.height = 96;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(30,25,45,0.9)';
    g.beginPath();
    g.roundRect(4, 8, 184, 80, 40);
    g.fill();
    g.fillStyle = COLOR_HEX[color];
    g.beginPath();
    g.roundRect(10, 14, 172, 68, 34);
    g.fill();
    // the shape sticker
    g.fillStyle = '#fff';
    g.beginPath();
    shapePoints(COLOR_SHAPE[color]).forEach(([x, y], i) => (i ? g.lineTo(52 + x * 40, 48 - y * 40) : g.moveTo(52 + x * 40, 48 - y * 40)));
    g.closePath();
    g.fill();
    g.fillStyle = '#fff';
    g.strokeStyle = '#2a2640';
    g.lineWidth = 7;
    g.font = '700 54px Fredoka, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.strokeText(String(n), 126, 50);
    g.fillText(String(n), 126, 50);
    t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    badgeCache.set(key, t);
  }
  return t;
}

export interface TrafficScene extends StageScene {
  onTapVehicle: ((id: number, long: boolean) => void) | null;
  timeline: Timeline;
  fx: Fx;
  /** reduced motion: everything jumps to its end */
  reduced: boolean;
  queueLeft(): number;
  startExit(id: number, slot: number, arrived: () => void): void;
  bonk(id: number, byId: number, distance: number, hit: () => void): void;
  shake(id: number): void;
  reveal(id: number, color: ColorId): void;
  boardPassenger(vehicleId: number, color: ColorId, landed: () => void): void;
  setSeatsLeft(vehicleId: number, color: ColorId, n: number): void;
  depart(vehicleId: number, gone: () => void): void;
  celebrate(): void;
  stuck(on: boolean): void;
  vehiclePosition(id: number): T.Vector3;
  /** for screenshots and measuring */
  focusOn(id: number | null, zoom?: number): void;
  /** where a vehicle is on the screen (CSS pixels): for the pointing hand of the tutorial */
  screenPos(id: number): { x: number; y: number };
  /**
   * Puts the whole scene into the state of the game (a saved game, an undo, a shuffle): every vehicle where it belongs, the
   * passengers that have boarded gone and the rest in the order of the queue. Nothing may be on the road.
   */
  sync(state: SyncState): void;
  /** opens or closes places in the station (the station is drawn again, and the vehicles in it move over) */
  setSlots(n: number): void;
  /** "VIP": the vehicle flies to the VIP place */
  startVip(id: number, arrived: () => void): void;
  /** while a vehicle is to be picked, the parked ones bob a little */
  setPickMode(on: boolean): void;
  /** a vehicle that turns on the spot turns to a heading (degrees) */
  rotateTo(id: number, heading: number): void;
  /** a car on a conveyor belt moves up to its new place */
  shiftOnBelt(id: number, x: number, z: number): void;
}

export function createTrafficScene(env: SceneEnv, level: LevelView, tier: Exclude<Tier, '2d'>, getSafe?: () => SafeArea): TrafficScene {
  const { renderer } = env;
  const reduced = env.reduced;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(30, env.width / env.height, 1, 260);
  let width = env.width;
  let height = env.height;

  // ---- the layout depends on the lot: the station sits right above it, and its width follows the width on screen
  const fitHalf = Math.max(level.lot.halfW + 0.6, 3.7);
  const pads0 = fitHalf >= 5.7 ? 8 : 5;
  /** how many regular places are open (the helper "extra place" opens more) */
  let slotsOpen = REGULAR_SLOTS;
  let pads = pads0;
  let pitch = Math.min(1.42, (fitHalf * 2 * 0.95) / pads);
  let kPitch = pitch / 1.42;
  const slotX = (i: number): number => (i - (pads - 1) / 2) * pitch;
  const STATION_Z = -(level.lot.halfH + 1.75);
  const dzN = STATION_Z + 8.15; // the diorama is drawn for a station at -8.15
  const queueHalf = Math.max(3.3, fitHalf * 0.82);

  // ---- rendering: filmic tone mapping and a warm studio environment for the reflections on the plastic
  renderer.toneMapping = T.NeutralToneMapping; // keeps the colours as saturated as they are painted
  renderer.toneMappingExposure = 0.95;
  const pmrem = new T.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new T.RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = envTexture;
  scene.environmentIntensity = 0.5;
  const diorama = buildWorld(level.world, queueHalf);
  diorama.group.position.z = dzN;
  const theme = diorama.theme;
  setSky(theme.skyTop, theme.skyBottom);

  const hemi = new T.HemisphereLight('#fff1d2', theme.ground, 0.42);
  const sun = new T.DirectionalLight('#fff4de', 3.3);
  sun.position.set(-10, 20, -3); // high and a little from behind: bright roofs, darker sides
  sun.target.position.set(0, 0, -4);
  sun.castShadow = tier === 'high';
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 19, bottom: -19, near: 4, far: 60 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 4;
  sun.shadow.intensity = 0.8; // soft, not black: the sand stays warm in the shade
  scene.add(hemi, sun, sun.target);

  const own: { dispose(): void }[] = [];
  const keep = <A extends { dispose(): void }>(x: A): A => {
    own.push(x);
    return x;
  };

  // ---- ground: sand, the parking pad, the station platform
  const northZ = theme.groundNorth + dzN;
  const ground = new T.Mesh(keep(new T.PlaneGeometry(120, 36 - northZ)), keep(new T.MeshStandardMaterial({ color: theme.ground, roughness: 0.95 })));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = (northZ + 36) / 2; // the ground stops at the shore or the road; what lies beyond is part of the diorama
  ground.receiveShadow = true;
  scene.add(ground);
  // the parking pad: lighter than the sand, rounded corners, and a fine darker line around it
  const padW = level.lot.halfW * 2 + 0.9;
  const padD = level.lot.halfH * 2 + 0.9;
  const edge = new T.Mesh(keep(rbox(padW + 0.3, 0.06, padD + 0.3, 0.85, 4)), keep(new T.MeshStandardMaterial({ color: theme.padEdge, roughness: 0.9 })));
  edge.position.y = 0.0;
  edge.receiveShadow = true;
  scene.add(edge);
  const pad = new T.Mesh(keep(rbox(padW, 0.1, padD, 0.75, 4)), keep(new T.MeshStandardMaterial({ color: theme.pad, roughness: 0.9 })));
  pad.position.y = 0.0;
  pad.receiveShadow = true;
  scene.add(pad);
  // station places: sunk pads with a "P", a golden VIP place, and three locked ones
  const texP = keep(glyphTexture((g) => {
    g.fillStyle = 'rgba(255,244,214,0.95)';
    g.font = '700 150px Fredoka, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('P', 64, 128);
  }));
  const texVip = keep(glyphTexture((g) => {
    g.fillStyle = '#fff3b0';
    g.font = '700 64px Fredoka, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.save();
    g.translate(64, 128);
    g.fillText('VIP', 0, 0);
    g.restore();
  }));
  const texPlus = keep(glyphTexture((g) => {
    g.strokeStyle = 'rgba(255,244,214,0.95)';
    g.lineWidth = 14;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(64, 98);
    g.lineTo(64, 158);
    g.moveTo(34, 128);
    g.lineTo(94, 128);
    g.stroke();
  }));
  // the station: a platform and the places on it. It is built again when a place is added.
  const stationGroup = new T.Group();
  scene.add(stationGroup);
  const stationOwn: { dispose(): void }[] = [];
  const stationKeep = <A extends { dispose(): void }>(x: A): A => {
    stationOwn.push(x);
    return x;
  };
  function buildStation(): void {
    stationGroup.clear();
    stationOwn.forEach((o) => o.dispose());
    stationOwn.length = 0;
    const platform = new T.Mesh(stationKeep(rbox(pads * pitch + 0.6, 0.1, 3.3, 0.45)), stationKeep(new T.MeshStandardMaterial({ color: theme.platform, roughness: 0.9 })));
    platform.position.set(0, 0.0, STATION_Z - 0.05);
    platform.receiveShadow = true;
    stationGroup.add(platform);
    const padGeo = stationKeep(rbox(pitch - 0.22, 0.08, 2.25, 0.2));
    for (let i = 0; i < pads; i++) {
      // 0 = the VIP place, then the open places, then the ones that are still locked
      const kind = i === 0 ? 'vip' : i <= slotsOpen ? 'p' : 'locked';
      const color = kind === 'vip' ? theme.padVip : kind === 'p' ? theme.padP : theme.padLocked;
      const m = new T.Mesh(padGeo, stationKeep(new T.MeshStandardMaterial({ color, roughness: 0.85 })));
      m.position.set(slotX(i), 0.02, STATION_Z);
      m.receiveShadow = true;
      stationGroup.add(m);
      const glyph = new T.Mesh(stationKeep(new T.PlaneGeometry(Math.min(0.95, pitch - 0.4), 1.9)), stationKeep(new T.MeshBasicMaterial({ map: kind === 'vip' ? texVip : kind === 'p' ? texP : texPlus, transparent: true })));
      glyph.rotation.x = -Math.PI / 2;
      glyph.position.set(slotX(i), 0.07, STATION_Z);
      stationGroup.add(glyph);
    }
  }
  buildStation();

  scene.add(diorama.group);

  // ---- vehicles
  const lowDetail = level.vehicles.length > 28;
  const views = new Map<number, VehicleView>();
  const qTexture = keep(glyphTexture((g) => {
    g.fillStyle = '#ffffff';
    g.font = '800 200px Fredoka, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('?', 128, 134);
  }, 256, 256));
  const qGeo = keep(new T.PlaneGeometry(1, 1));
  const qMat = keep(new T.MeshBasicMaterial({ map: qTexture, transparent: true }));
  for (const def of level.vehicles) {
    const root = new T.Group();
    const mesh = makeVehicle(def.type, def.hidden ? null : def.color, lowDetail);
    mesh.userData.index = def.id;
    mesh.castShadow = sun.castShadow;
    root.add(mesh);
    let q: T.Mesh | null = null;
    if (def.hidden) {
      q = new T.Mesh(qGeo, qMat);
      q.rotation.x = -Math.PI / 2;
      q.rotation.z = Math.PI / 2;
      const sz = def.type === 'bus' ? 1.1 : 0.78;
      q.scale.set(sz, sz, 1);
      q.position.set(0, roofY(def.type) + 0.03, 0);
      root.add(q);
    }
    root.position.set(def.x, 0, def.z);
    root.rotation.y = -rad(def.heading);
    scene.add(root);
    views.set(def.id, { def, root, mesh, slot: null, badge: null, hop: new Spring(0, 160, 10), pitch: new Spring(0, 220, 9), squash: new Spring(0, 260, 14), jitter: { x: 0, z: 0, until: 0 }, q });
  }

  // ---- the turntables under the vehicles that turn, and the conveyor belts
  const beltTextures: T.CanvasTexture[] = [];
  const turnTex = keep(glyphTexture((g) => {
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 12;
    g.lineCap = 'round';
    for (const a0 of [0.3, Math.PI + 0.3]) {
      g.beginPath();
      g.arc(128, 128, 84, a0, a0 + 2.2);
      g.stroke();
      const ex = 128 + Math.cos(a0 + 2.2) * 84;
      const ey = 128 + Math.sin(a0 + 2.2) * 84;
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      g.moveTo(ex + Math.cos(a0 + 2.2 + 1.57) * 22, ey + Math.sin(a0 + 2.2 + 1.57) * 22);
      g.lineTo(ex + Math.cos(a0 + 2.2 + 3.1) * 30, ey + Math.sin(a0 + 2.2 + 3.1) * 30);
      g.lineTo(ex + Math.cos(a0 + 2.2 - 1.57) * 22, ey + Math.sin(a0 + 2.2 - 1.57) * 22);
      g.fill();
    }
  }, 256, 256));
  const diskGeo = keep(new T.CylinderGeometry(TURNTABLE / 2 * 0.98, TURNTABLE / 2 * 0.98, 0.07, 32));
  const diskMat = keep(new T.MeshStandardMaterial({ color: '#3b4160', roughness: 0.6 }));
  const ringGeo = keep(new T.TorusGeometry(TURNTABLE / 2 * 0.98, 0.07, 6, 40));
  const ringMat = keep(new T.MeshStandardMaterial({ color: '#ffd02b', roughness: 0.5 }));
  const iconGeo = keep(new T.PlaneGeometry(TURNTABLE * 0.95, TURNTABLE * 0.95));
  const iconMat = keep(new T.MeshBasicMaterial({ map: turnTex, transparent: true, depthWrite: false }));
  for (const def of level.vehicles) {
    if (!def.rotator) continue;
    const disk = new T.Mesh(diskGeo, diskMat);
    disk.position.set(def.x, 0.065, def.z);
    disk.receiveShadow = true;
    const ring = new T.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(def.x, 0.1, def.z);
    const icon = new T.Mesh(iconGeo, iconMat);
    icon.rotation.x = -Math.PI / 2;
    icon.position.set(def.x, 0.108, def.z);
    scene.add(disk, ring, icon);
  }
  const beltGeoBase = keep(new T.BoxGeometry(1, 0.06, 1));
  const beltMat = keep(new T.MeshStandardMaterial({ color: '#363a4c', roughness: 0.7 }));
  for (const belt of level.belts ?? []) {
    const len = (belt.slots.length - 1) * BELT_PITCH + SIZES.car.len;
    const cx = belt.slots.reduce((a, p) => a + p[0], 0) / belt.slots.length;
    const cz = belt.slots.reduce((a, p) => a + p[1], 0) / belt.slots.length;
    const grp = new T.Group();
    grp.position.set(cx, 0.06, cz);
    grp.rotation.y = -rad(belt.heading);
    const base = new T.Mesh(beltGeoBase, beltMat);
    base.scale.set(len + 0.25, 1, BELT_WIDTH + 0.14);
    base.receiveShadow = true;
    const tex = glyphTexture((g) => {
      g.fillStyle = '#4a4f66';
      g.fillRect(0, 0, 128, 128);
      g.strokeStyle = '#ffd02b';
      g.lineWidth = 12;
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(20, 20);
      g.lineTo(70, 64);
      g.lineTo(20, 108);
      g.stroke();
    }, 128, 128);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(len / 1.0, 1);
    beltTextures.push(tex);
    own.push(tex);
    const stripe = new T.Mesh(keep(new T.PlaneGeometry(len, BELT_WIDTH)), keep(new T.MeshBasicMaterial({ map: tex })));
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.y = 0.034;
    grp.add(base, stripe);
    scene.add(grp);
  }

  // contact shadows: one InstancedMesh for all vehicles, one for passengers
  const blob = keep(blobTexture());
  const blobMat = keep(new T.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false }));
  const blobGeo = keep(new T.PlaneGeometry(1, 1));
  blobGeo.rotateX(-Math.PI / 2);
  const rectMat = keep(new T.MeshBasicMaterial({ map: keep(rectShadowTexture()), transparent: true, depthWrite: false }));
  const vShadow = new T.InstancedMesh(blobGeo, rectMat, level.vehicles.length);
  vShadow.frustumCulled = false;
  vShadow.renderOrder = 1;
  scene.add(vShadow);

  // ---- passengers: ONE InstancedMesh tinted per instance, plus one sticker InstancedMesh per colour
  const nPass = level.queue.length;
  const pGeo = keep(passengerGeometry());
  const pMat = keep(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, envMapIntensity: 0.7 }));
  // only the passengers you can see get a figure: a ring of slots, so the triangle count stays small
  const SLOTS = SEE_AHEAD + 10;
  const slotOwner: number[] = Array(SLOTS).fill(-1);
  const pMesh = new T.InstancedMesh(pGeo, pMat, Math.min(SLOTS, nPass));
  pMesh.castShadow = false; // the contact shadow is enough for them, and the shadow pass stays cheap
  pMesh.frustumCulled = false;
  scene.add(pMesh);
  const stickMat = keep(new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, envMapIntensity: 0.5 }));
  const colorsUsed = [...new Set(level.queue)];
  const stickMeshes = new Map<ColorId, T.InstancedMesh>();
  for (const c of colorsUsed) {
    const m = new T.InstancedMesh(keep(stickerGeometry(COLOR_SHAPE[c])), stickMat, level.queue.filter((x) => x === c).length);
    m.frustumCulled = false;
    scene.add(m);
    stickMeshes.set(c, m);
  }
  const pShadow = new T.InstancedMesh(blobGeo, blobMat, nPass);
  pShadow.frustumCulled = false;
  pShadow.renderOrder = 1;
  scene.add(pShadow);

  const tmpColor = new T.Color();
  const stickCount = new Map<ColorId, number>();
  const passengers: PassengerView[] = level.queue.map((color, i) => {
    const idx = stickCount.get(color) ?? 0;
    stickCount.set(color, idx + 1);
    return { color, inst: i, stick: { mesh: stickMeshes.get(color)!, idx }, s: i * SPACING, target: i * SPACING, delay: 0, hop: 0, flight: null, gone: false };
  });
  pMesh.setColorAt(0, tmpColor.set('#ffffff'));
  {
    const hide = new T.Object3D();
    hide.scale.setScalar(0);
    hide.updateMatrix();
    for (let i = 0; i < pMesh.count; i++) pMesh.setMatrixAt(i, hide.matrix); // unused slots stay invisible
  }
  const waiting: PassengerView[] = [...passengers];

  // ---- fx, timeline, interaction
  const fx = new Fx(tier);
  scene.add(fx.group);
  const timeline = new Timeline();
  const dummy = new T.Object3D();
  const v3 = new T.Vector3();
  let focus: { id: number | null; zoom: number } = { id: null, zoom: 1 };
  let time = 0;
  let stuckOn = false;

  function layout(): void {
    const aspect = width / height;
    camera.aspect = aspect;
    camera.fov = 30;
    camera.updateProjectionMatrix();
    // the whole lot and the station are visible between the title and the helper buttons; the lot fills the width when the height allows
    const safe = getSafe?.() ?? { top: 100, bottom: height - 120 };
    const fr = frameCamera({ width, height, fov: camera.fov, elevation: CAMERA_ELEVATION, lot: level.lot, stationZ: STATION_Z, stationHalfW: (pads * pitch) / 2 + 0.3, safe, marginX: 0.02 });
    const el = (CAMERA_ELEVATION * Math.PI) / 180;
    const dist = fr.dist;
    const tz = fr.tz;
    camera.position.set(0, Math.sin(el) * dist, tz + Math.cos(el) * dist);
    camera.lookAt(0, 0, tz);
    if (focus.id !== null) {
      const v = views.get(focus.id)!;
      const d = dist / focus.zoom;
      camera.position.set(v.root.position.x, Math.sin(el) * d, v.root.position.z + Math.cos(el) * d);
      camera.lookAt(v.root.position.x, 0.4, v.root.position.z);
    }
  }
  layout();

  const canvas = env.canvas;
  let downAt: { x: number; y: number; t: number } | null = null;
  /** The outlines of the vehicles that can be tapped, on the screen (CSS pixels, from the top-left of the canvas). */
  const hitShapes = (): HitShape[] => {
    const rect = canvas.getBoundingClientRect();
    const out: HitShape[] = [];
    const p = new T.Vector3();
    camera.updateMatrixWorld();
    for (const v of views.values()) {
      if (!v.root.visible || v.slot !== null) continue;
      v.root.updateMatrixWorld(true);
      const g = v.mesh.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      const bb = g.boundingBox!;
      const pts: { x: number; y: number }[] = [];
      for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
        p.set(x, y, z).applyMatrix4(v.mesh.matrixWorld).project(camera);
        pts.push({ x: ((p.x + 1) / 2) * rect.width, y: ((1 - p.y) / 2) * rect.height });
      }
      out.push({ id: v.def.id, pts });
    }
    return out;
  };
  const pick = (e: PointerEvent): number | null => {
    const rect = canvas.getBoundingClientRect();
    return nearestVehicle(hitShapes(), e.clientX - rect.left, e.clientY - rect.top);
  };
  let held: { id: number | null; timer: number; fired: boolean } | null = null;
  const onDown = (e: PointerEvent) => {
    downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    // a vehicle that turns on the spot: a long press sends it, a short one turns it
    const id = pick(e);
    const v = id !== null ? views.get(id) : null;
    held = { id, timer: 0, fired: false };
    if (v?.def.rotator) {
      const h = held;
      h.timer = window.setTimeout(() => {
        if (held !== h || !downAt) return;
        h.fired = true;
        api.onTapVehicle?.(id!, true);
      }, LONG_PRESS_MS);
    }
  };
  const onUp = (e: PointerEvent) => {
    const h = held;
    held = null;
    if (h) window.clearTimeout(h.timer);
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    downAt = null;
    if (h?.fired) return;
    if (moved > 14 || !api.onTapVehicle) return;
    const id = pick(e);
    if (id !== null) api.onTapVehicle(id, false);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);

  // ---- helpers for motion
  const stationScale = (t: VehicleDef['type']) => (t === 'car' ? 0.98 : t === 'van' ? 0.7 : 0.53) * kPitch;

  /** Where a vehicle is now and which way it faces (a belt car has moved up, a vehicle that turns has turned). */
  const nowOf = (v: VehicleView) => ({ x: v.root.position.x, z: v.root.position.z, heading: ((((-v.root.rotation.y * 180) / Math.PI) % 360) + 360) % 360 });

  function exitCurve(v: VehicleView, slot: number): T.CatmullRomCurve3 {
    const def = { ...v.def, ...nowOf(v) };
    const u = { x: Math.cos(rad(def.heading)), z: Math.sin(rad(def.heading)) };
    // drive straight until the whole vehicle is outside the lot
    const box = { x: def.x, z: def.z, hl: SIZES[def.type].len / 2, hw: SIZES[def.type].wid / 2, heading: def.heading };
    let d = 0;
    while (d < 40 && corners({ ...box, x: def.x + u.x * d, z: def.z + u.z * d }).some((p) => Math.abs(p.x) < level.lot.halfW + 0.2 && Math.abs(p.z) < level.lot.halfH + 0.2)) d += 0.1;
    const p1 = { x: def.x + u.x * (d + 0.4), z: def.z + u.z * (d + 0.4) };
    const sx = slotX(slot + 1);
    const side = p1.x >= 0 ? 1 : -1;
    const pts: [number, number][] = [[def.x, def.z], [def.x + u.x * (d * 0.5), def.z + u.z * (d * 0.5)], [p1.x, p1.z]];
    const towardStation = u.z < -0.5 && Math.abs(p1.x) < level.lot.halfW;
    if (!towardStation) {
      // round the outside of the lot: out to the side road, up it, and across to the station
      const rx = side * (level.lot.halfW + 1.5);
      if (p1.z > level.lot.halfH - 0.1) pts.push([p1.x + side * 0.6, p1.z + 1.2], [rx, level.lot.halfH + 0.2]);
      else pts.push([rx, p1.z]);
      pts.push([rx, -level.lot.halfH + 0.4]);
    }
    pts.push([sx, STATION_Z + 3.6], [sx, STATION_Z + 1.4], [sx, STATION_Z]);
    return new T.CatmullRomCurve3(pts.map(([x, z]) => new T.Vector3(x, 0, z)), false, 'centripetal');
  }

  /** Drives a vehicle along a curve with acceleration, cruising and braking. */
  function drive(v: VehicleView, curve: T.CatmullRomCurve3, opts: { vmax: number; brake: number; scaleTo?: number; done: () => void; dust?: boolean }): void {
    const L = curve.getLength();
    let s = 0;
    let vel = 0;
    const startScale = v.root.scale.x;
    timeline.add((dt) => {
      if (reduced) s = L;
      vel = Math.min(vel + 15 * dt, opts.vmax, Math.sqrt(2 * opts.brake * Math.max(0.002, L - s)) + 0.35);
      s = Math.min(L, s + vel * dt);
      const u = s / L;
      curve.getPointAt(u, v3);
      const tan = curve.getTangentAt(Math.min(0.999, u));
      v.root.position.set(v3.x, v.hop.value, v3.z);
      v.root.rotation.y = Math.atan2(-tan.z, tan.x);
      if (opts.scaleTo !== undefined) v.root.scale.setScalar(startScale + (opts.scaleTo - startScale) * easeInOutCubic(Math.max(0, (u - 0.62) / 0.38)));
      if (opts.dust && vel > 1.5 && Math.random() < 0.5 && !reduced) fx.puff(v3.x - tan.x * 1.1, v3.z - tan.z * 1.1);
      if (s >= L - 0.001) {
        opts.done();
        return true;
      }
      return false;
    });
  }

  let pickMode = false;
  /** the "?" look (black with a question mark) until the vehicle is uncovered, then its colour and its arrow */
  function applyLook(v: VehicleView, revealed: boolean): void {
    if (!v.def.hidden) return;
    const geo = vehicleGeometry(v.def.type, revealed ? COLOR_HEX[v.def.color] : BLACK_HEX, lowDetail);
    if (v.mesh.geometry !== geo) v.mesh.geometry = geo;
    if (v.q) v.q.visible = !revealed;
  }

  const api: TrafficScene = {
    scene,
    camera,
    onTapVehicle: null,
    timeline,
    fx,
    reduced,
    queueLeft: () => waiting.length,

    startExit(id, slot, arrived) {
      const v = views.get(id)!;
      v.squash.value = 0;
      // squash 90 ms, then away
      timeline.tween(reduced ? 0.01 : 0.09, (t) => v.root.scale.set(1, 1 - 0.1 * Math.sin(t * Math.PI), 1), () => {
        v.root.scale.set(1, 1, 1);
        const curve = exitCurve(v, slot);
        drive(v, curve, {
          vmax: 8.5, brake: 14, scaleTo: stationScale(v.def.type), dust: true,
          done: () => {
            v.slot = slot;
            v.root.position.set(slotX(slot + 1), 0, STATION_Z);
            v.root.rotation.y = -rad(270);
            // rock back and forth on its springs
            v.pitch.value = reduced ? 0 : 0.12;
            v.pitch.velocity = 0;
            arrived();
          },
        });
      });
    },

    bonk(id, byId, distance, hit) {
      const v = views.get(id)!;
      const other = views.get(byId)!;
      const now = nowOf(v);
      const u = { x: Math.cos(rad(now.heading)), z: Math.sin(rad(now.heading)) };
      const d = Math.max(0.05, distance);
      let s = 0;
      let vel = 0;
      let phase: 'out' | 'back' = 'out';
      const home = { x: now.x, z: now.z };
      timeline.add((dt) => {
        if (phase === 'out') {
          vel = Math.min(vel + 24 * dt, 6);
          s = Math.min(d, s + vel * dt);
          if (s >= d - 0.001) {
            phase = 'back';
            hit();
            if (!reduced) {
              v.jitter = { x: 0, z: 0, until: time + 0.4 };
              other.jitter = { x: 0, z: 0, until: time + 0.4 };
              fx.puff(home.x + u.x * (d + 0.9), home.z + u.z * (d + 0.9), 3);
            }
            vel = 0;
          }
        } else {
          vel = Math.min(vel + 14 * dt, 4);
          s = Math.max(0, s - vel * dt);
          if (s <= 0.001) {
            v.root.position.set(home.x, 0, home.z);
            return true;
          }
        }
        v.root.position.set(home.x + u.x * s, 0, home.z + u.z * s);
        return false;
      });
    },

    shake(id) {
      const v = views.get(id)!;
      if (!reduced) v.jitter = { x: 0, z: 0, until: time + 0.3 };
    },

    reveal(id, color) {
      const v = views.get(id)!;
      const hex = COLOR_HEX[color];
      timeline.tween(reduced ? 0.01 : 0.55, (t) => {
        v.root.rotation.y = -rad(v.def.heading) + easeOutQuad(t) * Math.PI * 2;
        if (t > 0.5 && v.mesh.geometry !== vehicleGeometry(v.def.type, hex, lowDetail)) {
          v.mesh.geometry = vehicleGeometry(v.def.type, hex, lowDetail);
          if (v.q) v.q.visible = false;
          fx.sparkle(v.root.position.x, 0.9, v.root.position.z, 8);
        }
      }, () => {
        v.root.rotation.y = -rad(v.def.heading);
      });
    },

    boardPassenger(vehicleId, color, landed) {
      const p = waiting.shift();
      if (!p || p.color !== color) throw new Error('the queue and the rules disagree');
      const v = views.get(vehicleId)!;
      curveAt(p.s, v3);
      const from = v3.clone().setY(0.4);
      const to = new T.Vector3(v.root.position.x, 0.75, v.root.position.z);
      p.flight = {
        t: 0, dur: reduced ? 0.01 : 0.42, from, to,
        done: () => {
          p.gone = true;
          p.flight = null;
          v.squash.value = reduced ? 0 : -0.16; // the vehicle swallows the passenger with a little squash
          v.squash.velocity = 0;
          fx.sparkle(to.x, 1.0, to.z, 4, [COLOR_HEX[color], '#ffffff']);
          landed();
        },
      };
      // everyone behind steps forward, one after another, with a hop
      waiting.forEach((q, i) => {
        q.target -= SPACING;
        q.delay = reduced ? 0 : Math.min(0.22, i * 0.012);
        q.hop = 0;
      });
    },

    setSeatsLeft(vehicleId, color, n) {
      const v = views.get(vehicleId)!;
      if (v.badge) {
        scene.remove(v.badge);
        (v.badge.material as T.SpriteMaterial).dispose();
        v.badge = null;
      }
      if (n <= 0) return;
      const sp = new T.Sprite(new T.SpriteMaterial({ map: badgeTexture(color, n), depthWrite: false, transparent: true }));
      sp.scale.set(1.2, 0.6, 1);
      sp.position.set(slotX((v.slot ?? 0) + 1), 1.75, STATION_Z + 0.2);
      sp.renderOrder = 5;
      scene.add(sp);
      v.badge = sp;
    },

    depart(vehicleId, gone) {
      const v = views.get(vehicleId)!;
      if (v.badge) {
        scene.remove(v.badge);
        (v.badge.material as T.SpriteMaterial).dispose();
        v.badge = null;
      }
      // a little hop for the honk, then off the top of the screen
      v.hop.value = reduced ? 0 : 0.05;
      v.hop.velocity = reduced ? 0 : 3.6;
      timeline.after(reduced ? 0.01 : 0.38, () => {
        const sx = v.root.position.x;
        const curve = new T.CatmullRomCurve3([new T.Vector3(sx, 0, STATION_Z), new T.Vector3(sx, 0, STATION_Z - 5), new T.Vector3(sx + 0.3, 0, STATION_Z - 14)]);
        drive(v, curve, { vmax: 9, brake: 1, done: () => { v.root.visible = false; gone(); } });
      });
    },

    celebrate() {
      if (reduced) return;
      for (let i = 0; i < 9; i++) {
        timeline.after(i * 0.42, () => fx.firework((Math.random() - 0.5) * fitHalf * 1.8, 6 + Math.random() * 3, STATION_Z - 5 - Math.random() * 3));
      }
    },

    stuck(on) {
      stuckOn = on;
    },

    vehiclePosition: (id) => views.get(id)!.root.position.clone(),

    screenPos(id) {
      const p = views.get(id)!.root.position.clone();
      p.y = 0.7;
      p.project(camera);
      return { x: ((p.x + 1) / 2) * width, y: ((1 - p.y) / 2) * height };
    },

    sync(st) {
      if (st.slots !== slotsOpen) api.setSlots(st.slots);
      for (const sv of st.vehicles) {
        const v = views.get(sv.id)!;
        const wasAway = v.slot !== null || !v.root.visible;
        applyLook(v, sv.revealed);
        if (v.badge) {
          scene.remove(v.badge);
          (v.badge.material as T.SpriteMaterial).dispose();
          v.badge = null;
        }
        v.hop.value = 0;
        v.hop.velocity = 0;
        v.pitch.value = 0;
        v.pitch.velocity = 0;
        v.squash.value = 0;
        v.mesh.position.set(0, 0, 0);
        if (sv.status === 'gone') {
          v.root.visible = false;
          v.slot = null;
        } else if (sv.status === 'station' && sv.slot !== null) {
          v.slot = sv.slot;
          v.root.visible = true;
          v.root.position.set(slotX(sv.slot + 1), 0, STATION_Z);
          v.root.rotation.set(0, -rad(270), 0);
          v.root.scale.setScalar(stationScale(v.def.type));
          api.setSeatsLeft(sv.id, sv.color, SIZES[v.def.type].seats - sv.filled);
        } else {
          // parked in the lot: back to its place (with a little pop if it came back from the station)
          v.slot = null;
          v.root.visible = true;
          v.root.position.set(sv.x, 0, sv.z);
          v.root.rotation.set(0, -rad(sv.heading), 0);
          if (wasAway && !reduced) {
            v.root.scale.setScalar(0.05);
            timeline.tween(0.4, (t) => v.root.scale.setScalar(Math.max(0.05, easeOutBack(t))), () => v.root.scale.setScalar(1));
            fx.sparkle(sv.x, 0.9, sv.z, 8);
          } else v.root.scale.setScalar(1);
        }
      }
      // passengers: the first `boarded` are gone; the others wait in the order of the queue
      waiting.length = 0;
      slotOwner.fill(-1);
      const perColor = new Map<ColorId, number>();
      passengers.forEach((p, i) => {
        p.flight = null;
        p.on = false;
        if (i < st.boarded) {
          p.gone = true;
          return;
        }
        p.gone = false;
        p.color = st.queue[i - st.boarded];
        const idx = perColor.get(p.color) ?? 0;
        perColor.set(p.color, idx + 1);
        p.stick = { mesh: stickMeshes.get(p.color)!, idx };
        p.s = p.target = (i - st.boarded) * SPACING;
        p.delay = 0;
        p.hop = 0;
        waiting.push(p);
      });
    },

    setSlots(n) {
      slotsOpen = n;
      pads = Math.max(pads0, 1 + n);
      pitch = Math.min(1.42, (fitHalf * 2 * 0.95) / pads);
      kPitch = pitch / 1.42;
      buildStation();
      for (const v of views.values()) {
        if (v.slot === null || !v.root.visible) continue;
        if (!timeline.busy) v.root.position.x = slotX(v.slot + 1);
        if (v.badge) v.badge.position.x = slotX(v.slot + 1);
      }
      layout();
    },

    startVip(id, arrived) {
      const v = views.get(id)!;
      v.slot = -1;
      const from = v.root.position.clone();
      const to = new T.Vector3(slotX(0), 0, STATION_Z);
      const startRot = v.root.rotation.y;
      const endRot = -rad(270) + Math.round((startRot + rad(270)) / (Math.PI * 2)) * Math.PI * 2;
      const s0 = v.root.scale.x;
      const s1 = stationScale(v.def.type);
      fx.sparkle(from.x, 0.9, from.z, 10, ['#ffd02b', '#ffffff']);
      timeline.tween(reduced ? 0.01 : 1.0, (t) => {
        const e = easeInOutCubic(t);
        v.root.position.set(from.x + (to.x - from.x) * e, Math.sin(Math.PI * e) * 3.4, from.z + (to.z - from.z) * e);
        v.root.rotation.y = startRot + (endRot - startRot) * e;
        v.root.scale.setScalar(s0 + (s1 - s0) * e);
      }, () => {
        v.root.position.set(to.x, 0, to.z);
        v.root.rotation.y = -rad(270);
        v.pitch.value = reduced ? 0 : 0.12;
        v.pitch.velocity = 0;
        fx.sparkle(to.x, 0.9, to.z, 12, ['#ffd02b', '#ffffff']);
        arrived();
      });
    },

    setPickMode(on) {
      pickMode = on;
    },

    rotateTo(id, heading) {
      const v = views.get(id)!;
      const from = v.root.rotation.y;
      // the shortest way round, 90 degrees to the right (the heading grows clockwise on the screen)
      let to = -rad(heading);
      while (to > from + 0.01) to -= Math.PI * 2;
      while (to < from - Math.PI * 1.5) to += Math.PI * 2;
      timeline.tween(reduced ? 0.01 : 0.26, (t) => (v.root.rotation.y = from + (to - from) * easeOutBack(t)), () => (v.root.rotation.y = -rad(heading)));
      if (!reduced) fx.sparkle(v.root.position.x, 0.3, v.root.position.z, 4, ['#ffffff', '#bfe9ff']);
    },

    shiftOnBelt(id, x, z) {
      const v = views.get(id)!;
      const from = v.root.position.clone();
      timeline.after(reduced ? 0 : 0.35, () => {
        timeline.tween(reduced ? 0.01 : 0.55, (t) => {
          const e = easeInOutCubic(t);
          v.root.position.set(from.x + (x - from.x) * e, v.root.position.y, from.z + (z - from.z) * e);
        }, () => v.root.position.set(x, v.root.position.y, z));
      });
    },

    focusOn(id, zoom = 3.4) {
      focus = { id, zoom };
      layout();
    },

    update(dt, t) {
      time = t;
      timeline.update(dt);
      fx.update(dt);
      if (!reduced) for (const bt of beltTextures) bt.offset.x -= dt * 0.9;

      // vehicles: spring wobble, shake, and the shadows
      let k = 0;
      for (const v of views.values()) {
        v.hop.step(dt);
        v.pitch.step(dt);
        v.squash.step(dt);
        if (v.slot !== null) {
          // parked in the station: rocks gently on its springs, squashes when it swallows a passenger
          v.root.rotation.z = v.pitch.value;
          v.root.scale.set(stationScale(v.def.type) * (1 - v.squash.value * 0.5), stationScale(v.def.type) * (1 + v.squash.value), stationScale(v.def.type) * (1 - v.squash.value * 0.5));
          v.root.position.y = Math.max(0, v.hop.value);
        }
        if (v.jitter.until > t) {
          const a = (v.jitter.until - t) * 0.5;
          v.mesh.position.set((Math.random() - 0.5) * 0.12 * a * 4, 0, (Math.random() - 0.5) * 0.12 * a * 4);
        } else v.mesh.position.set(0, 0, 0);
        if (pickMode && v.root.visible && v.slot === null && !reduced) v.mesh.position.y = 0.08 + Math.abs(Math.sin(t * 5 + v.def.id)) * 0.12;
        const visible = v.root.visible;
        const size = SIZES[v.def.type];
        dummy.position.set(v.root.position.x, 0.062, v.root.position.z); // just above the pad and the platform
        dummy.rotation.set(0, v.root.rotation.y, 0);
        dummy.scale.set(visible ? size.len * 1.42 * v.root.scale.x : 0, 1, visible ? size.wid * 1.42 * v.root.scale.z : 0);
        dummy.updateMatrix();
        vShadow.setMatrixAt(k, dummy.matrix);
        k++;
      }
      vShadow.instanceMatrix.needsUpdate = true;

      // passengers
      let colorDirty = false;
      for (const p of passengers) {
        let x = 0, y = 0, z = 0, yaw = 0, sc = 1, tilt = 0;
        if (p.gone) sc = 0;
        else if (p.flight) {
          const f = p.flight;
          f.t += dt / f.dur;
          const u = Math.min(1, f.t);
          x = f.from.x + (f.to.x - f.from.x) * u;
          z = f.from.z + (f.to.z - f.from.z) * u;
          y = f.from.y + (f.to.y - f.from.y) * u + Math.sin(u * Math.PI) * 1.15;
          sc = 1 - Math.max(0, (u - 0.75) / 0.25) * 0.9;
          yaw = Math.atan2(f.to.x - f.from.x, f.to.z - f.from.z);
          if (u >= 1) f.done();
        } else {
          if (p.delay > 0) p.delay -= dt;
          else if (Math.abs(p.s - p.target) > 0.002) {
            const dir = Math.sign(p.target - p.s);
            p.s += dir * Math.min(Math.abs(p.target - p.s), dt * 3.4);
            p.hop = (p.hop + dt * 5.5) % 1;
          } else p.hop = 0;
          const visible = p.target < SEE_AHEAD * SPACING;
          if (visible) {
            curveAt(Math.max(0, p.s), v3);
            x = v3.x;
            z = v3.z;
            const ahead = curveAt(Math.max(0, p.s) + 0.05, new T.Vector3());
            yaw = Math.atan2(v3.x - ahead.x, v3.z - ahead.z);
            const i = passengers.indexOf(p);
            if (!reduced) {
              tilt = Math.sin(t * 2.1 + i * 1.7) * 0.07 * (stuckOn ? 3 : 1);
              y = Math.abs(Math.sin(p.hop * Math.PI)) * 0.2 + (stuckOn ? Math.abs(Math.sin(t * 5 + i)) * 0.05 : 0);
            }
          } else sc = 0;
        }
        dummy.position.set(x, y, z);
        dummy.rotation.set(0, yaw, tilt);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        const slot = p.inst % pMesh.count;
        if (sc > 0) {
          if (slotOwner[slot] !== p.inst) {
            slotOwner[slot] = p.inst;
            pMesh.setColorAt(slot, tmpColor.set(COLOR_HEX[p.color]));
            colorDirty = true;
          }
          pMesh.setMatrixAt(slot, dummy.matrix);
          p.on = true;
        } else if (p.on) {
          p.on = false;
          if (slotOwner[slot] === p.inst) pMesh.setMatrixAt(slot, dummy.matrix); // scale 0: hide the freed slot
        }
        // sticker on top of the head, and the contact shadow
        dummy.position.set(x, y + 0.985 * PASSENGER_SCALE * sc, z);
        dummy.rotation.set(0, yaw, 0);
        dummy.updateMatrix();
        p.stick.mesh.setMatrixAt(p.stick.idx, dummy.matrix);
        dummy.position.set(x, 0.012, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1.25 * sc * (p.flight ? 0.6 : 1), 1, 1.25 * sc * (p.flight ? 0.6 : 1));
        dummy.updateMatrix();
        pShadow.setMatrixAt(p.inst, dummy.matrix);
      }
      pMesh.instanceMatrix.needsUpdate = true;
      if (colorDirty && pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
      pShadow.instanceMatrix.needsUpdate = true;
      stickMeshes.forEach((m) => (m.instanceMatrix.needsUpdate = true));
    },

    resize(w, h) {
      width = w;
      height = h;
      layout();
    },

    setTier(t) {
      sun.castShadow = t === 'high';
      renderer.shadowMap.enabled = t === 'high';
      scene.traverse((o) => {
        const m = (o as T.Mesh).material as T.Material | undefined;
        if (m) m.needsUpdate = true; // shaders change when shadows switch on or off
      });
    },

    dispose() {
      timeline.clear();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      if (held) window.clearTimeout(held.timer);
      renderer.toneMapping = T.NoToneMapping;
      renderer.toneMappingExposure = 1;
      envTexture.dispose();
      views.forEach((v) => v.badge && (v.badge.material as T.SpriteMaterial).dispose());
      fx.dispose();
      diorama.dispose();
      own.forEach((o) => o.dispose());
      pMesh.dispose();
      vShadow.dispose();
      pShadow.dispose();
      stickMeshes.forEach((m) => m.dispose());
      disposeTree(scene);
    },
  };

  const pathCurve = new T.CatmullRomCurve3(diorama.queuePoints.map((p) => new T.Vector3(p.x, 0, p.z + dzN)), false, 'catmullrom', 0.4);
  const pathLen = pathCurve.getLength();
  function curveAt(s: number, out: T.Vector3): T.Vector3 {
    return pathCurve.getPointAt(Math.min(1, Math.max(0, s / pathLen)), out);
  }
  void easeOutBack;
  void plasticMaterial;
  void BLACK_HEX;
  return api;
}
