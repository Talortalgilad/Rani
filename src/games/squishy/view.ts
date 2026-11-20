/**
 * The view of a squishy (stage 1): a flat picture on a grid of springs in WebGL (squeeze.ts), on a pastel work mat on the table, with a soft shadow; in the tier `2d` the same picture is a
 * plain canvas that squashes and stretches as a whole. It draws whatever the game paints on its canvas (the squishy, its decorations, its face), reports taps (in pixels of the picture)
 * and, in the squeeze mode, lets the finger press, stretch and release it (with a low sound, a short vibration, the eyes that look at the finger and close, and a small pop when it is back).
 */
import { buzz } from '../../haptics';
import { sound } from '../../sound';
import { getState } from '../../storage';
import { getTier, sessionTier } from '../../lobby3d/quality';
import type { FaceState } from './faces';
import { SIZE, type Loaded } from './shapes';
import { SquishGrid, type Finger } from './squeeze';

export const HALF = 1.18;
const FIT_W = 2.9, FIT_H = 3.5;
/** where the base stands on the screen (the share of the height): on the mat, above the controls */
const BASE_FRAC = 0.7;
/** the base of the squishy stands this far above the bottom of the place that it has (pixels) */
const BASE_LIFT = 18;
export type ViewMode = 'idle' | 'squeeze';
export type PaintFn = (g: CanvasRenderingContext2D, face: FaceState, look: { x: number; y: number }) => void;
export interface ViewOpts {
  /** the element that gets the touches (it covers the place of the squishy) */
  host: HTMLElement;
}

export class SquishView {
  readonly canvas = document.createElement('canvas');
  readonly grid = new SquishGrid(16);
  mode: ViewMode = 'idle';
  /** the flat view (tier 2d): the page keeps its own background */
  flat = false;
  stats = { fps: 0, ms: 0, longest: 0 };
  squeezes = 0;
  /** a tap (not a drag) in pixels of the picture */
  onTap?: (p: { x: number; y: number }) => void;
  /** a squeeze began (the count of the squeezes of this view) */
  onSqueeze?: (n: number) => void;
  private g = this.canvas.getContext('2d', { willReadFrequently: true })!;
  private loaded: Loaded | null = null;
  private paint: PaintFn = () => void 0;
  private dirty = true;
  private face: FaceState = 'open';
  private look = { x: 0, y: 0 };
  private lookT = 0;
  private blinkT = 0;
  private nextBlink = 2;
  private peak = 0;
  private popped = true;
  private deepDone = false;
  private finger: Finger | null = null;
  private downAt = 0;
  private downXY = { x: 0, y: 0 };
  private moved = false;
  private toPicture: (cx: number, cy: number) => { x: number; y: number } = () => ({ x: 0, y: 0 });
  private onPainted: (() => void) | null = null;
  private handle: { dispose(): void } | null = null;
  private flatStop: (() => void) | null = null;
  private flatBox: HTMLElement | null = null;
  private dead = false;
  /** where the base stands on the screen (the share of the height): from the place that the game gives the squishy */
  private baseFrac = BASE_FRAC;
  private rectT = 0;
  private hop = 0;
  private acc = 0;
  private frames = 0;
  private msAcc = 0;
  private longest = 0;
  private cleanups: (() => void)[] = [];

  constructor(private o: ViewOpts) {
    this.canvas.width = this.canvas.height = SIZE;
    const h = o.host;
    const on = <K extends keyof HTMLElementEventMap>(t: K, f: (e: HTMLElementEventMap[K]) => void): void => {
      h.addEventListener(t, f as EventListener);
      this.cleanups.push(() => h.removeEventListener(t, f as EventListener));
    };
    on('pointerdown', (e) => this.down(e));
    on('pointermove', (e) => this.move(e));
    on('pointerup', (e) => this.up(e));
    on('pointercancel', (e) => this.up(e));
  }

  setLoaded(l: Loaded): void {
    this.loaded = l;
    this.grid.reset();
    this.dirty = true;
  }
  /** what is drawn on the canvas */
  setPaint(f: PaintFn): void {
    this.paint = f;
    this.dirty = true;
  }
  invalidate(): void {
    this.dirty = true;
  }
  /** a little hop of the whole squishy (a colour was put on, a decoration was stuck) */
  bounce(): void {
    this.hop = 1;
  }
  setMode(m: ViewMode): void {
    this.mode = m;
    if (m === 'squeeze') {
      this.squeezes = 0;
      this.face = 'open';
    } else this.grid.release();
    this.dirty = true;
  }

