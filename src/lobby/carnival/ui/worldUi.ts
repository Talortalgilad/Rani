/**
 * The page of stage 2 over the carnival (SPEC-carnival.md 4.3, 4.5, 5, 7): the markers of the places, the catalog, what a resident wants (bubbles over his head), the hearts that fly, the level and
 * its banners, the quest strip, the book of residents and the board of wishes. DOM only. The scene (or the strip of the plain lobby) tells where residents and places are; the world (world.ts) decides
 * everything. Nothing is ever negative: a wish waits, a missing star says how many are missing, and every sheet closes with the X.
 */
import { sound } from '../../../sound';
import { getState } from '../../../storage';
import { sayLine } from '../../../games/english/content/heLines';
import { speakEn } from '../../../games/english/voice';
import { ITEMS, KIND_ICON, KIND_LABEL, itemById, itemImg, type Item, type ItemKind, type WishKind } from '../catalog';
import { MAX_LEVEL } from '../level';
import { RESIDENT_INFO, arrivalOrder, type Resident } from '../residents';
import { needed } from '../unlocks';
import { nearCentre } from '../talk/alerts';
import { speakClip } from '../talk/speak';
import { PERSONALITY_HE, SUGGEST_LINE, WISH_ICON, WISH_LINE, fillers, type WishType } from '../wishes';
import type { CarnivalWorld, WorldEvent } from '../world';
import { CS_LINES } from '../csLines';
import { FriendUI, LEVEL_NAME } from './friendUi';
import { friendLevel, friendsOf } from '../friends';

export interface WorldHost {
  layer: HTMLElement;
  world: CarnivalWorld;
  mode: '3d' | '2d';
  /** where a resident's head is on the screen (null: not seen) */
  pos(i: number): { x: number; y: number } | null;
  /** the camera goes to a place or to a resident (3D only), and a resident waves */
  focusSlot?(id: string): void;
  takeMe?(i: number): void;
  /** a resident does his trick (spin, a double jump, a dance) */
  trick?(i: number, kind: 'spin' | 'jump2' | 'dance'): void;
  /** the school of Lolly was tapped: her lessons (the page goes to the English game, straight to Lolly) */
  goTutor?(): void;
  /** is there a new lesson of Lolly today? (the ❗ at her school) */
  newLesson?(): boolean;
  /** a new resident arrived: the scene shows him */
  addResident?(r: Resident): void;
  /** the way to the word journey or to the lessons of Lolly (the locked card's button) */
  goWorld(kind: 'world' | 'unit', n: number): void;
  /** the counter of hearts that the hearts fly to, the row of games (it blinks when stars are missing), the talks (their "!" bubbles) */
  heartsEl(): HTMLElement | null;
  gamesBar(): HTMLElement | null;
  alerts(): number[];
}

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const csText = (id: string): string => CS_LINES.find((l) => l.id === id)?.text ?? '';
const say = (id: string): void => void sayLine(id);
const BUILD_QUESTS = ['pizza', 'drink', 'ride', 'three', 'five'];
const WISH_KINDS: ItemKind[] = ['food', 'drink', 'fun', 'rest', 'shop', 'decor'];

/** what a resident says in English when he is first in a line: the recording of his order, or the word and then "please" */
export function orderPieces(item: Item): { id: string; text: string }[] {
  if (item.order) return [{ id: item.order, text: `${item.en[0]}${item.en.slice(1).toLowerCase()}, please!` }];
  return [{ id: item.id, text: item.en.toLowerCase() }, { id: 'carn_please_plain', text: 'Please!' }];
}

export class WorldUI {
  private root: HTMLElement;
  private slotEls = new Map<string, HTMLButtonElement>();
  private slotState = new Map<string, string>();
  private wishEls = new Map<number, HTMLElement>();
  /** the text bubbles: one that would fall on another waits (hidden) until the other is gone */
  private says: { el: HTMLElement; r: number; ttl: number; shown: boolean; wait: number; line: string | null }[] = [];
  private questEl: HTMLButtonElement;
  private levelEl: HTMLElement;
  private bookBtn: HTMLButtonElement;
  private boardBtn: HTMLButtonElement;
  private buildBtn: HTMLButtonElement;
  /** build mode: the free places (and the locked ones, small) are shown. Off in the normal view, so the island stays clean. */
  private build = false;
  private sheet: HTMLElement | null = null;
  private banners: { html: string; line?: string }[] = [];
  private bannerOn = false;
  private moving: string | null = null;
  private dead = false;
  readonly friends = new FriendUI(this);
  private schoolEl: HTMLElement | null = null;
  private schoolNew = false;
  private schoolT = 0;
  private lastQuest = '';
  private badgeT = 0;
  private fitT = 0;
  /** the first stall is built with the guide (a hand points at a place, only the pizza can be picked) */
  private guide: boolean;
  private screenW = window.innerWidth;
  private screenH = window.innerHeight;

