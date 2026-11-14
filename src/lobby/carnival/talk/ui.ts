/**
 * The talks on the screen (SPEC-carnival.md 4.4): small bubbles, "!" bubbles, the screen of a talk (the resident big, the question below him,
 * an X that always closes it, no timer, no punishment: after a mistake the answer is shown and she tries again), and the hearts. DOM only; the
 * place of each resident comes from the host (the 3D scene, or the strip of the plain home).
 */
import { sound } from '../../../sound';
import { getState, update } from '../../../storage';
import { activeLevel, recordAnswer } from '../../../math/adaptive';
import { dayNumber, type Words } from '../../../games/english/engine/progress';
import { counter } from '../../../ui/counter';
import { englishName, type Resident } from '../residents';
import { Chatter, answered, nearCentre, tickAlerts } from './alerts';
import { MATH_TYPE, SUBJECT, WORD_NAMES, makeTalk, nextKind, rng, type Talk, type TalkEnv, type TalkKind } from './gen';
import { cv } from './lines';
import { loadSave, writeSave, type CarnivalSave } from './state';
import { opening, quiet, say } from './speak';

export interface TalkHost {
  /** where the elements go (a layer over the page) */
  layer: HTMLElement;
  residents: Resident[];
  /** the place of a resident's head on the screen (px), or null when he cannot be seen */
  pos(i: number): { x: number; y: number } | null;
  /** the camera comes close to a resident (and goes back with null); he stands still (and walks on when `hold` is false) */
  focus(i: number | null): void;
  hold(i: number, on: boolean): void;
  wave(i: number): void;
}

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const base = (): string => import.meta.env.BASE_URL;
const OTHER_NAMES = ['דני', 'נועה', 'תמר', 'יוסי', 'מיכל', 'עידו', 'שירה'];
const sleep = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

export class Talks {
  readonly save: CarnivalSave;
  private chatter: Chatter;
  private chatEl: HTMLElement;
  private chatR = -1;
  private chatT = 0;
  private alertEls = new Map<number, HTMLElement>();
  private heartsEl: HTMLElement;
  private screen: HTMLElement | null = null;
  private openR = -1;
  private dead = false;
  private closeTimer = 0;
  private lastSaved = 0;
  /** a talk waiting to be said again after a mistake (for the tests) */
  attempts = 0;
  private waveT = new Map<number, number>();

  constructor(private host: TalkHost, private now: () => number = () => Date.now()) {
    this.save = loadSave();
    this.chatter = new Chatter(Math.random);
    this.chatEl = document.createElement('div');
    this.chatEl.className = 'cv-chat';
    this.heartsEl = document.createElement('div');
    this.heartsEl.className = 'cv-hearts';
    this.heartsEl.setAttribute('data-say', 'cv_hearts');
    host.layer.append(this.chatEl, this.heartsEl);
    this.paintHearts();
  }

  /** for the screenshots and the tests: a bubble now, and its talk of a chosen kind */
  debugTalk(r: number, kind: TalkKind): void {
    if (this.open) this.close();
    if (!this.save.alerts.alerts.some((a) => a.r === r)) this.save.alerts.alerts.push({ r, seed: 4242 + r });
    this.openTalk(r, kind);
  }

  get open(): boolean {
    return this.screen !== null;
  }
  private paintHearts(): void {
    this.heartsEl.innerHTML = `❤️ ${counter(String(this.save.hearts))}`;
  }

