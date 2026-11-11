import * as T from '../../../lobby3d/lib';

/** Everything on the diorama is built from rounded shapes, in the same toy style as the vehicles. */

export type World = 'beach';

function colored(g: T.BufferGeometry, hex: string | ((x: number, y: number, z: number) => string)): T.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  const n = ng.attributes.position.count;
  const col = new Float32Array(n * 3);
  const c = new T.Color();
  const pos = ng.attributes.position;
  for (let i = 0; i < n; i++) {
    c.set(typeof hex === 'string' ? hex : hex(pos.getX(i), pos.getY(i), pos.getZ(i)));
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  ng.setAttribute('color', new T.BufferAttribute(col, 3));
  if (!ng.attributes.uv) ng.setAttribute('uv', new T.BufferAttribute(new Float32Array(n * 2), 2));
  return ng;
}

const at = (g: T.BufferGeometry, x: number, y: number, z: number, ry = 0): T.BufferGeometry => {
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
};

/** One curved palm leaf: tapers to a point and droops. Built from a small grid so it can bend. */
function leaf(len: number, wid: number, droop: number, base: string, tip: string): T.BufferGeometry {
  const cols = 7;
  const g = new T.PlaneGeometry(len, wid, cols, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getX(i) + len / 2) / len; // 0 at the trunk, 1 at the tip
    const half = Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.04)) ** 0.7;
    p.setX(i, t * len);
    p.setZ(i, p.getY(i) * half); // width, with a fold along the middle added below
    p.setY(i, -droop * t * t * len + Math.abs(p.getY(i)) * 0.0 + Math.abs(p.getZ(i)) * 0.0);
  }
  // fold: edges lower than the centre rib
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) - Math.abs(p.getZ(i)) * 0.35);
  g.computeVertexNormals();
  return colored(g, (x) => (x / len > 0.55 ? tip : base));
}

function palm(x: number, z: number, h: number, lean: number): T.BufferGeometry[] {
  const parts: T.BufferGeometry[] = [];
  const segs = 7;
  let px = 0;
  let py = 0;
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    const r = 0.2 - 0.07 * t;
    const sh = h / segs;
    const g = new T.CylinderGeometry(r * 0.9, r, sh * 1.08, 10);
    g.rotateZ(-lean * (0.35 + t));
    g.translate(px, py + sh / 2, 0);
    parts.push(colored(g, i % 2 ? '#9a6a3c' : '#a8764a'));
    px += Math.sin(lean * (0.35 + t)) * sh;
    py += Math.cos(lean * (0.35 + t)) * sh;
  }
  const crown = new T.SphereGeometry(0.26, 10, 8);
  crown.translate(px, py, 0);
  parts.push(colored(crown, '#7a5230'));
  for (let i = 0; i < 9; i++) {
    const l = leaf(2.3, 0.62, 0.32, '#2f9d3a', '#58c640');
    l.rotateZ(0.18 + (i % 2) * 0.12);
    l.rotateY((i / 9) * Math.PI * 2);
    l.translate(px, py + 0.05, 0);
    parts.push(l);
  }
  parts.forEach((g) => at(g, x, 0, z));
  return parts;
}

function beachBall(x: number, y: number, z: number): T.BufferGeometry {
  const g = new T.SphereGeometry(0.42, 22, 14);
  const cols = ['#ff4f4f', '#ffffff', '#ffd02b', '#ffffff', '#2ea8ff', '#ffffff'];
  return at(colored(g, (px, _py, pz) => cols[Math.floor(((Math.atan2(pz, px) + Math.PI) / (Math.PI * 2)) * 6) % 6]), x, y, z);
}

function lifeRing(x: number, y: number, z: number): T.BufferGeometry {
  const g = new T.TorusGeometry(0.46, 0.17, 12, 28);
  g.rotateX(Math.PI * 0.42);
  g.rotateZ(0.5);
  const tg = colored(g, (px, _py, pz) => (Math.floor(((Math.atan2(pz, px) + Math.PI) / (Math.PI * 2)) * 8) % 2 ? '#ffffff' : '#ee3b3b'));
  return at(tg, x, y, z);
}

function starfish(x: number, z: number): T.BufferGeometry {
  const s = new T.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 0.5 : 0.2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const g = new T.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.04, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2);
  return at(colored(g, '#f09aa8'), x, 0.04, z, 0.4);
}

