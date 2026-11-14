/**
 * The builder (SPEC-park.md 3.1): Rani draws the track with a finger, side view; points can be moved, the end deleted, the loop dragged on.
 * Then the car goes, by the physics, and when it does not get to the end the place is marked and a hint is said.
 */
import type { SoundApi } from '../../../sound';
import { diagnose, fix, type Diagnosis } from './hints';
import { sample, simulate, duration, type Ride } from './physics';
import { onArtLoaded } from './art';
import { drawBackground, drawHand, drawHandles, drawHeights, drawHits, drawObstacle, drawParts, drawSpeedGate, drawStarGoal, drawStations, drawStop, drawTrack, drawTrain, drawTunnel, fromX, fromY, makeView, toX, toY, type Look, type View } from './render2d';
import { evaluate, hitMask, noGoals, STAR_REACH, type Evaluation, type Goals } from '../goals';
import { funOf, type Fun } from '../fun';
import { END, PART_SPAN, WORLD_H, WORLD_W, addLoop, addPart, at, buildPath, cloneTrack, deleteFrom, extend, finish, moveY, newTrack, removeLoop, removePart, type PartKind, type Path, type Track } from './track';

export interface BuilderHooks {
  sound: SoundApi;
  /** the track changed (to save it) */
  onChange(t: Track): void;
  /** the hint to say (a kind) when the ride is over without getting to the end; `attempts` counts them */
  onFailed(d: Diagnosis, attempts: number): void;
  /** the car got to the end: how the goals of the level went (null when there are none) and the fun of the ride */
  onFinished(ev: Evaluation | null, fun: Fun): void;
  /** the car took a star */
  onStar?(got: number, of: number): void;
  /** the screen state changed: 'build' | 'ride' */
  onMode(mode: 'build' | 'ride', hasRide: boolean): void;
  /** the bottom of the mini map (px from the top of the canvas): the speech bubble goes under it */
  onLayout?(mapBottom: number): void;
  /** a place where something was refused (a bounce of the loop button, say) */
  onRefused?(what: 'loop' | PartKind): void;
}

interface Confetti { x: number; y: number; vx: number; vy: number; c: string; r: number; life: number }

