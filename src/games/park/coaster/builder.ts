/**
 * The builder (SPEC-park.md 3.1): Rani draws the track with a finger, side view; points can be moved, the end deleted, the loop dragged on.
 * Then the car goes, by the physics, and when it does not get to the end the place is marked and a hint is said.
 */
import type { SoundApi } from '../../../sound';
import { diagnose, fix, type Diagnosis } from './hints';
import { sample, simulate, duration, type Ride } from './physics';
import { drawBackground, drawHand, drawHandles, drawHeights, drawStations, drawStop, drawTrack, drawTrain, fromX, fromY, makeView, toX, toY, type Look, type View } from './render2d';
import { END, WORLD_H, WORLD_W, addLoop, at, buildPath, cloneTrack, deleteFrom, extend, finish, moveY, newTrack, removeLoop, type Path, type Track } from './track';

export interface BuilderHooks {
  sound: SoundApi;
  /** the track changed (to save it) */
  onChange(t: Track): void;
  /** the hint to say (a kind) when the ride is over without getting to the end; `attempts` counts them */
  onFailed(d: Diagnosis, attempts: number): void;
  /** the car got to the end */
  onFinished(): void;
  /** the screen state changed: 'build' | 'ride' */
  onMode(mode: 'build' | 'ride', hasRide: boolean): void;
  /** the bottom of the mini map (px from the top of the canvas): the speech bubble goes under it */
  onLayout?(mapBottom: number): void;
  /** a place where something was refused (a bounce of the loop button, say) */
  onRefused?(what: 'loop'): void;
}

interface Confetti { x: number; y: number; vx: number; vy: number; c: string; r: number; life: number }

type Drag = { kind: 'map' } | { kind: 'draw' } | { kind: 'move'; i: number } | { kind: 'pan'; x: number; x0: number } | { kind: 'loop'; px: number; py: number };

export class Builder {
  track: Track;
  path: Path;
  ride: Ride | null = null;
  mode: 'build' | 'ride' = 'build';
  attempts = 0;
  diag: Diagnosis | null = null;
  overview = false;
  selected = -1;
  /** the ride has been seen to finish with this track (the button "to ride!" is on) */
  rideOk = false;
  private view: View;
  private g: CanvasRenderingContext2D;
  private W = 0;
  private H = 0;
  private dpr = 1;
  private x0 = -1.6;
  private drag: Drag | null = null;
  private raf = 0;
  private last = 0;
  private time = 0;
  private rideT = 0;
  private lastTick = 0;
  private dirty = true;
  private confetti: Confetti[] = [];
  private wheeeDone = false;
  private ro: ResizeObserver;
  private doneAt = -1;
  /** the mini map of the whole track, in the empty sky above the track */
  mapRect = { x: 12, y: 72, w: 300, h: 60 };

  constructor(private canvas: HTMLCanvasElement, private hooks: BuilderHooks, private look: Look, track?: Track) {
    this.g = canvas.getContext('2d')!;
    this.track = track ?? newTrack();
    this.path = buildPath(this.track);
    this.view = makeView(300, 500, 0, false);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
  }

  setLook(l: Look): void {
    this.look = l;
    this.dirty = true;
  }

