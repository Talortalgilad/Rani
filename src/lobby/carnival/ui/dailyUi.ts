/**
 * The reasons to come back (SPEC-carnival.md 4.7), as the page shows them: the egg in the nest, the mailbox with its letters, the gift of the day, the guest who asks to stay, "we collected for you",
 * the greeting of the morning and the night, and the parade of Friday. Only good surprises: nothing here counts days, nothing is lost by not coming, nothing is announced as missed.
 */
import { sound } from '../../../sound';
import { sayLine } from '../../../games/english/content/heLines';
import { itemImg } from '../catalog';
import { imageUrl } from '../../../games/english/art/images';
import { ACCESSORIES } from '../friends';
import { CS_LINES } from '../csLines';
import type { WorldEvent } from '../world';
import type { WorldUI } from './worldUi';

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const csText = (id: string): string => CS_LINES.find((l) => l.id === id)?.text ?? '';
const say = (id: string): void => void sayLine(id);
const PARADE_SECONDS = 40;

export class DailyUI {
  private things = new Map<string, HTMLElement>();
  private parade: { el: HTMLElement; taps: number; t: number } | null = null;
  private stayAsked = false;
  private dead = false;
  /** the things that call her now (a bubble with what waits): two at the most on the screen in all */
  private calls = new Set<string>();
  private timers: number[] = [];
  constructor(private ui: WorldUI) {}
  private get w() {
    return this.ui.h.world;
  }