  constructor(readonly h: WorldHost) {
    this.root = document.createElement('div');
    this.root.className = `cvw ${h.mode === '2d' ? 'm2d' : ''}`;
    h.layer.appendChild(this.root);
    this.guide = !h.world.save.guided && Object.keys(h.world.save.built).length === 0;
    this.questEl = document.createElement('button');
    this.questEl.type = 'button';
    this.questEl.className = 'cvw-quest';
    this.questEl.addEventListener('click', () => {
      const q = this.h.world.quest;
      if (q) say(`qs_${q.id}`);
      // a quest that is about opening something turns the build mode on by itself
      if (q && BUILD_QUESTS.includes(q.id)) this.setBuild(true);
    });
    this.levelEl = document.createElement('div');
    this.levelEl.className = 'cvw-level';
    this.bookBtn = this.btn('📖', 'ספר התושבים', 'cvw-book', () => this.openBook());
    this.boardBtn = this.btn('📋', 'לוח המשאלות', 'cvw-boardbtn', () => this.openBoard());
    this.buildBtn = this.btn('🔨', 'מצב בנייה', 'cvw-buildbtn', () => this.setBuild(!this.build));
    this.root.append(this.questEl, this.levelEl, this.bookBtn, this.boardBtn);
    if (h.mode === '3d') this.root.append(this.buildBtn);
    if (this.guide) {
      this.showGuide();
      this.setBuild(true);
    }
    this.paintHud();
  }

  private btn(icon: string, label: string, cls: string, on: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `cvw-btn ${cls}`;
    b.setAttribute('aria-label', label);
    b.innerHTML = `${icon}<i></i>`;
    b.addEventListener('click', () => {
      sound.play('pop', 640);
      on();
    });
    return b;
  }

  // ---------------------------------------------------------------- the hud
  private paintHud(): void {
    const w = this.h.world;
    const q = w.quest;
    const key = `${q?.id}|${w.level}|${Math.round(w.levelProgress * 20)}`;
    if (key === this.lastQuest) return;
    this.lastQuest = key;
    this.questEl.innerHTML = q ? `<b>🎯</b> <span>${esc(q.he)}</span>` : '<b>🌟</b> <span>הקרנבל שלך חי!</span>';
    this.levelEl.innerHTML = `<span>רמה ${w.level}</span><u><i style="width:${Math.round(w.levelProgress * 100)}%"></i></u>`;
    this.levelEl.classList.toggle('max', w.level >= MAX_LEVEL);
  }

  /** the quest pill sits under the title, between the home button and the stars (its width follows the stars, which grow with the digits) */
  private fitQuest(): void {
    const st = document.querySelector<HTMLElement>('.stars')?.getBoundingClientRect();
    const right = st && st.width ? st.left - 8 : window.innerWidth - 133;
    this.questEl.style.width = `${Math.max(110, Math.min(280, right - 66))}px`;
  }

  // ---------------------------------------------------------------- the places
  setBuild(on: boolean): void {
    if (this.build === on) return;
    this.build = on;
    this.buildBtn.classList.toggle('on', on);
    this.root.classList.toggle('building', on);
    this.slotState.clear();
  }
  get building(): boolean {
    return this.build;
  }

