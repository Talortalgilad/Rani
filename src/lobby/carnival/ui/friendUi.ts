/**
 * The friendship of the residents on the page (SPEC-carnival.md 4.6): the card of a resident (the meter, the six details that show up one by one, the trick, the job, the gift), the
 * question "do you remember me?", the party day, the gift of level 4. DOM only; world.ts decides, friends.ts holds the rules. Nothing here is ever negative: a wrong answer is
 * answered with a smile and the right one, the meter never goes down, a party that was missed comes back next month.
 */
import { sound } from '../../../sound';
import { getState } from '../../../storage';
import { imageUrl } from '../../../games/english/art/images';
import { COLORS } from '../../../games/english/content/colors';
import { games } from '../../../games/registry';
import { sayLine } from '../../../games/english/content/heLines';
import { ACCESSORIES, ACCESSORY_MISSING, DETAILS, FOOD_OF_ITEM, accessoryById, friendLevel, friendOf, friendProgress, friendsOf, giftOf, shownDetails, trickOf, type Detail } from '../friends';
import { RESIDENT_INFO, infoOf, type ResidentInfo } from '../residents';
import { PERSONALITY_HE } from '../wishes';
import { CS_LINES } from '../csLines';
import { itemById, itemImg } from '../catalog';
import { say as sayPieces, speakClip } from '../talk/speak';
import type { WorldUI } from './worldUi';

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const csText = (id: string): string => CS_LINES.find((l) => l.id === id)?.text ?? '';
const say = (id: string): void => void sayLine(id);
export const LEVEL_NAME = ['', 'מכירים', 'חברים', 'חברים טובים', 'חברים קרובים', 'חבר הכי טוב'];
const DETAIL_ICON: Record<Detail, string> = { food: '🍽️', game: '🎮', color: '🎨', number: '🔢', hobby: '⭐', friend: '👫' };
const DETAIL_LINE: Record<Detail, string> = { food: 'cs_fav_food', game: 'cs_fav_game', color: 'cs_fav_color', number: 'cs_fav_number', hobby: 'cs_hobby', friend: 'cs_my_friend' };
const HOBBY_HE: Record<string, string> = { sleep: 'לישון', eat: 'לאכול', run: 'לרוץ', sing: 'לשיר' };
const FOODS = ['pizza', 'cake', 'cheese', 'donut', 'pasta', 'apple', 'chocolate', 'banana', 'icecream', 'egg', 'cookie'];
/** the English sentence of a detail, from level 3 ("I like pizza.", "It's red."), made of the recordings that exist */
const LIKE_RECORDED = ['pizza', 'cheese', 'pasta', 'meat', 'milk', 'cake', 'chocolate', 'icecream', 'apple', 'banana', 'egg', 'cookie'];
export function englishOf(d: Detail, info: ResidentInfo): { id: string; text: string } | null {
  // "I like pizza." is recorded for 12 foods (the lessons of Lolly); for the others the word alone
  if (d === 'food') return LIKE_RECORDED.includes(info.food) ? { id: `t_like_${info.food}`, text: `I like ${info.food}.` } : { id: info.food, text: info.food };
  if (d === 'color') return { id: `t_its_${info.color}`, text: `It's ${info.color}.` };
  if (d === 'number') return { id: `number_${info.number}`, text: String(info.number) };
  if (d === 'hobby') return { id: info.hobby, text: info.hobby };
  return null;
}

export class FriendUI {
  private quizT = 70;
  private lastQuiz = -1;

  constructor(private ui: WorldUI) {}
  private get w() {
    return this.ui.h.world;
  }
  private get save() {
    return this.w.save;
  }

