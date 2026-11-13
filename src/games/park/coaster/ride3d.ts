/**
 * The ride in 3D (SPEC-park.md 3.5): the track of the side view built in Three.js with gentle bends to the right and to the left, the camera in
 * the first car. Loaded only when Rani goes for the ride (a dynamic import). The same ride as the side view: the car goes by the same samples.
 */
import * as T from '../../../lobby3d/lib';
import { QualityMonitor } from '../../../lobby3d/quality';
import type { SoundApi } from '../../../sound';
import { sample, duration, type Ride } from './physics';
import { END, type Path } from './track';

export interface Ride3DOptions {
  /** less motion: no shake of the camera, no widening of the view ("calm ride", in the parents area) */
  calm: boolean;
  /** the quality of the device: 'high' has antialiasing and shadows off anyway; 'medium' is lighter */
  tier: 'high' | 'medium';
  /** the colour of the track and a number that makes the bends of the track always the same for it */
  color: string;
  seed: number;
  sound: SoundApi;
  /** the ride is over (the car stopped at the station) */
  onEnd(): void;
  /** the view is slow: the caller may go back to the side view */
  onSlow?(): void;
}
export interface Ride3D {
  setCamera(c: 'first' | 'side'): void;
  /** hands up and "wheee!" (a tap on the screen) */
  cheer(): void;
  dispose(): void;
  /** for tests and the numbers of the display */
  stats(): { calls: number; triangles: number };
}

const GAP = 0.95;
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The sideways bend of the track at distance s: gentle, zero on the lift, inside the loop and at the station. */
export function sway(path: Path, s: number, seed: number): number {
  const a = ((seed * 9301 + 49297) % 233280) / 233280;
  const b = ((seed * 7919 + 1013) % 4096) / 4096;
  let mask = smooth(path.crestS + 1, path.crestS + 6, s);
  if (path.loopS) mask *= 1 - smooth(path.loopS[0] - 5, path.loopS[0] - 1, s) * (1 - smooth(path.loopS[1] + 1, path.loopS[1] + 5, s));
  if (path.endS < Infinity) mask *= 1 - smooth(path.endS - 7, path.endS - 1, s);
  return mask * (2.6 * Math.sin(s * 0.13 + a * 6.28) + 3.4 * Math.sin(s * 0.047 + b * 6.28));
}