function cabana(x: number, z: number): T.BufferGeometry[] {
  const out: T.BufferGeometry[] = [];
  const hut = new T.RoundedBoxGeometry(2.4, 1.7, 1.9, 1, 0.12);
  out.push(at(colored(hut, '#1f8a96'), x, 0.85, z));
  const door = new T.RoundedBoxGeometry(0.9, 1.2, 0.2, 1, 0.05);
  out.push(at(colored(door, '#2b2833'), x - 0.35, 0.65, z + 0.93));
  const win = new T.RoundedBoxGeometry(0.7, 0.55, 0.2, 1, 0.05);
  out.push(at(colored(win, '#f2e6c2'), x + 0.62, 1.0, z + 0.93));
  // striped awning: slanted slats, yellow and white
  for (let i = 0; i < 8; i++) {
    const slat = new T.RoundedBoxGeometry(0.32, 0.1, 2.2, 1, 0.04);
    slat.rotateX(0.28);
    out.push(at(colored(slat, i % 2 ? '#ffffff' : '#ffd84a'), x - 1.12 + i * 0.32, 1.92, z + 0.55));
  }
  const roofBack = new T.RoundedBoxGeometry(2.7, 0.14, 1.2, 1, 0.05);
  out.push(at(colored(roofBack, '#ffd84a'), x, 1.78, z - 0.5));
  return out;
}

/** Posts and a sagging rope along the line where the passengers wait. */
function ropeFence(x0: number, x1: number, z: number): T.BufferGeometry[] {
  const out: T.BufferGeometry[] = [];
  const step = 1.2;
  const n = Math.round((x1 - x0) / step);
  const xs = Array.from({ length: n + 1 }, (_, i) => x0 + ((x1 - x0) * i) / n);
  for (const x of xs) {
    const post = new T.CylinderGeometry(0.075, 0.09, 0.78, 10);
    out.push(at(colored(post, '#8a5a3c'), x, 0.39, z));
    const cap = new T.SphereGeometry(0.1, 10, 8);
    out.push(at(colored(cap, '#6b432a'), x, 0.8, z));
  }
  for (let i = 0; i < xs.length - 1; i++) {
    const c = new T.CatmullRomCurve3([new T.Vector3(xs[i], 0.66, z), new T.Vector3((xs[i] + xs[i + 1]) / 2, 0.5, z), new T.Vector3(xs[i + 1], 0.66, z)]);
    out.push(colored(new T.TubeGeometry(c, 8, 0.035, 6, false), '#ecd9a5'));
  }
  return out;
}

/** Colours of the ground, the lot and the station for one world. */
export interface Theme {
  ground: string;
  pad: string;
  padEdge: string;
  platform: string;
  padVip: string;
  padP: string;
  padLocked: string;
  skyTop: string;
  skyBottom: string;
  /** where the ground ends in the north (the station sits at z = -8.15 while the diorama is built) */
  groundNorth: number;
}

export interface Diorama {
  group: T.Group;
  /** where the passengers wait, from the head of the queue (index 0) out to the door; the station sits at z = -8.15 */
  queuePoints: T.Vector3[];
  theme: Theme;
  dispose(): void;
}

/** The queue runs along the barrier, round the corner, and up to the door. `half` is half the width that is on screen. */
export function queuePointsFor(half: number): T.Vector3[] {
  const xL = -half;
  const xR = half + 0.3;
  const w = xR - xL;
  const extra = Math.max(0, (5 - half) * 3);
  return [[xL, -10.55], [xL + w * 0.3, -10.55], [xL + w * 0.62, -10.55], [xR - 1.3, -10.6], [xR - 0.3, -11.2], [xR, -12.4], [xR, -14.0], [xR, -16.0 - extra]].map(([x, z]) => new T.Vector3(x, 0, z));
}

let seaTexture: T.CanvasTexture | null = null;
function makeSea(): T.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#1f8ed6');
  grad.addColorStop(0.55, '#3bb7e6');
  grad.addColorStop(0.86, '#8de0ee');
  grad.addColorStop(1, '#d9f6f2');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 512);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (const [y, a] of [[430, 1], [468, 0.8], [498, 1.2]] as [number, number][]) {
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 8) g.lineTo(x, y + Math.sin((x / 256) * Math.PI * 4 * a) * 4);
    g.lineTo(256, y + 7);
    g.lineTo(0, y + 7);
    g.fill();
  }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

