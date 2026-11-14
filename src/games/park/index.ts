import type { GameContext, GameModule } from '../types';
import { sayLabel, sayLine } from '../english/content/heLines';
import { cheesyImg, getLook, setLook } from '../english/art/cheesy';
import { squishyUrl } from '../english/art/squishies';
import { stopSpeech } from '../english/voice';
import { SESSION_TTL_MS } from '../../access';
import { getState } from '../../storage';
import { allAllowed, speedAtEnd, type Verdict } from './coaster/allowed';
import { closeOrUndo } from './coaster/closer';
import { KINDS, cloneTrack, isClosed, newTrack, type Kind, type Track } from './coaster/track';
import type { ParkScene } from './coaster/scene';
import { pk } from './lines';
import './ui/park.css';

interface Saved { pieces: Kind[]; color?: string }
const COLORS = ['#ff5d8f', '#ff9f43', '#ffd23f', '#4cd97b', '#35b6ff', '#b58cff'];
let ctx: GameContext | null = null;
let root: HTMLElement | null = null;
let scene: ParkScene | null = null;
let track: Track = newTrack();
let colorIx = 0;
let tickets = 0;
let sayTimer = 0;
let busy = false;
let raf = 0;
let timers: number[] = [];
let lookBefore: ReturnType<typeof getLook> | null = null;
let companion = '';
const base = (): string => import.meta.env.BASE_URL;

const icon = `<svg viewBox="0 0 100 100" width="64" height="64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="100" height="100" rx="22" fill="#ffd6f0"/><path d="M8 78 C 28 78 30 24 50 24 C 70 24 72 70 92 70" fill="none" stroke="#ff5d8f" stroke-width="9" stroke-linecap="round"/><rect x="38" y="12" width="26" height="15" rx="6" fill="#ffb84d"/><circle cx="44" cy="30" r="4" fill="#4a3a5a"/><circle cx="58" cy="30" r="4" fill="#4a3a5a"/></svg>`;

/** The companion she chose in the English game (a squishy friend or Cheesy): read, never written, there. */
function riders(): string[] {
  const en = getState().games.english as { buddy?: string | null } | undefined;
  lookBefore ??= { ...getLook() };
  setLook({ buddy: en?.buddy ?? null, accessory: null });
  companion = en?.buddy ? squishyUrl(en.buddy) : `${base()}english/cheesy/happy.webp`;
  return [companion, `${base()}english/words/mom.webp`, `${base()}english/words/dad.webp`];
}

const esc = (t: string): string => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const line = (id: string): string => pk[id.replace(/^park_/, '') as keyof typeof pk] ?? '';

/** A friendly line over the stage: written, and said aloud, with the companion. */
function say(id: string): void {
  const el = root?.querySelector<HTMLElement>('.pk-bubble');
  if (!el) return;
  el.innerHTML = `<span class="pk-who">${cheesyImg('thinking')}</span><span>${esc(line(id))}</span>`;
  el.classList.remove('on');
  void el.offsetWidth;
  el.classList.add('on');
  window.clearTimeout(sayTimer);
  sayTimer = window.setTimeout(() => el.classList.remove('on'), 4200);
  void sayLine(id);
}
const later = (fn: () => void, ms: number): void => void timers.push(window.setTimeout(fn, ms));

function save(): void {
  if (!ctx) return;
  const s: Saved = { pieces: [...track.pieces], color: COLORS[colorIx] };
  ctx.save('track2', s);
  ctx.save('session2', { savedAt: Date.now(), ...s });
}
const onHide = (): void => save();

const REASON: Record<'speed' | 'space' | 'high', string> = { speed: 'park_tooSlow', space: 'park_noRoom', high: 'park_tooHigh' };
const LABEL: Record<Kind, [string, string]> = {
  straight: ['➡️', pk.straight], up: ['⤴️', pk.up], down: ['⤵️', pk.down], left: ['↰', pk.left], right: ['↱', pk.right], loop: ['🔁', pk.loop],
};