  // ---- every frame ----
  tick(dt: number, w = window.innerWidth, h = window.innerHeight): void {
    if (this.dead) return;
    const busy = this.open;
    // the "!" bubbles
    const a = tickAlerts(this.save.alerts, dt, this.host.residents.length, Math.floor(Math.random() * 1e9), busy);
    if (a) {
      this.host.wave(a.r);
      const p = this.host.pos(a.r);
      if (p && nearCentre(p.x, p.y, w, h)) void say([{ he: 'cv_rani' }]);
      this.persist(true);
    }
    for (const al of this.save.alerts.alerts) {
      let el = this.alertEls.get(al.r);
      if (!el) {
        const btn = document.createElement('button');
        btn.type = 'button';
        el = btn;
        el.className = 'cv-alert';
        el.textContent = '❗';
        el.setAttribute('aria-label', this.host.residents[al.r]?.name ?? '');
        const r = al.r;
        el.addEventListener('click', () => this.openTalk(r));
        this.host.layer.appendChild(el);
        this.alertEls.set(al.r, el);
      }
      const wt = (this.waveT.get(al.r) ?? 0) - dt;
      if (wt <= 0 && !busy) this.host.wave(al.r);
      this.waveT.set(al.r, wt <= 0 ? 2.6 : wt);
      const p = this.host.pos(al.r);
      el.style.visibility = p && !busy ? 'visible' : 'hidden';
      if (p) el.style.transform = `translate(${p.x}px, ${p.y - 34}px) translate(-50%, -100%)`;
    }
    for (const [r, el] of [...this.alertEls]) if (!this.save.alerts.alerts.some((x) => x.r === r)) {
      el.remove();
      this.alertEls.delete(r);
    }
    // the small bubbles: one resident at a time, never one who has a "!" bubble or is in a talk
    if (!busy && this.chatT <= 0) {
      const skip = [...this.save.alerts.alerts.map((x) => x.r)];
      const c = this.chatter.tick(dt, this.host.residents.length, skip);
      if (c) {
        this.chatR = c.r;
        this.chatT = 3.4;
        this.chatEl.textContent = c.chat.text;
        this.chatEl.classList.add('on');
        const p = this.host.pos(c.r);
        // the sound only when he is near the middle of the screen
        if (p && nearCentre(p.x, p.y, w, h)) void say(c.chat.he ? [{ he: c.chat.he }] : [{ en: c.chat.en! }]);
      }
    } else if (!busy) {
      this.chatT -= dt;
      this.chatter.tick(dt, 0);
    }
    if (this.chatR >= 0) {
      const p = this.host.pos(this.chatR);
      if (p && this.chatT > 0 && !busy) {
        // inside the screen
        const half = (this.chatEl.offsetWidth || 100) / 2 + 6;
        const x = Math.min(window.innerWidth - half, Math.max(half, p.x));
        this.chatEl.style.transform = `translate(${x}px, ${p.y - 18}px) translate(-50%, -100%)`;
      }
      else this.chatEl.classList.remove('on');
      if (this.chatT <= 0) {
        this.chatEl.classList.remove('on');
        this.chatR = -1;
      }
    }
    if (this.now() - this.lastSaved > 4000) this.persist();
  }

  private persist(force = false): void {
    if (force || this.now() - this.lastSaved > 4000) {
      writeSave(this.save);
      this.lastSaved = this.now();
    }
  }

  /** A tap on a resident: true when it opened a talk (he had a "!" bubble). */
  tapResident(i: number): boolean {
    if (this.open) return true;
    if (!this.save.alerts.alerts.some((a) => a.r === i)) return false;
    this.openTalk(i);
    return true;
  }

  // ---- the talk ----
  private env(resident: string): TalkEnv {
    const st = getState();
    const en = st.games.english as { words?: Words } | undefined;
    return { level: activeLevel(), words: en?.words ?? {}, today: dayNumber(), name: st.profile.name, otherNames: OTHER_NAMES, resident };
  }

  openTalk(r: number, forceKind?: TalkKind): void {
    const al = this.save.alerts.alerts.find((a) => a.r === r);
    if (!al || this.open) return;
    const res = this.host.residents[r];
    const env = this.env(englishName(res.name));
    const kind = forceKind ?? nextKind({ last: this.save.last, retry: this.save.retry }, env, al.seed);
    const talk = makeTalk(kind, al.seed, env) ?? makeTalk('hello', al.seed, env)!;
    this.openR = r;
    this.attempts = 0;
    this.host.hold(r, true);
    this.host.focus(r);
    const s = document.createElement('div');
    s.className = 'cv-talk';
    s.innerHTML = `<button class="cv-x" type="button" aria-label="סגירה">✕</button>
      <div class="cv-who"><img src="${esc(res.img)}" alt="" draggable="false"><div class="cv-say"></div></div>
      <div class="cv-act"></div><div class="cv-msg"></div>`;
    this.host.layer.appendChild(s);
    this.screen = s;
    s.querySelector('.cv-x')!.addEventListener('click', () => this.close());
    sound.play('bell', 880);
    this.render(talk, al.seed);
  }

