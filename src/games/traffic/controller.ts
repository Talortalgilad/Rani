import type { GameContext } from '../types';
import type { LevelData } from './engine/level';
import { SIZES, TrafficState, type SaveData } from './engine/state';
import type { TrafficScene } from './render/scene';
import type { Hud } from './ui/hud';

const PRAISE = ['יופי!', 'מדהים!', 'אלופה!'];

export interface Hooks {
  /** called when the level is won; returns what the result card should say */
  onWin(stars: 1 | 2 | 3, moves: number): { next: boolean; newStars: number };
  /** the state is calm (nothing is driving): a good moment to save */
  save(data: SaveData): void;
  clearSave(): void;
  /** try the same level again at once (after "stuck": no gate) */
  restart(): void;
  /** play the same level again (asks the gate like a new round) */
  replay(): void;
  next(): void;
  home(): void;
}

/** Stars: three when no helper was used. (Stage 1 has no helpers yet, so a finished level is three stars.) */
export const starsFor = (helpersUsed: number): 1 | 2 | 3 => (helpersUsed <= 0 ? 3 : helpersUsed === 1 ? 2 : 1);

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

  constructor(private ctx: GameContext, private scene: TrafficScene, private hud: Hud, private level: LevelData, private hooks: Hooks, resume?: SaveData) {
    this.state = new TrafficState(level.vehicles, level.queue);
    if (resume && this.state.load(resume)) {
      scene.restore({ vehicles: this.state.vehicles.map((v) => ({ id: v.id, status: v.status, slot: v.slot, color: v.color, filled: v.filled })), boarded: this.state.boarded });
      hud.setCount(this.state.boarded, this.state.total);
    }
    scene.onTapVehicle = (id) => this.tap(id);
    window.addEventListener('resize', this.onResize);
    this.showHint();
    if (resume) this.wait(300, () => this.pump());
  }

  private snd = (n: Parameters<GameContext['sound']['play']>[0]) => this.ctx.sound.play(n);
  private wait(ms: number, f: () => void): void {
    if (this.scene.reduced) ms = Math.min(ms, 30);
    this.later.push(window.setTimeout(() => this.alive && f(), ms));
  }

  /** The tutorial: what to say now, and which vehicle the hand points at. */
  private showHint(blocked = false): void {
    const steps = this.level.steps;
    if (!steps || this.ended) return;
    const step = steps[Math.min(this.state.moves, steps.length - 1)];
    const text = blocked && step.blocked ? step.blocked.text : step.text;
    const hand = blocked && step.blocked ? step.blocked.hand : step.hand;
    this.hud.caption(text);
    const v = hand !== undefined ? this.state.get(hand) : null;
    this.hud.hand(v && v.status === 'parked' ? this.scene.screenPos(v.id) : null);
  }

  tap(id: number): void {
    if (this.ended) return;
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
    const st = this.state.status;
    if (st === 'won') return this.win();
    if (st === 'stuck') return this.stuck();
    if (!this.state.vehicles.some((v) => v.status === 'driving')) {
      this.hooks.save(this.state.serialize());
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
    const stars = starsFor(0);
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
      const o = this.hud.overlay(`<h2>אופס! ננסה שוב?</h2><p style="margin:0;font-size:20px">טיפ: שלחו קודם רכב בצבע של הנוסעים הראשונים בתור</p>
        <button class="btn" id="tr-retry">ננסה שוב</button>`);
      o.querySelector('#tr-retry')!.addEventListener('click', () => this.hooks.restart());
    });
  }

  destroy(): void {
    this.alive = false;
    this.later.forEach(clearTimeout);
    this.scene.onTapVehicle = null;
    window.removeEventListener('resize', this.onResize);
  }
}

export const seatsOf = (type: 'car' | 'van' | 'bus'): number => SIZES[type].seats;
