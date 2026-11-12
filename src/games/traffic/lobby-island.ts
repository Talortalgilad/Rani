import * as T from '../../lobby3d/lib';
import { Spring } from '../../lobby3d/motion';
import { Particles } from '../../lobby3d/particles';
import { Materials, roundedBox } from '../../lobby3d/shapes';
import type { LobbyIslandCtx, LobbyIslandHandle } from '../types';
import { makeVehicle } from './render/toykit';
import { COLOR_HEX } from './render/palette';
import type { ColorId } from './engine/state';
import { ROAD } from './render/route';

/**
 * Traffic's miniature for the lobby, built from the game's own toy kit (the same vehicles, passengers and plastic): a small
 * parking lot with six coloured vehicles on the island. In a loop a bus drives out onto the road, along it to a little station,
 * passengers jump in, it honks and drives off, and a new vehicle drives into the empty place. Tapping the island makes every
 * vehicle hop at once.
 */
const LOOP = 9; // seconds
const K = 0.23; // game units to island units: the lot is 5.4 wide
const HALF = 2.7; // half the side of the lot
const ROADZ = -(HALF + ROAD.off); // the road along the station side
const PAD = { x: 1.4, z: -(HALF + 2.6) }; // the place of the bus at the station
const SPOT = { x: -0.2, z: -1.7 }; // the place in the lot of the vehicle that leaves, and gets replaced

type V = 'car' | 'van' | 'bus';
const PARKED: { type: V; color: ColorId; x: number; z: number; h: number }[] = [
  { type: 'car', color: 'red', x: -1.8, z: 1.7, h: 180 },
  { type: 'car', color: 'blue', x: 1.9, z: 1.9, h: 0 },
  { type: 'van', color: 'green', x: 1.5, z: -0.3, h: 90 },
  { type: 'car', color: 'pink', x: -1.9, z: -0.2, h: 270 },
  { type: 'van', color: 'orange', x: 0.2, z: 1.2, h: 0 },
];
const BUSES: ColorId[] = ['yellow', 'cyan'];
const rad = (d: number): number => (d * Math.PI) / 180;
const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

type P = { x: number; z: number };
/** A point along a polyline by the share t (0..1) of its length, and the heading there. */
function along(pts: P[], t: number): { x: number; z: number; h: number } {
  const lens: number[] = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    lens.push(l);
    total += l;
  }
  let d = clamp01(t) * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const f = lens[i] ? Math.min(1, d / lens[i]) : 0;
      const a = pts[i];
      const b = pts[i + 1];
      return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, h: (Math.atan2(b.z - a.z, b.x - a.x) * 180) / Math.PI };
    }
    d -= lens[i];
  }
  return { ...pts[pts.length - 1], h: 0 };
}

