import type { GameContext } from '../types';
import type { LevelData } from './engine/level';
import { FREE_UNDOS, canAfford, dailyFreeAvailable, dayKey, newBook, priceOf, recordUse, starsFor, type Helper, type HelperBook } from './engine/boosters';
import { suggestHelper } from './engine/solver';
import { MAX_SLOTS, SIZES, TrafficState, type SaveData } from './engine/state';
import type { TrafficScene } from './render/scene';
import type { Hud } from './ui/hud';

const PRAISE = ['יופי!', 'מדהים!', 'אלופה!'];

export interface Hooks {
  /** called when the level is won; returns what the result card should say */
  onWin(stars: 1 | 2 | 3, moves: number): { next: boolean; newStars: number };
  /** the state is calm (nothing is driving): a good moment to save */
  save(data: SaveData, book: HelperBook): void;
  /** the stars in the jar, and paying with them */
  stars(): number;
  spend(n: number): void;
  /** the day the free helper of the day was last used (null: never) */
  lastFreeDay(): string | null;
  useFreeDay(day: string): void;
  clearSave(): void;
  /** try the same level again at once (after "stuck": no gate) */
  restart(): void;
  /** play the same level again (asks the gate like a new round) */
  replay(): void;
  next(): void;
  home(): void;
}

export { starsFor };

/** Ties the rules (TrafficState) to the picture (TrafficScene), the sounds and the HUD. */
export class Controller {
  state: TrafficState;
  private busy = false; // a boarding is in the air
  private streak = 0;
  private lastBoard = 0;
  private ended = false;
  private alive = true;
  private later: number[] = [];
  private onResize = (): void => this.showHint();

  private book: HelperBook;
  private pickVip = false;

  constructor(private ctx: GameContext, private scene: TrafficScene, private hud: Hud, private level: LevelData, private hooks: Hooks, resume?: SaveData, book?: HelperBook) {
    this.state = new TrafficState(level.vehicles, level.queue, level.belts);
    this.book = book ?? newBook();
    if (resume && this.state.load(resume)) {
      this.syncScene();
      hud.setCount(this.state.boarded, this.state.total);
    }
    this.refreshBoosters();
    scene.onTapVehicle = (id, long) => this.tap(id, long);
    scene.canLeave = (id) => this.state.canLeave(id);
    scene.onSpeed = (fast) => this.hud.setFast(fast);
    window.addEventListener('resize', this.onResize);
    this.showHint();
    if (resume) this.wait(300, () => this.pump());
  }

  private snd = (n: Parameters<GameContext['sound']['play']>[0]) => this.ctx.sound.play(n);
  private wait(ms: number, f: () => void): void {
    if (this.scene.reduced) ms = Math.min(ms, 30);
    ms /= this.scene.speed; // double speed while the finger is held down
    this.later.push(window.setTimeout(() => this.alive && f(), ms));
  }

  /** The tutorial: what to say now, and which vehicle the hand points at. */
  private showHint(blocked = false): void {
    const steps = this.level.steps;
    if (this.ended) return;
    if (!steps) {
      // what is new in this level, until the first move
      this.hud.caption(this.level.intro && this.state.moves === 0 ? this.level.intro : null);
      return;
    }
    const step = steps[Math.min(this.state.moves, steps.length - 1)];
    const text = blocked && step.blocked ? step.blocked.text : step.text;
    const hand = blocked && step.blocked ? step.blocked.hand : step.hand;
    this.hud.caption(text);
    const v = hand !== undefined ? this.state.get(hand) : null;
    this.hud.hand(v && v.status === 'parked' ? this.scene.screenPos(v.id) : null);
  }

  private syncScene(): void {
    this.scene.sync({
      vehicles: this.state.vehicles.map((v) => ({ id: v.id, status: v.status, slot: v.slot, color: v.color, filled: v.filled, revealed: v.revealed, x: v.x, z: v.z, heading: v.heading })),
      boarded: this.state.boarded,
      queue: this.state.queue,
      slots: this.state.slots.length,
    });
  }

