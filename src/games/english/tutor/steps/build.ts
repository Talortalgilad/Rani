import { speakEn } from '../../voice';
import { esc } from '../../ui/text';
import { pictureHtml } from '../pictures';
import type { StepRun } from '../shell';

const arr = <T>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const shuffle = <T>(a: T[]): T[] => {
  const r = a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map((p) => p[1]);
  return r.length > 1 && r.every((v, i) => v === a[i]) ? [...r.slice(1), r[0]] : r;
};

/**
 * build: mixed word tiles, dragged into the slots in the right order. A tile is heard when it is tapped (the recording of the word if there is one,
 * else the voice of the phone). All slots full: right -> the whole sentence is said. Wrong: "almost" and the tiles go back; then the next tile sparkles; then Lolly shows.
 */
export const build: StepRun = async (sh, step) => {
  const c = sh.clear();
  const tiles = arr<string>(step.tiles);
  const clip = String(step.clip ?? '');
  const n = tiles.length;
  c.innerHTML = `${step.picture ? `<div class="tutor-pic big">${pictureHtml(String(step.picture))}</div>` : ''}<div class="tutor-slots" style="--n:${n}">${tiles.map((_, i) => `<div class="tutor-slot" data-s="${i}"></div>`).join('')}</div><div class="tutor-bank"></div>`;
  sh.lolly.set('think');
  const slots = [...c.querySelectorAll<HTMLElement>('.tutor-slot')];
  const bank = c.querySelector<HTMLElement>('.tutor-bank')!;
  const els: HTMLElement[] = [];
  const order = shuffle(tiles.map((t, i) => ({ t, i })));
  const place: (number | null)[] = new Array(n).fill(null); // slot -> tile index (position in `order`)
  const where = new Map<number, number>(); // tile (index in order) -> slot
  order.forEach((o, k) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tutor-tile';
    b.dataset.k = String(k);
    b.innerHTML = esc(o.t);
    b.dir = 'ltr';
    bank.appendChild(b);
    els.push(b);
  });
  const home = (k: number): void => {
    els[k].style.transform = '';
    els[k].classList.remove('placed', 'drag');
    bank.appendChild(els[k]);
  };
  const putIn = (k: number, s: number): void => {
    const cur = where.get(k);
    if (cur !== undefined) place[cur] = null;
    const other = place[s];
    if (other !== null && other !== k) {
      where.delete(other);
      home(other);
    }
    place[s] = k;
    where.set(k, s);
    els[k].style.transform = '';
    els[k].classList.remove('drag');
    els[k].classList.add('placed');
    slots[s].appendChild(els[k]);
  };
  const reset = (): void => {
    place.fill(null);
    where.clear();
    els.forEach((_, k) => home(k));
  };
  const hear = (k: number): void => void speakEn(order[k].t.replace(/[?.!,]/g, '')).catch(() => {});

  let tries = 0;
  await new Promise<void>((resolve, reject) => {
    const full = async (): Promise<void> => {
      const ok = place.every((k, s) => k !== null && order[k].t === tiles[s]);
      if (ok) {
        slots.forEach((s) => s.classList.add('ok'));
        sh.deps.sound.play('bonus');
        await sh.say(clip, { look: 'happy' });
        return resolve();
      }
      tries++;
      if (tries === 1) {
        await sh.say('t_almost', { look: 'think', keep: true });
        reset();
      } else if (tries === 2) {
        reset();
        const need = tiles[0];
        els[order.findIndex((o) => o.t === need)].classList.add('glow');
      } else {
        reset();
        await sh.say('t_show', { look: 'happy' });
        tiles.forEach((t, s) => putIn(order.findIndex((o, k) => o.t === t && !where.has(k)), s));
        slots.forEach((s) => s.classList.add('ok'));
        await sh.say(clip, { look: 'happy' });
        return resolve();
      }
    };
    const after = (): void => {
      if (place.every((k) => k !== null)) void full().catch(reject);
      else els.forEach((e) => e.classList.remove('glow'));
      // the tile that is needed next sparkles after the second mistake (it keeps glowing until a slot is filled)
    };
    els.forEach((el, k) => {
      let sx = 0;
      let sy = 0;
      let moved = false;
      let down = false;
      el.addEventListener('pointerdown', (e) => {
        down = true;
        moved = false;
        sx = e.clientX;
        sy = e.clientY;
        el.setPointerCapture(e.pointerId);
      });
      el.addEventListener('pointermove', (e) => {
        if (!down) return;
        const dx = e.clientX - sx;
        const dy = e.clientY - sy;
        if (!moved && Math.hypot(dx, dy) > 8) {
          moved = true;
          el.classList.add('drag');
        }
        if (moved) el.style.transform = `translate(${dx}px, ${dy}px) scale(1.08)`;
      });
      const up = (e: PointerEvent): void => {
        if (!down) return;
        down = false;
        if (!moved) {
          hear(k);
          // a tile in a slot goes back to the bank when it is tapped
          if (where.has(k)) {
            place[where.get(k)!] = null;
            where.delete(k);
            home(k);
          }
          return;
        }
        el.style.pointerEvents = 'none';
        const under = document.elementsFromPoint(e.clientX, e.clientY).find((x) => (x as HTMLElement).classList?.contains('tutor-slot')) as HTMLElement | undefined;
        el.style.pointerEvents = '';
        if (under) {
          putIn(k, Number(under.dataset.s));
          sh.deps.sound.play('pop', 520);
          after();
        } else if (where.has(k)) {
          place[where.get(k)!] = null;
          where.delete(k);
          home(k);
        } else home(k);
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', () => {
        down = false;
        el.style.transform = '';
        el.classList.remove('drag');
      });
    });
  });
  await sh.praise();
  return { tries: Math.min(3, tries + 1) };
};