  /** the markers of the places follow the scene each frame */
  onSlots(list: { id: string; x: number; y: number; behind: boolean }[]): void {
    if (this.dead || this.h.mode !== '3d') return;
    const w = this.h.world;
    const hh = window.innerHeight;
    const ww = window.innerWidth;
    for (const p of list) {
      if (p.id === 'lollyschool') {
        this.placeSchool(p);
        continue;
      }
      const s = w.slot(p.id);
      if (!s) continue;
      let el = this.slotEls.get(p.id);
      if (!el) {
        el = document.createElement('button');
        el.type = 'button';
        el.addEventListener('click', () => this.tapSlot(p.id));
        this.root.appendChild(el);
        this.slotEls.set(p.id, el);
      }
      const built = w.itemAt(p.id);
      const open = w.isSlotOpen(s);
      const q = built ? w.sim.queueOf(p.id).length : 0;
      const kindGuide = this.guide && s.kind === 'stall' && p.id === w.freeSlot('stall')?.id;
      const movingTarget = this.moving && !built && open && w.slot(this.moving)?.kind === s.kind;
      const shown = !!built || this.build || !!this.moving;
      const state = `${built ? 'b' + built.id : open ? 'f' : 'l' + s.level}|${q}|${kindGuide ? 1 : 0}|${movingTarget ? 1 : 0}`;
      if (this.slotState.get(p.id) !== state) {
        this.slotState.set(p.id, state);
        el.className = `cvw-slot ${built ? 'built' : open ? 'free' : 'lock'} ${s.kind} ${kindGuide ? 'guide' : ''} ${movingTarget ? 'target' : ''}`;
        el.setAttribute('aria-label', built ? built.he : open ? 'מקום פנוי' : `ייפתח ברמה ${s.level}`);
        el.innerHTML = built ? (q ? `<em>${q}</em>` : '') : open ? '+' : `🔒<small>${s.level}</small>`;
      }
      const vis = shown && !p.behind && p.x > 14 && p.x < ww - 14 && p.y > 118 && p.y < hh - 96;
      el.style.visibility = vis ? 'visible' : 'hidden';
      if (vis) el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
    }
  }

