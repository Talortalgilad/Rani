import * as T from '../../../lobby3d/lib';
import { SIZES, type ColorId, type VType } from '../engine/state';
import { COLOR_HEX, COLOR_SHAPE, shapePoints, type StickerShape } from './palette';

/**
 * The "toy kit": vehicles, passengers, roof arrows and stickers, all built in code from rounded shapes.
 * Every vehicle is ONE merged geometry with vertex colours (body, glass, wheels, lights), so a lot of 40 vehicles is
 * about 40 draw calls and not 800. Geometry is cached per type and colour and shared by all vehicles of that kind.
 */

const GLASS = '#5d7fae';
const GLASS_DEEP = '#3b5584';
const TYRE = '#202127';
const RIM = '#d8dbe4';
const DARK = '#2a2733';
const LIGHT = '#fff6cf';
const TAIL = '#e5333a';

const shade = (hex: string, k: number): string => '#' + new T.Color(hex).multiplyScalar(k).getHexString();

/** A geometry with a vertex colour on every vertex, converted so that all parts can be merged. */
function part(g: T.BufferGeometry, hex: string): T.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  const c = new T.Color(hex);
  const n = ng.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  ng.setAttribute('color', new T.BufferAttribute(col, 3));
  if (!ng.attributes.uv) ng.setAttribute('uv', new T.BufferAttribute(new Float32Array(n * 2), 2));
  return ng;
}

function rbox(w: number, h: number, d: number, r: number, x: number, y: number, z: number, hex: string): T.BufferGeometry {
  const g = new T.RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
  g.translate(x, y, z);
  return part(g, hex);
}

function wheel(x: number, z: number, r: number, w: number): T.BufferGeometry[] {
  const tyre = new T.CylinderGeometry(r, r, w, 18);
  tyre.rotateX(Math.PI / 2);
  tyre.translate(x, r, z);
  const rim = new T.CylinderGeometry(r * 0.52, r * 0.52, w + 0.012, 14);
  rim.rotateX(Math.PI / 2);
  rim.translate(x, r, z);
  return [part(tyre, TYRE), part(rim, RIM)];
}