  // ---------------------------------------------------------------- the nest, the mailbox and the gift box: taps over the places in the scene
  place(p: { id: string; x: number; y: number; behind: boolean; k: number }): void {
    let el = this.things.get(p.id);
    if (!el) {
      const b = document.createElement('button');
      b.type = 'button';
      el = b;
      el.className = `cvw-thing cvw-${p.id}`;
      el.setAttribute('aria-label', p.id === 'nest' ? 'הביצה' : p.id === 'mailbox' ? 'תיבת הדואר' : 'מתנת היום');
      const call = document.createElement('i');
      call.className = 'call';
      call.hidden = true;
      call.textContent = p.id === 'giftbox' ? '🎁' : p.id === 'mailbox' ? '✉️' : '🥚';
      el.appendChild(call);
      el.addEventListener('click', () => this.tap(p.id));
      this.ui.root.appendChild(el);
      this.things.set(p.id, el);
    }
    const w = this.w;
    const on = p.id === 'nest' ? w.eggs() > 0 : true;
    const vis = on && !p.behind && p.x > 20 && p.x < window.innerWidth - 20 && p.y > 130 && p.y < window.innerHeight - 100 && !this.parade;
    el.style.visibility = vis ? 'visible' : 'hidden';
    if (!vis) return;
    const k = Math.max(20, p.k);
    const size = Math.round((p.id === 'mailbox' ? 1.1 : p.id === 'giftbox' ? 0.9 : 1.1) * k);
    if (el.dataset.w !== String(size)) {
      el.dataset.w = String(size);
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
    }
    const on2 = this.calls.has(p.id);
    el.classList.toggle('wait', on2);
    el.querySelector<HTMLElement>('.call')!.hidden = !on2;
    el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y + 0.35 * k)}px) translate(-50%, -100%)`;
  }
  private tap(id: string): void {
    sound.play('pop', 640);
    if (id === 'nest') {
      this.ui.toast(csText('cs_egg_wait'));
      say('cs_egg_wait');
    } else if (id === 'mailbox') this.openMail();
    else this.openGift();
  }
  dispose(): void {
    this.dead = true;
    this.timers.forEach((t) => window.clearTimeout(t));
    for (const e of this.things.values()) e.remove();
    this.things.clear();
    this.endParade(false);
  }

  // ---------------------------------------------------------------- the mailbox: one letter a day, kept in the album
  openMail(): void {
    const w = this.w;
    const l = w.openMail();
    if (!l) return this.openAlbum();
    sound.play('bell');
    const from = w.residents.find((r) => r.id === l.from) ?? w.residents[0];
    const line = `cs_letter.${l.line}`;
    this.ui.openSheet('cvw-letter', `<img class="lt-env" src="${itemImg('envelope')}" alt=""><div class="lt-card"><div class="lt-frame"><img src="${imageUrl(l.pic)}" alt=""></div><p class="lt-text">${esc(csText(line))}</p><div class="lt-from"><img src="${esc(from.img)}" alt=""><b>${esc(from.name)}</b></div></div><button type="button" class="lt-more">האלבום שלי</button>`);
    say('cs_mail');
    window.setTimeout(() => say(line), 1100);
    this.ui.sheet?.querySelector('.lt-more')?.addEventListener('click', () => this.openAlbum());
  }
  /** all the letters that were opened (the album): a tap says the letter again */
  openAlbum(): void {
    const w = this.w;
    const ls = [...w.letters()].reverse();
    const el = this.ui.openSheet('cvw-album', `<h2>המכתבים שלי</h2>${ls.length ? '' : '<p class="al-empty">עוד אין מכתבים. מחר יחכה כאן אחד!</p>'}<div class="al-grid">${ls
      .map((l, i) => `<button type="button" class="al-i" data-i="${i}"><span class="lt-frame"><img src="${imageUrl(l.pic)}" alt=""></span><small>${esc((w.residents.find((r) => r.id === l.from) ?? w.residents[0]).name)}</small></button>`)
      .join('')}</div>`);
    el.querySelectorAll<HTMLButtonElement>('.al-i').forEach((b) =>
      b.addEventListener('click', () => {
        sound.play('pop', 640);
        say(`cs_letter.${ls[Number(b.dataset.i)].line}`);
      }),
    );
  }

  // ---------------------------------------------------------------- the gift of the day: one box, once a day
  openGift(): void {
    const w = this.w;
    const g = w.openDailyGift();
    if (!g) {
      this.ui.toast('המתנה של היום כבר אצלך. מחר תחכה עוד אחת!');
      return;
    }
    sound.play('fanfare');
    this.ui.confetti(14);
    let body = '';
    if (g.kind === 'hearts') body = `<div class="gf-big">❤️ ${g.n}</div>`;
    else if (g.kind === 'decor') body = `<img class="gf-img" src="${itemImg(g.id)}" alt=""><p>קישוט חינם! אפשר לבנות אותו בקרנבל.</p>`;
    else body = `<img class="gf-img" src="${itemImg(g.id)}" alt=""><b class="gf-name">${esc(ACCESSORIES.find((a) => a.id === g.id)?.he ?? '')}</b><p>אביזר חדש! הוא מחכה בחנות.</p>`;
    this.ui.openSheet('cvw-dgift', `<img class="gf-box" src="${itemImg('giftbox')}" alt=""><h2>${esc(csText('cs_daily_gift'))}</h2>${body}`);
    say('cs_daily_gift');
    this.ui.paintHud();
  }

  // ---------------------------------------------------------------- the guest of the day
  /** one talk with the guest was answered: he asks if he can stay (a yes keeps him for good; no answer is no loss: he comes again another day) */
  guestTalked(i: number): void {
    const w = this.w;
    if (this.stayAsked || i !== w.guestIndex() || !w.guestTalked()) return;
    this.stayAsked = true;
    this.timers.push(window.setTimeout(() => {
      if (this.dead) return;
      const r = w.residents[i];
      this.ui.openSheet('cvw-stay', `<img class="st-img" src="${esc(r.img)}" alt=""><h2>${esc(r.name)}</h2><p class="st-q">${esc(csText('cs_visitor_stay'))}</p><div class="st-acts"><button type="button" class="st-yes">כן, תישאר! 🏠</button><button type="button" class="st-later">אולי מחר</button></div>`);
      say('cs_visitor_stay');
      this.ui.sheet?.querySelector('.st-yes')?.addEventListener('click', () => {
        sound.play('fanfare');
        this.ui.closeSheet();
        const n = w.stayGuest();
        if (n >= 0) {
          this.ui.confetti(18);
          this.ui.queueBanner(`<b>${esc(csText('cs_new_resident'))}</b><img src="${esc(r.img)}" alt=""><span>${esc(r.name)}</span>`, 'cs_new_resident');
        }
        this.stayAsked = false;
      });
      this.ui.sheet?.querySelector('.st-later')?.addEventListener('click', () => (this.ui.closeSheet(), (this.stayAsked = false)));
    }, 2300));
  }

  // ---------------------------------------------------------------- what the visit brings (SPEC 4.8)
  /** the first minute: at the most two banners, 6 seconds together ("Rani is back!" first, then the most important thing: the hatching, and when there is none the guest); everything else
   * (the gift, the letter, the morning or night greeting, the parade) is a bubble in the world, and she can touch the screen while a banner is up */
  visit(events: WorldEvent[]): void {
    const ui = this.ui;
    const back = events.find((e): e is Extract<WorldEvent, { type: 'welcomeBack' }> => e.type === 'welcomeBack');
    const hatch = events.find((e): e is Extract<WorldEvent, { type: 'hatch' }> => e.type === 'hatch');
    const guest = events.find((e): e is Extract<WorldEvent, { type: 'guest' }> => e.type === 'guest');
    if (back) {
      sound.play('bonus');
      ui.queueBanner(`<b>${esc(csText('cs_welcome_back'))}</b>${back.hearts > 0 ? `<span>${esc(csText('cs_collected'))} ❤️ ${back.hearts}</span>` : ''}`, 'cs_welcome_back', 'top');
      if (back.hearts > 0) this.timers.push(window.setTimeout(() => !this.dead && say('cs_collected'), 2500));
      ui.paintHud();
    }
    if (hatch) ui.queueBanner(`<b>${esc(csText('cs_egg_hatch'))}</b><img src="${itemImg('egg_cracked')}" alt="">`, 'cs_egg_hatch', 'top');
    else if (guest) ui.queueBanner(`<b>${esc(csText('cs_visitor'))}</b><img src="${esc(guest.resident.img)}" alt=""><span>${esc(guest.resident.name)}</span>`, 'cs_visitor', 'top');
    // the greeting and the parade: a bubble over a resident, after the banners
    const greet = events.find((e): e is Extract<WorldEvent, { type: 'greet' }> => e.type === 'greet');
    let at = back || hatch || guest ? 6500 : 1500;
    if (greet) {
      const id = greet.kind === 'night' ? 'cs_good_night' : 'cs_good_morning';
      this.timers.push(window.setTimeout(() => !this.dead && ui.say(0, csText(id), id), at));
      at += 3200;
    }
    if (events.some((e) => e.type === 'paradeDay')) {
      this.timers.push(window.setTimeout(() => !this.dead && ui.say(0, csText('cs_parade'), 'cs_parade'), at));
      this.timers.push(window.setTimeout(() => !this.dead && this.startParade(), at + 3600));
    }
    // the others (the gift, the mail, the egg, the guest's talk) call with their bubbles: nothing to show here
  }
  /** an event in the middle of a visit (an egg found at a level-up) */
  event(e: WorldEvent): void {
    if (e.type === 'egg') this.ui.queueBanner(`<b>${esc(csText('cs_egg_found'))}</b><img src="${itemImg('egg')}" alt=""><span>${esc(csText('cs_egg_wait'))}</span>`, 'cs_egg_found');
  }
  /** the baby came out of the egg: he says hello to the world (the recorded line) */
  hatched(i: number): void {
    this.ui.say(i, csText('cs_baby_hello'), 'cs_baby_hello');
    sound.play('pop', 1100);
    this.timers.push(window.setTimeout(() => sound.play('pop', 1250), 160));
    this.ui.confetti(12);
  }

  // ---------------------------------------------------------------- the parade of Friday
  /** everybody walks in a line round the plaza with what they wear; she taps in the rhythm and confetti flies. It lasts a short while, and ends by itself. */
  startParade(): void {
    if (this.dead || this.parade || this.w.paradeOn()) return;
    const w = this.w;
    w.startParade();
    const el = document.createElement('div');
    el.className = 'cvw-parade';
    el.innerHTML = '<p class="pd-t">🎺 המצעד! הקישי בקצב</p><button type="button" class="pd-x" aria-label="סיום">✕</button>';
    this.ui.h.layer.appendChild(el);
    this.parade = { el, taps: 0, t: PARADE_SECONDS };
    el.addEventListener('pointerdown', (ev) => {
      if ((ev.target as HTMLElement).closest('.pd-x')) return;
      this.parade!.taps++;
      this.burst(ev.clientX, ev.clientY);
    });
    el.querySelector('.pd-x')!.addEventListener('click', () => this.endParade(true));
    this.ui.closeSheet();
  }
  /** the music of the parade is not recorded yet (docs/carnival-missing.md): the rhythm is her own taps, each with a little sound */
  private burst(x: number, y: number): void {
    sound.play('pop', 700 + (this.parade!.taps % 4) * 120);
    for (let k = 0; k < 8; k++) {
      const e = document.createElement('i');
      e.className = 'cvw-burst';
      e.textContent = ['🎉', '✨', '⭐', '❤️', '🎈', '🎊'][k % 6];
      e.style.left = `${x}px`;
      e.style.top = `${y}px`;
      const a = (k / 8) * Math.PI * 2 + Math.random() * 0.5, d = 60 + Math.random() * 70;
      e.style.setProperty('--dx', `${Math.cos(a) * d}px`);
      e.style.setProperty('--dy', `${Math.sin(a) * d - 30}px`);
      this.ui.h.layer.appendChild(e);
      window.setTimeout(() => e.remove(), 1100);
    }
  }
  /** `joined`: she took part (a few taps, or she stayed to the end), it counts for today (and the quest) */
  endParade(joined: boolean): void {
    const p = this.parade;
    if (!p) return;
    p.el.remove();
    this.parade = null;
    this.w.endParade(joined && p.taps >= 1);
    this.ui.confetti(10);
  }
  /** how many call bubbles of the world are up (the talks' bubbles use what is left of the two) */
  shownCalls(): number {
    return this.calls.size;
  }
  tick(dt: number): void {
    // who calls: the gift, the letter, the egg (in this order); only two at once, the rest wait in line and come up when one is opened
    const w = this.w;
    const want = [w.giftBlink() ? 'giftbox' : '', w.mailBlink() ? 'mailbox' : '', w.eggs() > 0 && w.eggIsNew() ? 'nest' : ''].filter(Boolean).slice(0, 2);
    if (want.length !== this.calls.size || want.some((x) => !this.calls.has(x))) this.calls = new Set(want);
    if (!this.parade) return;
    this.parade.t -= dt;
    if (this.parade.t <= 0) this.endParade(true);
  }
}
