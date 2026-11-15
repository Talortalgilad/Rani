/**
 * The prototype of the squishy workshop (SPEC-squishy.md, stage 0): ONE screen, with the cat. Paint every part on its own (a tap on a colour and then on a part), and the squeeze test.
 * It is entered from the parents area only (a temporary door: it is not in registry.ts and not in the lobby), and it answers one question: does it feel like a real squishy?
 *
 * The squishy is a flat picture on a grid of 16 x 16 squares in WebGL (one draw call), moved by the springs of squeeze.ts. The colours are made of the map of the shape (paint.ts)
 * in a canvas that is the texture. In the tier `2d` the same picture is a plain canvas that is squashed and stretched as a whole.
 * The sliders on the screen (the radius, the depth and the return time) change the constants of squeeze.ts at once, to tune them on the phone.
 */
import './lab.css';
import { getState } from '../../storage';
import { sound } from '../../sound';
import { buzz } from '../../haptics';
import { sessionTier, getTier } from '../../lobby3d/quality';
import { drawFace, type FaceState } from './face';
import { compose, PALETTE, partAt, type RGB } from './paint';
import { loadShape, originalColors, SHAPES, SIZE, shapeInfo, type Loaded } from './shapes';
import { SQUEEZE, SquishGrid, type Finger } from './squeeze';

type Mode = 'paint' | 'squeeze';
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const base = (): string => import.meta.env?.BASE_URL ?? '/';
/** the half size of the picture in the world of the scene (the plane is 2 x HALF) */
const HALF = 1.18;
/** the scene shows this much of the world across, and this much high, at least */
const FIT_W = 2.9;
const FIT_H = 3.5;
/** where the base of the squishy stands on the screen (the share of the height): on the table of the picture, above the controls */
const BASE_FRAC = 0.755;

