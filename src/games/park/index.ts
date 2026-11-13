import type { GameContext, GameModule } from '../types';
import { sayLabel, sayLine } from '../english/content/heLines';
import { cheesyImg, getLook, setLook } from '../english/art/cheesy';
import { squishyUrl } from '../english/art/squishies';
import { stopSpeech } from '../english/voice';
import { SESSION_TTL_MS } from '../../access';
import { getState } from '../../storage';
import { sessionTier } from '../../lobby3d/quality';
import { Builder } from './coaster/builder';
import type { Diagnosis } from './coaster/hints';
import type { Ride3D } from './coaster/ride3d';
import { cloneTrack, newTrack, type Track } from './coaster/track';
import { pk } from './lines';
import './ui/park.css';

interface Saved { pts: { x: number; y: number }[]; loopAt: number | null; complete: boolean }
let ctx: GameContext | null = null;
let root: HTMLElement | null = null;
let builder: Builder | null = null;
let ride3d: Ride3D | null = null;
let sayTimer = 0;
let companionSrc = '';
let lookBefore: ReturnType<typeof getLook> | null = null;
const base = (): string => import.meta.env.BASE_URL;
const TRACK_COLOR = '#ff5d8f';

const icon = `<svg viewBox="0 0 100 100" width="64" height="64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="100" height="100" rx="22" fill="#ffd6f0"/><path d="M8 78 C 28 78 30 24 50 24 C 70 24 72 70 92 70" fill="none" stroke="#ff5d8f" stroke-width="9" stroke-linecap="round"/><rect x="38" y="12" width="26" height="15" rx="6" fill="#ffb84d"/><circle cx="44" cy="30" r="4" fill="#4a3a5a"/><circle cx="58" cy="30" r="4" fill="#4a3a5a"/></svg>`;

const img = (src: string): HTMLImageElement => {
  const i = new Image();
  i.src = src;
  return i;
};

/** The companion she chose in the English game (a squishy friend or Cheesy): read, never written, there. */
function riders(): (HTMLImageElement | null)[] {
  const en = getState().games.english as { buddy?: string | null } | undefined;
  lookBefore ??= { ...getLook() };
  setLook({ buddy: en?.buddy ?? null, accessory: null });
  const first = en?.buddy ? squishyUrl(en.buddy) : `${base()}english/cheesy/happy.webp`;
  companionSrc = first;
  return [img(first), img(`${base()}english/words/mom.webp`), img(`${base()}english/words/dad.webp`)];
}

const esc = (t: string): string => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** A friendly line over the stage: written, and said aloud, with the companion. */
function say(id: string): void {
  const el = root?.querySelector<HTMLElement>('.pk-bubble');
  if (!el) return;
  const key = id.replace(/^park_/, '') as keyof typeof pk;
  el.innerHTML = `<span class="pk-who">${cheesyImg('thinking')}</span><span>${esc(pk[key] ?? '')}</span>`;
  el.classList.remove('on');
  void el.offsetWidth;
  el.classList.add('on');
  window.clearTimeout(sayTimer);
  sayTimer = window.setTimeout(() => el.classList.remove('on'), 4200);
  void sayLine(id);
}

const toSaved = (t: Track): Saved => ({ pts: t.pts.map((p) => ({ ...p })), loopAt: t.loopAt, complete: t.complete });
const fromSaved = (s: Saved | null | undefined): Track | null => {
  if (!s || !Array.isArray(s.pts) || s.pts.length < 1 || !s.pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) return null;
  return { pts: s.pts.map((p) => ({ ...p })), loopAt: typeof s.loopAt === 'number' ? s.loopAt : null, complete: !!s.complete };
};
function save(t: Track): void {
  if (!ctx) return;
  ctx.save('track', toSaved(t));
  ctx.save('session', { savedAt: Date.now(), track: toSaved(t) });
}
const onHide = (): void => {
  if (builder) save(builder.track);
};

const btn = (cls: string, say: string, label: string, ico: string): string => `<button class="pk-btn ${cls}" type="button" data-say="park_${say}" aria-label="${label}"><span class="ico">${ico}</span><span class="lbl">${label}</span></button>`;

