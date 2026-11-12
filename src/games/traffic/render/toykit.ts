import * as T from '../../../lobby3d/lib';
import { SIZES, type ColorId, type VType } from '../engine/state';
import { COLOR_HEX, COLOR_SHAPE, shapePoints, type StickerShape } from './palette';

/**
 * The "toy kit": vehicles, passengers, roof arrows and stickers, all built in code from rounded shapes.
 * Every vehicle is ONE merged geometry with vertex colours (body, glass, wheels, lights), so a lot of 40 vehicles is
 * about 40 draw calls and not 800. Geometry is cached per type and colour and shared by all vehicles of that kind.
 */

const PANE = '#8fe3ff';
const TYRE = '#1d1e25';
const RIM = '#d8dbe4';
const DARK = '#2a2733';
const LIGHT = '#fff6cf';
const TAIL = '#e5333a';


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
  if (!ng.attributes.normal) ng.computeVertexNormals();
  return ng;
}

/** A soft "pillow" box: `seg` 1 = 108 triangles, 2 = 300. The normals are rounded, so even 1 reads as puffy. */
function rbox(w: number, h: number, d: number, r: number, x: number, y: number, z: number, hex: string, seg = 1): T.BufferGeometry {
  const g = new T.RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
  g.translate(x, y, z);
  return part(g, hex);
}

/** A plain 12-triangle box for small flat details. */
function box(w: number, h: number, d: number, x: number, y: number, z: number, hex: string, tiltZ = 0): T.BufferGeometry {
  const g = new T.BoxGeometry(w, h, d);
  if (tiltZ) g.rotateZ(tiltZ);
  g.translate(x, y, z);
  return part(g, hex);
}

/** A big wheel that sticks out a little from the body. */
function wheel(x: number, z: number, r: number, w: number, sides = 16): T.BufferGeometry[] {
  const tyre = new T.CylinderGeometry(r, r, w, sides);
  tyre.rotateX(Math.PI / 2);
  tyre.translate(x, r, z);
  const side = Math.sign(z) || 1;
  const rim = new T.CircleGeometry(r * 0.55, 12);
  if (side < 0) rim.rotateY(Math.PI);
  rim.translate(x, r, z + side * (w / 2 + 0.003));
  return [part(tyre, TYRE), part(rim, RIM)];
}

/** The white roof arrow: puffy (a rounded bevel), no outline. Points along +x. */
function arrow(len: number, wid: number, y: number): T.BufferGeometry {
  const bev = 0.03;
  const hl = len / 2 - bev;
  const sw = wid * 0.16 - bev * 0.5;
  const hw = wid * 0.46 - bev;
  const neck = hl * 0.05;
  const s = new T.Shape();
  s.moveTo(-hl, -sw);
  s.lineTo(neck, -sw);
  s.lineTo(neck, -hw);
  s.lineTo(hl, 0);
  s.lineTo(neck, hw);
  s.lineTo(neck, sw);
  s.lineTo(-hl, sw);
  s.closePath();
  const g = new T.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelSize: bev, bevelThickness: 0.035, bevelSegments: 2, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y + 0.002, 0);
  return part(g, '#ffffff');
}

export interface Spec {
  len: number;
  wid: number;
  bodyH: number;
  cabH: number;
  wheelR: number;
}
// taller and with bigger wheels than before: the side of the vehicle is what the tilted camera shows
const SPECS: Record<VType, Spec> = {
  car: { len: 1.94, wid: 0.98, bodyH: 0.5, cabH: 0.42, wheelR: 0.3 },
  van: { len: 2.94, wid: 0.98, bodyH: 0.54, cabH: 0.48, wheelR: 0.32 },
  bus: { len: 3.94, wid: 1.08, bodyH: 0.64, cabH: 0.56, wheelR: 0.36 },
  fire: { len: 3.94, wid: 1.08, bodyH: 0.64, cabH: 0.5, wheelR: 0.36 },
};
const baseOf = (s: Spec): number => s.wheelR * 0.72; // the body sits low, the wheels stand out
const ROOF_CAP = 0.12;

/** Height of the top of the roof: where the arrow lies. */
export const roofY = (t: VType): number => baseOf(SPECS[t]) + SPECS[t].bodyH + SPECS[t].cabH + ROOF_CAP;