export function buildBeach(half = 5): Diorama {
  const group = new T.Group();
  const parts: T.BufferGeometry[] = [];
  parts.push(...palm(-6.6, -14.4, 4.6, 0.28), ...palm(-4.3, -16.4, 5.3, -0.22), ...palm(7.6, -12.3, 3.9, -0.3), ...palm(-8.0, -9.4, 3.4, 0.3));
  parts.push(beachBall(-3.6, 0.42, -12.9), lifeRing(2.7, 0.3, -12.7), starfish(-1.5, -12.2), starfish(1.1, -14.4));
  parts.push(...cabana(half + 0.6, -15.4));
  parts.push(...ropeFence(-half - 0.4, half - 0.4, -9.55));
  const merged = T.mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  const mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0, side: T.DoubleSide, envMapIntensity: 0.5 });
  const props = new T.Mesh(merged, mat);
  props.castShadow = true;
  props.receiveShadow = true;
  group.add(props);

  // the sea along the far edge, and the sand
  seaTexture ??= makeSea();
  const sea = new T.Mesh(new T.PlaneGeometry(40, 10), new T.MeshStandardMaterial({ map: seaTexture, roughness: 0.4, envMapIntensity: 0.6 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0, -26.5);
  group.add(sea);

  return {
    group,
    queuePoints: queuePointsFor(half),
    theme: { ground: '#e6b660', pad: '#f6dba0', padEdge: '#c58f3c', platform: '#d4a350', padVip: '#8a6620', padP: '#b98531', padLocked: '#c4954a', skyTop: '#58c8f0', skyBottom: '#eacd8c', groundNorth: -22 },
    dispose() {
      merged.dispose();
      mat.dispose();
      sea.geometry.dispose();
      (sea.material as T.MeshStandardMaterial).dispose();
    },
  };
}

// ---- the city ---------------------------------------------------------------------------------------------------

const rb = (w: number, h: number, d: number, r: number): T.BufferGeometry => new T.RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
const flat = (w: number, d: number, x: number, z: number, y: number, hex: string): T.BufferGeometry => {
  const g = new T.BoxGeometry(w, 0.04, d);
  return at(colored(g, hex), x, y, z);
};

/** A round tree: a short trunk and a bunch of balls. */
function roundTree(x: number, z: number, s = 1): T.BufferGeometry[] {
  const out: T.BufferGeometry[] = [];
  out.push(at(colored(new T.CylinderGeometry(0.16 * s, 0.22 * s, 1.3 * s, 8), '#8a5a3c'), x, 0.65 * s, z));
  const balls: [number, number, number, number, string][] = [
    [0, 2.0, 0, 1.0, '#58b83a'], [0.62, 1.7, 0.2, 0.7, '#6ccb45'], [-0.6, 1.75, -0.1, 0.72, '#4fa835'], [0.1, 2.65, 0.1, 0.72, '#7ad84e'], [-0.1, 1.8, 0.62, 0.62, '#62c040'],
  ];
  for (const [bx, by, bz, br, hex] of balls) out.push(at(colored(new T.SphereGeometry(br * s, 10, 8), hex), x + bx * s, by * s, z + bz * s));
  return out;
}

function bench(x: number, z: number): T.BufferGeometry[] {
  const out: T.BufferGeometry[] = [];
  out.push(at(colored(rb(1.7, 0.1, 0.5, 0.04), '#b97a45'), x, 0.5, z));
  out.push(at(colored(rb(1.7, 0.45, 0.08, 0.03), '#a96a38'), x, 0.8, z - 0.25));
  for (const dx of [-0.7, 0.7]) out.push(at(colored(rb(0.1, 0.5, 0.45, 0.03), '#4a4a58'), x + dx, 0.25, z));
  return out;
}

function lamp(x: number, z: number): T.BufferGeometry[] {
  const out: T.BufferGeometry[] = [];
  out.push(at(colored(new T.CylinderGeometry(0.06, 0.09, 3.0, 8), '#5a5f70'), x, 1.5, z));
  out.push(at(colored(rb(0.5, 0.5, 0.5, 0.2), '#fff2b0'), x, 3.15, z));
  out.push(at(colored(new T.CylinderGeometry(0.2, 0.22, 0.1, 10), '#5a5f70'), x, 2.9, z));
  return out;
}

const BUILD_COLORS = ['#f2a7b8', '#9fd3f5', '#ffd98a', '#b9e3a6', '#d2b6f0', '#f7b48b'];

function skyline(half: number): T.BufferGeometry[] {
  const out: T.BufferGeometry[] = [];
  const xs = [-half - 5.5, -half - 1.2, half - 4.2, half + 0.6, half + 5.2, -half + 3.6];
  xs.forEach((x, i) => {
    const w = 3.6 + (i % 3) * 0.7;
    const h = 5.5 + ((i * 7) % 4) * 1.4;
    const z = -25.5 - (i % 2) * 1.5;
    const hex = BUILD_COLORS[i % BUILD_COLORS.length];
    out.push(at(colored(rb(w, h, 3.2, 0.35), hex), x, h / 2, z));
    out.push(at(colored(rb(w + 0.2, 0.35, 3.4, 0.12), '#ffffff'), x, h + 0.1, z));
    const floors = Math.floor(h / 1.5);
    const cols = Math.max(2, Math.floor(w / 1.1));
    for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
      out.push(at(colored(rb(0.55, 0.75, 0.12, 0.05), '#a9dcf7'), x - (cols - 1) * 0.5 + c * 1.0, 1.3 + f * 1.4, z + 1.62));
    }
  });
  return out;
}

