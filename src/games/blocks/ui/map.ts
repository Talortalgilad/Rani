import { LEVELS, WORLDS } from '../levels';
import { bk } from '../lines';

export interface Progress { levels: Record<number, number> }
export const emptyProgress = (): Progress => ({ levels: {} });
/** A level opens once the one before it is finished with at least one star; the first level is always open. */
export const isUnlocked = (p: Progress, id: number): boolean => id === 1 || (p.levels[id - 1] ?? 0) > 0;

const ROW = 112;
const XS = [68, 34, 66, 30, 62, 36];

/** The journey: four worlds, each with a winding path of 15 stops, the boss at the end (in the style of the memory game's map). */
export function renderMap(root: HTMLElement, p: Progress, cb: { onPick(id: number): void; onBack(): void }): void {
  const current = LEVELS.find((l) => isUnlocked(p, l.id) && !p.levels[l.id]);
  root.innerHTML = `
    <div class="bk-pane bk-map">
      <div class="bk-mtop">
        <button class="bk-round" id="bk-back" aria-label="חזרה">⬅️</button>
        <h2 data-say="blk_journey">${bk.journey}</h2>
        <span class="bk-sp"></span>
      </div>
      ${WORLDS.map((w) => {
        const lv = LEVELS.filter((l) => l.world === w.id);
        const open = isUnlocked(p, lv[0].id);
        const pts = lv.map((_, i) => [XS[i % XS.length], ROW * (i + 0.5)]);
        const d = pts
          .map(([x, y], i) => {
            if (i === 0) return `M${x} ${y}`;
            const [px, py] = pts[i - 1];
            const my = (py + y) / 2;
            return `C${px} ${my} ${x} ${my} ${x} ${y}`;
          })
          .join(' ');
        return `
        <section class="bk-w ${open ? '' : 'closed'} w${w.id}" style="--from:${w.from};--to:${w.to};--pathc:${w.path}">
          <header><span>${w.icon}</span><h3>${w.name}</h3>${open ? '' : '<span>🔒</span>'}</header>
          <div class="bk-trail" style="height:${ROW * lv.length}px">
            <svg viewBox="0 0 100 ${ROW * lv.length}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" vector-effect="non-scaling-stroke"/></svg>
            ${lv
              .map((l, i) => {
                const style = `left:${XS[i % XS.length]}%;top:${ROW * (i + 0.5)}px`;
                const cls = `${l.boss ? 'boss' : ''} ${l.hard === 3 && !l.boss ? 'hard' : ''}`;
                if (!isUnlocked(p, l.id)) return `<button class="bk-stop locked ${cls}" data-id="${l.id}" style="${style}" aria-label="נעול"><b>🔒</b></button>`;
                const st = p.levels[l.id] ?? 0;
                return `<button class="bk-stop ${cls} ${current?.id === l.id ? 'current' : ''}" data-id="${l.id}" style="${style}"><b>${l.boss ? '💎' : l.n}</b>${l.hard === 3 && !l.boss ? `<em>${bk.hard}</em>` : ''}
                <span class="bk-stars">${[1, 2, 3].map((s) => `<i class="${s <= st ? 'on' : ''}">⭐</i>`).join('')}</span></button>`;
              })
              .join('')}
          </div>
        </section>`;
      }).join('')}
    </div>`;
  root.querySelector('#bk-back')!.addEventListener('click', cb.onBack);
  root.querySelectorAll<HTMLButtonElement>('.bk-stop').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.classList.contains('locked')) {
        b.classList.remove('wiggle');
        void b.offsetWidth;
        b.classList.add('wiggle');
      } else cb.onPick(Number(b.dataset.id));
    }),
  );
  root.querySelector('.bk-stop.current')?.scrollIntoView({ block: 'center' });
}