  /** The X: closes at any time; the "!" bubble stays. */
  close(): void {
    window.clearTimeout(this.closeTimer);
    quiet();
    this.screen?.remove();
    this.screen = null;
    if (this.openR >= 0) {
      this.host.hold(this.openR, false);
      this.host.focus(null);
    }
    this.openR = -1;
  }

  private msg(text: string, cls = ''): void {
    const m = this.screen?.querySelector<HTMLElement>('.cv-msg');
    if (!m) return;
    m.className = `cv-msg ${cls}`;
    m.textContent = text;
  }
  private sayText(html: string): void {
    const el = this.screen?.querySelector<HTMLElement>('.cv-say');
    if (el) el.innerHTML = html;
  }

  private render(t: Talk, seed: number): void {
    const act = this.screen!.querySelector<HTMLElement>('.cv-act')!;
    const res = this.host.residents[this.openR];
    const items = (item: { emoji: string }, n: number, cls = ''): string => Array.from({ length: n }, () => `<i class="${cls}">${item.emoji}</i>`).join('');
    const btn = (html: string, i: number, cls = ''): string => `<button class="cv-opt ${cls}" type="button" data-i="${i}">${html}</button>`;
    let wrong: (() => Promise<void>) | null = null;
    const done = (ok: boolean, picked?: HTMLElement): void => {
      if (ok) void this.correct(t);
      else void this.mistake(t, picked, wrong);
    };
    const prompt = opening(t, englishName(res.name));
    void say(prompt);
    const bind = (): void => {
      act.querySelectorAll<HTMLElement>('.cv-opt').forEach((b) =>
        b.addEventListener('click', () => {
          if (b.classList.contains('lock')) return;
          const i = Number(b.dataset.i);
          if (t.kind === 'can' || t.kind === 'what') void say([{ word: t.options[i] }]);
          done(i === ('answer' in t ? (t.kind === 'more' ? t.answer : t.kind === 'together' || t.kind === 'missing' ? t.choices.indexOf(t.answer) : t.answer) : -1), b);
        }),
      );
    };
    if (t.kind === 'together') {
      this.sayText(`<span class="n">${counter(`${t.a}`)}</span> ${esc(t.item.he)} + <span class="n">${counter(`${t.b}`)}</span> ${esc(t.item.he)}<br>${esc(cv.howmany)}`);
      act.innerHTML = `<div class="cv-items"><span class="grp">${items(t.item, t.a)}</span><b>+</b><span class="grp">${items(t.item, t.b, 'b')}</span></div><div class="cv-opts">${t.choices.map((c, i) => btn(counter(String(c)), i)).join('')}</div>`;
      wrong = () => this.countRow(act, t.answer);
      bind();
    } else if (t.kind === 'missing') {
      this.sayText(`${esc(cv.had)} <span class="n">${counter(String(t.a))}</span> ${esc(t.item.he)}, ${esc(cv.ate)} <span class="n">${counter(String(t.b))}</span><br>${esc(cv.left)}`);
      act.innerHTML = `<div class="cv-items"><span class="grp">${items(t.item, t.a - t.b)}</span><span class="grp ate">${items(t.item, t.b)}</span></div><div class="cv-opts">${t.choices.map((c, i) => btn(counter(String(c)), i)).join('')}</div>`;
      wrong = () => this.countRow(act, t.answer, '.grp:not(.ate) i');
      bind();
    } else if (t.kind === 'more') {
      this.sayText(esc(t.ask === 'more' ? cv.more : cv.less));
      act.innerHTML = `<div class="cv-stacks">${[t.a, t.b].map((n, i) => btn(`<span class="pile">${items(t.item, n)}</span>`, i, 'stack')).join('')}</div>`;
      wrong = async () => {
        // the counts are shown on both piles, counted aloud
        const piles = act.querySelectorAll<HTMLElement>('.stack');
        for (const [i, n] of [t.a, t.b].entries()) {
          const tag = document.createElement('em');
          tag.textContent = String(n);
          piles[i].appendChild(tag);
          await say([{ num: n }]);
        }
      };
      bind();
    } else if (t.kind === 'exact') {
      this.sayText(`${esc(cv.want)} <span class="n">${counter(String(t.n))}</span> ${esc(t.item.he)}`);
      const count = (): number => act.querySelectorAll('.plate i').length;
      act.innerHTML = `<div class="cv-pile">${Array.from({ length: t.pile }, () => `<button class="it" type="button">${t.item.emoji}</button>`).join('')}</div><div class="cv-plate"><span class="plate"></span><b class="cnt0">0</b></div><button class="cv-opt ok" type="button">${esc(cv.enough)} ✔</button>`;
      const plate = act.querySelector<HTMLElement>('.plate')!;
      const cnt = act.querySelector<HTMLElement>('.cnt0')!;
      act.querySelectorAll<HTMLElement>('.it').forEach((b) =>
        b.addEventListener('click', () => {
          if (b.classList.contains('gone') || act.classList.contains('lock')) return;
          b.classList.add('gone');
          const i = document.createElement('i');
          i.textContent = t.item.emoji;
          plate.appendChild(i);
          cnt.textContent = String(count());
          sound.play('pop', 500 + count() * 40);
          void say([{ num: count() }]);
        }),
      );
      act.querySelector('.ok')!.addEventListener('click', () => done(count() === t.n));
      wrong = async () => {
        act.classList.add('lock');
        plate.innerHTML = '';
        act.querySelectorAll('.it').forEach((b) => b.classList.remove('gone'));
        cnt.textContent = '0';
        for (let k = 1; k <= t.n; k++) {
          const i = document.createElement('i');
          i.textContent = t.item.emoji;
          i.className = 'glow';
          plate.appendChild(i);
          cnt.textContent = String(k);
          await say([{ num: k }]);
          await sleep(250);
        }
        await sleep(700);
        plate.innerHTML = '';
        cnt.textContent = '0';
        act.classList.remove('lock');
      };
    } else if (t.kind === 'can') {
      this.sayText(`<span dir="ltr" class="en">Can I have the ${esc(WORD_NAMES.get(t.word) ?? t.word)}, please?</span><br><small>${esc(cv.tapthis)}</small>`);
      act.innerHTML = `<div class="cv-opts pics">${t.options.map((w, i) => btn(`<img src="${base()}english/words/${w}.webp" alt="" draggable="false">`, i, 'pic')).join('')}</div>`;
      bind();
    } else if (t.kind === 'what') {
      this.sayText(`<span dir="ltr" class="en">What is it?</span><br><small>${esc(cv.tapword)}</small>`);
      act.innerHTML = `<div class="cv-bigpic"><img src="${base()}english/words/${t.word}.webp" alt="" draggable="false"></div><div class="cv-opts">${t.options.map((w, i) => btn(`<span dir="ltr">${esc(WORD_NAMES.get(w) ?? w)}</span>`, i, 'word')).join('')}</div>`;
      bind();
    } else {
      this.sayText(`<span dir="ltr" class="en">Hello! I'm ${esc(t.self)}.<br>What's your name?</span><br><small>${esc(cv.tapname)}</small>`);
      act.innerHTML = `<div class="cv-opts">${t.names.map((n, i) => btn(esc(n), i, 'word')).join('')}</div>`;
      bind();
    }
    void seed;
    // the right answer is shown after a mistake
    (act as HTMLElement & { _wrong?: typeof wrong })._wrong = wrong;
  }