  private resize(): void {
    const r = this.canvas.getBoundingClientRect();
    this.W = Math.max(200, r.width);
    this.H = Math.max(260, r.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.updateView();
    this.dirty = true;
  }

  private updateView(): void {
    const maxX0 = Math.max(0, WORLD_W + 2 - this.W / makeView(this.W, this.H, 0, false).s);
    this.x0 = Math.min(maxX0, Math.max(-1.6, this.x0));
    this.view = makeView(this.W, this.H, this.x0, this.overview);
    const sky = this.view.y0 - WORLD_H * this.view.s - 72;
    const h = Math.max(36, Math.min(70, sky * 0.42));
    this.mapRect = { x: 12, y: 72, w: this.W - 24, h };
    this.hooks.onLayout?.(72 + h);
  }

  private inMap(x: number, y: number): boolean {
    const m = this.mapRect;
    return x >= m.x - 6 && x <= m.x + m.w + 6 && y >= m.y - 6 && y <= m.y + m.h + 6;
  }

  /** A tap or a drag on the mini map jumps there: the view is centred on that place. */
  private jumpTo(px: number): void {
    const m = this.mapRect;
    const wx = ((px - m.x - 4) / (m.w - 8)) * (WORLD_W + 3) - 1.5;
    this.x0 = wx - this.W / this.view.s / 2;
    this.updateView();
  }

  /** The view shows all the track (or goes back to the part where Rani is working). */
  toggleOverview(): void {
    this.overview = !this.overview;
    this.updateView();
    this.dirty = true;
  }

  // ---- the finger ----

  private pt(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /** The point of the track near the finger (at least 44 px of touch), or -1. */
  private hit(px: number, py: number, canMove: boolean): number {
    const v = this.view;
    const r = Math.max(26, v.s * 0.4);
    let best = -1;
    let d = r;
    this.track.pts.forEach((p, i) => {
      if (canMove && (i === 0 || (this.track.complete && i === this.track.pts.length - 1))) return;
      const dd = Math.hypot(toX(v, p.x) - px, toY(v, p.y) - py);
      if (dd < d) {
        d = dd;
        best = i;
      }
    });
    return best;
  }

  private onDown = (e: PointerEvent): void => {
    if (this.mode !== 'build') return;
    const { x, y } = this.pt(e);
    this.canvas.setPointerCapture(e.pointerId);
    const v = this.view;
    const last = this.track.pts[this.track.pts.length - 1];
    const endD = Math.hypot(toX(v, last.x) - x, toY(v, last.y) - y);
    const i = this.hit(x, y, true);
    if (this.inMap(x, y)) {
      this.drag = { kind: 'map' };
      this.jumpTo(x);
    } else if (i > 0) {
      this.drag = { kind: 'move', i };
      this.selected = i;
    } else if (!this.track.complete && endD < Math.max(70, v.s * 1.2)) {
      this.drag = { kind: 'draw' };
      this.selected = this.track.pts.length - 1;
      this.clearHint();
    } else this.drag = { kind: 'pan', x, x0: this.x0 };
    this.dirty = true;
  };

  private onMove = (e: PointerEvent): void => {
    const d = this.drag;
    if (!d) return;
    const { x, y } = this.pt(e);
    const v = this.view;
    if (d.kind === 'map') this.jumpTo(x);
    else if (d.kind === 'pan') {
      this.x0 = d.x0 - (x - d.x) / v.s;
      this.updateView();
    } else if (d.kind === 'move') {
      moveY(this.track, d.i, fromY(v, y));
      this.changed();
    } else if (d.kind === 'draw') {
      // the screen scrolls by itself near the edges
      if (!this.overview) {
        if (x > this.W * 0.82) this.x0 += (x - this.W * 0.82) / this.W * 0.5;
        else if (x < this.W * 0.18 && this.x0 > 0) this.x0 -= (this.W * 0.18 - x) / this.W * 0.5;
        this.updateView();
      }
      const wx = fromX(this.view, x);
      let added = false;
      // fill in the points the finger went by, so that a fast finger does not skip
      const last = this.track.pts[this.track.pts.length - 1];
      const steps = Math.max(1, Math.floor((wx - last.x) / 0.7));
      for (let k = 1; k <= steps; k++) added = extend(this.track, last.x + ((wx - last.x) * k) / steps, fromY(this.view, y)) || added;
      if (added) {
        this.changed();
        this.hooks.sound.play('tick', 600 + this.track.pts.length * 18);
      }
    } else if (d.kind === 'loop') {
      d.px = x;
      d.py = y;
    }
    this.dirty = true;
  };

  private onUp = (): void => {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (d.kind === 'draw') {
      if (finish(this.track)) this.hooks.sound.play('bonus');
      this.changed();
    }
    if (d.kind === 'loop') this.dropLoop(d.px);
    this.dirty = true;
  };

  /** The loop button is dragged out of the tray: it follows the finger over the canvas. */
  beginLoopDrag(clientX: number, clientY: number): void {
    const r = this.canvas.getBoundingClientRect();
    this.drag = { kind: 'loop', px: clientX - r.left, py: clientY - r.top };
    this.dirty = true;
  }
  moveLoopDrag(clientX: number, clientY: number): void {
    if (this.drag?.kind !== 'loop') return;
    const r = this.canvas.getBoundingClientRect();
    this.drag.px = clientX - r.left;
    this.drag.py = clientY - r.top;
    this.dirty = true;
  }
  endLoopDrag(): void {
    const d = this.drag;
    this.drag = null;
    if (d?.kind === 'loop') this.dropLoop(d.px);
    this.dirty = true;
  }
  private dropLoop(px: number): void {
    if (px < 0 || px > this.W) return;
    if (addLoop(this.track, fromX(this.view, px))) {
      this.hooks.sound.play('bonus');
      this.changed();
    } else this.hooks.onRefused?.('loop');
  }
  removeLoopPiece(): void {
    removeLoop(this.track);
    this.changed();
  }

  // ---- editing ----

  private changed(): void {
    this.path = buildPath(this.track);
    this.rideOk = false;
    this.ride = null;
    this.clearHint();
    this.hooks.onChange(this.track);
    this.dirty = true;
  }
  private clearHint(): void {
    this.diag = null;
  }

  /** Deletes from the point that was touched last to the end. */
  deleteEnd(): void {
    deleteFrom(this.track, this.selected > 0 ? this.selected : this.track.pts.length - 2);
    this.selected = -1;
    this.changed();
  }
  restart(): void {
    this.track = newTrack();
    this.selected = -1;
    this.attempts = 0;
    this.x0 = -1.6;
    this.updateView();
    this.changed();
  }
  hasLoop(): boolean {
    return this.track.loops.length > 0;
  }
  /** "Fix it for me" (after 3 tries that did not work). */
  fixIt(): boolean {
    if (!this.diag) return false;
    const ok = fix(this.track, this.diag);
    this.attempts = 0;
    this.changed();
    return ok;
  }
  setTrack(t: Track): void {
    this.track = cloneTrack(t);
    this.changed();
  }

  // ---- the ride ----

  canRide(): boolean {
    return this.track.pts.length > 1;
  }

  startRide(): void {
    if (!this.canRide()) return;
    this.path = buildPath(this.track);
    this.ride = simulate(this.path);
    this.rideT = 0;
    this.lastTick = 0;
    this.wheeeDone = false;
    this.doneAt = -1;
    this.diag = null;
    this.selected = -1;
    this.mode = 'ride';
    this.overview = false;
    this.x0 = -1.6;
    this.updateView();
    this.hooks.onMode('ride', true);
    this.dirty = true;
  }

  /** Back to building (the marks of a ride that did not work stay on the screen). */
  stopRide(): void {
    this.mode = 'build';
    this.confetti = [];
    this.hooks.onMode('build', !!this.ride);
    this.dirty = true;
  }

  /** the time of the ride now, in seconds (for the screenshots) */
  get rideTime(): number {
    return this.rideT;
  }

  carPose(): { s: number; v: number } {
    return this.ride ? sample(this.ride, this.rideT) : { s: 0, v: 0 };
  }

  private rideDone(): void {
    const r = this.ride!;
    this.doneAt = this.time;
    if (r.outcome === 'finished') {
      this.rideOk = true;
      this.hooks.sound.play('fanfare');
      for (let i = 0; i < 70; i++) this.confetti.push({ x: this.W * Math.random(), y: -20 - Math.random() * this.H * 0.4, vx: (Math.random() - 0.5) * 60, vy: 90 + Math.random() * 140, c: ['#ff5d8f', '#ffd23f', '#5ad1ff', '#8fe36b', '#b58cff'][i % 5], r: 3 + Math.random() * 4, life: 3.5 });
      this.hooks.onFinished();
    } else {
      this.attempts++;
      this.diag = diagnose(this.track, this.path, r);
      this.hooks.sound.play('oops');
      if (this.diag) this.hooks.onFailed(this.diag, this.attempts);
      // the screen shows the stop: the view is at the place
      this.mode = 'build';
      this.hooks.onMode('build', true);
      if (this.diag) {
        this.x0 = Math.max(-1.6, this.diag.mx - (this.W / this.view.s) * 0.5);
        this.updateView();
      }
    }
  }

  // ---- the loop ----

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const animating = this.mode === 'ride' || !!this.diag || this.confetti.length > 0 || this.track.pts.length <= 1 || this.drag?.kind === 'loop';
    if (!animating && !this.dirty) return;
    this.time += dt;
    if (this.mode === 'ride' && this.ride) this.stepRide(dt);
    for (const c of this.confetti) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.life -= dt;
    }
    this.confetti = this.confetti.filter((c) => c.life > 0 && c.y < this.H + 20);
    this.draw();
    this.dirty = false;
  };