function setUi(mode: 'build' | 'ride', hasRide: boolean): void {
  if (!root) return;
  const r = root;
  r.classList.toggle('riding', mode === 'ride');
  r.classList.toggle('hasride', hasRide);
  paint();
}

/** Which buttons are on: the go button when there is a track, "ride!" after a good ride, "fix it" after three tries that did not work. */
function paint(): void {
  if (!root || !builder) return;
  const b = builder;
  const riding = root.classList.contains('riding');
  const in3d = !!ride3d;
  root.querySelector('.pk-go')!.classList.toggle('off', !b.canRide() || riding || in3d);
  root.querySelector('.pk-fix')!.classList.toggle('on', !!b.diag && b.attempts >= 3 && !riding);
  root.querySelector('.pk-after')!.classList.toggle('on', b.rideOk && !in3d);
  root.querySelector('.pk-loop')!.classList.toggle('placed', b.hasLoop());
  root.querySelector('.pk-tools')!.classList.toggle('hide', riding || in3d || b.rideOk);
}

async function go3d(): Promise<void> {
  if (!root || !builder || !ctx) return;
  const cur = builder.currentRide();
  const pref = getState().settings.lobby;
  const tier = sessionTier(pref);
  // without 3D (or in the plain tier) the ride is shown again from the side, close up
  if (!cur || tier === '2d') {
    builder.startRide();
    return;
  }
  const holder = root.querySelector<HTMLElement>('.pk-three')!;
  holder.classList.add('on');
  root.classList.add('in3d');
  try {
    const { startRide3d } = await import('./coaster/ride3d');
    ride3d = await startRide3d(holder, cur.path, cur.ride, {
      calm: ctx.load<boolean>('calm', false),
      tier,
      color: TRACK_COLOR,
      companionUrl: companionSrc,
      seed: Math.round(cur.path.s[cur.path.n - 1] * 100),
      sound: ctx.sound,
      onEnd: () => root?.classList.add('ride3d-done'),
      onSlow: () => void 0,
    });
    paint();
  } catch {
    leave3d();
    builder.startRide();
  }
}

function leave3d(): void {
  ride3d?.dispose();
  ride3d = null;
  const holder = root?.querySelector<HTMLElement>('.pk-three');
  holder?.classList.remove('on');
  root?.classList.remove('in3d', 'ride3d-done', 'cam-side');
  paint();
}