  /** Counts a row of things aloud, one by one (the help after a mistake). */
  private async countRow(act: HTMLElement, n: number, sel = '.cv-items i'): Promise<void> {
    const els = [...act.querySelectorAll<HTMLElement>(sel)].slice(0, n);
    els.forEach((e) => e.classList.remove('glow'));
    for (const [k, e] of els.entries()) {
      e.classList.add('glow');
      await say([{ num: k + 1 }]);
      await sleep(200);
    }
  }

  private async mistake(t: Talk, picked: HTMLElement | undefined, help: (() => Promise<void>) | null): Promise<void> {
    if (!this.screen) return;
    this.attempts++;
    sound.play('oops');
    picked?.classList.add('shake');
    window.setTimeout(() => picked?.classList.remove('shake'), 500);
    // the kind comes back later
    if (!this.save.retry.includes(t.kind)) this.save.retry.push(t.kind);
    this.persist(true);
    const act = this.screen.querySelector<HTMLElement>('.cv-act')!;
    // show the answer
    const right = act.querySelector<HTMLElement>(`.cv-opt[data-i="${this.answerIndex(t)}"]`);
    right?.classList.add('show');
    this.msg(cv.almost);
    await say([{ he: 'cv_almost' }]);
    if (!this.screen) return;
    if (help) await help();
    if (!this.screen) return;
    this.msg(cv.tryagain);
    void say([{ he: 'cv_tryagain' }]);
  }
  private answerIndex(t: Talk): number {
    return t.kind === 'together' || t.kind === 'missing' ? t.choices.indexOf(t.answer) : 'answer' in t ? t.answer : -1;
  }