  tap(id: number, long = false): void {
    if (this.ended) return;
    if (this.pickVip) return this.vipPick(id);
    const rv = this.state.get(id);
    if (rv.rotator && rv.status === 'parked' && !long) {
      // a short tap turns a vehicle that turns on the spot; a long press sends it
      const h = this.state.rotate(id);
      if (h !== null) {
        this.scene.rotateTo(id, h);
        this.snd('flip');
        this.hud.hand(null);
      }
      return;
    }
    const r = this.state.tap(id);
    if (r.kind === 'ignored') return;
    if (r.kind === 'full') {
      this.scene.shake(id);
      this.snd('oops');
      return;
    }
    if (r.kind === 'blocked') {
      this.snd('bonk');
      this.scene.bonk(id, r.by, r.distance, () => {});
      this.showHint(true);
      return;
    }
    this.hud.message(null);
    this.hud.hand(null);
    this.scene.stuck(false);
    this.snd('engine');
    for (const v of this.state.uncovered(id)) this.wait(350, () => (this.scene.reveal(v.id, v.color), this.snd('pop')));
    this.refreshBoosters();
    for (const sh of r.shifts) this.scene.shiftOnBelt(sh.id, sh.x, sh.z);
    this.scene.startExit(id, r.slot, () => {
      this.snd('brake');
      this.state.arrive(id);
      this.wait(260, () => this.pump());
    });
  }

  /** Let waiting passengers board, one at a time, until nobody can. */
  private pump(): void {
    if (this.busy || this.ended) return;
    const next = this.state.nextBoarding();
    if (!next) return this.settled();
    this.busy = true;
    const { vehicle, color } = next;
    this.scene.boardPassenger(vehicle.id, color, () => {
      const r = this.state.board();
      if (!r) return;
      const now = performance.now();
      this.streak = now - this.lastBoard < 700 ? this.streak + 1 : 1;
      this.lastBoard = now;
      this.ctx.sound.play('pop', Math.min(1400, 420 * Math.pow(1.07, this.streak)));
      this.hud.setCount(this.state.boarded, this.state.total);
      this.scene.setSeatsLeft(r.vehicle.id, r.vehicle.color, r.left);
      if (this.streak > 0 && this.streak % 6 === 0) {
        this.hud.praise(PRAISE[Math.min(PRAISE.length - 1, this.streak / 6 - 1)]);
        this.snd('bonus');
      }
      const finish = () => {
        this.busy = false;
        this.pump();
      };
      if (r.full) {
        this.snd('honk');
        this.wait(250, () => {
          this.scene.depart(r.vehicle.id, () => {});
          this.state.depart(r.vehicle.id);
          this.wait(300, finish);
        });
      } else this.wait(60, finish);
    });
  }

  /** Nothing is moving: save, show the next hint, and see if it is over. */
  private settled(): void {
    this.refreshBoosters();
    const st = this.state.status;
    if (st === 'won') return this.win();
    if (st === 'stuck') return this.stuck();
    if (!this.state.vehicles.some((v) => v.status === 'driving')) {
      this.hooks.save(this.state.serialize(), this.book);
      this.showHint();
    }
  }

  private win(): void {
    this.ended = true;
    this.hooks.clearSave();
    this.hud.hand(null);
    this.scene.celebrate();
    this.snd('firework');
    this.wait(500, () => this.snd('win'));
    const stars = starsFor(this.book.helpersUsed);
    const res = this.hooks.onWin(stars, this.state.moves);
    this.wait(2200, () => {
      const tut = this.level.kind === 'tutorial';
      const o = this.hud.overlay(`<h2>${tut ? 'כל הכבוד!' : 'כל הנוסעים על הסיפון!'}</h2>
        <div class="tr-stars">${[1, 2, 3].map((i) => `<span class="${i <= stars ? 'on' : ''}">⭐</span>`).join('')}</div>
        ${res.next ? '<button class="btn" id="tr-next">הבא</button>' : '<p style="margin:0;font-size:20px">סיימת את כל השלבים!</p>'}
        <button class="btn secondary" id="tr-again">שוב</button><button class="btn secondary" id="tr-home2">הביתה</button>`);
      o.querySelector('#tr-next')?.addEventListener('click', () => this.hooks.next());
      o.querySelector('#tr-again')?.addEventListener('click', () => this.hooks.replay());
      o.querySelector('#tr-home2')?.addEventListener('click', () => this.hooks.home());
    });
  }