  private stepRide(dt: number): void {
    const r = this.ride!;
    const end = duration(r);
    if (this.rideT < end) {
      this.rideT = Math.min(end, this.rideT + dt);
      const { s, v } = this.carPose();
      const p = at(this.path, s);
      // the camera follows the car
      const target = p.x - (this.W / this.view.s) * 0.4;
      this.x0 += (target - this.x0) * Math.min(1, dt * 4);
      this.updateView();
      // sounds: the chain going up, the wind, the passengers
      if (this.time - this.lastTick > 0.2) {
        this.lastTick = this.time;
        if (s < this.path.crestS) this.hooks.sound.play('chain');
        else if (Math.abs(v) > 4) this.hooks.sound.play('wind', 120 + Math.abs(v) * 45);
      }
      if (!this.wheeeDone && p.th < -0.5 && v > 6 && s > this.path.crestS) {
        this.wheeeDone = true;
        this.hooks.sound.play('wheee');
      }
      if (p.th > 0.1) this.wheeeDone = this.wheeeDone && false;
    } else if (this.doneAt < 0) this.rideDone();
    else if (this.mode === 'ride' && r.outcome === 'finished' && this.time - this.doneAt > 1.2 && !this.keepRideView) {
      /* the view stays on the end: the buttons of the screen go on */
    }
  }
  /** the screen of the end of a good ride stays until a button is pressed */
  keepRideView = true;