export function buildCity(half = 5): Diorama {
  const group = new T.Group();
  const parts: T.BufferGeometry[] = [];
  const xR = half + 0.3;
  // sidewalk behind the barrier, kerb, road with a dashed line and a crosswalk
  parts.push(flat(80, 8.6, 0, -14.1, 0.02, '#ece2cf'));
  parts.push(flat(80, 0.25, 0, -18.55, 0.05, '#cfc6b4'));
  parts.push(flat(80, 4.4, 0, -20.9, 0.02, '#858a9c'));
  for (let x = -20; x <= 20; x += 2.4) parts.push(flat(1.2, 0.14, x, -20.9, 0.05, '#f4f1e6'));
  for (let i = 0; i < 7; i++) parts.push(flat(0.5, 3.6, -1.8 + i * 0.6, -20.9, 0.05, '#ffffff'));
  // trees, benches and lamps
  parts.push(...roundTree(-half - 1.1, -12.6, 1.0), ...roundTree(-half + 1.2, -16.3, 1.25), ...roundTree(half - 3.4, -15.6, 0.95), ...roundTree(xR + 3.2, -12.0, 1.1));
  parts.push(...bench(-1.6, -13.3), ...bench(2.4, -16.6));
  parts.push(...lamp(-half - 0.2, -11.4), ...lamp(0.3, -11.4), ...lamp(xR + 1.6, -11.4));
  // the shop the passengers come out of
  parts.push(at(colored(rb(3.0, 3.4, 2.6, 0.3), '#ffb45c'), xR, 1.7, -17.0));
  parts.push(at(colored(rb(1.0, 1.7, 0.2, 0.08), '#5b4636'), xR - 0.5, 0.85, -15.62));
  parts.push(at(colored(rb(1.0, 0.8, 0.2, 0.08), '#a9dcf7'), xR + 0.75, 1.5, -15.62));
  for (let i = 0; i < 7; i++) parts.push(at(colored(rb(0.46, 0.1, 1.2, 0.04), i % 2 ? '#ffffff' : '#ee4b4b'), xR - 1.35 + i * 0.45, 2.4, -15.5));
  parts.push(...ropeFence(-half - 0.4, half - 0.4, -9.55).map((g) => g));
  parts.push(...skyline(half));
  const merged = T.mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  const mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0, side: T.DoubleSide, envMapIntensity: 0.5 });
  const props = new T.Mesh(merged, mat);
  props.castShadow = true;
  props.receiveShadow = true;
  group.add(props);
  return {
    group,
    queuePoints: queuePointsFor(half),
    theme: { ground: '#c4c1cc', pad: '#d9d7e1', padEdge: '#9b99ab', platform: '#9094a8', padVip: '#c79a2e', padP: '#7f849a', padLocked: '#8a8ea2', skyTop: '#6ec6ff', skyBottom: '#e6f5ff', groundNorth: -30 },
    dispose() {
      merged.dispose();
      mat.dispose();
    },
  };
}

export type WorldKind = 'city' | 'beach';
export const buildWorld = (w: WorldKind, half: number): Diorama => (w === 'city' ? buildCity(half) : buildBeach(half));
