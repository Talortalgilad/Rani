import { getStats, getTier } from './quality';

/**
 * A small FPS display for measuring on a real phone: open the app with `#fps` at the end of the address.
 * It shows frames per second, the quality tier, the CPU time of one 3D frame, and draw calls / triangles.
 * Loaded only when asked for, so it costs nothing otherwise.
 */
export function startFpsOverlay(): void {
  if (document.getElementById('fps-overlay')) return;
  const el = document.createElement('div');
  el.id = 'fps-overlay';
  el.style.cssText =
    'position:fixed;top:2px;left:2px;z-index:99999;font:600 11px/1.3 ui-monospace,Menlo,monospace;color:#0f0;background:rgba(0,0,0,.65);padding:3px 6px;border-radius:6px;pointer-events:none;white-space:pre;direction:ltr';
  document.body.appendChild(el);
  let frames = 0;
  let last = performance.now();
  const tick = (t: number) => {
    requestAnimationFrame(tick);
    frames++;
    if (t - last < 500) return;
    const fps = (frames * 1000) / (t - last);
    frames = 0;
    last = t;
    const s = getStats();
    const tier = getTier();
    el.textContent = `${fps.toFixed(0)} fps · ${s ? `3D ${tier}` : 'regular'}` + (s ? `\njs ${s.jsMs.toFixed(1)} ms · ${s.calls} calls · ${(s.triangles / 1000).toFixed(0)}k tris` : '');
    el.style.color = fps >= 55 ? '#0f0' : fps >= 45 ? '#ff0' : '#f66';
  };
  requestAnimationFrame(tick);
}
