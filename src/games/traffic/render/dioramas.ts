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

export interface Diorama {
  group: T.Group;
  /** where the passengers wait: from the head of the queue (index 0) out to the cabana */
  queuePath: T.CatmullRomCurve3;
  dispose(): void;
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

export function buildBeach(): Diorama {
  const group = new T.Group();
  const parts: T.BufferGeometry[] = [];
  parts.push(...palm(-6.6, -14.4, 4.6, 0.28), ...palm(-4.3, -16.4, 5.3, -0.22), ...palm(7.6, -12.3, 3.9, -0.3), ...palm(-8.0, -9.4, 3.4, 0.3));
  parts.push(beachBall(-3.6, 0.42, -12.9), lifeRing(2.7, 0.3, -12.7), starfish(-1.5, -12.2), starfish(1.1, -14.4));
  parts.push(...cabana(5.6, -15.4));
  parts.push(...ropeFence(-5.4, 4.6, -9.55));
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

  // the queue: from the head (left) straight along the fence, round the corner, and up toward the cabana
  const queuePath = new T.CatmullRomCurve3(
    [[-5.0, -10.55], [-2.0, -10.55], [1.5, -10.55], [4.0, -10.6], [5.0, -11.2], [5.3, -12.4], [5.3, -14.0], [5.3, -16.0]].map(([x, z]) => new T.Vector3(x, 0, z)),
    false,
    'catmullrom',
    0.4,
  );
  return {
    group,
    queuePath,
    dispose() {
      merged.dispose();
      mat.dispose();
      sea.geometry.dispose();
      (sea.material as T.MeshStandardMaterial).dispose();
    },
  };
}