function buildVehicle(type: VType, bodyHex: string, low: boolean): T.BufferGeometry {
  const seg = low ? 1 : 2; // a crowded lot (many vehicles) uses lighter vehicles: the triangle budget is for the whole scene
  const s = SPECS[type];
  const { len: L, wid: W, bodyH, cabH, wheelR } = s;
  const parts: T.BufferGeometry[] = [];
  const base = baseOf(s);
  const bodyTop = base + bodyH;
  const r = bodyH * 0.45;

  // body in the full colour from the wheels up to the windows, on a thin dark strip
  parts.push(box(L * 0.92, 0.08, W * 0.8, 0, base + 0.02, 0, DARK));
  parts.push(rbox(L, bodyH, W, r, 0, base + bodyH / 2, 0, bodyHex, seg));

  // cabin: ONE rounded shell in the body colour, narrower than the body, whose top is the roof (nothing overhangs)
  const cabLen = type === 'car' ? L * 0.56 : type === 'van' ? L * 0.9 : type === 'fire' ? L * 0.34 : L * 0.96;
  const cabX = type === 'car' ? -L * 0.07 : type === 'van' ? -L * 0.03 : type === 'fire' ? L * 0.3 : 0;
  const cabW = W * 0.9;
  const shellBottom = bodyTop - 0.28;
  const roofTop = bodyTop + cabH + ROOF_CAP;
  parts.push(rbox(cabLen, roofTop - shellBottom, cabW, 0.15, cabX, (roofTop + shellBottom) / 2, 0, bodyHex, seg));

  // separate window panes in bright glossy cyan; what is left of the shell between them are the pillars
  const n = type === 'car' ? 2 : type === 'van' ? 3 : type === 'fire' ? 2 : 6;
  const pillar = 0.09;
  const margin = 0.14;
  const paneLen = (cabLen - margin * 2 - pillar * (n - 1)) / n;
  const paneH = cabH - 0.04;
  const paneY = bodyTop + 0.03 + paneH / 2;
  for (let i = 0; i < n; i++) {
    const px = cabX - cabLen / 2 + margin + paneLen / 2 + i * (paneLen + pillar);
    for (const side of [1, -1]) parts.push(box(paneLen, paneH, 0.03, px, paneY, side * (cabW / 2 - 0.003), PANE));
  }
  parts.push(box(0.03, paneH, cabW * 0.82, cabX + cabLen / 2 - 0.003, paneY, 0, PANE)); // windscreen
  parts.push(box(0.03, paneH * 0.9, cabW * 0.7, cabX - cabLen / 2 + 0.003, paneY - 0.01, 0, PANE)); // rear window

  // wheels: 16 sides, one big wheel at the back of a bus, none doubled
  const axles: [number, number][] =
    type === 'car' ? [[L * 0.3, wheelR], [-L * 0.3, wheelR]]
    : type === 'van' ? [[L * 0.31, wheelR], [-L * 0.3, wheelR]]
    : [[L * 0.3, wheelR], [-L * 0.27, wheelR * 1.18]];
  for (const [ax, wr] of axles) for (const side of [1, -1]) parts.push(...wheel(ax, side * (W / 2), wr, 0.17, low ? 12 : 16));

  // headlights (round), tail lights, grille
  for (const side of [1, -1]) {
    const hl = new T.CylinderGeometry(0.085, 0.085, 0.05, 8);
    hl.rotateZ(Math.PI / 2);
    hl.translate(L / 2 - 0.004, base + bodyH * 0.55, side * W * 0.3);
    parts.push(part(hl, LIGHT));
    parts.push(box(0.05, 0.11, 0.2, -L / 2 + 0.02, base + bodyH * 0.55, side * W * 0.3, TAIL));
  }
  parts.push(box(0.05, 0.13, W * 0.34, L / 2 - 0.005, base + bodyH * 0.28, 0, DARK));
  if (type === 'bus') for (const side of [1, -1]) parts.push(box(0.06, 0.2, 0.05, L / 2 - 0.2, bodyTop + 0.22, side * (W / 2 + 0.05), DARK));

  // a fire truck: a ladder on the back, a light bar on the cab, white stripes and a rack of equipment along the sides
  if (type === 'fire') {
    const top = bodyTop + 0.02;
    for (const side of [1, -1]) {
      parts.push(box(2.3, 0.07, 0.07, -L * 0.17, top + 0.2, side * 0.3, '#e8e8ee'));
      parts.push(box(2.1, 0.05, 0.05, -L * 0.17, top + 0.1, side * 0.3, '#9aa0b0'));
      parts.push(box(1.7, 0.4, 0.04, -L * 0.14, base + bodyH * 0.55, side * (W / 2 + 0.01), '#c8ccd8')); // equipment doors
    }
    for (let i = 0; i < 9; i++) parts.push(box(0.05, 0.05, 0.62, -L * 0.17 - 1.0 + i * 0.25, top + 0.2, 0, '#e8e8ee'));
    parts.push(box(0.2, 0.1, 0.5, cabX - 0.3, roofY(type) + 0.07, 0, '#2f6bff'));
    parts.push(box(0.2, 0.1, 0.22, cabX - 0.3, roofY(type) + 0.07, 0.2, '#ff3b30'));
    parts.push(box(L * 0.97, 0.07, W * 1.01, 0, base + bodyH * 0.3, 0, '#ffffff'));
  }

  // the arrow on the roof (60% of the old size, puffy). A hidden "?" vehicle has none until it is uncovered.
  if (bodyHex !== BLACK_HEX) {
    const arrowLen = (type === 'car' ? L * 0.42 : type === 'van' ? L * 0.44 : L * 0.34) * 0.6;
    const a = arrow(arrowLen, cabW * 0.95 * 0.6, roofY(type) - 0.01);
    a.translate(cabX, 0, 0);
    parts.push(a);
  }

  const merged = T.mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

const cache = new Map<string, T.BufferGeometry>();
export function vehicleGeometry(type: VType, hex: string, low = false): T.BufferGeometry {
  const key = `${type}|${hex}|${low ? 'low' : 'full'}`;
  let g = cache.get(key);
  if (!g) {
    g = buildVehicle(type, hex, low);
    cache.set(key, g);
  }
  return g;
}

let bodyMat: T.MeshStandardMaterial | null = null;
/** One glossy plastic material for every vehicle (colour comes from the vertex colours). */
export function plasticMaterial(): T.MeshStandardMaterial {
  bodyMat ??= new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0, envMapIntensity: 0.75 });
  return bodyMat;
}