let verdicts: Record<Kind, Verdict> | null = null;

/** Everything on the screen follows the track: the buttons (grey when a piece cannot go), the meter, the close and ride buttons. */
function refresh(landLast = false): void {
  if (!root || !scene) return;
  const closed = isClosed(track);
  verdicts = allAllowed(track);
  for (const k of KINDS) {
    const b = root.querySelector<HTMLElement>(`.pk-piece[data-k="${k}"]`)!;
    b.classList.toggle('nope', !verdicts[k].ok);
    b.classList.toggle('hint', track.pieces.length === 0 && k === 'straight');
  }
  root.classList.toggle('closed', closed);
  root.classList.toggle('empty', track.pieces.length === 0);
  root.querySelector('.pk-close')!.classList.toggle('blink', !closed && track.pieces.length > 10);
  root.querySelector('.pk-close')!.classList.toggle('off', closed || track.pieces.length === 0 || busy);
  root.querySelector('.pk-undo')!.classList.toggle('off', track.pieces.length === 0 || busy);
  scene.setTrack(track, landLast);
  const sp = speedAtEnd(track);
  const chain = !track.pieces.includes('down');
  const lvl = chain ? 'green' : sp.level;
  const m = root.querySelector<HTMLElement>('.pk-meter')!;
  m.dataset.level = lvl;
  m.classList.toggle('hide', closed);
  m.querySelector('.chain')!.textContent = chain ? '⛓️' : '';
}

function place(k: Kind): boolean {
  if (busy || !scene) return false;
  const v = verdicts?.[k] ?? { ok: true };
  if (!v.ok) {
    say(REASON[v.why]);
    ctx?.sound.play('oops');
    const b = root?.querySelector(`.pk-piece[data-k="${k}"]`);
    b?.classList.remove('shake');
    void (b as HTMLElement | null)?.offsetWidth;
    b?.classList.add('shake');
    return false;
  }
  track.pieces.push(k);
  ctx?.sound.play('tick', 500 + track.pieces.length * 25);
  if (track.pieces.length === 1) say('park_chainFree');
  refresh(true);
  save();
  if (isClosed(track)) {
    ctx?.sound.play('bonus');
    say('park_closedOk');
  }
  return true;
}

function undo(): void {
  if (busy || !track.pieces.length) return;
  track.pieces.pop();
  ctx?.sound.play('pop', 360);
  refresh();
  save();
}

/** The game closes the track for her: pieces come one after the other (or a few are taken off first when there is no way back). */
function closeIt(): void {
  if (busy || !scene || isClosed(track) || !track.pieces.length) return;
  const way = closeOrUndo(track);
  if (!way) return;
  busy = true;
  refresh();
  const steps: (() => void)[] = [];
  if (way.undo > 0) {
    say('park_closeNoWay');
    for (let i = 0; i < way.undo; i++)
      steps.push(() => {
        track.pieces.pop();
        ctx?.sound.play('pop', 360);
        refresh();
      });
  } else say('park_closeBusy');
  for (const k of way.pieces)
    steps.push(() => {
      track.pieces.push(k);
      ctx?.sound.play('tick', 500 + track.pieces.length * 25);
      refresh(true);
    });
  steps.forEach((f, i) => later(f, 500 + i * 230));
  later(() => {
    busy = false;
    refresh();
    save();
    ctx?.sound.play('bonus');
    say('park_closedOk');
  }, 500 + steps.length * 230 + 400);
}

function setRide(on: boolean): void {
  root?.classList.toggle('riding', on);
  root?.classList.remove('ride-done');
}

