import { LEVEL_COUNT, ZONES, makeLevel } from '../levels';
import { pk } from '../lines';

export interface Progress { levels: Record<number, number> }
export const emptyProgress = (): Progress => ({ levels: {} });
/** A challenge opens once the one before it is done with at least one star; the first one is always open. */
export const isUnlocked = (p: Progress, id: number): boolean => id === 1 || (p.levels[id - 1] ?? 0) > 0;

const ROW = 112;
const XS = [68, 34, 66, 30, 62, 36];

/** The journey: four zones of ten stops on a winding path, the big track at the end of each (in the style of the other games' maps). */
export function renderMap(root: HTMLElement, p: Progress, cb: { onPick(id: number): void; onBack(): void }): void {
  const current = Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1).find((id) => isUnlocked(p, id) && !p.levels[id]);
  root.innerHTML = `
    <div class="pk-mapscreen">
      <div class="pk-mtop"><button class="pk-round" id="pk-mback" type="button" aria-label="back">⬅️</button><h2 data-say="park_journey">${pk.journey}</h2><span class="pk-sp"></span></div>
      ${ZONES.map((z) => {
        const ids = Array.from({ length: 10 }, (_, i) => z.first + i);
        const open = isUnlocked(p, ids[0]);
        const pts = ids.map((_, i) => [XS[i % XS.length], ROW * (i + 0.5)]);
        const d = pts.map(([x, y], i) => {
          if (i === 0) return `M${x} ${y}`;
          const [px, py] = pts[i - 1];
          const my = (py + y) / 2;
          return `C${px} ${my} ${x} ${my} ${x} ${y}`;
        }).join(' ');
        const name = pk[`zone${z.id}` as 'zone1'];
        return `<section class="pk-zone z${z.id} ${open ? '' : 'closed'}" style="--from:${z.from};--to:${z.to};--pathc:${z.path}">
          <header><span>${z.icon}</span><h3 data-say="park_zone${z.id}">${name}</h3>${open ? '' : '<span>🔒</span>'}</header>
          <div class="pk-trail" style="height:${ROW * 10}px">
            <svg viewBox="0 0 100 ${ROW * 10}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" vector-effect="non-scaling-stroke"/></svg>
            ${ids.map((id, i) => {
              const style = `left:${XS[i % XS.length]}%;top:${ROW * (i + 0.5)}px`;
              const boss = i === 9;
              const hard = makeLevel(id).goals.parts.length + (makeLevel(id).goals.speed ? 1 : 0) >= 3;
              if (!isUnlocked(p, id)) return `<button class="pk-stop locked ${boss ? 'boss' : ''}" data-id="${id}" style="${style}" aria-label="🔒"><b>🔒</b></button>`;
              const st = p.levels[id] ?? 0;
              return `<button class="pk-stop ${boss ? 'boss' : ''} ${current === id ? 'current' : ''}" data-id="${id}" style="${style}"><b>${boss ? '🎢' : i + 1}</b>${hard && !boss ? `<em>${pk.hard}</em>` : ''}
                <span class="pk-stars">${[1, 2, 3].map((s) => `<i class="${s <= st ? 'on' : ''}">⭐</i>`).join('')}</span></button>`;
            }).join('')}
          </div>
        </section>`;
      }).join('')}
    </div>`;
  root.querySelector('#pk-mback')!.addEventListener('click', cb.onBack);
  root.querySelectorAll<HTMLButtonElement>('.pk-stop').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.classList.contains('locked')) {
        b.classList.remove('wiggle');
        void b.offsetWidth;
        b.classList.add('wiggle');
      } else cb.onPick(Number(b.dataset.id));
    }),
  );
  root.querySelector('.pk-stop.current')?.scrollIntoView({ block: 'center' });
}