  private stuck(): void {
    this.hooks.clearSave();
    this.scene.stuck(true);
    this.snd('oops');
    this.wait(900, () => {
      if (this.ended || this.state.status !== 'stuck') return;
      // one helper that would really get the game going again; the first one of the day is free
      const help = suggestHelper(this.level.vehicles, this.state);
      const free = dailyFreeAvailable(this.hooks.lastFreeDay(), dayKey());
      const price = help ? priceOf(help.kind, this.book, free) : null;
      const names: Record<string, string> = { slot: 'מקום נוסף', vip: 'VIP' };
      const label = help && price ? `${names[help.kind]} · ${price.free ? 'חינם היום!' : `${price.stars} ⭐`}` : '';
      const o = this.hud.overlay(`<h2>אופס! ננסה שוב?</h2><p style="margin:0;font-size:20px">${help ? 'עזר קטן יכול להמשיך את המשחק' : 'טיפ: שלחו קודם רכב בצבע של הנוסעים הראשונים בתור'}</p>
        ${help ? `<button class="btn" id="tr-help">${label}</button>` : ''}
        <button class="btn ${help ? 'secondary' : ''}" id="tr-retry">ננסה שוב</button>`);
      const hb = o.querySelector('#tr-help') as HTMLElement | null;
      if (hb && help && price) {
        const ok = canAfford(price, this.hooks.stars());
        hb.classList.toggle('dim', !ok);
        if (!ok) hb.textContent = `🔒 ${label}`;
        hb.addEventListener('click', () => {
          if (!canAfford(price, this.hooks.stars())) return this.hud.toast(`צריך עוד ${price.stars - this.hooks.stars()} ⭐ בשביל זה`);
          this.hud.clearOverlay();
          this.scene.stuck(false);
          this.charge(help.kind, price, free);
          if (help.kind === 'slot') this.doSlot();
          else this.doVip(help.vehicle!);
        });
      }
      o.querySelector('#tr-retry')!.addEventListener('click', () => this.hooks.restart());
    });
  }

  // ---- the helpers ----------------------------------------------------------------------------------------------------

  private moving(): boolean {
    return this.busy || this.state.vehicles.some((v) => v.status === 'driving') || this.scene.timeline.busy;
  }

  private distinctColors(): number {
    return new Set(this.state.queue).size;
  }

  private applicable(h: Helper): boolean {
    if (h === 'undo') return this.state.canUndo();
    if (h === 'shuffle') return this.distinctColors() >= 2;
    if (h === 'slot') return this.state.slots.length < MAX_SLOTS;
    return this.state.vip === null && this.state.vehicles.some((v) => v.status === 'parked');
  }

  /** Looks of the four buttons: the badge says what it costs, and a button is dimmed (not grey) when it cannot be used. */
  refreshBoosters(): void {
    const stars = this.hooks.stars();
    this.hud.setStars(stars);
    for (const h of ['undo', 'shuffle', 'slot', 'vip'] as Helper[]) {
      const price = priceOf(h, this.book);
      const badge = h === 'undo' && price.free ? String(FREE_UNDOS - this.book.undosUsed) : `${price.stars}⭐`;
      const poor = !canAfford(price, stars);
      this.hud.setBooster(h, { badge, dim: poor || !this.applicable(h), locked: poor, active: h === 'vip' && this.pickVip });
    }
  }