function startRide(): void {
  if (!scene || !isClosed(track)) return;
  say('park_pop');
  scene.startRide('first');
  setRide(true);
  root?.classList.remove('outside');
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
    track = newTrack();
    busy = false;
    timers = [];
    const piece = (k: Kind): string => `<button class="pk-piece" type="button" data-k="${k}" data-say="park_${k}" aria-label="${LABEL[k][1]}"><span class="ico">${LABEL[k][0]}</span><span class="lbl">${LABEL[k][1]}</span></button>`;
    const rest = (cls: string, say: string, label: string, ico: string): string => `<button class="pk-act ${cls}" type="button" data-say="park_${say}" aria-label="${label}"><span class="ico">${ico}</span><span class="lbl">${label}</span></button>`;
    root = document.createElement('div');
    root.className = 'pk';
    root.innerHTML = `<div class="pk-host"></div>
      <div class="pk-top"><button class="pk-round pk-home" type="button" aria-label="home">🏠</button><div class="pk-tickets" data-say="park_tickets">🎟️ <b>0</b></div><span class="pk-sp"></span>
        <button class="pk-round pk-color" type="button" data-say="park_color" aria-label="${pk.color}">🎨</button>
        <button class="pk-round pk-new" type="button" data-say="park_newTrack" aria-label="${pk.newTrack}">🧹</button>
        <button class="pk-round pk-center" type="button" data-say="park_center" aria-label="${pk.center}">🎯</button></div>
      <div class="pk-bubble"></div>
      <div class="pk-meter" data-level="green"><img alt="" draggable="false"><span class="chain"></span></div>
      <div class="pk-panel">
        <div class="pk-row">${(['straight', 'up', 'down', 'left', 'right'] as Kind[]).map(piece).join('')}</div>
        <div class="pk-row">${rest('pk-undo', 'undo', pk.undo, '↩️')}${piece('loop')}${rest('pk-close', 'close', pk.close, '🏁')}${rest('pk-go', 'ride', pk.ride, '🎢')}</div>
      </div>
      <div class="pk-hud">
        <button class="pk-round pk-leave" type="button" data-say="park_back" aria-label="${pk.back}">⬅️</button>
        <div class="pk-tickets" data-say="park_tickets">🎟️ <b>0</b></div>
        <button class="pk-round pk-view" type="button" data-say="park_outView" aria-label="${pk.outView}">🎥</button>
        <button class="pk-round pk-again" type="button" data-say="park_again" aria-label="${pk.again}">↺</button>
      </div>`;
    c.container.appendChild(root);
    const r = root;
    r.querySelector<HTMLImageElement>('.pk-meter img')!.src = riders()[0];
    r.addEventListener('pointerdown', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-say]');
      if (el?.dataset.say) void sayLabel(el.dataset.say, '');
    });
    document.body.classList.add('lobby3d-on', 'park-on');
    // the track from a visit under 10 minutes ago, or the one saved last
    const s2 = c.load<(Saved & { savedAt: number }) | null>('session2', null);
    const fresh = s2 && Date.now() - s2.savedAt < SESSION_TTL_MS ? s2 : null;
    const saved = fresh ?? c.load<Saved | null>('track2', null);
    if (saved && Array.isArray(saved.pieces)) track = { pieces: saved.pieces.filter((k): k is Kind => (KINDS as string[]).includes(k)) };
    colorIx = Math.max(0, COLORS.indexOf(saved?.color ?? COLORS[0]));
    tickets = c.load<number>('tickets', 0);
    const setTickets = (): void => r.querySelectorAll('.pk-tickets b').forEach((b) => (b.textContent = String(tickets)));
    setTickets();

    void (async () => {
      try {
        const { startScene } = await import('./coaster/scene');
        const host = r.querySelector<HTMLElement>('.pk-host')!;
        const sc = await startScene(host, {
          color: COLORS[colorIx],
          riders: riders(),
          companionUrl: companion,
          sound: c.sound,
          calm: c.load<boolean>('calm', false),
          onBalloon: (v) => {
            tickets += v;
            c.save('tickets', tickets);
            setTickets();
          },
          onRideEnd: () => r.classList.add('ride-done'),
          onCheer: () => say('park_wheee'),
        });
        if (!root) {
          sc.handle.dispose();
          return;
        }
        scene = sc;
        sc.handle.fadeIn(250);
        sc.setColor(COLORS[colorIx]);
        refresh();
        if (!track.pieces.length) say('park_tapArrows');
        if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__pk = { place, undo, closeIt, startRide, get scene() { return scene; }, get track() { return track; }, refresh, say };
      } catch {
        r.classList.add('no3d');
      }
    })();

    // the speed meter follows the end of the track
    const follow = (): void => {
      raf = requestAnimationFrame(follow);
      const m = r.querySelector<HTMLElement>('.pk-meter');
      const p = scene && !scene.riding ? scene.endScreen() : null;
      if (m && p) m.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      m?.classList.toggle('away', !p || !!scene?.riding);
    };
    raf = requestAnimationFrame(follow);

    r.querySelector('.pk-home')!.addEventListener('click', () => c.onExit());
    r.querySelector('.pk-center')!.addEventListener('click', () => scene?.home());
    r.querySelector('.pk-color')!.addEventListener('click', () => {
      colorIx = (colorIx + 1) % COLORS.length;
      scene?.setColor(COLORS[colorIx]);
      c.sound.play('pop', 600 + colorIx * 60);
      save();
    });
    r.querySelector('.pk-new')!.addEventListener('click', () => c.requestRound(() => {
      track = newTrack();
      refresh();
      save();
      say('park_tapArrows');
    }));
    r.querySelector('.pk-undo')!.addEventListener('click', undo);
    r.querySelector('.pk-close')!.addEventListener('click', closeIt);
    r.querySelector('.pk-go')!.addEventListener('click', startRide);
    // the pieces: a finger on a button shows the piece (the ghost); lifting the finger puts it there; sliding out cancels
    r.querySelectorAll<HTMLElement>('.pk-piece').forEach((b) => {
      const k = b.dataset.k as Kind;
      let on = false;
      const inside = (e: PointerEvent): boolean => {
        const q = b.getBoundingClientRect();
        return e.clientX >= q.left - 8 && e.clientX <= q.right + 8 && e.clientY >= q.top - 8 && e.clientY <= q.bottom + 8;
      };
      b.addEventListener('pointerdown', (e) => {
        if (busy) return;
        try {
          b.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        on = true;
        if (verdicts?.[k].ok) scene?.setGhost(k);
      });
      b.addEventListener('pointermove', (e) => {
        if (!on) return;
        if (!inside(e)) {
          on = false;
          scene?.setGhost(null);
        }
      });
      const end = (e: PointerEvent): void => {
        const was = on;
        on = false;
        scene?.setGhost(null);
        if (was && inside(e)) place(k);
      };
      b.addEventListener('pointerup', end);
      b.addEventListener('pointercancel', () => {
        on = false;
        scene?.setGhost(null);
      });
    });
    // the ride
    r.querySelector('.pk-leave')!.addEventListener('click', () => {
      scene?.stopRide();
      setRide(false);
      r.classList.remove('outside');
      refresh();
    });
    r.querySelector('.pk-view')!.addEventListener('click', () => {
      const out = r.classList.toggle('outside');
      scene?.setView(out ? 'outside' : 'first');
    });
    r.querySelector('.pk-again')!.addEventListener('click', () => {
      scene?.stopRide();
      startRide();
    });
    window.addEventListener('pagehide', onHide);
  },

  canInterrupt: () => !root?.classList.contains('riding'),
  pause() {},
  resume() {},

  unmount() {
    window.removeEventListener('pagehide', onHide);
    save();
    cancelAnimationFrame(raf);
    timers.forEach((t) => window.clearTimeout(t));
    scene?.handle.dispose();
    scene = null;
    stopSpeech();
    window.clearTimeout(sayTimer);
    if (lookBefore) setLook(lookBefore);
    lookBefore = null;
    document.body.classList.remove('lobby3d-on', 'park-on');
    root?.remove();
    root = null;
    ctx = null;
  },
};

export default park;
export { cloneTrack };