const park: GameModule = {
  id: 'park',
  title: pk.title,
  icon,
  color: '#ff5d8f',
  /** Out of the game and back within 10 minutes: the same track, without the gate. */
  resumeWithoutGate: true,

  mount(c: GameContext) {
    ctx = c;
    root = document.createElement('div');
    root.className = 'pk';
    root.innerHTML = `<div class="pk-top"><button class="pk-round pk-home" type="button" aria-label="home">🏠</button><h1 data-say="park_title">${pk.title}</h1>${btn('pk-view round', 'overview', pk.overview, '🔭')}</div>
      <div class="pk-stage"><canvas class="pk-canvas"></canvas><div class="pk-bubble"></div><div class="pk-three"></div>
        <div class="pk-after">${btn('pk-3d big', 'ride', pk.ride, '🎢')}${btn('pk-again', 'again', pk.again, '↺')}</div>
        <div class="pk-3d-ui">${btn('pk-cam round', 'carView', pk.carView, '🎥')}${btn('pk-backb round', 'back', pk.back, '⬅️')}${btn('pk-again3 round', 'again', pk.again, '↺')}</div>
      </div>
      <div class="pk-tools">
        ${btn('pk-loop', 'loop', pk.loop, '🔁')}${btn('pk-del', 'del', pk.del, '🗑️')}${btn('pk-restart', 'restart', pk.restart, '🧹')}${btn('pk-fix', 'fixMe', pk.fixMe, '🪄')}
        ${btn('pk-go big off', 'go', pk.go, '▶')}
      </div>`;
    c.container.appendChild(root);
    const r = root;
    r.addEventListener('pointerdown', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-say]');
      if (el?.dataset.say) void sayLabel(el.dataset.say, '');
    });
    r.querySelector('.pk-home')!.addEventListener('click', () => c.onExit());
    // a track left less than 10 minutes ago goes on (the gate was skipped by the host); otherwise the track saved last
    const session = c.load<{ savedAt: number; track: Saved } | null>('session', null);
    const fresh = session && Date.now() - session.savedAt < SESSION_TTL_MS ? fromSaved(session.track) : null;
    const track = fresh ?? fromSaved(c.load<Saved | null>('track', null)) ?? newTrack();
    builder = new Builder(
      r.querySelector('canvas')!,
      {
        sound: c.sound,
        onChange: (t) => {
          save(t);
          paint();
        },
        onFailed: (d: Diagnosis, attempts: number) => {
          say(`park_hint_${d.kind}`);
          if (attempts >= 3) r.querySelector('.pk-fix')!.classList.add('on');
          paint();
        },
        onFinished: () => {
          say('park_great');
          paint();
        },
        onMode: setUi,
        onRefused: () => {
          const l = r.querySelector('.pk-loop')!;
          l.classList.remove('bounce');
          void (l as HTMLElement).offsetWidth;
          l.classList.add('bounce');
        },
      },
      { track: TRACK_COLOR, riders: riders() },
      cloneTrack(track),
    );
    // the buttons
    const b = builder;
    r.querySelector('.pk-go')!.addEventListener('click', () => b.startRide());
    r.querySelector('.pk-del')!.addEventListener('click', () => b.deleteEnd());
    r.querySelector('.pk-restart')!.addEventListener('click', () => b.restart());
    r.querySelector('.pk-fix')!.addEventListener('click', () => {
      b.fixIt();
      paint();
    });
    r.querySelector('.pk-view')!.addEventListener('click', () => b.toggleOverview());
    r.querySelector('.pk-3d')!.addEventListener('click', () => void go3d());
    r.querySelector('.pk-again')!.addEventListener('click', () => {
      b.rideOk = false;
      b.startRide();
    });
    r.querySelector('.pk-again3')!.addEventListener('click', () => {
      leave3d();
      b.rideOk = false;
      b.startRide();
    });
    r.querySelector('.pk-backb')!.addEventListener('click', () => {
      leave3d();
      b.stopRide();
      b.rideOk = true;
      paint();
    });
    r.querySelector('.pk-cam')!.addEventListener('click', () => {
      const side = r.classList.toggle('cam-side');
      ride3d?.setCamera(side ? 'side' : 'first');
    });
    r.querySelector('.pk-three')!.addEventListener('pointerdown', () => ride3d?.cheer());
    // the loop is dragged out of its place in the tray (a tap on it when it is on the track takes it off)
    const loopBtn = r.querySelector<HTMLElement>('.pk-loop')!;
    loopBtn.addEventListener('pointerdown', (e) => {
      if (b.hasLoop()) {
        b.removeLoopPiece();
        return;
      }
      loopBtn.setPointerCapture(e.pointerId);
      b.beginLoopDrag(e.clientX, e.clientY);
    });
    loopBtn.addEventListener('pointermove', (e) => b.moveLoopDrag(e.clientX, e.clientY));
    loopBtn.addEventListener('pointerup', () => {
      b.endLoopDrag();
      paint();
    });
    loopBtn.addEventListener('pointercancel', () => b.endLoopDrag());
    window.addEventListener('pagehide', onHide);
    paint();
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__pk = { builder, go3d, leave3d, get ride3d() { return ride3d; } };
  },

  canInterrupt: () => !builder || !root?.classList.contains('riding'),
  pause() {},
  resume() {},

  unmount() {
    window.removeEventListener('pagehide', onHide);
    if (builder) save(builder.track);
    leave3d();
    builder?.destroy();
    builder = null;
    stopSpeech();
    window.clearTimeout(sayTimer);
    if (lookBefore) setLook(lookBefore);
    lookBefore = null;
    root?.remove();
    root = null;
    ctx = null;
  },
};

export default park;