  private draw(): void {
    const g = this.g;
    const v = this.view;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawBackground(g, v, this.time);
    drawHeights(g, v);
    drawStations(g, v, this.path);
    drawTrack(g, v, this.path, this.look.track);
    if (this.mode === 'build') {
      if (this.diag) drawStop(g, v, this.diag.mx, this.diag.my, this.diag.capY, this.time);
      drawHandles(g, v, this.track, this.selected);
      if (this.track.pts.length <= 1) drawHand(g, v, this.time);
      // the end of the track that is being drawn: a ring to start from
      if (!this.track.complete) {
        const last = this.track.pts[this.track.pts.length - 1];
        g.strokeStyle = 'rgba(255,93,143,.55)';
        g.lineWidth = 3;
        g.setLineDash([5, 6]);
        g.beginPath();
        g.arc(toX(v, last.x), toY(v, last.y), Math.max(22, v.s * 0.5), 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
      }
      // the loop that is dragged: where it will be put
      if (this.drag?.kind === 'loop') {
        const wx = fromX(v, this.drag.px);
        let near = this.track.pts[1] ?? this.track.pts[0];
        for (const p of this.track.pts) if (Math.abs(p.x - wx) < Math.abs(near.x - wx)) near = p;
        g.strokeStyle = '#ff5d8f';
        g.lineWidth = 4;
        g.setLineDash([6, 6]);
        g.beginPath();
        g.arc(toX(v, near.x + 0.5), toY(v, near.y + 1.25), v.s * 1.25, 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
        g.font = `${Math.round(v.s * 0.9)}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.fillText('🔁', this.drag.px, this.drag.py);
      }
    }
    if (this.ride) {
      const { s, v: speed } = this.mode === 'ride' ? this.carPose() : { s: this.diag ? this.ride.s[this.ride.s.length - 1] : this.path.crestS, v: 0 };
      if (this.mode === 'ride' || this.diag || this.ride.outcome !== 'finished') drawTrain(g, v, this.path, s, speed, this.look, this.time);
    } else {
      drawTrain(g, v, this.path, 2.9, 0, this.look, this.time);
    }
    this.drawMap();
    for (const c of this.confetti) {
      g.fillStyle = c.c;
      g.fillRect(c.x, c.y, c.r * 1.6, c.r);
    }
  }

  /** the car is inside the loop now (for screenshots and the sound of the loop) */
  carInLoop(): boolean {
    return this.mode === 'ride' && !!this.ride && at(this.path, this.carPose().s).inLoop;
  }

  /** The whole track in small, with a frame for what is on the screen. */
  private drawMap(): void {
    const g = this.g;
    const m = this.mapRect;
    const v = this.view;
    g.save();
    g.fillStyle = 'rgba(255,255,255,.78)';
    g.beginPath();
    g.roundRect(m.x, m.y, m.w, m.h, 14);
    g.fill();
    g.strokeStyle = 'rgba(138,47,102,.35)';
    g.lineWidth = 1.5;
    g.stroke();
    const kx = (m.w - 8) / (WORLD_W + 3);
    const ky = (m.h - 10) / 10.5;
    const mx = (x: number): number => m.x + 4 + (x + 1.5) * kx;
    const my = (y: number): number => m.y + m.h - 5 - y * ky;
    g.strokeStyle = 'rgba(255,143,184,.8)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(m.x + 4, my(0));
    g.lineTo(m.x + m.w - 4, my(0));
    g.stroke();
    g.strokeStyle = '#ff5d8f';
    g.lineWidth = 2.2;
    g.lineJoin = 'round';
    g.beginPath();
    const p = this.path;
    for (let i = 0; i < p.n; i += 4) {
      if (i === 0) g.moveTo(mx(p.x[i]), my(p.y[i]));
      else g.lineTo(mx(p.x[i]), my(p.y[i]));
    }
    g.stroke();
    // the end station, a flag
    g.fillStyle = '#333';
    g.fillRect(mx(END.x + 1.4) - 1, my(3.2), 2, my(1.5) - my(3.2));
    if (this.diag) {
      g.fillStyle = '#e0245e';
      g.beginPath();
      g.arc(mx(this.diag.mx), my(this.diag.my), 4, 0, Math.PI * 2);
      g.fill();
    }
    if (this.mode === 'ride' && this.ride) {
      const q = at(this.path, this.carPose().s);
      g.fillStyle = '#ffb84d';
      g.beginPath();
      g.arc(mx(q.x), my(q.y), 4, 0, Math.PI * 2);
      g.fill();
    }
    // what is on the screen
    const vx0 = mx(v.x0), vx1 = mx(v.x0 + v.W / v.s);
    g.strokeStyle = '#8a2f66';
    g.lineWidth = 2;
    g.fillStyle = 'rgba(138,47,102,.12)';
    g.beginPath();
    g.roundRect(Math.max(m.x + 2, vx0), m.y + 3, Math.min(m.x + m.w - 2, vx1) - Math.max(m.x + 2, vx0), m.h - 6, 6);
    g.fill();
    g.stroke();
    g.restore();
  }

  /** The ride, for the 3D view (the same one). */
  currentRide(): { path: Path; ride: Ride } | null {
    return this.ride ? { path: this.path, ride: this.ride } : null;
  }
  currentView(): View {
    return this.view;
  }
}

export { END };
