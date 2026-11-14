/**
 * Lolly (Miss Lolly, SPEC-tutor.md section 1): a candy-pink squishy with round glasses and a bow tie, drawn in code.
 * Expressions: listening (the head tilts), happy (jumps), confused (spinning eyes), clapping. The mouth moves with the volume of the clip.
 */
import { watchVolume } from './audio';

export type Look = 'idle' | 'listen' | 'happy' | 'confused' | 'clap';
export const LOOKS: Look[] = ['idle', 'listen', 'happy', 'confused', 'clap'];

const INK = '#3a2f4b';
const eyes = (look: Look): string => {
  const lens = `<circle cx="72" cy="92" r="21" fill="#fff" stroke="${INK}" stroke-width="5"/><circle cx="128" cy="92" r="21" fill="#fff" stroke="${INK}" stroke-width="5"/><path d="M93 90 Q100 84 107 90" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M51 88 L38 82 M149 88 L162 82" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  if (look === 'happy') return `${lens}<path d="M61 96 Q72 82 83 96 M117 96 Q128 82 139 96" fill="none" stroke="${INK}" stroke-width="5.5" stroke-linecap="round"/>`;
  if (look === 'confused') {
    const spiral = (cx: number): string => {
      const pts = Array.from({ length: 41 }, (_, k) => {
        const a = (k / 40) * Math.PI * 5;
        const r = 1.5 + (k / 40) * 14;
        return `${(cx + Math.cos(a) * r).toFixed(1)},${(92 + Math.sin(a) * r).toFixed(1)}`;
      }).join(' ');
      return `<polyline class="spin" points="${pts}" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`;
    };
    return `${lens}${spiral(72)}${spiral(128)}`;
  }
  const dy = look === 'listen' ? -3 : 0;
  return `${lens}<circle cx="${look === 'listen' ? 76 : 72}" cy="${94 + dy}" r="8" fill="${INK}"/><circle cx="${look === 'listen' ? 132 : 128}" cy="${94 + dy}" r="8" fill="${INK}"/><circle cx="${look === 'listen' ? 79 : 75}" cy="${90 + dy}" r="3" fill="#fff"/><circle cx="${look === 'listen' ? 135 : 131}" cy="${90 + dy}" r="3" fill="#fff"/>`;
};
const mouth = (look: Look, open: number): string => {
  if (open > 0.08) {
    const h = 5 + open * 17;
    return `<ellipse class="lm-mouth" cx="100" cy="${132 + h / 4}" rx="${11 + open * 4}" ry="${h}" fill="#c2325f" stroke="${INK}" stroke-width="4"/><ellipse cx="100" cy="${132 + h * 0.75}" rx="6" ry="${Math.max(1, h * 0.35)}" fill="#ff8aa8"/>`;
  }
  if (look === 'confused') return `<path class="lm-mouth" d="M84 138 Q92 130 100 138 Q108 146 116 138" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  if (look === 'listen') return `<ellipse class="lm-mouth" cx="100" cy="138" rx="6" ry="5" fill="#c2325f" stroke="${INK}" stroke-width="4"/>`;
  return `<path class="lm-mouth" d="M82 133 Q100 ${look === 'happy' ? 154 : 148} 118 133" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
};
const arms = (look: Look): string =>
  look === 'clap'
    ? `<g class="lm-clap"><ellipse cx="86" cy="156" rx="16" ry="12" fill="#ff7fb5" stroke="${INK}" stroke-width="4" transform="rotate(-25 86 156)"/><ellipse cx="114" cy="156" rx="16" ry="12" fill="#ff7fb5" stroke="${INK}" stroke-width="4" transform="rotate(25 114 156)"/></g>`
    : `<ellipse cx="34" cy="150" rx="13" ry="10" fill="#ff7fb5" stroke="${INK}" stroke-width="4" transform="rotate(${look === 'happy' ? -40 : 20} 34 150)"/><ellipse cx="166" cy="150" rx="13" ry="10" fill="#ff7fb5" stroke="${INK}" stroke-width="4" transform="rotate(${look === 'happy' ? 40 : -20} 166 150)"/>`;

export function lollySvg(look: Look, open = 0): string {
  return `<svg class="lolly-svg" viewBox="0 0 200 200" aria-hidden="true">
    <ellipse cx="100" cy="188" rx="58" ry="7" fill="rgba(58,47,75,.16)"/>
    <path d="M100 34 C150 34 176 72 176 118 C176 160 148 182 100 182 C52 182 24 160 24 118 C24 72 50 34 100 34 Z" fill="#ff9ac8" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M52 70 Q64 46 92 42" fill="none" stroke="#ffd3ea" stroke-width="9" stroke-linecap="round"/>
    <circle cx="48" cy="124" r="11" fill="#ff6fa8" opacity=".55"/><circle cx="152" cy="124" r="11" fill="#ff6fa8" opacity=".55"/>
    ${look === 'clap' ? '' : arms(look)}
    ${eyes(look)}
    ${mouth(look, open)}
    <g><path d="M100 168 L78 158 Q70 168 78 178 Z" fill="#7b5cff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M100 168 L122 158 Q130 168 122 178 Z" fill="#7b5cff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><circle cx="100" cy="168" r="7" fill="#5a3fe0" stroke="${INK}" stroke-width="4"/></g>
    ${look === 'clap' ? arms(look) : ''}
  </svg>`;
}

export interface Lolly { set(l: Look): void; get(): Look; speaking(on: boolean): void; el: HTMLElement }

/** A living Lolly in `el`. While she speaks, the mouth follows the volume of the clip (or, for the voice of the phone, flaps). */
export function mountLolly(el: HTMLElement, first: Look = 'idle'): Lolly {
  el.classList.add('lolly');
  let look: Look = first;
  let open = 0;
  let timer = 0;
  let seen = 0;
  const paint = (): void => {
    el.innerHTML = lollySvg(look, open);
    el.dataset.look = look;
  };
  paint();
  const set = (l: Look): void => {
    look = l;
    paint();
  };
  const mouthTo = (v: number): void => {
    const q = Math.round(v * 5) / 5;
    if (q === open) return;
    open = q;
    paint();
  };
  const speaking = (on: boolean): void => {
    window.clearInterval(timer);
    seen = 0;
    if (!on) {
      watchVolume(null);
      mouthTo(0);
      return;
    }
    watchVolume((v) => {
      seen = Date.now();
      mouthTo(v);
    });
    // no volume (the voice of the phone, or no sound): the mouth flaps by itself
    timer = window.setInterval(() => {
      if (Date.now() - seen > 250) mouthTo(Math.random() < 0.3 ? 0 : 0.35 + Math.random() * 0.65);
    }, 140);
  };
  return { set, get: () => look, speaking, el };
}
