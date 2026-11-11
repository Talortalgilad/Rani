import * as T from './lib';
import { getTier, lowerTier, QualityMonitor, setStatsProbe, setTier, type Tier } from './quality';

/** What a screen gives the stage: its own scene, camera and per-frame update. */
export interface StageScene {
  scene: T.Scene;
  camera: T.PerspectiveCamera;
  update(dt: number, time: number): void;
  resize(width: number, height: number): void;
  setTier?(tier: Tier): void;
  dispose(): void;
}

export interface SceneEnv {
  tier: Tier;
  width: number;
  height: number;
  reduced: boolean;
  canvas: HTMLCanvasElement;
  /** The one shared renderer, for screens that need to set tone mapping (they must put it back when disposed). */
  renderer: T.WebGLRenderer;
}

export interface SceneHandle {
  canvas: HTMLCanvasElement;
  /** The canvas starts transparent; this fades it in (instantly when ms is 0). */
  fadeIn(ms: number): void;
  dispose(): void;
}

/** One renderer for the whole life of the app (iOS limits the number of WebGL contexts). */
let renderer: T.WebGLRenderer | null = null;
let root: HTMLDivElement | null = null;
let active: { handle: SceneHandle; scene: StageScene } | null = null;

export const reducedMotion = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function ensureRenderer(tier: Tier): { r: T.WebGLRenderer; root: HTMLDivElement } {
  if (!root) {
    root = document.createElement('div');
    root.id = 'lobby-root';
    document.body.prepend(root);
  }
  if (!renderer) {
    renderer = new T.WebGLRenderer({ antialias: tier === 'high', alpha: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = 'three-canvas';
    root.appendChild(renderer.domElement);
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__lobby3d = { renderer, get tier() { return getTier(); } };
  }
  return { r: renderer, root };
}

function applyTier(r: T.WebGLRenderer, tier: Tier): void {
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier === 'high' ? 2 : 1.5));
  r.shadowMap.enabled = tier === 'high';
  r.shadowMap.type = T.PCFSoftShadowMap;
}

/** Frees geometries, materials and textures under an object. */
export function disposeTree(o: T.Object3D): void {
  o.traverse((c) => {
    const m = c as T.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      for (const v of Object.values(mat)) if (v && (v as T.Texture).isTexture) (v as T.Texture).dispose();
      mat.dispose();
    }
  });
}

export function setSky(top: string, bottom: string): void {
  if (root) root.style.background = `linear-gradient(${top}, ${bottom})`;
}

/**
 * Shows one scene on the shared renderer. The loop stops when the page is hidden, and the quality monitor
 * lowers the tier (never raises it) if the device cannot keep up; at the bottom it calls `onFallback`.
 */
export async function showScene(
  factory: (env: SceneEnv) => StageScene | Promise<StageScene>,
  opts: { autoDowngrade: boolean; onFallback(): void; /** A screen with no regular version (a 3D-only game) never falls below this tier. */ minTier?: Tier },
): Promise<SceneHandle> {
  active?.handle.dispose();
  const tier = getTier();
  const { r, root: host } = ensureRenderer(tier);
  applyTier(r, tier);
  host.style.display = 'block';
  host.style.transition = 'none';
  host.style.opacity = '0';
  const env: SceneEnv = { tier, width: window.innerWidth, height: window.innerHeight, reduced: reducedMotion(), canvas: r.domElement, renderer: r };
  const scene = await factory(env);

  let raf = 0;
  let last = 0;
  let disposed = false;
  const monitor = new QualityMonitor(() => {
    if (!opts.autoDowngrade) return;
    const next = lowerTier(getTier());
    if (next === '2d' && opts.minTier) return; // nowhere to fall back to: stay on the lowest 3D tier
    setTier(next);
    if (next === '2d') {
      opts.onFallback();
      return;
    }
    applyTier(r, next);
    scene.setTier?.(next);
  });

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    r.setSize(w, h, false);
    r.domElement.style.width = '100%';
    r.domElement.style.height = '100%';
    scene.resize(w, h);
  };
  let jsMs = 0;
  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    monitor.sample(dt);
    const t0 = performance.now();
    scene.update(dt, t / 1000);
    r.render(scene.scene, scene.camera);
    jsMs = jsMs * 0.9 + (performance.now() - t0) * 0.1; // CPU time of one frame, without the GPU's share
  };
  setStatsProbe(() => ({ calls: r.info.render.calls, triangles: r.info.render.triangles, jsMs }));
  const start = () => {
    if (disposed || raf) return;
    last = performance.now();
    monitor.reset();
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const onVis = () => (document.hidden ? stop() : start());
  const onLost = (e: Event) => {
    e.preventDefault();
    setTier('2d');
    opts.onFallback();
  };

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVis);
  r.domElement.addEventListener('webglcontextlost', onLost);
  resize();
  start();

  const handle: SceneHandle = {
    canvas: r.domElement,
    fadeIn(ms) {
      host.style.transition = ms ? `opacity ${ms}ms ease` : 'none';
      host.style.opacity = '1';
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
      r.domElement.removeEventListener('webglcontextlost', onLost);
      scene.dispose();
      setStatsProbe(null);
      host.style.display = 'none';
      host.style.opacity = '0';
      if (active?.handle === handle) active = null;
    },
  };
  active = { handle, scene };
  return handle;
}

/** For tests and diagnostics. */
export const rendererInfo = () => renderer?.info.memory ?? null;
export const rendererCount = (): number => (renderer ? 1 : 0);