  /** A helper button was pressed. */
  useHelper(h: Helper): void {
    if (this.ended) return;
    if (h === 'vip' && this.pickVip) return this.cancelVip();
    if (this.moving()) return this.hud.toast('רגע, הרכבים עוד בדרך');
    const price = priceOf(h, this.book);
    if (!this.applicable(h)) {
      const why: Record<Helper, string> = { undo: 'אין מה לבטל', shuffle: 'אין מה לערבב', slot: 'כבר יש 7 מקומות', vip: 'מקום ה-VIP תפוס' };
      return this.hud.toast(why[h]);
    }
    const have = this.hooks.stars();
    if (!canAfford(price, have)) return this.hud.toast(`צריך עוד ${price.stars - have} ⭐ בשביל זה`);
    if (h === 'vip') {
      this.pickVip = true;
      this.scene.setPickMode(true);
      this.hud.message('בחרו רכב שיעוף למקום ה-VIP');
      this.hud.hand(null);
      return this.refreshBoosters();
    }
    this.charge(h, price, false);
    if (h === 'undo') this.doUndo();
    else if (h === 'shuffle') this.doShuffle();
    else this.doSlot();
  }

  private charge(h: Helper, price: { stars: number; free: boolean }, daily: boolean): void {
    if (!price.free) this.hooks.spend(price.stars);
    if (daily) this.hooks.useFreeDay(dayKey());
    this.book = recordUse(h, this.book);
    this.refreshBoosters();
  }

  private cancelVip(): void {
    this.pickVip = false;
    this.scene.setPickMode(false);
    this.hud.message(null);
    this.showHint();
    this.refreshBoosters();
  }

  private vipPick(id: number): void {
    const v = this.state.get(id);
    if (v.status !== 'parked' || this.moving()) return;
    const price = priceOf('vip', this.book);
    if (!canAfford(price, this.hooks.stars())) return this.cancelVip();
    this.pickVip = false;
    this.scene.setPickMode(false);
    this.hud.message(null);
    this.charge('vip', price, false);
    this.doVip(id);
  }

  private doUndo(): void {
    if (!this.state.undo()) return;
    this.streak = 0;
    this.hud.hand(null);
    this.snd('flip');
    this.syncScene();
    this.hud.setCount(this.state.boarded, this.state.total);
    this.hooks.save(this.state.serialize(), this.book);
    this.showHint();
    this.refreshBoosters();
  }

  private doShuffle(): void {
    const before = this.state.queue.join();
    for (let k = 0; k < 6 && this.state.queue.join() === before; k++) this.state.shuffleQueue(Math.random);
    this.snd('bonus');
    this.syncScene();
    this.wait(500, () => this.pump());
  }

  private doSlot(): void {
    this.state.addSlot();
    this.scene.setSlots(this.state.slots.length);
    this.snd('bonus');
    this.refreshBoosters();
    this.wait(400, () => this.pump());
  }

  private doVip(id: number): void {
    const v = this.state.get(id);
    const wasHidden = v.hidden && !v.revealed;
    if (!this.state.sendToVip(id)) return;
    this.snd('engine');
    if (wasHidden) this.wait(300, () => (this.scene.reveal(id, v.color), this.snd('pop')));
    for (const u of this.state.uncovered(id)) this.wait(350, () => (this.scene.reveal(u.id, u.color), this.snd('pop')));
    this.scene.startVip(id, () => {
      this.snd('brake');
      this.state.arrive(id);
      this.wait(260, () => this.pump());
    });
  }

  destroy(): void {
    this.alive = false;
    this.later.forEach(clearTimeout);
    this.scene.onTapVehicle = null;
    this.scene.setPickMode(false);
    window.removeEventListener('resize', this.onResize);
  }
}

export const seatsOf = (type: 'car' | 'van' | 'bus'): number => SIZES[type].seats;