  /** the school of Lolly (SPEC-tutor.md 2): the building (its picture, when there is one) with Lolly outside; a ❗ over her when there is a new lesson. Nothing is drawn if the building has no picture yet. */
  private placeSchool(p: { x: number; y: number; behind: boolean }): void {
    if (!this.schoolEl) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'cvw-school';
      el.setAttribute('aria-label', 'בית הספר של לולי');
      const b = import.meta.env.BASE_URL;
      el.innerHTML = `<img class="sc-b" src="${b}park/items/lollyschool.webp" alt="" onerror="this.remove()"><img class="sc-l" src="${b}english/tutor/lolly_happy.webp" alt="" draggable="false"><i class="sc-new" aria-hidden="true">❗</i>`;
      el.addEventListener('click', () => {
        sound.play('pop', 640);
        this.h.goTutor?.();
      });
      this.root.appendChild(el);
      this.schoolEl = el;
      this.schoolNew = !!this.h.newLesson?.();
      el.classList.toggle('new', this.schoolNew);
    }
    const vis = !p.behind && p.x > 30 && p.x < window.innerWidth - 30 && p.y > 130 && p.y < window.innerHeight - 100;
    this.schoolEl.style.visibility = vis ? 'visible' : 'hidden';
    if (vis) this.schoolEl.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -90%)`;
  }

  private tapSlot(id: string): void {
    const w = this.h.world;
    const s = w.slot(id);
    if (!s) return;
    const built = w.itemAt(id);
    if (this.moving) {
      if (!built && w.isSlotOpen(s) && w.slot(this.moving)?.kind === s.kind) {
        w.move(this.moving, id);
        sound.play('bell');
      }
      this.moving = null;
      this.slotState.clear();
      return;
    }
    if (built) return this.openItemSheet(id);
    if (!w.isSlotOpen(s)) {
      sound.play('pop', 300);
      this.toast(`המקום הזה ייפתח ברמה ${s.level}`);
      return;
    }
    this.openCatalog({ slot: id });
  }

  // ---------------------------------------------------------------- sheets
  closeSheet(): void {
    this.sheet?.remove();
    this.sheet = null;
  }
  openSheet(cls: string, html: string): HTMLElement {
    this.closeSheet();
    const el = document.createElement('div');
    el.className = `cvw-sheet ${cls}`;
    el.innerHTML = `<button type="button" class="cvw-close" aria-label="סגירה">✕</button>${html}`;
    el.querySelector('.cvw-close')!.addEventListener('click', () => {
      sound.play('pop', 480);
      this.closeSheet();
    });
    this.h.layer.appendChild(el);
    this.sheet = el;
    return el;
  }
  toast(text: string): void {
    const t = document.createElement('div');
    t.className = 'cvw-toast';
    t.textContent = text;
    this.h.layer.appendChild(t);
    window.setTimeout(() => t.remove(), 2600);
  }

  /** The catalog: tabs by kind, a card for each item (open, locked with the world that opens it, or too dear: the stars that are missing). With a place, only what can stand on it. */
  openCatalog(o: { slot?: string; kind?: ItemKind } = {}): void {
    const w = this.h.world;
    const slot = o.slot ? w.slot(o.slot) : undefined;
    const stars = (): number => getState().stars;
    const kinds = WISH_KINDS.filter((k) => ITEMS.some((i) => i.kind === k && (!slot || i.slot === slot.kind)));
    let tab: ItemKind = o.kind && kinds.includes(o.kind) ? o.kind : kinds[0];
    const el = this.openSheet('cvw-catalog', '<h2></h2><div class="tabs"></div><div class="grid"></div><div class="note"></div>');
    el.querySelector('h2')!.textContent = 'מה נבנה כאן?';
    if (this.guide) say('cs_pick_item');
    const paint = (): void => {
      el.querySelector('.tabs')!.innerHTML = kinds.map((k) => `<button type="button" data-k="${k}" class="${k === tab ? 'on' : ''}">${KIND_ICON[k]} ${KIND_LABEL[k]}</button>`).join('');
      const items = ITEMS.filter((i) => i.kind === tab && (!slot || i.slot === slot.kind));
      el.querySelector('.grid')!.innerHTML = items
        .map((i) => {
          const st = w.canBuy(i);
          const dim = this.guide && i.id !== 'pizzastand';
          const lock = needed(i);
          const price = i.price === 0 ? 'מתנה!' : `⭐ ${i.price}`;
          return `<button type="button" class="card ${st} ${dim ? 'dim' : ''}" data-i="${i.id}"><img src="${itemImg(i.id)}" alt="" draggable="false"><b>${esc(i.he)}</b><small dir="ltr">${esc(i.en)}</small><span class="price ${st === 'stars' ? 'short' : ''}">${st === 'locked' ? (lock!.kind === 'world' ? `🌍 עולם ${lock!.n}` : `📚 יחידה ${lock!.n}`) : price}</span></button>`;
        })
        .join('');
      el.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) =>
        b.addEventListener('click', () => {
          tab = b.dataset.k as ItemKind;
          paint();
        }),
      );
      el.querySelectorAll<HTMLButtonElement>('.card').forEach((b) =>
        b.addEventListener('click', () => {
          const item = itemById(b.dataset.i!)!;
          if (b.classList.contains('dim')) return;
          this.pick(item, slot?.id ?? null, el);
        }),
      );
    };
    paint();
    void stars;
  }

  private pick(item: Item, slotId: string | null, sheet: HTMLElement): void {
    const w = this.h.world;
    const note = sheet.querySelector<HTMLElement>('.note')!;
    const st = w.canBuy(item);
    if (st === 'locked') {
      const n = needed(item)!;
      sound.play('pop', 300);
      say('cs_locked_world');
      note.innerHTML = `<p>${esc(csText('cs_locked_world'))}</p><button type="button" class="go">${n.kind === 'world' ? `קחי אותי לעולם ${n.n}` : `קחי אותי לשיעורים של לולי`}</button>`;
      note.querySelector('.go')!.addEventListener('click', () => {
        this.closeSheet();
        this.h.goWorld(n.kind, n.n);
      });
      return;
    }
    if (st === 'place') {
      note.innerHTML = '<p>כל המקומות תפוסים. אפשר להחזיר משהו לקטלוג ולקבל את הכוכבים בחזרה.</p>';
      return;
    }
    if (st === 'stars') {
      const missing = item.price - getState().stars;
      sound.play('pop', 300);
      say('cs_need_stars');
      note.innerHTML = `<p>חסרים לך ${missing} כוכבים. בואי נשחק!</p>`;
      this.closeSheet();
      this.toast(`חסרים לך ${missing} כוכבים. בואי נשחק!`);
      const bar = this.h.gamesBar();
      bar?.classList.add('pulse');
      window.setTimeout(() => bar?.classList.remove('pulse'), 3200);
      return;
    }
    const slot = slotId ?? w.freeSlot(item.slot)?.id;
    if (!slot) return;
    const r = w.build(slot, item.id);
    if (!r.ok) return;
    this.setBuild(false);
    sound.play('bell');
    this.closeSheet();
    if (this.guide) {
      this.guide = false;
      w.save.guided = true;
      this.hideGuide();
    }
    this.slotState.clear();
    this.h.focusSlot?.(slot);
    this.queueBanner(`<b>${item.slot === 'ride' ? 'מתקן חדש בקרנבל!' : 'דוכן חדש נפתח!'}</b><img src="${itemImg(item.id)}" alt="">`, item.slot === 'ride' ? 'cs_new_ride' : 'cs_new_stall');
    sayEn(item);
  }

  private openItemSheet(slotId: string): void {
    const w = this.h.world;
    const item = w.itemAt(slotId)!;
    const q = w.sim.queueOf(slotId).length;
    const el = this.openSheet('cvw-item', `<img src="${itemImg(item.id)}" alt=""><h2>${esc(item.he)}</h2><button type="button" class="en" dir="ltr">${esc(item.en)} 🔊</button><p>${q ? `בתור עכשיו: ${q}` : 'אין תור עכשיו'}</p><div class="acts"><button type="button" class="act" data-a="go">⭐ הפעלה</button><button type="button" class="act" data-a="move">↔ הזזה</button><button type="button" class="act" data-a="back">↩ החזרה לקטלוג</button></div>`);
    el.querySelector('.en')!.addEventListener('click', () => sayEn(item, true));
    el.querySelectorAll<HTMLButtonElement>('.act').forEach((b) =>
      b.addEventListener('click', () => {
        const a = b.dataset.a;
        if (a === 'go') {
          sound.play('bell');
          this.h.focusSlot?.(slotId);
          this.closeSheet();
        } else if (a === 'move') {
          this.moving = slotId;
          this.slotState.clear();
          this.closeSheet();
          this.toast('הקישי על מקום פנוי כדי להעביר');
        } else {
          w.remove(slotId);
          sound.play('pop', 520);
          this.slotState.clear();
          this.closeSheet();
        }
      }),
    );
  }

  // ---------------------------------------------------------------- the board of wishes
  openBoard(): void {
    const w = this.h.world;
    const c = w.sim.wishCounts();
    const kinds: WishType[] = ['food', 'drink', 'fun', 'rest', 'play'];
    const max = Math.max(1, ...kinds.map((k) => c[k]));
    const top = kinds.filter((k) => k !== 'play').reduce((a, k) => (c[k] > c[a] ? k : a), 'food' as WishType);
    const builtIcons = Object.values(w.save.built).map((id) => `<img src="${itemImg(id)}" alt="">`).join('');
    const el = this.openSheet(
      'cvw-board',
      `<h2>${esc(csText('cs_board'))}</h2><div class="bars">${kinds
        .map((k) => `<button type="button" class="bar ${k === top && c[k] > 0 ? 'top' : ''}" data-k="${k}"><i style="height:${Math.round((c[k] / max) * 100)}%"></i><b>${c[k]}</b><span>${WISH_ICON[k]}</span></button>`)
        .join('')}</div><p class="topline">${c[top] > 0 ? esc(csText('cs_board_top')) : ''}</p><div class="mine"><small>בקרנבל שלך:</small> ${builtIcons || '—'}</div>`,
    );
    if (c[top] > 0) say('cs_board_top');
    el.querySelectorAll<HTMLButtonElement>('.bar').forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.dataset.k as WishType;
        if (k === 'play') return;
        // a tap on a column opens the catalog on that kind (with no place picked: the first free one)
        this.setBuild(true);
        this.openCatalog({ kind: k as WishKind });
      }),
    );
  }

  // ---------------------------------------------------------------- the book of residents
  openBook(): void {
    const w = this.h.world;
    const alerts = new Set(this.h.alerts());
    const rows = w.residents
      .map((r, i) => ({ r, i, wish: w.sim.agents[i]?.wish ?? null, call: alerts.has(i) }))
      .sort((a, b) => Number(b.call) - Number(a.call) || Number(!!b.wish) - Number(!!a.wish));
    const unknown = RESIDENT_INFO.slice(4).filter((x) => !w.save.arrived.includes(x.id));
    const el = this.openSheet(
      'cvw-bookpage',
      `<h2>${esc(csText('cs_book'))}</h2><div class="list">${rows
        .map(({ r, i, wish, call }) => `<button type="button" class="row" data-i="${i}"><img src="${esc(r.img)}" alt=""><span><b>${esc(r.name)}</b><small>${r.personality ? PERSONALITY_HE[r.personality] : ''} · ${LEVEL_NAME[friendLevel(friendsOf(w.save).hearts[r.id] ?? 0)]}</small></span><em>${call ? '❗' : wish ? WISH_ICON[wish.kind] : ''}</em></button>`)
        .join('')}${unknown.map((x) => `<div class="row ghost"><img src="${residentImg(x.id)}" alt=""><span><b>?</b></span></div>`).join('')}</div>`,
    );
    el.querySelectorAll<HTMLButtonElement>('.row[data-i]').forEach((b) =>
      b.addEventListener('click', () => {
        const i = Number(b.dataset.i);
        const r = w.residents[i];
        const wish = w.sim.agents[i]?.wish;
        el.querySelectorAll('.open').forEach((x) => x.remove());
        const open = document.createElement('div');
        open.className = 'open';
        open.innerHTML = `<img src="${esc(r.img)}" alt=""><h3>${esc(r.name)}</h3><p>${csText('cs_wants_now')} ${wish ? WISH_ICON[wish.kind] : '—'}</p><button type="button" class="takeme">${esc(csText('cs_take_me'))}</button> <button type="button" class="takeme card">הכרטיס שלו</button>`;
        b.after(open);
        say('cs_wants_now');
        open.querySelector('.takeme.card')!.addEventListener('click', () => this.friends.openCard(i));
        open.querySelector('.takeme:not(.card)')!.addEventListener('click', () => {
          this.closeSheet();
          this.h.takeMe?.(i);
        });
      }),
    );
  }

  // ---------------------------------------------------------------- the guide of the first stall
  private guideEl: HTMLElement | null = null;
  private showGuide(): void {
    this.guideEl = document.createElement('div');
    this.guideEl.className = 'cvw-guide';
    this.guideEl.innerHTML = `<b>${esc(csText('cs_first_free'))}</b><span>${esc(csText('cs_pick_place'))}</span>`;
    this.h.layer.appendChild(this.guideEl);
    window.setTimeout(() => !this.dead && this.guide && (say('cs_first_free'), window.setTimeout(() => this.guide && say('cs_pick_place'), 2600)), 1500);
  }
  private hideGuide(): void {
    this.guideEl?.remove();
    this.guideEl = null;
  }

  // ---------------------------------------------------------------- banners
  queueBanner(html: string, line?: string): void {
    this.banners.push({ html, line });
    if (!this.bannerOn) this.nextBanner();
  }
  private nextBanner(): void {
    const b = this.banners.shift();
    if (!b) {
      this.bannerOn = false;
      return;
    }
    this.bannerOn = true;
    const el = document.createElement('div');
    el.className = 'cvw-banner';
    el.innerHTML = b.html;
    this.h.layer.appendChild(el);
    if (b.line) say(b.line);
    window.setTimeout(() => {
      el.remove();
      this.nextBanner();
    }, 2700);
  }
  confetti(n = 22): void {
    for (let k = 0; k < n; k++) {
      const e = document.createElement('i');
      e.className = 'cvw-conf';
      e.textContent = ['🎉', '✨', '⭐', '❤️', '🎈'][k % 5];
      e.style.left = `${10 + Math.random() * 80}%`;
      e.style.animationDelay = `${Math.random() * 0.5}s`;
      this.h.layer.appendChild(e);
      window.setTimeout(() => e.remove(), 2600);
    }
  }

  // ---------------------------------------------------------------- what the world says
  /** the world's events: hearts fly, orders are said, bubbles over heads, levels and arrivals are celebrated */
  handle(events: WorldEvent[]): void {
    const w = this.h.world;
    for (const e of events) {
      switch (e.type) {
        case 'heart': {
          this.flyHeart(e.r, e.amount);
          if (e.why === 'stall' && Math.random() < 0.6) this.sayBubble(e.r, csText('cs_yum'), 'cs_yum');
          this.h.alerts();
          break;
        }
        case 'order': {
          const item = itemById(e.item);
          if (item) {
            const parts = orderPieces(item);
            this.sayBubble(e.r, parts.map((p) => p.text).join(' '), null, 'en');
            if (this.near(e.r)) void (async () => { for (const p of parts) await speakClip(p.id, p.text); })();
          }
          break;
        }
        case 'chat':
          this.sayBubble(e.r, csText(e.line), e.line);
          break;
        case 'wish':
          sound.play('pop', 760);
          break;
        case 'board':
          sound.play('bell');
          break;
        case 'levelUp':
          sound.play('fanfare');
          this.confetti();
          this.queueBanner(`<b>${esc(csText('cs_level_up'))}</b><span>רמה ${e.level}</span>`, 'cs_level_up');
          break;
        case 'newPlace':
          this.queueBanner(`<b>${esc(csText('cs_new_place'))}</b>`, 'cs_new_place');
          this.slotState.clear();
          break;
        case 'arrival':
          this.h.addResident?.(e.resident);
          this.queueBanner(`<b>${esc(csText('cs_new_resident'))}</b><img src="${esc(e.resident.img)}" alt=""><span>${esc(e.resident.name)}</span>`, 'cs_new_resident');
          break;
        case 'quest':
          sound.play('bonus');
          this.queueBanner(`<b>${esc(csText('cs_quest_done'))}</b><span>❤️ ${e.quest.hearts}${e.quest.stars ? ' ⭐ ' + e.quest.stars : ''}</span>`, 'cs_quest_done');
          break;
        case 'friendUp': {
          sound.play('bonus');
          const r = w.residents[e.r];
          this.queueBanner(`<b>${esc(csText(e.level >= 5 ? 'cs_best_friend' : 'cs_friend_up'))}</b><img src="${esc(r.img)}" alt=""><span>${esc(r.name)} · ${LEVEL_NAME[e.level]}</span>`, e.level >= 5 ? 'cs_best_friend' : 'cs_friend_up');
          break;
        }
        case 'unlocked':
          this.queueBanner(`<b>${esc(csText('cs_unlock_words'))}</b>${e.items.slice(0, 3).map((id) => `<img src="${itemImg(id)}" alt="">`).join('')}`, 'cs_unlock_words');
          break;
        case 'built':
        case 'removed':
          this.slotState.clear();
          break;
      }
    }
    void w;
  }

  private near(r: number): boolean {
    const p = this.h.pos(r);
    return !!p && nearCentre(p.x, p.y, this.screenW, this.screenH);
  }
  private sayBubble(r: number, text: string, line: string | null, lang: 'he' | 'en' = 'he'): void {
    const p = this.h.pos(r);
    if (!p || !text) return;
    for (const s of this.says.filter((x) => x.r === r)) s.el.remove();
    this.says = this.says.filter((x) => x.r !== r).slice(-5);
    const el = document.createElement('div');
    el.className = 'cvw-say';
    el.dir = lang === 'en' ? 'ltr' : 'rtl';
    el.textContent = text;
    el.style.visibility = 'hidden';
    this.h.layer.appendChild(el);
    this.says.push({ el, r, ttl: 2.4, shown: false, wait: 0, line });
  }
  /** where the bubble of a resident sits (the same rule as the frame uses) */
  private sayRect(el: HTMLElement, p: { x: number; y: number }): { x: number; y: number; w: number; h: number } {
    const w = el.offsetWidth || 90;
    const h = el.offsetHeight || 28;
    const half = w / 2 + 6;
    const x = Math.min(window.innerWidth - half, Math.max(half, p.x));
    return { x: x - w / 2, y: p.y - 30 - h, w, h };
  }
  private visibleBubbles(): DOMRect[] {
    const out: DOMRect[] = [];
    this.h.layer.querySelectorAll<HTMLElement>('.cvw-say, .cv-chat.on').forEach((e) => {
      if (e.style.visibility !== 'hidden') out.push(e.getBoundingClientRect());
    });
    return out;
  }

  flyHeart(r: number, amount: number): void {
    const from = this.h.pos(r);
    const to = this.h.heartsEl()?.getBoundingClientRect();
    if (!from || !to) return;
    sound.play('pop', 800);
    for (let k = 0; k < Math.min(amount, 3); k++) {
      const e = document.createElement('div');
      e.className = 'cv-fly';
      e.textContent = '❤️';
      e.style.left = `${from.x}px`;
      e.style.top = `${from.y - 20}px`;
      document.body.appendChild(e);
      const a = e.animate([{ transform: 'translate(-50%,-50%) scale(.5)', opacity: 1 }, { transform: `translate(${to.left + to.width / 2 - from.x - 40}px, ${to.top - from.y}px) scale(1.1)`, opacity: 1 }], { duration: 850, delay: k * 150, easing: 'ease-in', fill: 'forwards' });
      a.onfinish = () => e.remove();
      window.setTimeout(() => e.remove(), 1800);
    }
  }

  /** A resident was tapped: what he wants, in Hebrew and (for food) in English; and if nothing fills it, the hint. */
  residentTapped(i: number): void {
    const w = this.h.world;
    w.count('taps');
    // a friend of level 2 does his trick when he is tapped
    const tk = w.trick(i);
    if (tk) this.h.trick?.(i, tk);
    const wish = w.sim.agents[i]?.wish;
    if (!wish) return;
    const text = csText(WISH_LINE[wish.kind]);
    this.sayBubble(i, text, WISH_LINE[wish.kind]);
    // the word in English, for what he wants to eat (only a word that she already learned)
    const info = RESIDENT_INFO.find((x) => x.id === (w.residents[i]?.id === 'companion' ? 'cheesy' : w.residents[i]?.id));
    const words = (getState().games.english as { words?: Record<string, { seen?: boolean }> } | undefined)?.words ?? {};
    if (wish.kind === 'food' && info && words[info.food]?.seen) window.setTimeout(() => void speakEn(info.food), 1500);
    const built = Object.values(w.save.built).map((id) => itemById(id)!).filter(Boolean);
    if (wish.kind !== 'play' && fillers(wish, built).length === 0) window.setTimeout(() => this.sayBubble(i, csText(SUGGEST_LINE[wish.kind]), SUGGEST_LINE[wish.kind]), 2400);
  }

  // ---------------------------------------------------------------- every frame
  tick(dt: number): void {
    if (this.dead) return;
    this.screenW = window.innerWidth;
    this.screenH = window.innerHeight;
    const w = this.h.world;
    this.paintHud();
    this.friends.tick(dt, !!this.sheet);
    this.schoolT -= dt;
    if (this.schoolT <= 0 && this.schoolEl) {
      this.schoolT = 5;
      this.schoolNew = !!this.h.newLesson?.();
      this.schoolEl.classList.toggle('new', this.schoolNew);
    }
    this.fitT -= dt;
    if (this.fitT <= 0) {
      this.fitT = 0.5;
      this.fitQuest();
    }
    // the bubbles with the icon of what each resident wants, over his head
    const seen = new Set<number>();
    w.sim.agents.forEach((a, i) => {
      if (!a.wish || !a.active) return;
      const p = this.h.pos(i);
      let el = this.wishEls.get(i);
      if (!el) {
        el = document.createElement('div');
        el.className = 'cvw-wish';
        el.textContent = WISH_ICON[a.wish.kind];
        this.h.layer.appendChild(el);
        this.wishEls.set(i, el);
      }
      el.textContent = WISH_ICON[a.wish.kind];
      seen.add(i);
      el.style.visibility = p && a.mode !== 'riding' ? 'visible' : 'hidden';
      if (p) el.style.transform = `translate(${p.x}px, ${p.y - 6}px) translate(-50%, -100%)`;
    });
    for (const [i, el] of [...this.wishEls]) if (!seen.has(i)) (el.remove(), this.wishEls.delete(i));
    for (const s of this.says) {
      const p = this.h.pos(s.r);
      if (!s.shown) {
        // it waits until it does not fall on another bubble (and gives up after a while: the moment passed)
        s.wait += dt;
        if (!p) continue;
        const r = this.sayRect(s.el, p);
        const hit = this.visibleBubbles().some((b) => r.x < b.right + 4 && r.x + r.w > b.left - 4 && r.y < b.bottom + 4 && r.y + r.h > b.top - 4);
        if (hit) {
          if (s.wait > 7) s.ttl = 0;
          continue;
        }
        s.shown = true;
        s.el.style.visibility = 'visible';
        s.el.style.transform = `translate(${r.x + r.w / 2}px, ${p.y - 30}px) translate(-50%, -100%)`;
        if (s.line && this.near(s.r)) say(s.line);
      }
      s.ttl -= dt;
      if (p) {
        const half = (s.el.offsetWidth || 90) / 2 + 6;
        s.el.style.transform = `translate(${Math.min(window.innerWidth - half, Math.max(half, p.x))}px, ${p.y - 30}px) translate(-50%, -100%)`;
      }
      if (s.ttl <= 0) s.el.remove();
    }
    this.says = this.says.filter((s) => s.ttl > 0);
    // the number of the ones who want something (on the book button)
    this.badgeT -= dt;
    if (this.badgeT <= 0) {
      this.badgeT = 1;
      const n = w.sim.agents.filter((a) => a.wish).length + this.h.alerts().length;
      this.bookBtn.querySelector('i')!.textContent = n ? String(n) : '';
    }
  }

  dispose(): void {
    this.dead = true;
    this.friends.dispose();
    this.schoolEl?.remove();
    this.closeSheet();
    this.root.remove();
    this.guideEl?.remove();
    this.wishEls.forEach((e) => e.remove());
    this.says.forEach((s) => s.el.remove());
    document.querySelectorAll('.cvw-banner, .cvw-toast, .cvw-conf').forEach((e) => e.remove());
  }
}

const residentImg = (id: string): string => `${import.meta.env.BASE_URL}park/squishies/${id}.webp`;
/** the sign of a stall in English, said (the recording of the word or the voice of the phone) */
function sayEn(item: Item, force = false): void {
  void force;
  void speakEn(item.en.toLowerCase());
}
export { arrivalOrder };