  // ---------------------------------------------------------------- the card
  openCard(i: number): void {
    const w = this.w;
    const r = w.residents[i];
    const info = infoOf(r.id);
    if (!r || !info) return;
    const hearts = friendsOf(this.save).hearts[r.id] ?? 0;
    const lv = friendLevel(hearts);
    const shown = new Set(shownDetails(lv));
    const f = friendsOf(this.save);
    const worn = [...(f.worn[r.id] ?? [])].map((a) => accessoryById(a)).filter(Boolean);
    const detailHtml = (d: Detail): string => {
      if (!shown.has(d)) return `<button type="button" class="drow lock" data-d="${d}" disabled><i>${DETAIL_ICON[d]}</i><b>?</b><span class="lk" aria-label="נעול">🔒</span></button>`;
      let val = '';
      if (d === 'food') val = `<img src="${imageUrl(info.food)}" alt="">`;
      else if (d === 'game') { const g = games.find((x) => x.id === r.game); val = `<span class="gi">${g ? g.icon : '🎮'}</span>`; }
      else if (d === 'color') val = `<span class="sw" style="background:${COLORS.find((c) => c.id === info.color)?.hex ?? '#ccc'}"></span>`;
      else if (d === 'number') val = `<span class="num">${info.number}</span>`;
      else if (d === 'hobby') val = `<b>${esc(HOBBY_HE[info.hobby] ?? info.hobby)}</b>`;
      else { const fid = friendOf(r.id); const fr = w.residents.find((x) => x.id === fid); const known = fr ?? null; val = known ? `<img src="${esc(known.img)}" alt=""><b>${esc(known.name)}</b>` : '<b>?</b>'; }
      return `<button type="button" class="drow" data-d="${d}"><i>${DETAIL_ICON[d]}</i>${val}</button>`;
    };
    const el = this.ui.openSheet(
      'cvw-card',
      `<div class="cd-top"><img class="cd-img" src="${esc(r.img)}" alt="">${worn.map((a) => `<img class="cd-worn" src="${import.meta.env.BASE_URL}park/items/${a!.img}.webp" alt="${esc(a!.he)}" onerror="this.remove()">`).join('')}</div>
       <h2>${esc(r.name)}${r.mine ? ' <i class="mine-star" aria-hidden="true">★</i>' : ''}</h2>${r.mine ? '<p class="cd-mine">הכנתי בעצמי</p>' : ''}<p class="cd-p">${r.personality ? PERSONALITY_HE[r.personality] : ''} · <b>${LEVEL_NAME[lv]}</b></p>
       <div class="meter" aria-label="${LEVEL_NAME[lv]}">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= lv ? 'on' : n === lv + 1 ? 'next' : ''}"></i>`).join('')}<u><s style="width:${Math.round(friendProgress(hearts) * 100)}%"></s></u></div>
       <div class="details">${DETAILS.map((d) => detailHtml(d.key)).join('')}</div>
       <div class="cd-acts">
         ${lv >= 2 ? `<button type="button" class="cd-b" data-a="trick">✨ הטריק שלו</button>` : ''}
         ${lv >= 3 ? `<button type="button" class="cd-b" data-a="job">${f.job[r.id] ? '🧑‍🍳 מפסיק לעבוד' : '🧑‍🍳 לעבוד בדוכן'}</button>` : ''}
         ${w.giftWaiting(i) ? `<button type="button" class="cd-b cdgift" data-a="gift">🎁 מתנה!</button>` : ''}
         <button type="button" class="cd-b" data-a="go">${esc(csText('cs_take_me'))}</button>
       </div>`,
    );
    // a detail is said when it is tapped: "the colour that I like best:" and the word; from level 3 also in English
    el.querySelectorAll<HTMLButtonElement>('.drow:not(.lock)').forEach((b) =>
      b.addEventListener('click', () => {
        const d = b.dataset.d as Detail;
        sound.play('pop', 640);
        void this.sayDetail(d, r.id, r.name, info, lv >= 3);
      }),
    );
    el.querySelector('[data-a="go"]')?.addEventListener('click', () => (this.ui.closeSheet(), this.ui.h.takeMe?.(i)));
    el.querySelector('[data-a="trick"]')?.addEventListener('click', () => (this.ui.closeSheet(), this.doTrick(i)));
    el.querySelector('[data-a="gift"]')?.addEventListener('click', () => this.openGift(i));
    el.querySelector('[data-a="job"]')?.addEventListener('click', () => (f.job[r.id] ? (w.setJob(i, null), this.ui.closeSheet(), this.ui.toast('הוא הפסיק לעבוד')) : this.openJob(i)));
  }
  private async sayDetail(d: Detail, id: string, name: string, info: ResidentInfo, english: boolean): Promise<void> {
    const pieces = [{ he: DETAIL_LINE[d] }] as Parameters<typeof sayPieces>[0];
    if (d === 'food') pieces.push({ he: `w_${info.food}` });
    else if (d === 'color') pieces.push({ he: `c_${info.color}` });
    else if (d === 'number') pieces.push({ num: info.number });
    else if (d === 'hobby') pieces.push({ he: `w_${info.hobby}` });
    await sayPieces(pieces);
    void id; void name;
    const en = english ? englishOf(d, info) : null;
    if (en) await speakClip(en.id, en.text);
  }
  doTrick(i: number): void {
    const k = this.w.trick(i);
    if (!k) return;
    sound.play('bonus');
    this.ui.h.takeMe?.(i);
    window.setTimeout(() => this.ui.h.trick?.(i, k), 700);
    say('cs_new_trick');
  }

  // ---------------------------------------------------------------- a job at a stall
  private openJob(i: number): void {
    const w = this.w;
    const stalls = w.slots.filter((s) => s.kind === 'stall' && w.itemAt(s.id));
    const el = this.ui.openSheet('cvw-job', `<h2>איפה הוא יעבוד?</h2><div class="jobs">${stalls.map((s) => `<button type="button" data-s="${s.id}"><img src="${itemImg(w.itemAt(s.id)!.id)}" alt=""><b>${esc(w.itemAt(s.id)!.he)}</b>${w.sim.jobOf(s.id) >= 0 ? `<small>${esc(w.residents[w.sim.jobOf(s.id)].name)} עובד כאן</small>` : ''}</button>`).join('') || '<p>אין עדיין דוכן. אפשר לבנות אחד!</p>'}</div>`);
    el.querySelectorAll<HTMLButtonElement>('.jobs button').forEach((b) =>
      b.addEventListener('click', () => {
        if (w.setJob(i, b.dataset.s!)) {
          sound.play('bell');
          this.ui.closeSheet();
          this.ui.h.focusSlot?.(b.dataset.s!);
          this.ui.toast(`${w.residents[i].name} עובד בדוכן עם כובע טבח!`);
        }
      }),
    );
  }

  // ---------------------------------------------------------------- the gift of level 4
  openGift(i: number): void {
    const w = this.w;
    const r = w.residents[i];
    const g = accessoryById(giftOf(r.id))!;
    const el = this.ui.openSheet('cvw-gift', `<h2>${esc(csText('cs_gift_for_you'))}</h2><div class="gb"><img class="gbox" src="${import.meta.env.BASE_URL}park/items/giftbox.webp" alt=""><img class="gimg" src="${import.meta.env.BASE_URL}park/items/${g.img}.webp" alt="" onerror="this.replaceWith(Object.assign(document.createElement('b'),{textContent:'${esc(g.he)}'}))"></div><button type="button" class="cd-b" data-a="wear">מלבישים אותו!</button>`);
    say('cs_gift_for_you');
    sound.play('bonus');
    el.querySelector('[data-a="wear"]')!.addEventListener('click', () => {
      if (w.takeGift(i)) {
        sound.play('fanfare');
        this.ui.confetti(14);
        this.ui.toast(`${r.name} קיבל ${g.he}`);
      }
      this.ui.closeSheet();
      this.clearBubble(i);
    });
  }

  // ---------------------------------------------------------------- "do you remember me?"
  openQuiz(i: number): void {
    const w = this.w;
    const r = w.residents[i];
    const info = infoOf(r.id);
    if (!info) return;
    const lv = w.levelOf(i);
    const kinds = (['food', 'color', 'number'] as const).filter((k) => shownDetails(lv).includes(k === 'number' ? 'number' : k));
    const avail = kinds.filter((k) => k === 'food' || k === 'color' || k === 'number');
    if (!avail.length) return;
    const k = avail[(this.lastQuiz = (this.lastQuiz + 1) % avail.length)];
    const pick = <T,>(right: T, pool: T[]): T[] => {
      const others = pool.filter((x) => x !== right).sort(() => Math.random() - 0.5).slice(0, 2);
      return [right, ...others].sort(() => Math.random() - 0.5);
    };
    let opts: { v: string; html: string }[];
    if (k === 'food') opts = pick(info.food, FOODS).map((v) => ({ v, html: `<img src="${imageUrl(v)}" alt="">` }));
    else if (k === 'color') opts = pick(info.color, COLORS.map((c) => c.id)).map((v) => ({ v, html: `<span class="sw" style="background:${COLORS.find((c) => c.id === v)!.hex}"></span>` }));
    else opts = pick(String(info.number), Array.from({ length: 10 }, (_, n) => String(n + 1))).map((v) => ({ v, html: `<span class="num">${v}</span>` }));
    const right = k === 'number' ? String(info.number) : k === 'food' ? info.food : info.color;
    const el = this.ui.openSheet('cvw-quiz', `<div class="cd-top"><img class="cd-img" src="${esc(r.img)}" alt=""></div><h2>${esc(csText(`cs_quiz_${k}`))}</h2><div class="qopts">${opts.map((o) => `<button type="button" data-v="${o.v}">${o.html}</button>`).join('')}</div><p class="qmsg" aria-live="polite"></p>`);
    say(`cs_quiz_${k}`);
    this.clearBubble(i);
    let done = false;
    el.querySelectorAll<HTMLButtonElement>('.qopts button').forEach((b) =>
      b.addEventListener('click', () => {
        if (done) return;
        done = true;
        const ok = b.dataset.v === right;
        el.querySelectorAll<HTMLElement>('.qopts button').forEach((x) => x.classList.toggle('right', x.dataset.v === right));
        const msg = el.querySelector<HTMLElement>('.qmsg')!;
        if (ok) {
          sound.play('bonus');
          msg.textContent = csText('cs_quiz_right');
          say('cs_quiz_right');
          const n = w.remembered(i, true);
          this.ui.flyHeart(i, n);
          window.setTimeout(() => this.ui.closeSheet(), 1700);
        } else {
          // no penalty: he reminds her with a smile, and shows the answer
          sound.play('pop', 420);
          b.classList.add('soft');
          msg.textContent = csText('cs_quiz_remind');
          say('cs_quiz_remind');
          window.setTimeout(() => this.ui.closeSheet(), 2600);
        }
        this.quizT = 90;
      }),
    );
  }

  // ---------------------------------------------------------------- the party day
  openParty(i: number): void {
    const w = this.w;
    const r = w.residents[i];
    const info = infoOf(r.id);
    if (!info) return;
    const set = [info.food, ...FOODS.filter((x) => x !== info.food).sort(() => Math.random() - 0.5).slice(0, 2)].sort(() => Math.random() - 0.5);
    const el = this.ui.openSheet('cvw-party', `<div class="cd-top party"><img class="cd-img" src="${esc(r.img)}" alt=""><img class="cd-worn" src="${import.meta.env.BASE_URL}park/items/partyhat.webp" alt="" onerror="this.remove()"><img class="cd-bal" src="${import.meta.env.BASE_URL}park/items/balloons.webp" alt=""></div><h2>${esc(csText('cs_party_today'))}</h2><p class="cd-p">${esc(csText('cs_party_gift'))}</p><div class="qopts">${set.map((v) => `<button type="button" data-v="${v}"><img src="${imageUrl(v)}" alt=""></button>`).join('')}</div>`);
    say('cs_party_today');
    window.setTimeout(() => say('cs_party_gift'), 1700);
    this.clearBubble(i);
    let done = false;
    el.querySelectorAll<HTMLButtonElement>('.qopts button').forEach((b) =>
      b.addEventListener('click', () => {
        if (done) return;
        done = true;
        const n = w.partyGift(i, b.dataset.v === info.food);
        sound.play('fanfare');
        this.ui.confetti(30);
        say('cs_party_thanks');
        this.ui.flyHeart(i, n);
        window.setTimeout(() => this.ui.closeSheet(), 1900);
      }),
    );
  }

  // ---------------------------------------------------------------- the call button: one fixed button (a party, a gift, a question), always in the same place
  private quizI: number | null = null;
  private scanT = 0;
  private party: number | undefined;
  private gift = -1;
  private callEl: HTMLButtonElement | null = null;
  private call: { kind: 'party' | 'gift' | 'quiz'; i: number } | null = null;
  private clearBubble(i: number): void {
    if (this.quizI === i) this.quizI = null;
  }
  tick(dt: number, busy: boolean): void {
    const w = this.w;
    if (!busy) this.quizT -= dt;
    // what is waiting changes rarely: it is looked at twice a second, not every frame
    this.scanT -= dt;
    if (this.scanT <= 0) {
      this.scanT = 0.5;
      this.party = w.partyNow()[0];
      this.gift = w.residents.findIndex((_, i) => w.giftWaiting(i));
    }
    const party = this.party, gift = this.gift;
    if (this.quizT <= 0 && this.quizI === null) {
      const cand = w.residents.map((_, i) => i).filter((i) => w.levelOf(i) >= 2 && w.sim.agents[i]?.active);
      if (cand.length) this.quizI = cand[Math.floor(Math.random() * cand.length)];
      this.quizT = 100;
    }
    const next = party !== undefined ? { kind: 'party' as const, i: party } : gift >= 0 ? { kind: 'gift' as const, i: gift } : this.quizI !== null ? { kind: 'quiz' as const, i: this.quizI } : null;
    if (next?.kind !== this.call?.kind || next?.i !== this.call?.i) {
      this.call = next;
      this.callEl?.remove();
      this.callEl = null;
      if (next) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = `cvw-callb ${next.kind}`;
        el.setAttribute('aria-label', next.kind === 'party' ? 'יום חגיגה' : next.kind === 'gift' ? 'מתנה' : 'שאלה');
        el.innerHTML = `<span>${next.kind === 'party' ? '🎉' : next.kind === 'gift' ? '🎁' : '❓'}</span><img src="${esc(w.residents[next.i].img)}" alt="">`;
        el.addEventListener('click', () => {
          sound.play('pop', 700);
          const c = this.call;
          if (!c) return;
          if (c.kind === 'party') this.openParty(c.i);
          else if (c.kind === 'gift') this.openGift(c.i);
          else this.openQuiz(c.i);
        });
        this.ui.h.layer.appendChild(el);
        this.callEl = el;
      }
    }
  }
  dispose(): void {
    this.callEl?.remove();
  }
}
void RESIDENT_INFO; void ACCESSORIES; void ACCESSORY_MISSING; void FOOD_OF_ITEM; void trickOf; void getState; void itemById;
