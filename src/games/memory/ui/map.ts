import { LEVELS, WORLDS } from '../levels';

export interface LevelProgress { stars: number; bestAttempts: number; bestStreak: number }
export interface Progress { levels: Record<number, LevelProgress> }

export const emptyProgress = (): Progress => ({ levels: {} });

/** A level opens once the previous one is finished; a world opens with its first level. */
export const isUnlocked = (p: Progress, id: number): boolean => id === 1 || (p.levels[id - 1]?.stars ?? 0) > 0;

const ROW = 120;
const XS = [68, 30, 70, 32];

/** The journey: four worlds, each with a winding path and four stops. */
export function renderMap(root: HTMLElement, p: Progress, cb: { onPick(id: number): void; onBack(): void }): void {
  const current = LEVELS.find((l) => isUnlocked(p, l.id) && !(p.levels[l.id]?.stars));
  root.innerHTML = `
    <div class="mm-pane mm-map">
      <div class="mm-top">
        <button class="icon-btn small" id="mm-back" aria-label="חזרה">⬅️</button>
        <h2>מסע</h2>
        <span class="mm-sp"></span>
      </div>
      ${WORLDS.map((w) => {
        const lv = LEVELS.filter((l) => l.world === w.id);
        const open = isUnlocked(p, lv[0].id);
        const pts = lv.map((_, i) => [XS[i], ROW * (i + 0.5)]);
        const d = pts
          .map(([x, y], i) => {
            if (i === 0) return `M${x} ${y}`;
            const [px, py] = pts[i - 1];
            const my = (py + y) / 2;
            return `C${px} ${my} ${x} ${my} ${x} ${y}`;
          })
          .join(' ');
        return `
        <section class="mm-w ${open ? '' : 'closed'}" style="--from:${w.from};--to:${w.to};--pathc:${w.path}">
          <header><span>${w.icon}</span><h3>${w.name}</h3>${open ? '' : '<span>🔒</span>'}</header>
          <div class="mm-trail" style="height:${ROW * lv.length}px">
            <svg viewBox="0 0 100 ${ROW * lv.length}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" vector-effect="non-scaling-stroke"/></svg>
            ${lv.map((l, i) => {
              const style = `left:${XS[i]}%;top:${ROW * (i + 0.5)}px`;
              if (!isUnlocked(p, l.id)) return `<button class="mm-stop locked ${l.boss ? 'boss' : ''}" data-id="${l.id}" style="${style}" aria-label="נעול"><b>🔒</b></button>`;
              const st = p.levels[l.id]?.stars ?? 0;
              return `<button class="mm-stop ${l.boss ? 'boss' : ''} ${current?.id === l.id ? 'current' : ''}" data-id="${l.id}" style="${style}"><b>${l.id}</b>
                <span class="mm-stars">${[1, 2, 3].map((s) => `<i class="${s <= st ? 'on' : ''}">⭐</i>`).join('')}</span></button>`;
            }).join('')}
          </div>
        </section>`;
      }).join('')}
    </div>`;
  root.querySelector('#mm-back')!.addEventListener('click', cb.onBack);
  root.querySelectorAll<HTMLButtonElement>('.mm-stop').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.classList.contains('locked')) {
        b.classList.remove('wiggle');
        void b.offsetWidth;
        b.classList.add('wiggle');
      } else cb.onPick(Number(b.dataset.id));
    }),
  );
  root.querySelector('.mm-stop.current')?.scrollIntoView({ block: 'center' });
}