/** The white arrow on the roof, pointing along +x, with a thin dark outline. */
function arrow(len: number, wid: number, y: number): T.BufferGeometry[] {
  const shapeOf = (k: number) => {
    const s = new T.Shape();
    const hl = (len / 2) * k;
    const sw = wid * 0.17 * k;
    const hw = wid * 0.42 * k;
    const neck = hl * 0.1;
    s.moveTo(-hl, -sw);
    s.lineTo(neck, -sw);
    s.lineTo(neck, -hw);
    s.lineTo(hl, 0);
    s.lineTo(neck, hw);
    s.lineTo(neck, sw);
    s.lineTo(-hl, sw);
    s.closePath();
    return s;
  };
  const make = (k: number, depth: number, bevel: number, hex: string, lift: number) => {
    const g = new T.ExtrudeGeometry(shapeOf(k), { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 4 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, y + lift, 0);
    return part(g, hex);
  };
  return [make(1.1, 0.012, 0.012, '#2b2a36', 0), make(1, 0.028, 0.02, '#ffffff', 0.012)];
}

export interface Spec {
  len: number;
  wid: number;
  bodyH: number;
  cabH: number;
  wheelR: number;
}
const SPECS: Record<VType, Spec> = {
  car: { len: 1.94, wid: 0.94, bodyH: 0.46, cabH: 0.34, wheelR: 0.2 },
  van: { len: 2.94, wid: 0.94, bodyH: 0.5, cabH: 0.4, wheelR: 0.22 },
  bus: { len: 3.94, wid: 1.04, bodyH: 0.56, cabH: 0.46, wheelR: 0.25 },
};

/** Height of the roof: where the arrow lies. */
export const roofY = (t: VType): number => SPECS[t].wheelR * 0.8 + SPECS[t].bodyH + SPECS[t].cabH + 0.07;

function buildVehicle(type: VType, bodyHex: string): T.BufferGeometry {
  const s = SPECS[type];
  const { len: L, wid: W, bodyH, cabH, wheelR } = s;
  const parts: T.BufferGeometry[] = [];
  const base = wheelR * 0.8; // the body sits low between the wheels
  const bodyTop = base + bodyH;
  const trim = shade(bodyHex, 0.72);
  const r = bodyH * 0.38;

  // chassis shadow strip and body
  parts.push(rbox(L * 0.94, 0.1, W * 0.86, 0.04, 0, base + 0.04, 0, DARK));
  parts.push(rbox(L, bodyH, W, r, 0, base + bodyH / 2, 0, bodyHex));
  // darker skirt along the bottom: the two-tone look of toy vehicles
  parts.push(rbox(L * 1.003, bodyH * 0.32, W * 1.006, r * 0.8, 0, base + bodyH * 0.16, 0, trim));

  // passenger cabin: a dark glass block, a coloured roof slab and coloured pillars between the windows
  const cabLen = type === 'car' ? L * 0.52 : type === 'van' ? L * 0.9 : L * 0.96;
  const cabX = type === 'car' ? -L * 0.08 : type === 'van' ? -L * 0.02 : 0;
  const cabW = W * (type === 'car' ? 0.86 : 0.93);
  parts.push(rbox(cabLen, cabH, cabW, 0.1, cabX, bodyTop + cabH / 2 - 0.02, 0, GLASS));
  parts.push(rbox(cabLen + 0.03, 0.09, cabW + 0.03, 0.045, cabX, bodyTop + cabH + 0.0, 0, bodyHex));
  const windows = type === 'car' ? 2 : type === 'van' ? 3 : 6;
  for (let i = 0; i <= windows; i++) {
    const px = cabX - cabLen / 2 + 0.035 + ((cabLen - 0.07) * i) / windows;
    parts.push(rbox(0.07, cabH + 0.02, cabW + 0.035, 0.03, px, bodyTop + cabH / 2 - 0.02, 0, bodyHex));
  }
  // windscreen and rear window: bigger, slightly lighter panes on the two ends
  parts.push(rbox(0.05, cabH * 0.82, cabW * 0.9, 0.03, cabX + cabLen / 2 + 0.012, bodyTop + cabH * 0.5, 0, GLASS_DEEP));
  parts.push(rbox(0.05, cabH * 0.7, cabW * 0.8, 0.03, cabX - cabLen / 2 - 0.012, bodyTop + cabH * 0.5, 0, GLASS_DEEP));
  // belt line under the windows
  parts.push(rbox(cabLen + 0.02, 0.05, cabW + 0.02, 0.02, cabX, bodyTop + 0.005, 0, trim));

  // wheels
  const axles = type === 'car' ? [L * 0.3, -L * 0.3] : type === 'van' ? [L * 0.31, -L * 0.3] : [L * 0.33, -L * 0.27, -L * 0.39];
  for (const ax of axles) for (const side of [1, -1]) parts.push(...wheel(ax, side * (W / 2 - 0.0), wheelR, 0.13));

  // lights, grille and (on buses) mirrors
  for (const side of [1, -1]) {
    parts.push(rbox(0.07, 0.11, 0.2, 0.03, L / 2 - 0.005, base + bodyH * 0.55, side * W * 0.3, LIGHT));
    parts.push(rbox(0.06, 0.1, 0.16, 0.025, -L / 2 + 0.005, base + bodyH * 0.55, side * W * 0.3, TAIL));
  }
  parts.push(rbox(0.05, 0.12, W * 0.38, 0.03, L / 2 + 0.002, base + bodyH * 0.3, 0, DARK));
  if (type === 'bus') {
    for (const side of [1, -1]) {
      parts.push(rbox(0.06, 0.2, 0.05, 0.02, L / 2 - 0.14, base + bodyH + 0.18, side * (W / 2 + 0.05), DARK));
      parts.push(rbox(0.05, 0.1, 0.06, 0.02, L / 2 - 0.14, base + bodyH + 0.1, side * (W / 2 + 0.08), DARK));
    }
    // two roof hatches
    for (const x of [-L * 0.3, L * 0.3]) parts.push(rbox(0.5, 0.05, 0.5, 0.06, x, bodyTop + cabH + 0.06, 0, shade(bodyHex, 1.12)));
    // a lighter stripe along the side
    parts.push(rbox(L * 0.98, 0.05, W * 1.012, 0.02, 0, base + bodyH * 0.5, 0, shade(bodyHex, 1.18)));
  }
  if (type === 'van') parts.push(rbox(L * 0.98, 0.045, W * 1.01, 0.02, 0, base + bodyH * 0.52, 0, shade(bodyHex, 1.16)));

  // the arrow on the roof
  const arrowLen = type === 'car' ? L * 0.42 : type === 'van' ? L * 0.44 : L * 0.34;
  const arrowX = type === 'car' ? cabX : type === 'bus' ? 0 : cabX;
  if (bodyHex !== BLACK_HEX) {
    // a hidden "?" vehicle has no arrow until it is uncovered
    const ag = arrow(arrowLen, cabW * 0.95, bodyTop + cabH + 0.045);
    ag.forEach((g) => g.translate(arrowX, 0, 0));
    parts.push(...ag);
  }

  const merged = T.mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

const cache = new Map<string, T.BufferGeometry>();
export function vehicleGeometry(type: VType, hex: string): T.BufferGeometry {
  const key = `${type}|${hex}`;
  let g = cache.get(key);
  if (!g) {
    g = buildVehicle(type, hex);
    cache.set(key, g);
  }
  return g;
}

let bodyMat: T.MeshStandardMaterial | null = null;
/** One glossy plastic material for every vehicle (colour comes from the vertex colours). */
export function plasticMaterial(): T.MeshStandardMaterial {
  bodyMat ??= new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0, envMapIntensity: 0.9 });
  return bodyMat;
}

