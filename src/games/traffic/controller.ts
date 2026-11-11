import type { GameContext } from '../types';
import { TrafficState } from './engine/state';
import type { TrafficScene } from './render/scene';
import { SLICE_LEVEL, SLICE_QUEUE, SLICE_VEHICLES, LOT } from './levels/beach-slice';
import type { Hud } from './ui/hud';

const PRAISE = ['יופי!', 'מדהים!', 'אלופה!'];

/** Ties the rules (TrafficState) to the picture (TrafficScene), the sounds and the HUD. */
export class Controller {
  state = new TrafficState(SLICE_VEHICLES, SLICE_QUEUE);
  private busy = false; // a boarding is in the air
  private streak = 0;
  private lastBoard = 0;
  private ended = false;
  private alive = true;
  private later: number[] = [];

  constructor(private ctx: GameContext, private scene: TrafficScene, private hud: Hud) {
    scene.onTapVehicle = (id) => this.tap(id);
  }

  static view = { vehicles: SLICE_VEHICLES, queue: SLICE_QUEUE, lot: LOT };
  static level = SLICE_LEVEL;

  private snd = (n: Parameters<GameContext['sound']['play']>[0]) => this.ctx.sound.play(n);
  private wait(ms: number, f: () => void): void {
    if (this.scene.reduced) ms = Math.min(ms, 30);
    this.later.push(window.setTimeout(() => this.alive && f(), ms));
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
      return;
    }
    this.hud.message(null);
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
    if (!next) return this.check();
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

  private check(): void {
    const st = this.state.status;
    if (st === 'won') this.win();
    else if (st === 'stuck') this.stuck();
  }

  private win(): void {
    this.ended = true;
    this.scene.celebrate();
    this.snd('firework');
    this.wait(500, () => this.snd('win'));
    const stars = this.state.moves <= SLICE_VEHICLES.length + 4 ? 3 : this.state.moves <= SLICE_VEHICLES.length + 10 ? 2 : 1;
    this.ctx.onRoundEnd({ won: true, stars: stars as 1 | 2 | 3, score: this.state.moves });
    this.wait(2200, () => {
      const o = this.hud.overlay(`<h2>כל הנוסעים על הסיפון!</h2>
        <div class="tr-stars">${[1, 2, 3].map((i) => `<span class="${i <= stars ? 'on' : ''}">⭐</span>`).join('')}</div>
        <button class="btn" id="tr-again">שוב</button><button class="btn secondary" id="tr-home2">הביתה</button>`);
      o.querySelector('#tr-again')!.addEventListener('click', () => this.ctx.requestRound(() => this.restart?.()));
      o.querySelector('#tr-home2')!.addEventListener('click', () => this.ctx.onExit());
    });
  }

  restart: (() => void) | null = null;

  private stuck(): void {
    this.scene.stuck(true);
    this.snd('oops');
    this.wait(900, () => {
      const o = this.hud.overlay(`<h2>אופס! ננסה שוב?</h2><p style="margin:0;font-size:20px">אולי עזרה קטנה תעזור 💡</p>
        <button class="btn" id="tr-retry">ננסה שוב</button>`);
      o.querySelector('#tr-retry')!.addEventListener('click', () => this.restart?.());
    });
  }

  destroy(): void {
    this.alive = false;
    this.later.forEach(clearTimeout);
    this.scene.onTapVehicle = null;
  }
}