export async function startRide3d(container: HTMLElement, path: Path, ride: Ride, o: Ride3DOptions): Promise<Ride3D> {
  const renderer = new T.WebGLRenderer({ antialias: o.tier === 'high', powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, o.tier === 'high' ? 2 : 1.5));
  renderer.domElement.className = 'pk-ride3d';
  container.appendChild(renderer.domElement);
  const scene = new T.Scene();
  const sky = new T.Color('#bfe6ff');
  scene.background = sky;
  scene.fog = new T.Fog('#d9efff', 40, 150);
  scene.add(new T.HemisphereLight('#ffffff', '#ffc4de', 1.5));
  const sun = new T.DirectionalLight('#fff4e0', 2);
  sun.position.set(20, 40, 30);
  scene.add(sun);
  const cam = new T.PerspectiveCamera(62, 1, 0.1, 300);
  const disposables: { dispose(): void }[] = [];
  const keep = <X extends { dispose(): void }>(x: X): X => (disposables.push(x), x);

  // ---- the 3D curve: the points of the side view, bent sideways ----
  const stride = 3;
  const n = Math.floor((path.n - 1) / stride) + 1;
  const P: T.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const k = Math.min(path.n - 1, i * stride);
    P.push(new T.Vector3(path.x[k], path.y[k], sway(path, path.s[k], o.seed)));
  }
  // the frames: parallel transport of "up" (it turns upside down in the loop and comes back), and a lean into the bends
  const Tg: T.Vector3[] = [], Up: T.Vector3[] = [], Rt: T.Vector3[] = [];
  let up = new T.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const t = P[Math.min(n - 1, i + 1)].clone().sub(P[Math.max(0, i - 1)]).normalize();
    up = up.clone().sub(t.clone().multiplyScalar(up.dot(t))).normalize();
    Tg.push(t);
    Up.push(up);
  }
  const lean = new Float32Array(n);
  for (let i = 2; i < n - 2; i++) {
    // the sideways acceleration of the bend, as an angle
    const acc = (P[i + 2].z - 2 * P[i].z + P[i - 2].z) / 0.9;
    lean[i] = Math.max(-0.5, Math.min(0.5, -acc * 0.35));
  }
  for (let i = 0; i < n; i++) {
    const q = new T.Quaternion().setFromAxisAngle(Tg[i], o.calm ? 0 : lean[i]);
    Up[i] = Up[i].clone().applyQuaternion(q);
    Rt.push(Tg[i].clone().cross(Up[i]).normalize());
  }
  const idxOf = (s: number): number => Math.min(n - 1.001, Math.max(0, s / (path.s[1] * stride)));
  const poseAt = (s: number): { p: T.Vector3; t: T.Vector3; u: T.Vector3; r: T.Vector3 } => {
    const f = idxOf(s);
    const i = Math.floor(f);
    const k = f - i;
    return {
      p: P[i].clone().lerp(P[i + 1], k),
      t: Tg[i].clone().lerp(Tg[i + 1], k).normalize(),
      u: Up[i].clone().lerp(Up[i + 1], k).normalize(),
      r: Rt[i].clone().lerp(Rt[i + 1], k).normalize(),
    };
  };

  // ---- the rails (two thin strips lofted along the curve), the sleepers, the pillars ----
  const color = new T.Color(o.color);
  const railMat = keep(new T.MeshStandardMaterial({ color, roughness: 0.35 }));
  const railGeo = (side: number): T.BufferGeometry => {
    const pos: number[] = [];
    const idx: number[] = [];
    const w = 0.045;
    for (let i = 0; i < n; i++) {
      const c = P[i].clone().addScaledVector(Rt[i], side * 0.3);
      const corners = [[-w, -w], [w, -w], [w, w], [-w, w]];
      for (const [a, b] of corners) {
        const v = c.clone().addScaledVector(Rt[i], a).addScaledVector(Up[i], b);
        pos.push(v.x, v.y, v.z);
      }
      if (i > 0) {
        const b0 = (i - 1) * 4, b1 = i * 4;
        for (let k = 0; k < 4; k++) {
          const k2 = (k + 1) % 4;
          idx.push(b0 + k, b1 + k, b1 + k2, b0 + k, b1 + k2, b0 + k2);
        }
      }
    }
    const g = keep(new T.BufferGeometry());
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  scene.add(new T.Mesh(railGeo(-1), railMat), new T.Mesh(railGeo(1), railMat));
  const tieGeo = keep(new T.BoxGeometry(0.8, 0.05, 0.1));
  const tieMat = keep(new T.MeshStandardMaterial({ color: '#5a3a6a', roughness: 0.8 }));
  const ties = new T.InstancedMesh(tieGeo, tieMat, Math.ceil(n / 3));
  const m4 = new T.Matrix4();
  let nt = 0;
  for (let i = 0; i < n; i += 3) {
    m4.makeBasis(Rt[i], Up[i], Tg[i]).setPosition(P[i].x, P[i].y - 0.08, P[i].z);
    ties.setMatrixAt(nt++, m4);
  }
  ties.count = nt;
  scene.add(ties);
  const pillarGeo = keep(new T.CylinderGeometry(0.07, 0.09, 1, 6));
  const pillarMat = keep(new T.MeshStandardMaterial({ color: '#8a6aa8', roughness: 0.7 }));
  const pillars: T.Matrix4[] = [];
  let lastX = -9;
  for (let i = 0; i < n; i += 4) {
    if (path.inLoop[Math.min(path.n - 1, i * stride)] || P[i].x - lastX < 1.8 || P[i].y < 0.6) continue;
    lastX = P[i].x;
    const h = P[i].y - 0.1;
    pillars.push(new T.Matrix4().compose(new T.Vector3(P[i].x, h / 2, P[i].z), new T.Quaternion(), new T.Vector3(1, h, 1)));
  }
  const pil = new T.InstancedMesh(pillarGeo, pillarMat, Math.max(1, pillars.length));
  pillars.forEach((m, i) => pil.setMatrixAt(i, m));
  pil.count = pillars.length;
  scene.add(pil);

  // ---- the cars ----
  const carColors = ['#ff7aa8', '#ffb84d', '#5ad1ff'];
  const carGeo = keep(new T.RoundedBoxGeometry(0.8, 0.4, 0.55, 3, 0.1));
  const cars = carColors.map((c) => {
    const m = new T.Mesh(carGeo, keep(new T.MeshStandardMaterial({ color: c, roughness: 0.3 })));
    scene.add(m);
    return m;
  });

  // ---- the land: the ground, hills, lollipop trees, clouds ----
  const ground = new T.Mesh(keep(new T.PlaneGeometry(500, 500)), keep(new T.MeshStandardMaterial({ color: '#ffc4de', roughness: 1 })));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const rnd = ((): (() => number) => {
    let a = o.seed + 17;
    return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
  })();
  const hillGeo = keep(new T.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2));
  const hillMat = keep(new T.MeshStandardMaterial({ color: '#c9f0dd', roughness: 1 }));
  const hills = new T.InstancedMesh(hillGeo, hillMat, 14);
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1;
    const sc = 5 + rnd() * 7;
    hills.setMatrixAt(i, new T.Matrix4().compose(new T.Vector3(i * 2.4 - 4, 0, side * (22 + rnd() * 25)), new T.Quaternion(), new T.Vector3(sc * 1.6, sc * 0.8, sc)));
  }
  scene.add(hills);
  const stemGeo = keep(new T.CylinderGeometry(0.06, 0.06, 1, 5));
  const stemMat = keep(new T.MeshStandardMaterial({ color: '#ffffff' }));
  const popGeo = keep(new T.SphereGeometry(0.5, 10, 8));
  const popMat = keep(new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }));
  const trees = o.tier === 'high' ? 46 : 26;
  const stems = new T.InstancedMesh(stemGeo, stemMat, trees);
  const pops = new T.InstancedMesh(popGeo, popMat, trees);
  const col = new T.Color();
  const palette = ['#ff5d8f', '#ffb84d', '#7ad7ff', '#b58cff', '#8fe36b'];
  for (let i = 0; i < trees; i++) {
    const x = rnd() * 32 - 2;
    const z = (rnd() < 0.5 ? -1 : 1) * (4 + rnd() * 14);
    const h = 1.2 + rnd() * 1.8;
    stems.setMatrixAt(i, new T.Matrix4().compose(new T.Vector3(x, h / 2, z), new T.Quaternion(), new T.Vector3(1, h, 1)));
    const r = 0.7 + rnd() * 0.5;
    pops.setMatrixAt(i, new T.Matrix4().compose(new T.Vector3(x, h + r * 0.3, z), new T.Quaternion(), new T.Vector3(r, r, r)));
    pops.setColorAt(i, col.set(palette[i % palette.length]));
  }
  scene.add(stems, pops);
  const cloudGeo = keep(new T.SphereGeometry(1, 10, 8));
  const cloudMat = keep(new T.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }));
  const clouds = new T.InstancedMesh(cloudGeo, cloudMat, 18);
  for (let i = 0; i < 18; i++) {
    const cx = (i % 6) * 6 + rnd() * 3, cy = 13 + rnd() * 6, cz = (i < 9 ? -1 : 1) * (14 + rnd() * 12);
    clouds.setMatrixAt(i, new T.Matrix4().compose(new T.Vector3(cx, cy, cz), new T.Quaternion(), new T.Vector3(3 + rnd() * 2, 1.1, 1.8)));
  }
  scene.add(clouds);
  // the station banner at the end
  const banner = new T.Mesh(keep(new T.BoxGeometry(0.1, 2.4, 0.1)), keep(new T.MeshStandardMaterial({ color: '#ffffff' })));
  banner.position.set(END.x + 1.4, 1.2, 0);
  scene.add(banner);

  // ---- the ride ----
  let camMode: 'first' | 'side' = 'first';
  let t = 0;
  let endAt = -1;
  let hands = 0;
  let disposed = false;
  let raf = 0;
  let last = performance.now();
  let tick = 0;
  const monitor = new QualityMonitor(() => o.onSlow?.());
  const dur = duration(ride);
  const size = (): void => {
    const w = container.clientWidth || 360;
    const h = container.clientHeight || 640;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  };
  size();
  const ro = new ResizeObserver(size);
  ro.observe(container);

  const frame = (now: number): void => {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    monitor.sample(dt);
    t = Math.min(dur, t + dt);
    const { s, v } = sample(ride, t);
    // the cars on the track
    cars.forEach((c, k) => {
      const q = poseAt(Math.max(0.3, s - k * GAP));
      c.position.copy(q.p).addScaledVector(q.u, 0.25);
      const m = new T.Matrix4().makeBasis(q.t, q.u, q.r);
      c.quaternion.setFromRotationMatrix(m);
      c.visible = camMode === 'side' || k > 0;
    });
    const q = poseAt(s);
    const speed = Math.abs(v);
    if (camMode === 'first') {
      const calm = o.calm;
      cam.fov = 72 + (calm ? 0 : Math.min(16, speed * 1.3)) + hands * 6;
      cam.updateProjectionMatrix();
      const shake = calm ? 0 : Math.min(0.03, speed * 0.003);
      cam.position.copy(q.p).addScaledVector(q.u, 0.85 + (Math.random() - 0.5) * shake).addScaledVector(q.r, (Math.random() - 0.5) * shake);
      const ahead = poseAt(s + 3.2);
      cam.up.copy(q.u);
      cam.lookAt(ahead.p.clone().addScaledVector(ahead.u, 0.45));
    } else {
      cam.fov = 55;
      cam.updateProjectionMatrix();
      const target = q.p.clone();
      cam.position.set(target.x - 2, target.y + 3.2, target.z + 11);
      cam.up.set(0, 1, 0);
      cam.lookAt(target);
    }
    hands = Math.max(0, hands - dt * 1.5);
    renderer.render(scene, cam);
    // sounds of the ride
    tick += dt;
    if (tick > 0.2 && t < dur) {
      tick = 0;
      if (s < path.crestS) o.sound.play('chain');
      else if (speed > 4) o.sound.play('wind', 120 + speed * 45);
    }
    if (t >= dur && endAt < 0) {
      endAt = now;
      o.sound.play('fanfare');
    }
    if (endAt > 0 && now - endAt > 1400) {
      endAt = Infinity;
      o.onEnd();
    }
  };
  raf = requestAnimationFrame(frame);

  return {
    setCamera: (c) => void (camMode = c),
    cheer: () => {
      hands = 1;
      o.sound.play('wheee');
    },
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      disposables.forEach((d) => d.dispose());
      [hills, stems, pops, clouds, ties, pil].forEach((m) => m.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