  /** The right answer: thanks, a heart (and now and then a star), and the bubble is gone. */
  private async correct(t: Talk): Promise<void> {
    if (!this.screen) return;
    const r = this.openR;
    const first = this.attempts === 0;
    this.screen.classList.add('happy');
    sound.play('correct');
    this.msg(cv.thanks, 'ok');
    const sv = this.save;
    sv.hearts += 1;
    sv.answers += 1;
    sv.last = SUBJECT[t.kind];
    sv.retry = sv.retry.filter((k) => k !== t.kind);
    sv.count += 1;
    answered(sv.alerts, r);
    if (sv.answers % 5 === 0) update((s) => void (s.stars += 1));
    if (SUBJECT[t.kind] === 'math') recordAnswer(MATH_TYPE[t.kind], first ? 1 : 2);
    this.persist(true);
    this.flyHeart(sv.answers % 5 === 0);
    this.paintHearts();
    void say([{ he: 'cv_thanks' }]);
    this.closeTimer = window.setTimeout(() => this.close(), 2000);
  }
  private flyHeart(star: boolean): void {
    const from = this.screen?.querySelector('.cv-who img')?.getBoundingClientRect();
    const to = this.heartsEl.getBoundingClientRect();
    if (!from) return;
    for (const [i, ch] of (star ? ['❤️', '⭐'] : ['❤️']).entries()) {
      const e = document.createElement('div');
      e.className = 'cv-fly';
      e.textContent = ch;
      e.style.left = `${from.left + from.width / 2}px`;
      e.style.top = `${from.top + from.height / 3}px`;
      document.body.appendChild(e);
      const a = e.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 }, { transform: `translate(${to.left + to.width / 2 - (from.left + from.width / 2) - 50}px, ${to.top - (from.top + from.height / 3)}px) scale(1.2)`, opacity: 1 }], { duration: 900, delay: i * 200, easing: 'ease-in', fill: 'forwards' });
      a.onfinish = () => e.remove();
      window.setTimeout(() => e.remove(), 1800);
    }
  }

  dispose(): void {
    this.dead = true;
    window.clearTimeout(this.closeTimer);
    this.close();
    writeSave(this.save);
    this.chatEl.remove();
    this.heartsEl.remove();
    this.alertEls.forEach((e) => e.remove());
    this.alertEls.clear();
    void rng;
  }
}