export const BLACK_HEX = '#17151f';

/** A vehicle mesh (one draw call). `color` null = a "?" vehicle: black plastic. */
export function makeVehicle(type: VType, color: ColorId | null): T.Mesh {
  const mesh = new T.Mesh(vehicleGeometry(type, color ? COLOR_HEX[color] : BLACK_HEX), plasticMaterial());
  mesh.castShadow = true;
  return mesh;
}

export const vehicleSize = (t: VType) => SIZES[t];

// ---- passengers ------------------------------------------------------------------------------------------------

/** A "jelly" passenger: capsule body, round head, two short legs, two small black eyes. White: tinted per instance. */
export function passengerGeometry(): T.BufferGeometry {
  const body = new T.CapsuleGeometry(0.17, 0.2, 6, 12);
  body.translate(0, 0.36, 0);
  const head = new T.SphereGeometry(0.2, 16, 12);
  head.translate(0, 0.78, 0);
  const legs = [-0.085, 0.085].map((x) => {
    const g = new T.CapsuleGeometry(0.065, 0.05, 4, 8);
    g.translate(x, 0.1, 0.01);
    return part(g, '#ffffff');
  });
  const eyes = [-0.075, 0.075].map((x) => {
    const g = new T.SphereGeometry(0.032, 8, 6);
    g.translate(x, 0.8, 0.185);
    return part(g, '#1a1822');
  });
  const merged = T.mergeGeometries([part(body, '#ffffff'), part(head, '#ffffff'), ...legs, ...eyes], false);
  merged.computeBoundingSphere();
  return merged;
}

/** The sticker of one colour: a flat extruded shape that sits on the passenger's head. */
export function stickerGeometry(shape: StickerShape, size = 0.2): T.BufferGeometry {
  const pts = shapePoints(shape);
  const s = new T.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x * size, y * size) : s.lineTo(x * size, y * size)));
  s.closePath();
  const g = new T.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.006, bevelSegments: 1 });
  g.rotateX(-Math.PI / 2);
  return g;
}

export const shapeOf = (c: ColorId): StickerShape => COLOR_SHAPE[c];
