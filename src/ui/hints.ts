import type { Hint } from '../math/generator';

const dot = (cls = '') => `<span class="dot ${cls}"></span>`;
const dots = (n: number, cls = '') =>
  Array.from({ length: n }, (_, i) => dot(cls) + ((i + 1) % 5 === 0 && i + 1 < n ? '<span class="dot-gap"></span>' : '')).join('');

export function renderHint(h: Hint): string {
  switch (h.kind) {
    case 'dots':
      if (h.op === '+') {
        return `<div class="hint dots" dir="ltr">${dots(h.a, 'a')}<b>+</b>${dots(h.b, h.ghostSecond ? 'ghost' : 'b')}</div>`;
      }
      return `<div class="hint dots" dir="ltr">${dots(h.a - h.b, 'a')}${dots(h.b, 'gone')}</div>`;
    case 'tenframe':
      return `<div class="hint tenframe" dir="ltr">${Array.from({ length: 10 }, (_, i) =>
        i < h.filled ? `<span class="cell on"></span>` : `<span class="cell num">${i - h.filled + 1}</span>`).join('')}</div>`;
    case 'numberline': {
      const ticks = Array.from({ length: h.max + 1 }, (_, i) => {
        const marked = h.marks.includes(i);
        return `<span class="tick ${marked ? 'mark' : ''}"><i></i>${marked || i % 5 === 0 ? `<em>${i}</em>` : ''}</span>`;
      }).join('');
      return `<div class="hint numberline" dir="ltr">${ticks}</div>`;
    }
    case 'step':
      return `<div class="hint step" dir="ltr"><span class="chip">${h.delta > 0 ? '+' : '−'}${Math.abs(h.delta)}</span><span class="chip">${h.delta > 0 ? '+' : '−'}${Math.abs(h.delta)}</span><span class="chip">${h.delta > 0 ? '+' : '−'}${Math.abs(h.delta)}</span></div>`;
    case 'count':
      return ''; // count hints number the emoji in place (see gate.ts)
  }
}