export function createLobbyIsland(ctx: LobbyIslandCtx): LobbyIslandHandle {
  const { shadows, reduced } = ctx;
  const mats = new Materials();
  const world = new T.Group(); // the miniature, in game units
  world.scale.setScalar(K);
  world.position.set(0, 0.04 + (HALF + 0.4) * K * Math.sin(0.4), 0.3);
  world.rotation.x = 0.4; // tipped toward the camera, which looks along the island: the whole lot and the station show
  const root = new T.Group();
  root.add(world);
  const sparks = new Particles(shadows ? 40 : 20, new T.SphereGeometry(1, 6, 5), new T.MeshBasicMaterial({ color: '#ffffff' }));
  root.add(sparks.mesh);

  // the lot, the road and the station
  const own: { dispose(): void }[] = [];
  const keep = <A extends { dispose(): void }>(x: A): A => (own.push(x), x);
  const pad = new T.Mesh(keep(roundedBox(HALF * 2 + 0.6, 0.12, HALF * 2 + 0.6, 0.5)), mats.get('#f9eedd', { rough: 0.9 }));
  pad.position.y = 0.0;
  pad.receiveShadow = shadows;
  world.add(pad);
  const asphalt = keep(new T.MeshStandardMaterial({ color: '#4a4f66', roughness: 0.9 }));
  const ring = (w: number, d: number, x: number, z: number): void => {
    const m = new T.Mesh(keep(new T.BoxGeometry(w, 0.06, d)), asphalt);
    m.position.set(x, 0.06, z);
    world.add(m);
  };
  ring(HALF * 2 + 1.2, ROAD.width, 0, HALF + ROAD.off);
  ring(HALF * 2 + 1.2, ROAD.width, 0, -(HALF + ROAD.off));
  ring(ROAD.width, HALF * 2 + 1.2, HALF + ROAD.off, 0);
  ring(ROAD.width, HALF * 2 + 1.2, -(HALF + ROAD.off), 0);
  const platform = new T.Mesh(keep(roundedBox(5.4, 0.12, 2.4, 0.4)), mats.get('#8c6bb5', { rough: 0.9 }));
  platform.position.set(0.3, 0.0, PAD.z);
  platform.receiveShadow = shadows;
  world.add(platform);
  for (const x of [-1.4, 0, 1.4, 2.8]) {
    const slot = new T.Mesh(keep(roundedBox(1.2, 0.08, 1.9, 0.2)), mats.get(x === 1.4 ? '#6e4f9a' : '#7d60a6', { rough: 0.85 }));
    slot.position.set(x, 0.1, PAD.z);
    world.add(slot);
  }

  // the vehicles: five that stay, two buses that take turns leaving and arriving
  const place = (m: T.Object3D, x: number, z: number, h: number, s = 1): void => {
    m.position.set(x, 0.1, z);
    m.rotation.y = -rad(h);
    m.scale.setScalar(s);
  };
  const parked = PARKED.map((p) => {
    const g = new T.Group();
    const m = makeVehicle(p.type, p.color, true);
    m.castShadow = shadows;
    g.add(m);
    place(g, p.x, p.z, p.h);
    world.add(g);
    return { g, p, hop: new Spring(0, 160, 10) };
  });
  const buses = BUSES.map((c) => {
    const g = new T.Group();
    const m = makeVehicle('bus', c, true);
    m.castShadow = shadows;
    g.add(m);
    world.add(g);
    return { g, hop: new Spring(0, 160, 10) };
  });
  // the passengers: little coloured figures that wait in a row behind the station and jump into the bus
  const personGeo = keep(new T.CapsuleGeometry(0.2, 0.32, 4, 8));
  const headGeo = keep(new T.SphereGeometry(0.22, 10, 8));
  const people = [0, 1, 2].map((i) => {
    const g = new T.Group();
    const hex = COLOR_HEX[(['yellow', 'red', 'blue'] as ColorId[])[i]];
    const mat = keep(new T.MeshStandardMaterial({ color: hex, roughness: 0.5 }));
    const body = new T.Mesh(personGeo, mat);
    body.position.y = 0.4;
    const head = new T.Mesh(headGeo, mat);
    head.position.y = 0.9;
    g.add(body, head);
    world.add(g);
    return g;
  });
  const queueAt = (i: number): P => ({ x: PAD.x + 1.2 + i * 0.5, z: PAD.z - 1.5 });

  // the way out: up out of the lot, along the road to the place at the station; and the way in is the same road from the right
  const outPath: P[] = [{ x: SPOT.x, z: SPOT.z }, { x: SPOT.x, z: ROADZ + 0.1 }, { x: PAD.x, z: ROADZ + 0.1 }, { x: PAD.x, z: PAD.z }];
  const farRight: P = { x: HALF + 2.4, z: ROADZ };
  const awayPath: P[] = [{ x: PAD.x, z: PAD.z }, { x: PAD.x, z: ROADZ + 0.1 }, farRight];
  const inPath: P[] = [farRight, { x: SPOT.x, z: ROADZ + 0.1 }, { x: SPOT.x, z: SPOT.z }];

  let hopNow = false;
  let lastLoop = -1;
  const pose = (b: (typeof buses)[number], q: { x: number; z: number; h: number }, s: number, y = 0): void => {
    place(b.g, q.x, q.z, q.h, s);
    b.g.position.y = 0.1 + y + Math.max(0, b.hop.value);
  };

  return {
    object: root,
    update(dt, time) {
      const loopIdx = Math.floor(time / LOOP);
      const tl = reduced ? 0 : time % LOOP;
      const leaver = buses[loopIdx % 2];
      const newcomer = buses[(loopIdx + 1) % 2];
      if (loopIdx !== lastLoop) lastLoop = loopIdx;
      // the vehicle that leaves: pops, drives out, waits for its passengers, honks, drives off
      const roadS = 0.5; // size on the road
      if (tl < 0.5) {
        pose(leaver, { ...SPOT, h: 270 }, 1, 0);
        const k = Math.sin(clamp01(tl / 0.5) * Math.PI);
        leaver.g.scale.set(1 + 0.07 * k, 1 - 0.18 * k, 1 + 0.07 * k);
        leaver.g.position.y = 0.1 + 0.15 * k * k;
      } else if (tl < 2.6) {
        const u = ease(clamp01((tl - 0.5) / 2.1));
        const q = along(outPath, u);
        pose(leaver, q, 1 - (1 - roadS) * clamp01(u * 3));
      } else if (tl < 5.6) {
        pose(leaver, { x: PAD.x, z: PAD.z, h: 270 }, roadS, 0);
        // a honk at 4.6 s: a little hop and a puff
        const honk = clamp01((tl - 4.6) / 0.35);
        if (tl >= 4.6 && tl < 5.0) leaver.g.position.y = 0.1 + Math.sin(honk * Math.PI) * 0.18;
      } else if (tl < 7.4) {
        const u = ease(clamp01((tl - 5.6) / 1.8));
        const q = along(awayPath, u);
        pose(leaver, q, roadS * (1 - clamp01((u - 0.7) / 0.3)));
      } else leaver.g.scale.setScalar(0.0001);
      // the one that comes in
      if (tl > 5.6 && tl < 8.4) {
        const u = ease(clamp01((tl - 5.6) / 2.8));
        const q = along(inPath, u);
        pose(newcomer, q, roadS + (1 - roadS) * clamp01((u - 0.6) / 0.4));
      } else if (tl >= 8.4) {
        pose(newcomer, { ...SPOT, h: 270 }, 1);
      } else newcomer.g.scale.setScalar(0.0001);
      // passengers: they hop into the bus one by one while it waits (2.6 s to 4.4 s)
      people.forEach((g, i) => {
        const start = 2.7 + i * 0.55;
        const u = clamp01((tl - start) / 0.5);
        const from = queueAt(i);
        const to = { x: PAD.x, z: PAD.z };
        if (tl < start - 0.01) {
          g.visible = tl > 0.6 && tl < 5.9;
          g.position.set(from.x, 0.1, from.z);
          g.scale.setScalar(0.75);
        } else if (u < 1) {
          g.visible = true;
          g.position.set(from.x + (to.x - from.x) * u, 0.1 + Math.sin(u * Math.PI) * 1.3, from.z + (to.z - from.z) * u);
          g.scale.setScalar(0.75 * (1 - 0.3 * u));
        } else g.visible = false;
      });
      if (reduced) people.forEach((g) => (g.visible = false));
      // the tap: every vehicle hops at once
      if (hopNow) {
        hopNow = false;
        parked.forEach((p) => (p.hop.velocity = 3.2));
        buses.forEach((b) => (b.hop.velocity = 3.2));
      }
      for (const p of parked) {
        p.hop.step(dt);
        p.g.position.y = 0.1 + Math.max(0, p.hop.value);
      }
      for (const b of buses) b.hop.step(dt);
      // sparkles: where the bus honks and where the vehicle arrives
      if (!reduced) {
        const prev = ((time - dt) % LOOP + LOOP) % LOOP;
        if (prev < 4.6 && tl >= 4.6) sparks.emit(new T.Vector3((PAD.x * K) , 0.35, 0.3 + PAD.z * K), 8, { colors: ['#ffd23f', '#ffffff'], speed: 1.0, size: 0.04, life: 0.7 });
        if (prev < 8.4 && tl >= 8.4) sparks.emit(new T.Vector3(SPOT.x * K, 0.3, 0.3 + SPOT.z * K), 6, { colors: ['#ffffff', '#bfe9ff'], speed: 0.9, size: 0.035 });
      }
      sparks.update(dt);
    },
    tap() {
      hopNow = true;
    },
    dispose() {
      own.forEach((o) => o.dispose());
      sparks.dispose();
      mats.dispose();
    },
  };
}