export const BLACK_HEX = '#17151f';

/** A vehicle mesh (one draw call). `color` null = a "?" vehicle: black plastic. */
export function makeVehicle(type: VType, color: ColorId | null, low = false): T.Mesh {
  const mesh = new T.Mesh(vehicleGeometry(type, color ? COLOR_HEX[color] : BLACK_HEX, low), plasticMaterial());
  mesh.castShadow = true;
  return mesh;
}

export const vehicleSize = (t: VType) => SIZES[t];

// ---- passengers ------------------------------------------------------------------------------------------------

/** Passengers are 40% bigger than in round 1. */
export const PASSENGER_SCALE = 1.4;

/** A "jelly" passenger: capsule body, round head, two short legs, two small black eyes. White: tinted per instance. Low-poly. */
export function passengerGeometry(): T.BufferGeometry {
  const body = new T.CapsuleGeometry(0.17, 0.2, 2, 8);
  body.translate(0, 0.36, 0);
  const head = new T.SphereGeometry(0.2, 8, 5);
  head.translate(0, 0.78, 0);
  const legs = [-0.085, 0.085].map((x) => {
    const g = new T.CapsuleGeometry(0.065, 0.05, 1, 5);
    g.translate(x, 0.1, 0.01);
    return part(g, '#ffffff');
  });
  const eyes = [-0.075, 0.075].map((x) => {
    const g = new T.SphereGeometry(0.034, 4, 3);
    g.translate(x, 0.8, 0.185);
    return part(g, '#1a1822');
  });
  const merged = T.mergeGeometries([part(body, '#ffffff'), part(head, '#ffffff'), ...legs, ...eyes], false);
  merged.scale(PASSENGER_SCALE, PASSENGER_SCALE, PASSENGER_SCALE);
  merged.computeBoundingSphere();
  return merged;
}

/** The sticker of one colour: a flat shape that sits on top of the head (a handful of triangles). */
export function stickerGeometry(shape: StickerShape, size = 0.28): T.BufferGeometry {
  const pts = shapePoints(shape);
  const s = new T.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x * size, y * size) : s.lineTo(x * size, y * size)));
  s.closePath();
  const g = new T.ShapeGeometry(s, 1);
  g.rotateX(-Math.PI / 2);
  return g;
}

export const shapeOf = (c: ColorId): StickerShape => COLOR_SHAPE[c];
