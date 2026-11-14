/**
 * The ride in 3D (SPEC-park.md 3.5): the track of the side view built in Three.js with gentle bends to the right and to the left, the camera in
 * the first car. Loaded only when Rani goes for the ride (a dynamic import). The same ride as the side view: the car goes by the same samples.
 */
import * as T from '../../../lobby3d/lib';
import { QualityMonitor } from '../../../lobby3d/quality';
import type { SoundApi } from '../../../sound';
import { sample, duration, type Ride } from './physics';
import { END, type Path } from './track';
import { buildCurve, placeScenery, STRIDE, sway } from './scenery';

export interface Ride3DOptions {
  /** less motion: no shake of the camera, no widening of the view ("calm ride", in the parents area) */
  calm: boolean;
  /** the quality of the device: 'high' has antialiasing and shadows off anyway; 'medium' is lighter */
  tier: 'high' | 'medium';
  /** the colour of the track and a number that makes the bends of the track always the same for it */
  color: string;
  seed: number;
  /** the picture of the companion (the squishy she chose, or Cheesy): his top is seen at the bottom of the screen */
  companionUrl?: string;
  sound: SoundApi;
  /** the ride is over (the car stopped at the station) */
  onEnd(): void;
  /** the view is slow: the caller may go back to the side view */
  onSlow?(): void;
  /** every frame: the distance of the car (for the dark of a tunnel and the water of a splash) */
  onFrame?(s: number): void;
}
export interface Ride3D {
  setCamera(c: 'first' | 'side'): void;
  /** hands up and "wheee!" (a tap on the screen) */
  cheer(): void;
  dispose(): void;
  /** jumps to a moment of the ride, in seconds (for the screenshots), and to the middle of the loop (false when there is no loop) */
  seek(t: number): void;
  seekLoop(fraction: number, which?: number): boolean;
  /** for tests and the numbers of the display */
  stats(): { calls: number; triangles: number };
}