export function renderSquishyLab(root: HTMLElement, onExit: () => void): () => void {
  let dead = false;
  let mode: Mode = 'paint';
  let colorIdx = 0;
  let shapeId = 'cat';
  let loaded: Loaded | null = null;
  let colors: RGB[] = [];
  let squeezes = 0;
  const grid = new SquishGrid(16);
  const tier = sessionTier(getState().settings.lobby);
  const flat = tier === '2d';

  // ---------------------------------------------------------------- the screen
  root.innerHTML = `<div class="screen sq-lab ${flat ? 'flat' : ''}">
    <div class="sq-bar"><button type="button" class="sq-x" aria-label="חזרה">✕</button><b>סדנת הסקווישים · ניסוי</b><button type="button" class="sq-gear" aria-label="כוונון">⚙️</button></div>
    <div class="sq-stage" aria-label="הסקווישי"></div>
    <div class="sq-tune" hidden>
      <label>רדיוס <input type="range" data-k="radius" min="0.2" max="1.1" step="0.01"><output></output></label>
      <label>עומק <input type="range" data-k="depth" min="0.1" max="1.2" step="0.01"><output></output></label>
      <label>חזרה (שנ׳) <input type="range" data-k="returnSeconds" min="0.4" max="3.5" step="0.05"><output></output></label>
      <div class="sq-shapes"></div>
      <button type="button" class="sq-copy">העתק ערכים</button>
      <div class="sq-fps">—</div>
    </div>
    <div class="sq-dock">
      <div class="sq-modes"><button type="button" data-m="paint" class="on">🎨 צביעה</button><button type="button" data-m="squeeze">🤏 מעיכה</button></div>
      <div class="sq-palette">${PALETTE.map((p, i) => `<button type="button" data-i="${i}" class="${i === 0 ? 'on' : ''}" aria-label="${esc(p.he)}" style="background:rgb(${p.rgb.join(',')})"></button>`).join('')}</div>
      <div class="sq-meter" hidden><span>מעכי!</span><i></i><i></i><i></i><i></i><i></i></div>
    </div>
  </div>`;
  const screen = root.querySelector<HTMLElement>('.sq-lab')!;
  const stage = screen.querySelector<HTMLElement>('.sq-stage')!;
  const tune = screen.querySelector<HTMLElement>('.sq-tune')!;
  const fpsEl = screen.querySelector<HTMLElement>('.sq-fps')!;
  screen.querySelector('.sq-x')!.addEventListener('click', () => onExit());
  screen.querySelector('.sq-gear')!.addEventListener('click', () => (tune.hidden = !tune.hidden));
  const meter = screen.querySelector<HTMLElement>('.sq-meter')!;
  const palette = screen.querySelector<HTMLElement>('.sq-palette')!;
  // the sliders change the constants of the squeeze at once
  tune.querySelectorAll<HTMLInputElement>('input[type=range]').forEach((inp) => {
    const k = inp.dataset.k as 'radius' | 'depth' | 'returnSeconds';
    const out = inp.nextElementSibling as HTMLElement;
    inp.value = String(SQUEEZE[k]);
    out.textContent = SQUEEZE[k].toFixed(2);
    inp.addEventListener('input', () => {
      SQUEEZE[k] = Number(inp.value);
      out.textContent = SQUEEZE[k].toFixed(2);
    });
  });
  // "copy the values": the three numbers as a text, to send what was found on the phone
  const copyBtn = tune.querySelector<HTMLButtonElement>('.sq-copy')!;
  copyBtn.addEventListener('click', () => {
    const text = `radius=${SQUEEZE.radius.toFixed(2)} depth=${SQUEEZE.depth.toFixed(2)} returnSeconds=${SQUEEZE.returnSeconds.toFixed(2)}`;
    const done = (): void => {
      copyBtn.textContent = 'הועתק ✓';
      window.setTimeout(() => (copyBtn.textContent = 'העתק ערכים'), 1600);
    };
    const old = (): void => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      ta.remove();
      done();
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, old);
    else old();
  });
  const shapesEl = tune.querySelector<HTMLElement>('.sq-shapes')!;
  shapesEl.innerHTML = SHAPES.map((s) => `<button type="button" data-s="${s}" class="${s === shapeId ? 'on' : ''}">${s}</button>`).join('');
  shapesEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-s]');
    if (!b) return;
    shapesEl.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    void setShape(b.dataset.s!);
  });
  const setMode = (m: Mode): void => {
    mode = m;
    screen.querySelectorAll<HTMLButtonElement>('.sq-modes button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    palette.hidden = m !== 'paint';
    meter.hidden = m !== 'squeeze';
    screen.classList.toggle('squeeze-mode', m === 'squeeze');
  };
  screen.querySelector('.sq-modes')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-m]');
    if (b) setMode(b.dataset.m as Mode);
  });
  palette.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-i]');
    if (!b) return;
    colorIdx = Number(b.dataset.i);
    palette.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    sound.play('pop', 500 + colorIdx * 70);
  });
  setMode('paint');

  // ---------------------------------------------------------------- the picture (a canvas with the colours and the face)
  const cv = document.createElement('canvas');
  cv.width = cv.height = SIZE;
  const g = cv.getContext('2d', { willReadFrequently: true })!;
  const composed = new Uint8ClampedArray(SIZE * SIZE * 4);
  const imgData = new ImageData(composed, SIZE, SIZE);
  let face: FaceState = 'open';
  /** where the eyes look (towards a finger that came down), and for how long they look before they close */
  let look = { x: 0, y: 0 };
  let lookT = 0;
  let peak = 0;
  let popped = true;
  let deepDone = false;
  let dirty = true;
  let nextBlink = 2;
  let blinkT = 0;

  function paintCanvas(): void {
    if (!loaded) return;
    compose(loaded.map, colors, composed);
    g.putImageData(imgData, 0, 0);
    if (loaded.face) drawFace(g, loaded.face.x, loaded.face.y, loaded.face.size, face, look);
    dirty = false;
    onPainted?.();
  }
  let onPainted: (() => void) | null = null;

  async function setShape(id: string): Promise<void> {
    shapeId = id;
    const l = await loadShape(id);
    if (dead || shapeId !== id) return;
    loaded = l;
    colors = originalColors(id);
    grid.reset();
    dirty = true;
  }

  // ---------------------------------------------------------------- touch: the same for the 3D scene and for the flat picture
  /** converts a point of the screen to the space of the picture (-1..1, y up); set by the view */
  let toPicture: (cx: number, cy: number) => { x: number; y: number } = () => ({ x: 0, y: 0 });
  let finger: Finger | null = null;
  let downAt = 0;
  let downXY = { x: 0, y: 0 };
  let moved = false;
  const pxOf = (p: { x: number; y: number }): { x: number; y: number } => ({ x: ((p.x + 1) / 2) * SIZE, y: ((1 - p.y) / 2) * SIZE });

  stage.addEventListener('pointerdown', (e) => {
    if (!loaded || finger) return;
    stage.setPointerCapture(e.pointerId);
    const p = toPicture(e.clientX, e.clientY);
    downAt = performance.now();
    downXY = { x: e.clientX, y: e.clientY };
    moved = false;
    if (mode === 'squeeze') {
      finger = { x: p.x, y: p.y, x0: p.x, y0: p.y, force: 0.55 };
      grid.press(finger);
      // the eyes first look at the finger (a moment), then they close
      face = 'open';
      if (loaded.face) {
        const fu = (loaded.face.x / SIZE) * 2 - 1, fv = 1 - (loaded.face.y / SIZE) * 2;
        look = { x: Math.max(-1, Math.min(1, (p.x - fu) * 2.4)), y: Math.max(-1, Math.min(1, -(p.y - fv) * 2.4)) };
      }
      lookT = 0.2;
      peak = 0;
      popped = false;
      deepDone = false;
      buzz(10);
      dirty = true;
      squeezes++;
      meter.querySelectorAll('i').forEach((el, i) => el.classList.toggle('on', i < Math.min(5, squeezes)));
      sound.play('squish', 250);
    } else {
      finger = { x: p.x, y: p.y, x0: p.x, y0: p.y, force: 0 };
    }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!finger) return;
    if (Math.hypot(e.clientX - downXY.x, e.clientY - downXY.y) > 10) moved = true;
    if (mode !== 'squeeze') return;
    const p = toPicture(e.clientX, e.clientY);
    finger.x = p.x;
    finger.y = p.y;
  });
  const up = (e: PointerEvent): void => {
    if (!finger) return;
    const f = finger;
    finger = null;
    if (mode === 'squeeze') {
      grid.release();
      face = 'open';
      look = { x: 0, y: 0 };
      lookT = 0;
      dirty = true;
    } else if (!moved && e.type === 'pointerup' && loaded) {
      // a tap in the painting: the part under the finger gets the colour
      const q = pxOf({ x: f.x, y: f.y });
      const part = partAt(loaded.map, SIZE, q.x, q.y, shapeInfo(loaded.id).areas);
      if (part) {
        colors[part - 1] = PALETTE[colorIdx].rgb;
        dirty = true;
        sound.play('pop', 520 + colorIdx * 60);
        hop = 1;
      }
    }
  };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  let hop = 0;

  // ---------------------------------------------------------------- the frame (shared by the 3D scene and the flat picture)
  let frames = 0;
  let frameMs = 0;
  let acc = 0;
  let longest = 0;
  function tick(dt: number, t: number, ms: number): void {
    if (finger && mode === 'squeeze') finger.force = Math.min(1, 0.55 + ((performance.now() - downAt) / 1000) * 1.1);
    grid.step(dt);
    if (finger && mode === 'squeeze') {
      peak = Math.max(peak, grid.maxOffset());
      if (lookT > 0) {
        lookT -= dt;
        if (lookT <= 0) (face = 'squeezed'), (dirty = true);
      }
      // a longer press goes deeper: a second, lower sound, once
      if (!deepDone && finger.force > 0.97) {
        deepDone = true;
        sound.play('squish', 165);
      }
    } else if (!popped && !finger && peak > 0.04 && grid.maxOffset() < peak * 0.06) {
      // back in shape: a small pop (the deeper it was pressed, the lower)
      popped = true;
      sound.play('unsquish', 470 - 260 * Math.min(1, peak / 0.4));
    }
    hop = Math.max(0, hop - dt * 3);
    // a blink now and then
    if (loaded?.face && face !== 'squeezed') {
      if (face === 'blink') {
        blinkT -= dt;
        if (blinkT <= 0) (face = 'open'), (dirty = true);
      } else if (t > nextBlink) {
        face = 'blink';
        blinkT = 0.13;
        nextBlink = t + 2.4 + Math.random() * 2.4;
        dirty = true;
      }
    }
    if (dirty) paintCanvas();
    frames++;
    acc += dt;
    frameMs += ms;
    longest = Math.max(longest, dt);
    if (acc >= 1) {
      fpsEl.textContent = `${Math.round(frames / acc)} fps · ${(frameMs / frames).toFixed(1)} ms · ≥${(longest * 1000).toFixed(0)} ms`;
      latest = { fps: frames / acc, ms: frameMs / frames, longest: longest * 1000 };
      frames = 0; acc = 0; frameMs = 0; longest = 0;
    }
  }
  let latest = { fps: 0, ms: 0, longest: 0 };

  // ---------------------------------------------------------------- the 3D view
  let sceneHandle: { dispose(): void } | null = null;
  const start3d = async (): Promise<void> => {
    const [{ showScene }, T] = await Promise.all([import('../../lobby3d/stage'), import('../../lobby3d/lib')]);
    if (dead) return;
    const handle = await showScene(
      (env) => {
        const prevTone = env.renderer.toneMapping;
        env.renderer.toneMapping = T.NoToneMapping;
        const scene = new T.Scene();
        const camera = new T.PerspectiveCamera(30, env.width / env.height, 0.1, 50);
        const tex = new T.CanvasTexture(cv);
        tex.colorSpace = T.SRGBColorSpace;
        const geo = new T.PlaneGeometry(HALF * 2, HALF * 2, grid.n, grid.n);
        const mat = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
        const mesh = new T.Mesh(geo, mat);
        scene.add(mesh);
        // the shadow on the table: a soft ellipse that widens a little when the squishy is pressed
        const sc = document.createElement('canvas');
        sc.width = sc.height = 128;
        const sg = sc.getContext('2d')!;
        const grad = sg.createRadialGradient(64, 64, 4, 64, 64, 62);
        grad.addColorStop(0, 'rgba(50,25,40,.95)');
        grad.addColorStop(0.6, 'rgba(50,25,40,.55)');
        grad.addColorStop(1, 'rgba(50,25,40,0)');
        sg.fillStyle = grad;
        sg.fillRect(0, 0, 128, 128);
        const shadowTex = new T.CanvasTexture(sc);
        const shadow = new T.Mesh(new T.PlaneGeometry(2, 2), new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false }));
        scene.add(shadow);
        const pos = geo.attributes.position as InstanceType<typeof T.BufferAttribute>;
        let visW = 3, visH = 3;
        /** the world height of the table where the base of the squishy stands, and the height of the picture's centre when it rests there */
        let baseWorld = 0;
        let restY = 0;
        const place = (): void => {
          baseWorld = (0.5 - BASE_FRAC) * visH;
          // the lowest pixel of the shape is on the table (the box of the shape), not the bottom of the square of the picture
          const baseLocal = loaded ? (1 - (2 * loaded.box.y1) / SIZE) * HALF : -0.94 * HALF;
          restY = baseWorld - baseLocal;
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
        toPicture = (cx, cy) => {
          const wx = (cx / window.innerWidth - 0.5) * visW;
          const wy = (0.5 - cy / window.innerHeight) * visH;
          return { x: wx / HALF, y: (wy - restY) / HALF };
        };
        onPainted = () => (tex.needsUpdate = true);
        let time = 0;
        return {
          scene,
          camera,
          update(dt) {
            time += dt;
            const t0 = performance.now();
            tick(dt, time, 0);
            for (let p = 0; p < grid.points; p++) {
              pos.setXY(p, (grid.rest[p * 2] + grid.off[p * 2]) * HALF, (grid.rest[p * 2 + 1] + grid.off[p * 2 + 1]) * HALF);
            }
            pos.needsUpdate = true;
            // the squishy sits on the table: whatever is squeezed, its base stays where it is (it flattens upwards and sideways, it does not sink into the table)
            place();
            let bottom = 0;
            for (let i = 0; i <= grid.n; i++) bottom += grid.off[(grid.n * (grid.n + 1) + i) * 2 + 1];
            bottom /= grid.n + 1;
            mesh.position.y = restY - bottom * HALF;
            mesh.position.x = 0;
            // the shadow under it: where the base is, as wide as the shape; it widens and darkens when the squishy is pressed down
            const box = loaded?.foot ?? { x0: 80, x1: 432 };
            const rx = ((box.x1 - box.x0) / SIZE) * HALF * 0.95;
            const press = Math.min(1, grid.maxOffset() / 0.28);
            const ry = rx * 0.14 * (1 + 0.25 * press);
            shadow.position.set((((box.x0 + box.x1) / SIZE - 1)) * HALF, baseWorld - ry * 0.25, -0.01);
            shadow.scale.set(rx * (1 + 0.38 * press), ry, 1);
            (shadow.material as InstanceType<typeof T.MeshBasicMaterial>).opacity = 0.7 + 0.3 * press;
            mesh.scale.setScalar(1 + Math.sin(hop * Math.PI) * 0.05);
            frameMs += performance.now() - t0;
          },
          resize(w, h) {
            fit(w, h);
          },
          dispose() {
            env.renderer.toneMapping = prevTone;
            onPainted = null;
            geo.dispose();
            mat.dispose();
            tex.dispose();
            shadowTex.dispose();
          },
        };
      },
      { autoDowngrade: false, minTier: 'medium', onFallback: () => void 0 },
    );
    if (dead) return handle.dispose();
    sceneHandle = handle;
    handle.fadeIn(0);
    const bg = document.getElementById('lobby-root');
    if (bg) bg.style.background = `url(${base()}squishy/bg/workshop.webp) center / cover`;
    document.body.classList.add('lobby3d-on');
  };

  // ---------------------------------------------------------------- the flat view (tier 2d): the whole picture squashes and stretches
  const startFlat = (): void => {
    document.body.style.background = `url(${base()}squishy/bg/workshop.webp) center / cover`;
    const view = document.createElement('div');
    view.className = 'sq-flatview';
    cv.className = 'sq-flatcanvas';
    const wrap = document.createElement('div');
    wrap.className = 'sq-flatwrap';
    const shadowEl = document.createElement('i');
    shadowEl.className = 'sq-flatshadow';
    wrap.append(shadowEl, cv);
    view.appendChild(wrap);
    stage.appendChild(view);
    onPainted = () => void 0;
    toPicture = (cx, cy) => {
      const r = cv.getBoundingClientRect();
      return { x: ((cx - r.left) / r.width) * 2 - 1, y: 1 - ((cy - r.top) / r.height) * 2 };
    };
    let raf = 0;
    let last = performance.now();
    let sx = 1, sy = 1, vx = 0, vy = 0;
    const loop = (now: number): void => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      tick(dt, now / 1000, 0);
      const press = grid.pressed ? Math.min(1, finger?.force ?? 0.55) : 0;
      const wSlow = 5.8 / Math.max(0.2, SQUEEZE.returnSeconds);
      const w = grid.pressed ? 20 : wSlow;
      const tx = 1 + press * 0.1, ty = 1 - press * 0.16;
      vx += (w * w * (tx - sx) - 2 * w * vx) * dt; vy += (w * w * (ty - sy) - 2 * w * vy) * dt;
      sx += vx * dt; sy += vy * dt;
      shadowEl.style.transform = `translateX(-50%) scale(${(1 + 0.38 * Math.min(1, (1 - sy) / 0.12)).toFixed(3)}, 1)`;
      cv.style.transform = `scale(${sx.toFixed(3)}, ${sy.toFixed(3)}) scale(${(1 + Math.sin(hop * Math.PI) * 0.05).toFixed(3)})`;
    };
    raf = requestAnimationFrame(loop);
    flatStop = () => cancelAnimationFrame(raf);
  };
  let flatStop: (() => void) | null = null;

  void setShape(shapeId);
  if (flat || getTier() === '2d') startFlat();
  else void start3d().catch(() => {
    // no WebGL after all: the flat picture
    if (!dead) startFlat();
  });
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__squish = { grid, SQUEEZE, setMode, setShape, paint: (part: number, idx: number) => { colors[part - 1] = PALETTE[idx].rgb; dirty = true; }, get latest() { return latest; }, get face() { return face; } };

  return () => {
    dead = true;
    flatStop?.();
    sceneHandle?.dispose();
    document.body.classList.remove('lobby3d-on');
    document.body.style.background = '';
    const bg = document.getElementById('lobby-root');
    if (bg) bg.style.background = '';
  };
}
