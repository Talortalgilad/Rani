import { artSvg } from '../decks';
import { enUrl, hasCardImage, cardUrl, pictureHtml, pictureUrl } from '../decks/pictures';
import { INK, star5 } from '../decks/svg';
import type { Card } from '../engine';

const FONT = `font-family="Rubik, system-ui, sans-serif" font-weight="800" text-anchor="middle" fill="${INK}"`;
const wrap = (inner: string, bg: string) =>
  `<svg viewBox="0 0 100 125" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><rect width="100" height="125" fill="${bg}"/>${inner}</svg>`;

/** Pictures that are repeated on the quantity cards (7 apples, 4 balls...): one 3D picture of the English game, as many times as the number says. */
const QTY_PICS = ['apple', 'banana', 'ball', 'cookie', 'balloon', 'star', 'donut', 'cupcake'];

/**
 * Where the pictures sit on a quantity card, like the dots of a dice: size and centres in % of the card's width (the card is 125 high).
 * Every picture is at least 28% of the width, so that they can be counted: up to 6 like a dice, 7 and 8 in two rows of four.
 */
export const QTY_LAYOUT: Record<number, { size: number; pts: [number, number][] }> = {
  1: { size: 56, pts: [[50, 62]] },
  2: { size: 40, pts: [[30, 36], [70, 89]] },
  3: { size: 36, pts: [[28, 28], [50, 62], [72, 96]] },
  4: { size: 36, pts: [[30, 36], [70, 36], [30, 88], [70, 88]] },
  5: { size: 30, pts: [[26, 30], [74, 30], [50, 62], [26, 94], [74, 94]] },
  6: { size: 32, pts: [[30, 26], [70, 26], [30, 62], [70, 62], [30, 98], [70, 98]] },
  7: { size: 28, pts: [[17, 44], [39, 44], [61, 44], [83, 44], [28, 82], [50, 82], [72, 82]] },
  8: { size: 28, pts: [[17, 44], [39, 44], [61, 44], [83, 44], [17, 82], [39, 82], [61, 82], [83, 82]] },
};
export const QTY_MAX = 8;
function qty(n: number): string {
  const id = QTY_PICS[(n - 1) % QTY_PICS.length];
  const { size, pts } = QTY_LAYOUT[Math.max(1, Math.min(QTY_MAX, n))];
  return `<div class="mm-qty" aria-label="${n}">${pts.map(([x, y]) => `<img src="${enUrl(id)}" alt="" draggable="false" style="width:${size}%;left:${x - size / 2}%;top:${(y - size / 2) / 1.25}%">`).join('')}</div>`;
}

/** A special card with a 3D picture: the picture on a coloured ground (the frame tells it from a plain card). */
const special3d = (url: string, bg: string, badge: string): string => `<div class="mm-special" style="background:${bg}"><img src="${url}" alt="" draggable="false"><i>${badge}</i></div>`;

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
  if (!f) return { html: pictureHtml(card.art), frame: deckFrame };
  switch (f.kind) {
    case 'letter':
      return { html: wrap(`<text x="50" y="92" font-size="84" ${FONT}>${f.letter}</text>`, '#dff0ff'), frame: '#4a90e2' };
    case 'num':
      return { html: wrap(`<text x="50" y="90" font-size="${f.n > 9 ? 62 : 84}" ${FONT}>${f.n}</text>`, '#dff0ff'), frame: '#4a90e2' };
    case 'qty':
      return { html: qty(f.n), frame: '#ff9a3c' };
    case 'word': {
      // the word cards use the 3D pictures of the English game where there is one (apple, ball, dog...), else the drawn picture
      if (pictureUrl(f.art)) return { html: `<div class="mm-wordcard"><div class="mm-wp">${pictureHtml(f.art)}</div><b style="font-size:${f.word.length > 4 ? 20 : 24}px">${f.word}</b></div>`, frame: '#ff9a3c' };
      const pic = artSvg(f.art).replace('<svg ', '<svg x="8" y="4" width="84" height="84" ');
      return { html: wrap(`${pic}<text x="50" y="116" font-size="${f.word.length > 4 ? 20 : 24}" ${FONT}>${f.word}</text>`, '#fff'), frame: '#ff9a3c' };
    }
    case 'special': {
      // the star card shows the 3D star, the peek card the telescope; the shuffle card has no picture in the sheets and stays drawn
      if (f.special === 'star') return { html: special3d(enUrl('star'), '#fff3c4', '★'), frame: SPECIAL.star.frame };
      if (f.special === 'peek' && hasCardImage('telescope')) return { html: special3d(cardUrl('telescope'), '#d9f1ff', '👁'), frame: SPECIAL.peek.frame };
      return { html: SPECIAL[f.special].svg, frame: SPECIAL[f.special].frame };
    }
  }
}