const GAP = 0.95;
export { sway };

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

  // ---- the 3D curve: the points of the side view, bent sideways (scenery.ts) ----
  const stride = STRIDE;
  const curve = buildCurve(path, o.seed, o.calm);
  const { P, Tg, Up, Rt, n } = curve;
  const land = placeScenery(path, curve, o.seed, o.tier);
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
  const tieMat = keep(new T.MeshStandardMaterial({ color: '#ffd9ec', roughness: 0.7 }));
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
  const pillarMat = keep(new T.MeshStandardMaterial({ color: '#e3d2f7', roughness: 0.7 }));
  const pillars = land.pillars.map((q) => new T.Matrix4().compose(new T.Vector3(q.x, q.h / 2, q.z), new T.Quaternion(), new T.Vector3(1, q.h, 1)));
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

  // ---- the front of the first car and the top of the companion, at the bottom of the view ----
  const cockpit = new T.Group();
  const nose = new T.Mesh(carGeo, keep(new T.MeshStandardMaterial({ color: carColors[0], roughness: 0.3 })));
  nose.scale.set(1.15, 0.8, 1.3);
  nose.position.set(0, -0.78, -1.15);
  cockpit.add(nose);
  if (o.companionUrl) {
    const im = new Image();
    im.onload = () => {
      if (disposedFlag) return;
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      c.getContext('2d')!.drawImage(im, 0, 0, 256, 256);
      const tex = keep(new T.CanvasTexture(c));
      tex.colorSpace = T.SRGBColorSpace;
      const sp = new T.Sprite(keep(new T.SpriteMaterial({ map: tex, transparent: true })));
      sp.scale.set(0.42, 0.42, 1);
      sp.position.set(0, -0.5, -1.0);
      cockpit.add(sp);
    };
    im.src = o.companionUrl;
  }
  cam.add(cockpit);
  scene.add(cam);
  let disposedFlag = false;

  // ---- the land: grass, hills far and near, candy trees on both sides of the track, clouds, and things that pass close by ----
  const grassTex = ((): T.Texture => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#8fe07a';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = i % 2 ? 'rgba(190,255,150,.55)' : 'rgba(90,190,100,.35)';
      g.beginPath();
      g.ellipse(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 7, 2 + Math.random() * 3, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
    const tex = keep(new T.CanvasTexture(c));
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(60, 60);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  })();
  const ground = new T.Mesh(keep(new T.PlaneGeometry(500, 500)), keep(new T.MeshStandardMaterial({ map: grassTex, roughness: 1 })));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const rnd = ((): (() => number) => {
    let a = o.seed + 17;
    return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
  })();
  const hillGeo = keep(new T.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2));
  const hillMat = keep(new T.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }));
  const hills = new T.InstancedMesh(hillGeo, hillMat, 22);
  const hillColors = ['#e7d4ff', '#c9f0dd', '#ffd6ea', '#d6e8ff'];
  const colh = new T.Color();
  for (let i = 0; i < 22; i++) {
    const side = i % 2 ? 1 : -1;
    const far = i < 10;
    const sc = far ? 14 + rnd() * 12 : 6 + rnd() * 6;
    hills.setMatrixAt(i, new T.Matrix4().compose(new T.Vector3(-10 + (i / 22) * 70 + rnd() * 6, 0, side * (far ? 70 + rnd() * 40 : 24 + rnd() * 16)), new T.Quaternion(), new T.Vector3(sc * 1.7, sc * 0.75, sc)));
    hills.setColorAt(i, colh.set(hillColors[i % hillColors.length]));
  }
  scene.add(hills);
  const stemGeo = keep(new T.CylinderGeometry(0.06, 0.06, 1, 5));
  const stemMat = keep(new T.MeshStandardMaterial({ color: '#ffffff' }));
  const popGeo = keep(new T.SphereGeometry(0.5, 10, 8));
  const popMat = keep(new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }));
  const trees = land.trees.length;
  const stems = new T.InstancedMesh(stemGeo, stemMat, trees);
  const pops = new T.InstancedMesh(popGeo, popMat, trees);
  const col = new T.Color();
  land.trees.forEach((q, i) => {
    stems.setMatrixAt(i, new T.Matrix4().compose(new T.Vector3(q.x, q.h / 2, q.z), new T.Quaternion(), new T.Vector3(1, q.h, 1)));
    pops.setMatrixAt(i, new T.Matrix4().compose(new T.Vector3(q.x, q.y, q.z), new T.Quaternion(), new T.Vector3(q.r, q.r, q.r)));
    pops.setColorAt(i, col.set(q.c));
  });
  scene.add(stems, pops);
  const cloudGeo = keep(new T.SphereGeometry(1, 10, 8));
  const cloudMat = keep(new T.MeshStandardMaterial({ color: '#ffffff', roughness: 1 }));
  const clouds = new T.InstancedMesh(cloudGeo, cloudMat, 26);
  for (let i = 0; i < 26; i++) {
    const cx = -4 + (i % 13) * 3.4 + rnd() * 2, cy = 12 + rnd() * 9, cz = (i < 13 ? -1 : 1) * (14 + rnd() * 22);
    clouds.setMatrixAt(i, new T.Matrix4().compose(new T.Vector3(cx, cy, cz), new T.Quaternion(), new T.Vector3(3 + rnd() * 2.5, 1.2, 1.9)));
  }
  scene.add(clouds);
  // posts with flags close to the track, one every few units on both sides: they rush by and give the feeling of speed
  const postGeo = keep(new T.CylinderGeometry(0.05, 0.05, 1, 5));
  const flagGeo = keep(new T.BoxGeometry(0.75, 0.42, 0.03));
  const posts = land.posts;
  const postMesh = new T.InstancedMesh(postGeo, stemMat, Math.max(1, posts.length));
  const flagMesh = new T.InstancedMesh(flagGeo, popMat, Math.max(1, posts.length));
  posts.forEach((q, i) => {
    const gy = 0;
    postMesh.setMatrixAt(i, new T.Matrix4().compose(new T.Vector3(q.x, gy + q.h / 2, q.z), new T.Quaternion(), new T.Vector3(1, q.h, 1)));
    flagMesh.setMatrixAt(i, new T.Matrix4().compose(new T.Vector3(q.x + 0.38, gy + q.h - 0.25, q.z), new T.Quaternion(), new T.Vector3(1, 1, 1)));
    flagMesh.setColorAt(i, col.set(q.c));
  });
  postMesh.count = flagMesh.count = posts.length;
  scene.add(postMesh, flagMesh);
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
  const sampleFns = { dur: duration(ride) };
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
    o.onFrame?.(s);
    // the cars on the track
    cars.forEach((c, k) => {
      const q = poseAt(Math.max(0.3, s - k * GAP));
      c.position.copy(q.p).addScaledVector(q.u, 0.25);
      const m = new T.Matrix4().makeBasis(q.t, q.u, q.r);
      c.quaternion.setFromRotationMatrix(m);
      c.visible = camMode === 'side' || k > 0;
      cockpit.visible = camMode === 'first';
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
      cam.fov = 62;
      cam.updateProjectionMatrix();
      const target = q.p.clone();
      cam.position.set(target.x - 1.5, target.y + 2.2, target.z + 3.2);
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
    seek: (x) => void (t = Math.min(sampleFns.dur, Math.max(0, x))),
    seekLoop: (f, which = 0) => {
      const lp = path.loops[which];
      if (!lp) return false;
      const target = lp[0] + (lp[1] - lp[0]) * f;
      let k = 0;
      while (k < ride.s.length - 1 && ride.s[k] < target) k++;
      t = ride.t[k];
      return true;
    },
    cheer: () => {
      hands = 1;
      o.sound.play('wheee');
    },
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    dispose: () => {
      disposed = true;
      disposedFlag = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      disposables.forEach((d) => d.dispose());
      [hills, stems, pops, clouds, ties, pil, postMesh, flagMesh].forEach((m) => m.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