  // ---------------------------------------------------------------- touch
  private pic(e: PointerEvent): { x: number; y: number } {
    return this.toPicture(e.clientX, e.clientY);
  }
  private px(p: { x: number; y: number }): { x: number; y: number } {
    return { x: ((p.x + 1) / 2) * SIZE, y: ((1 - p.y) / 2) * SIZE };
  }
  private down(e: PointerEvent): void {
    if (!this.loaded || this.finger) return;
    try { this.o.host.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const p = this.pic(e);
    this.downAt = performance.now();
    this.downXY = { x: e.clientX, y: e.clientY };
    this.moved = false;
    if (this.mode === 'squeeze') {
      this.finger = { x: p.x, y: p.y, x0: p.x, y0: p.y, force: 0.55 };
      this.grid.press(this.finger);
      // the eyes first look at the finger (a moment), then they close
      this.face = 'open';
      const f = this.loaded.face;
      if (f) {
        const fu = (f.x / SIZE) * 2 - 1, fv = 1 - (f.y / SIZE) * 2;
        this.look = { x: Math.max(-1, Math.min(1, (p.x - fu) * 2.4)), y: Math.max(-1, Math.min(1, -(p.y - fv) * 2.4)) };
      }
      this.lookT = 0.2;
      this.peak = 0;
      this.popped = false;
      this.deepDone = false;
      buzz(10);
      this.squeezes++;
      sound.play('squish', 250);
      this.onSqueeze?.(this.squeezes);
      this.dirty = true;
    } else this.finger = { x: p.x, y: p.y, x0: p.x, y0: p.y, force: 0 };
  }
  private move(e: PointerEvent): void {
    if (!this.finger) return;
    if (Math.hypot(e.clientX - this.downXY.x, e.clientY - this.downXY.y) > 10) this.moved = true;
    if (this.mode !== 'squeeze') return;
    const p = this.pic(e);
    this.finger.x = p.x;
    this.finger.y = p.y;
  }
  private up(e: PointerEvent): void {
    if (!this.finger) return;
    const f = this.finger;
    this.finger = null;
    if (this.mode === 'squeeze') {
      this.grid.release();
      this.face = 'open';
      this.look = { x: 0, y: 0 };
      this.lookT = 0;
      this.dirty = true;
    } else if (!this.moved && e.type === 'pointerup') this.onTap?.(this.px({ x: f.x, y: f.y }));
  }

  // ---------------------------------------------------------------- the frame
  private tick(dt: number, t: number): void {
    const g = this.grid;
    if (this.finger && this.mode === 'squeeze') this.finger.force = Math.min(1, 0.55 + ((performance.now() - this.downAt) / 1000) * 1.1);
    g.step(dt);
    if (this.finger && this.mode === 'squeeze') {
      this.peak = Math.max(this.peak, g.maxOffset());
      if (this.lookT > 0) {
        this.lookT -= dt;
        if (this.lookT <= 0) (this.face = 'squeezed'), (this.dirty = true);
      }
      if (!this.deepDone && this.finger.force > 0.97) {
        this.deepDone = true;
        sound.play('squish', 165);
      }
    } else if (!this.popped && !this.finger && this.peak > 0.04 && g.maxOffset() < this.peak * 0.06) {
      this.popped = true;
      sound.play('unsquish', 470 - 260 * Math.min(1, this.peak / 0.4));
    }
    this.hop = Math.max(0, this.hop - dt * 3);
    // a blink now and then
    if (this.loaded?.face && this.face !== 'squeezed') {
      if (this.face === 'blink') {
        this.blinkT -= dt;
        if (this.blinkT <= 0) (this.face = 'open'), (this.dirty = true);
      } else if (t > this.nextBlink) {
        this.face = 'blink';
        this.blinkT = 0.13;
        this.nextBlink = t + 2.4 + Math.random() * 2.4;
        this.dirty = true;
      }
    }
    if (this.dirty && this.loaded) {
      this.paint(this.g, this.face, this.look);
      this.dirty = false;
      this.onPainted?.();
    }
    // the place of the squishy: its base stands near the bottom of the stage, above the panel of the controls
    if (this.rectT-- <= 0) {
      this.rectT = 20;
      const r = this.o.host.getBoundingClientRect();
      if (r.height > 120) this.baseFrac = Math.min(0.92, Math.max(0.35, (r.bottom - BASE_LIFT) / window.innerHeight));
    }
    this.frames++;
    this.acc += dt;
    this.longest = Math.max(this.longest, dt);
    if (this.acc >= 1) {
      this.stats = { fps: this.frames / this.acc, ms: this.msAcc / this.frames, longest: this.longest * 1000 };
      this.frames = 0; this.acc = 0; this.msAcc = 0; this.longest = 0;
    }
  }

  // ---------------------------------------------------------------- start: 3D or flat
  async start(): Promise<void> {
    const flat = sessionTier(getState().settings.lobby) === '2d' || getTier() === '2d';
    if (flat) return this.startFlat();
    try {
      await this.start3d();
    } catch {
      if (!this.dead) this.startFlat();
    }
  }

  private async start3d(): Promise<void> {
    const [{ showScene }, T] = await Promise.all([import('../../lobby3d/stage'), import('../../lobby3d/lib')]);
    if (this.dead) return;
    const grid = this.grid;
    const view = this;
    const handle = await showScene(
      (env) => {
        const prevTone = env.renderer.toneMapping;
        env.renderer.toneMapping = T.NoToneMapping;
        const scene = new T.Scene();
        const camera = new T.PerspectiveCamera(30, env.width / env.height, 0.1, 50);
        const tex = new T.CanvasTexture(view.canvas);
        tex.colorSpace = T.SRGBColorSpace;
        const geo = new T.PlaneGeometry(HALF * 2, HALF * 2, grid.n, grid.n);
        const mat = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
        const mesh = new T.Mesh(geo, mat);
        scene.add(mesh);
        // the work mat: a round cream mat on the table, over the tools of the picture; the shadow falls on it
        const mc = document.createElement('canvas');
        mc.width = 512; mc.height = 256;
        const mg = mc.getContext('2d')!;
        const rg = mg.createRadialGradient(256, 128, 20, 256, 128, 250);
        rg.addColorStop(0, '#fdf3e0'); rg.addColorStop(0.82, '#f6e6c8'); rg.addColorStop(0.9, '#ecd9b8'); rg.addColorStop(0.92, '#ffffff'); rg.addColorStop(1, '#ffffff');
        mg.save(); mg.scale(1, 0.5); mg.fillStyle = rg; mg.beginPath(); mg.arc(256, 256, 250, 0, Math.PI * 2); mg.fill(); mg.restore();
        mg.globalCompositeOperation = 'destination-in';
        mg.save(); mg.scale(1, 0.5); mg.beginPath(); mg.arc(256, 256, 250, 0, Math.PI * 2); mg.fill(); mg.restore();
        const matTex = new T.CanvasTexture(mc);
        matTex.colorSpace = T.SRGBColorSpace;
        const rug = new T.Mesh(new T.PlaneGeometry(2, 1), new T.MeshBasicMaterial({ map: matTex, transparent: true, depthWrite: false, toneMapped: false }));
        rug.position.z = -0.03;
        scene.add(rug);
        const sc = document.createElement('canvas');
        sc.width = sc.height = 128;
        const sg = sc.getContext('2d')!;
        const grad = sg.createRadialGradient(64, 64, 4, 64, 64, 62);
        grad.addColorStop(0, 'rgba(50,25,40,.8)'); grad.addColorStop(0.6, 'rgba(50,25,40,.42)'); grad.addColorStop(1, 'rgba(50,25,40,0)');
        sg.fillStyle = grad; sg.fillRect(0, 0, 128, 128);
        const shadowTex = new T.CanvasTexture(sc);
        const shadow = new T.Mesh(new T.PlaneGeometry(2, 2), new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false }));
        shadow.position.z = -0.01;
        scene.add(shadow);
        const pos = geo.attributes.position as InstanceType<typeof T.BufferAttribute>;
        let visW = 3, visH = 3, baseWorld = 0, restY = 0;
        const place = (): void => {
          baseWorld = (0.5 - view.baseFrac) * visH;
          const l = view.loaded;
          restY = baseWorld - (l ? (1 - (2 * l.box.y1) / SIZE) * HALF : -0.94 * HALF);
        };
        const fit = (w: number, h: number): void => {
          camera.aspect = w / h;
          const need = Math.max(FIT_W / camera.aspect, FIT_H);
          camera.position.set(0, 0, need / (2 * Math.tan((camera.fov * Math.PI) / 360)));
          camera.lookAt(0, 0, 0);
          camera.updateProjectionMatrix();
          visH = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
          visW = visH * camera.aspect;
          place();
        };
        fit(env.width, env.height);
        view.toPicture = (cx, cy) => ({ x: ((cx / window.innerWidth - 0.5) * visW) / HALF, y: ((0.5 - cy / window.innerHeight) * visH - restY) / HALF });
        view.onPainted = () => (tex.needsUpdate = true);
        let time = 0;
        return {
          scene, camera,
          update(dt) {
            time += dt;
            const t0 = performance.now();
            view.tick(dt, time);
            for (let p = 0; p < grid.points; p++) pos.setXY(p, (grid.rest[p * 2] + grid.off[p * 2]) * HALF, (grid.rest[p * 2 + 1] + grid.off[p * 2 + 1]) * HALF);
            pos.needsUpdate = true;
            place();
            let bottom = 0;
            for (let i = 0; i <= grid.n; i++) bottom += grid.off[(grid.n * (grid.n + 1) + i) * 2 + 1];
            bottom /= grid.n + 1;
            mesh.position.y = restY - bottom * HALF;
            const foot = view.loaded?.foot ?? { x0: 80, x1: 432 };
            const rx = ((foot.x1 - foot.x0) / SIZE) * HALF * 0.95;
            const press = Math.min(1, grid.maxOffset() / 0.28);
            const ry = rx * 0.14 * (1 + 0.25 * press);
            shadow.position.set(((foot.x0 + foot.x1) / SIZE - 1) * HALF, baseWorld - ry * 0.25, -0.01);
            shadow.scale.set(rx * (1 + 0.38 * press), ry, 1);
            (shadow.material as InstanceType<typeof T.MeshBasicMaterial>).opacity = 0.75 + 0.25 * press;
            // the mat: wide, under the squishy, covering the tools of the picture
            rug.position.set(0, baseWorld - 0.02, -0.03);
            rug.scale.set(HALF * 1.28, HALF * 1.28 * 0.5 * 0.62, 1);
            mesh.scale.setScalar(1 + Math.sin(view.hop * Math.PI) * 0.05);
            view.msAcc += performance.now() - t0;
          },
          resize(w, h) { fit(w, h); },
          dispose() {
            env.renderer.toneMapping = prevTone;
            view.onPainted = null;
            geo.dispose(); mat.dispose(); tex.dispose(); shadowTex.dispose(); matTex.dispose();
          },
        };
      },
      { autoDowngrade: false, minTier: 'medium', onFallback: () => void 0 },
    );
    if (this.dead) return handle.dispose();
    this.handle = handle;
    handle.fadeIn(0);
    document.body.classList.add('lobby3d-on');
    this.dirty = true;
  }

  private startFlat(): void {
    const box = document.createElement('div');
    box.className = 'sq-flatview';
    const wrap = document.createElement('div');
    wrap.className = 'sq-flatwrap';
    const mat = document.createElement('i');
    mat.className = 'sq-flatmat';
    const shadowEl = document.createElement('i');
    shadowEl.className = 'sq-flatshadow';
    this.canvas.className = 'sq-flatcanvas';
    wrap.append(mat, shadowEl, this.canvas);
    box.appendChild(wrap);
    this.o.host.appendChild(box);
    this.flatBox = box;
    this.flat = true;
    this.onPainted = () => void 0;
    this.toPicture = (cx, cy) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: ((cx - r.left) / r.width) * 2 - 1, y: 1 - ((cy - r.top) / r.height) * 2 };
    };
    let raf = 0, last = performance.now(), sx = 1, sy = 1, vx = 0, vy = 0;
    const loop = (now: number): void => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.tick(dt, now / 1000);
      const press = this.grid.pressed ? Math.min(1, this.finger?.force ?? 0.55) : 0;
      const wSlow = 5.8 / 1.5;
      const w = this.grid.pressed ? 20 : wSlow;
      vx += (w * w * (1 + press * 0.1 - sx) - 2 * w * vx) * dt;
      vy += (w * w * (1 - press * 0.16 - sy) - 2 * w * vy) * dt;
      sx += vx * dt; sy += vy * dt;
      shadowEl.style.transform = `translateX(-50%) scale(${(1 + 0.38 * Math.min(1, (1 - sy) / 0.12)).toFixed(3)}, 1)`;
      this.canvas.style.transform = `scale(${sx.toFixed(3)}, ${sy.toFixed(3)}) scale(${(1 + Math.sin(this.hop * Math.PI) * 0.05).toFixed(3)})`;
    };
    raf = requestAnimationFrame(loop);
    this.flatStop = () => cancelAnimationFrame(raf);
  }

  dispose(): void {
    this.dead = true;
    this.flatStop?.();
    this.flatBox?.remove();
    this.handle?.dispose();
    this.cleanups.forEach((f) => f());
    document.body.classList.remove('lobby3d-on');
    const bg = document.getElementById('lobby-root');
    if (bg) bg.style.background = '';
  }
}

/** the workshop picture behind the squishy: on the 3D canvas (its root) and as the background of the page for the flat view */
export function setWorkshopBg(on: boolean, base: string): void {
  const url = `url(${base}squishy/bg/workshop.webp) center / cover`;
  const root = document.getElementById('lobby-root');
  if (root) root.style.background = on ? url : '';
}
