import { artSvg } from '../decks';
import { INK, star5 } from '../decks/svg';
import type { Card } from '../engine';

const FONT = `font-family="Rubik, system-ui, sans-serif" font-weight="800" text-anchor="middle" fill="${INK}"`;
const wrap = (inner: string, bg: string) =>
  `<svg viewBox="0 0 100 125" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><rect width="100" height="125" fill="${bg}"/>${inner}</svg>`;

// dice positions inside a 100×100 area
const DICE: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[26, 26], [50, 50], [74, 74]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[30, 24], [70, 24], [30, 50], [70, 50], [30, 76], [70, 76]],
};

/** Quantity picture: dice pattern up to 6, ten-frames above that. */
function qty(n: number): string {
  const dot = (x: number, y: number, r: number) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ff7d3c" stroke="${INK}" stroke-width="3.5"/>`;
  if (n <= 6) {
    return wrap(
      `<rect x="14" y="22" width="72" height="72" rx="14" fill="#fff" stroke="${INK}" stroke-width="4.5"/>` +
        `<g transform="translate(15 23) scale(.7)">${DICE[n].map(([x, y]) => dot(x, y, 11)).join('')}</g>`,
      '#fff7ec',
    );
  }
  const frames = Math.ceil(n / 10);
  let left = n;
  const out: string[] = [];
  for (let f = 0; f < frames; f++) {
    const y0 = frames === 1 ? 34 : 8 + f * 58;
    out.push(`<rect x="8" y="${y0}" width="84" height="${frames === 1 ? 56 : 48}" rx="8" fill="#fff" stroke="${INK}" stroke-width="4"/>`);
    const cw = 84 / 5;
    const ch = (frames === 1 ? 56 : 48) / 2;
    for (let c = 0; c < 10; c++) {
      const x = 8 + (c % 5) * cw + cw / 2;
      const y = y0 + Math.floor(c / 5) * ch + ch / 2;
      out.push(c < Math.min(10, left) ? dot(x, y, frames === 1 ? 8.5 : 7.5) : '');
    }
    left -= 10;
  }
  return wrap(out.join(''), '#fff7ec');
}

const SPECIAL: Record<string, { svg: string; frame: string }> = {
  star: {
    frame: '#ffd23f',
    svg: wrap(`<path d="${star5(50, 64, 42, 19)}" fill="#ffd23f" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      <circle cx="41" cy="60" r="5" fill="${INK}"/><circle cx="59" cy="60" r="5" fill="${INK}"/>
      <path d="M42 72 Q50 80 58 72" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`, '#fff3c4'),
  },
  peek: {
    frame: '#6ec6ff',
    svg: wrap(`<path d="M8 62 Q50 14 92 62 Q50 110 8 62Z" fill="#fff" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      <circle cx="50" cy="62" r="20" fill="#4a90e2" stroke="${INK}" stroke-width="4.5"/>
      <circle cx="50" cy="62" r="9" fill="${INK}"/><circle cx="44" cy="55" r="4" fill="#fff"/>`, '#d9f1ff'),
  },
  shuffle: {
    frame: '#b58cff',
    svg: wrap(`<path d="M50 62 m0 0 a5 5 0 0 1 10 0 a12 12 0 0 1 -24 0 a20 20 0 0 1 40 0 a28 28 0 0 1 -56 0" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/>
      <path d="M50 62 m0 0 a5 5 0 0 1 10 0 a12 12 0 0 1 -24 0 a20 20 0 0 1 40 0 a28 28 0 0 1 -56 0" fill="none" stroke="#b58cff" stroke-width="7" stroke-linecap="round"/>`, '#efe6ff'),
  },
};

export interface FrontFace { html: string; frame: string }

/** Markup and border colour for the face-up side of a card. Different kinds get different colours. */
export function frontFace(card: Card, deckFrame: string): FrontFace {
  const f = card.face;
  if (!f) return { html: artSvg(card.art), frame: deckFrame };
  switch (f.kind) {
    case 'letter':
      return { html: wrap(`<text x="50" y="92" font-size="84" ${FONT}>${f.letter}</text>`, '#dff0ff'), frame: '#4a90e2' };
    case 'num':
      return { html: wrap(`<text x="50" y="90" font-size="${f.n > 9 ? 62 : 84}" ${FONT}>${f.n}</text>`, '#dff0ff'), frame: '#4a90e2' };
    case 'qty':
      return { html: qty(f.n), frame: '#ff9a3c' };
    case 'word': {
      const pic = artSvg(f.art).replace('<svg ', '<svg x="8" y="4" width="84" height="84" ');
      return { html: wrap(`${pic}<text x="50" y="116" font-size="${f.word.length > 4 ? 20 : 24}" ${FONT}>${f.word}</text>`, '#fff'), frame: '#ff9a3c' };
    }
    case 'special':
      return { html: SPECIAL[f.special].svg, frame: SPECIAL[f.special].frame };
  }
}