export type Piece = 'loop' | PartKind;
type Drag = { kind: 'map' } | { kind: 'draw' } | { kind: 'move'; i: number } | { kind: 'pan'; x: number; x0: number } | { kind: 'part'; part: Piece; px: number; py: number };

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
  /** the challenge: its goals, the picture of the zone, how many loops and which parts are allowed, and the hand that shows how */
  goals: Goals = noGoals();
  bg: string | null = null;
  allow: { loops: number; parts: PartKind[] } = { loops: 2, parts: ['chain', 'tunnel', 'splash'] };
  guide: Path | null = null;
  solution: Track | null = null;
  /** the last ride: the goals (null without goals), the fun, and whether the goals failed */
  evalRes: Evaluation | null = null;
  fun: Fun | null = null;
  goalFailed = false;
  collected: boolean[] = [];
  private hits: Uint8Array = new Uint8Array(0);
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
  private lastS = 0;
  private dirty = true;
  private confetti: Confetti[] = [];
  private wheeeDone = false;
  private ro: ResizeObserver;
  private offArt: () => void;
  private doneAt = -1;
  /** the mini map of the whole track, in the empty sky above the track */
  mapRect = { x: 12, y: 72, w: 300, h: 60 };

  constructor(private canvas: HTMLCanvasElement, private hooks: BuilderHooks, private look: Look, track?: Track) {
    this.g = canvas.getContext('2d')!;
    this.track = track ?? newTrack();
    this.path = buildPath(this.track);
    this.view = makeView(300, 500, 0, false);
    this.offArt = onArtLoaded(() => (this.dirty = true));
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
    this.offArt();
    this.ro.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
  }

  /** A challenge (or free building without one): the goals, the zone's picture and the way. */
  setLevel(lv: { goals: Goals; solution: Track; allow: { loops: number; parts: PartKind[] }; zoneBg: string; tutorial: boolean } | null): void {
    this.goals = lv ? lv.goals : noGoals();
    this.solution = lv ? cloneTrack(lv.solution) : null;
    this.bg = lv ? lv.zoneBg : 'candy';
    this.allow = lv ? lv.allow : { loops: 2, parts: ['chain', 'tunnel', 'splash'] };
    this.guide = lv?.tutorial ? buildPath(lv.solution) : null;
    this.attempts = 0;
    this.goalFailed = false;
    this.evalRes = null;
    this.fun = null;
    this.collected = this.goals.stars.map(() => false);
    this.changed();
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
    } else if (d.kind === 'part') {
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
    if (d.kind === 'part') this.dropPart(d.part, d.px);
    this.dirty = true;
  };

  /** A piece (the loop or a special part) is dragged out of the tray: it follows the finger over the canvas. */
  beginPartDrag(part: Piece, clientX: number, clientY: number): void {
    const r = this.canvas.getBoundingClientRect();
    this.drag = { kind: 'part', part, px: clientX - r.left, py: clientY - r.top };
    this.dirty = true;
  }
  movePartDrag(clientX: number, clientY: number): void {
    if (this.drag?.kind !== 'part') return;
    const r = this.canvas.getBoundingClientRect();
    this.drag.px = clientX - r.left;
    this.drag.py = clientY - r.top;
    this.dirty = true;
  }
  endPartDrag(): void {
    const d = this.drag;
    this.drag = null;
    if (d?.kind === 'part') this.dropPart(d.part, d.px);
    this.dirty = true;
  }
  private dropPart(part: Piece, px: number): void {
    if (px < 0 || px > this.W) return;
    const x = fromX(this.view, px);
    const ok = part === 'loop' ? addLoop(this.track, x, this.allow.loops) : this.allow.parts.includes(part) && addPart(this.track, part, x);
    if (ok) {
      this.hooks.sound.play('bonus');
      this.changed();
    } else this.hooks.onRefused?.(part);
  }
  /** A tap on a piece that is on the track takes it off (one of them). */
  removePiece(part: Piece): void {
    if (part === 'loop') removeLoop(this.track);
    else removePart(this.track, part);
    this.changed();
  }
  has(part: Piece): boolean {
    return part === 'loop' ? this.track.loops.length > 0 : this.track.parts.some((p) => p.kind === part);
  }
  /** Gets a piece on the track when the tray is full: the loop can be put twice where two are allowed. */
  full(part: Piece): boolean {
    return part === 'loop' ? this.track.loops.length >= this.allow.loops : false;
  }

  // ---- editing ----

  private changed(): void {
    this.path = buildPath(this.track);
    this.hits = hitMask(this.goals, this.path);
    this.collected = this.goals.stars.map(() => false);
    this.goalFailed = false;
    this.evalRes = null;
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
    this.goalFailed = false;
    this.x0 = -1.6;
    this.updateView();
    this.changed();
  }
  /** "Fix it for me" (after 3 tries that did not work): the ride that did not finish is mended; a ride that missed a goal gets the solution. */
  fixIt(): boolean {
    if (!this.diag && this.goalFailed && this.solution) {
      this.track = cloneTrack(this.solution);
      this.attempts = 0;
      this.changed();
      return true;
    }
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
    this.lastS = 0;
    this.doneAt = -1;
    this.diag = null;
    this.collected = this.goals.stars.map(() => false);
    this.evalRes = null;
    this.goalFailed = false;
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
      this.fun = funOf(this.track, this.path, r);
      const hasGoals = this.goals.stars.length > 0 || this.goals.obstacles.length > 0 || !!this.goals.speed || !!this.goals.height || this.goals.parts.length > 0;
      this.evalRes = hasGoals ? evaluate(this.goals, this.track, this.path, r) : null;
      if (this.evalRes && !this.evalRes.ok) {
        // it finished, but a goal was missed: another try (the track stays as it is)
        this.goalFailed = true;
        this.attempts++;
        this.hooks.sound.play('oops');
        this.mode = 'build';
        this.hooks.onMode('build', true);
        this.hooks.onFinished(this.evalRes, this.fun);
        return;
      }
      this.rideOk = true;
      this.hooks.sound.play('fanfare');
      for (let i = 0; i < 70; i++) this.confetti.push({ x: this.W * Math.random(), y: -20 - Math.random() * this.H * 0.4, vx: (Math.random() - 0.5) * 60, vy: 90 + Math.random() * 140, c: ['#ff5d8f', '#ffd23f', '#5ad1ff', '#8fe36b', '#b58cff'][i % 5], r: 3 + Math.random() * 4, life: 3.5 });
      this.hooks.onFinished(this.evalRes, this.fun);
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
    const animating = this.mode === 'ride' || !!this.diag || this.confetti.length > 0 || this.track.pts.length <= 1 || this.drag?.kind === 'part' || this.goals.stars.length > 0 || !!this.guide;
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
      for (const d of this.path.splashes) if (this.lastS < d && s >= d) this.hooks.sound.play('splash');
      this.lastS = s;
      this.goals.stars.forEach((st, i) => {
        if (!this.collected[i] && Math.hypot(p.x - st.x, p.y - st.y) <= STAR_REACH) {
          this.collected[i] = true;
          this.hooks.sound.play('starpop');
          this.hooks.onStar?.(this.collected.filter(Boolean).length, this.goals.stars.length);
          for (let k = 0; k < 14; k++) this.confetti.push({ x: toX(this.view, st.x), y: toY(this.view, st.y), vx: (Math.random() - 0.5) * 220, vy: -80 - Math.random() * 140, c: '#ffd23f', r: 3 + Math.random() * 3, life: 0.8 });
        }
      });
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
    drawBackground(g, v, this.time, this.bg);
    drawHeights(g, v);
    // the height that is asked for: a line with its number
    const hg = this.goals.height;
    if (hg) {
      g.save();
      g.setLineDash([10, 8]);
      g.strokeStyle = 'rgba(224,36,94,.85)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, toY(v, hg.h));
      g.lineTo(v.W, toY(v, hg.h));
      g.stroke();
      g.restore();
    }
    const sg = this.goals.speed;
    if (sg) drawSpeedGate(g, v, sg, 'back', false);
    drawStations(g, v, this.path);
    for (const o of this.goals.obstacles) drawObstacle(g, v, o, false, this.time);
    drawTrack(g, v, this.path, this.look.track);
    drawParts(g, v, this.path, this.time, false);
    if (this.hits.some((h) => h)) drawHits(g, v, this.path, this.hits, this.time);
    const got = this.mode === 'ride' ? this.collected : this.evalRes ? this.evalRes.stars : this.collected;
    this.goals.stars.forEach((st, i) => drawStarGoal(g, v, st, !!got[i], this.time, i));
    if (this.mode === 'build') {
      if (this.diag) drawStop(g, v, this.diag.mx, this.diag.my, this.diag.capY, this.time);
      drawHandles(g, v, this.track, this.selected);
      if (this.guide && this.track.pts.length <= 2 && !this.drag) this.drawGuide(g, v);
      else if (this.track.pts.length <= 1 && !this.guide) drawHand(g, v, this.time);
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
      // the piece that is dragged: where it will be put
      if (this.drag?.kind === 'part') this.drawPartDrag(g, v, this.drag);
    }
    if (this.ride) {
      const { s, v: speed } = this.mode === 'ride' ? this.carPose() : { s: this.diag ? this.ride.s[this.ride.s.length - 1] : this.path.crestS, v: 0 };
      if (this.mode === 'ride' || this.diag || this.ride.outcome !== 'finished') drawTrain(g, v, this.path, s, speed, this.look, this.time);
      else if (this.goalFailed) drawTrain(g, v, this.path, this.ride.s[this.ride.s.length - 1], 0, this.look, this.time);
    } else {
      drawTrain(g, v, this.path, 2.9, 0, this.look, this.time);
    }
    // the tunnels (a hill that the track goes into) and the front of the splash and of the gate are over the train
    for (const [a, b] of this.path.tunnels) drawTunnel(g, v, this.path, at(this.path, a).x, at(this.path, b).x);
    drawParts(g, v, this.path, this.time, true);
    if (sg) {
      const hit = this.mode === 'ride' && this.ride ? at(this.path, this.carPose().s).x > sg.x : false;
      drawSpeedGate(g, v, sg, 'front', hit);
    }
    this.drawMap();
    for (const c of this.confetti) {
      g.fillStyle = c.c;
      g.fillRect(c.x, c.y, c.r * 1.6, c.r);
    }
  }

  /** The hand that shows how to draw the challenge: it goes along the way of the reference solution, with the dotted line behind it. */
  private drawGuide(g: CanvasRenderingContext2D, v: View): void {
    const p = this.guide!;
    const a = p.crestS, b = p.endS === Infinity ? p.s[p.n - 1] : p.endS;
    const k = (this.time % 5) / 5;
    const d = a + (b - a) * Math.min(1, k * 1.15);
    g.save();
    g.globalAlpha = k < 0.05 ? k / 0.05 : k > 0.93 ? Math.max(0, (1 - k) / 0.07) : 1;
    g.strokeStyle = 'rgba(255,93,143,.65)';
    g.lineWidth = Math.max(5, v.s * 0.15);
    g.lineCap = 'round';
    g.setLineDash([2, 11]);
    g.beginPath();
    for (let s2 = a; s2 <= d; s2 += 0.25) {
      const q = at(p, s2);
      if (s2 === a) g.moveTo(toX(v, q.x), toY(v, q.y));
      else g.lineTo(toX(v, q.x), toY(v, q.y));
    }
    g.stroke();
    g.setLineDash([]);
    const q = at(p, d);
    g.font = `${Math.round(v.s * 1.1)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('👆', toX(v, q.x) + v.s * 0.1, toY(v, q.y) + v.s * 0.5);
    g.restore();
    // the view follows the hand
    const target = q.x - (this.W / v.s) * 0.4;
    if (Math.abs(target - this.x0) > 0.05 && !this.drag) {
      this.x0 += (target - this.x0) * 0.08;
      this.updateView();
    }
  }

  private drawPartDrag(g: CanvasRenderingContext2D, v: View, d: { part: Piece; px: number; py: number }): void {
    const wx = fromX(v, d.px);
    let near = this.track.pts[1] ?? this.track.pts[0];
    for (const p of this.track.pts) if (Math.abs(p.x - wx) < Math.abs(near.x - wx)) near = p;
    g.save();
    g.strokeStyle = '#ff5d8f';
    g.fillStyle = 'rgba(255,93,143,.18)';
    g.lineWidth = 4;
    g.setLineDash([6, 6]);
    g.beginPath();
    if (d.part === 'loop') g.arc(toX(v, near.x + 0.5), toY(v, near.y + 1.25), v.s * 1.25, 0, Math.PI * 2);
    else {
      const w = PART_SPAN[d.part] * v.s;
      g.roundRect(d.px - w / 2, toY(v, near.y) - v.s * 1.1, w, v.s * 2.2, 14);
      g.fill();
    }
    g.stroke();
    g.setLineDash([]);
    g.font = `${Math.round(v.s * 0.9)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.fillText({ loop: '🔁', chain: '⛓️', tunnel: '🚇', splash: '💦' }[d.part], d.px, d.py);
    g.restore();
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
    for (const o of this.goals.obstacles) {
      g.fillStyle = 'rgba(120,120,140,.7)';
      g.fillRect(mx(o.x0), my(o.y1), Math.max(3, mx(o.x1) - mx(o.x0)), Math.max(3, my(o.y0) - my(o.y1)));
    }
    g.fillStyle = '#ffb800';
    this.goals.stars.forEach((st, i) => {
      if (this.collected[i]) return;
      g.beginPath();
      g.arc(mx(st.x), my(st.y), 3, 0, Math.PI * 2);
      g.fill();
    });
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
