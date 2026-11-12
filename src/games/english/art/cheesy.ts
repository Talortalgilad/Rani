import { INK } from '../../memory/decks/svg';

/**
 * The squishy cheese wedge, drawn in SVG. All the expressions share one body; the face and the little props change.
 * "Squishy": it breathes all the time (CSS `breathe`), squashes when pressed (`squish`) and springs back slowly.
 */
export type Expression = 'happy' | 'thinking' | 'surprised' | 'encourage' | 'dance';
export const EXPRESSIONS: Expression[] = ['happy', 'thinking', 'surprised', 'encourage', 'dance'];

const CHEESE = '#ffc83a';
const CHEESE_DARK = '#f2a21a';
const HOLE = '#e8921a';
const CHEEK = '#ff8fa8';

const body = (): string => `
  <polygon points="100,42 40,150 160,150" fill="${INK}" stroke="${INK}" stroke-width="50" stroke-linejoin="round"/>
  <polygon points="100,42 40,150 160,150" fill="${CHEESE}" stroke="${CHEESE}" stroke-width="42" stroke-linejoin="round"/>
  <path d="M52 154 L148 154 Q158 154 156 146 L152 138 L48 138 L44 146 Q42 154 52 154Z" fill="${CHEESE_DARK}" opacity=".55"/>
  <ellipse cx="82" cy="62" rx="15" ry="8" fill="#fff" opacity=".45" transform="rotate(-32 82 62)"/>
  <ellipse cx="60" cy="92" rx="5" ry="3.5" fill="#fff" opacity=".4" transform="rotate(-50 60 92)"/>
  <g stroke="${INK}" stroke-width="3">
    <ellipse cx="104" cy="66" rx="6.5" ry="5" fill="${HOLE}"/>
    <ellipse cx="50" cy="146" rx="7" ry="5.5" fill="${HOLE}"/>
    <ellipse cx="148" cy="143" rx="6.5" ry="5" fill="${HOLE}"/>
    <ellipse cx="116" cy="152" rx="4.5" ry="3.5" fill="${HOLE}"/>
  </g>`;

const feet = (): string =>
  `<ellipse cx="74" cy="176" rx="17" ry="9" fill="${CHEESE_DARK}" stroke="${INK}" stroke-width="4"/>` +
  `<ellipse cx="126" cy="176" rx="17" ry="9" fill="${CHEESE_DARK}" stroke="${INK}" stroke-width="4"/>`;

function eye(x: number, y: number, r: number, look: { x: number; y: number } = { x: 0, y: 0 }, blink = true): string {
  return `<g class="${blink ? 'ch-eye' : ''}" style="transform-origin:${x}px ${y}px">
    <circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="3.5"/>
    <circle cx="${x + look.x + r * 0.15}" cy="${y + look.y + r * 0.15}" r="${r * 0.58}" fill="${INK}"/>
    <circle cx="${x + look.x - r * 0.12}" cy="${y + look.y - r * 0.22}" r="${r * 0.22}" fill="#fff"/>
    <circle cx="${x + look.x + r * 0.28}" cy="${y + look.y + r * 0.3}" r="${r * 0.1}" fill="#fff"/>
  </g>`;
}

const cheeks = (): string => `<ellipse cx="58" cy="122" rx="9" ry="6" fill="${CHEEK}" opacity=".85"/><ellipse cx="142" cy="122" rx="9" ry="6" fill="${CHEEK}" opacity=".85"/>`;

const smile = (open = false): string =>
  open
    ? `<path d="M86 124 Q100 148 114 124 Z" fill="${INK}" stroke="${INK}" stroke-width="3.5"/><path d="M92 134 Q100 144 108 134 Q100 130 92 134Z" fill="#ff7d93" stroke="none"/>`
    : `<path d="M88 126 Q100 139 112 126" fill="none" stroke="${INK}" stroke-width="4.5"/>`;

const star = (x: number, y: number, s: number, c = '#fff6a8'): string =>
  `<path d="M${x} ${y - s} L${x + s * 0.3} ${y - s * 0.3} L${x + s} ${y} L${x + s * 0.3} ${y + s * 0.3} L${x} ${y + s} L${x - s * 0.3} ${y + s * 0.3} L${x - s} ${y} L${x - s * 0.3} ${y - s * 0.3}Z" fill="${c}" stroke="${INK}" stroke-width="2.5"/>`;

const hand = (x: number, y: number): string => `<circle cx="${x}" cy="${y}" r="9" fill="${CHEESE_DARK}" stroke="${INK}" stroke-width="4"/>`;

function face(e: Expression): string {
  switch (e) {
    case 'happy':
      return eye(78, 106, 13) + eye(122, 106, 13) + cheeks() + smile();
    case 'surprised':
      return (
        `<path d="M64 84 Q78 76 92 84" fill="none" stroke="${INK}" stroke-width="4"/><path d="M108 84 Q122 76 136 84" fill="none" stroke="${INK}" stroke-width="4"/>` +
        eye(78, 104, 15, { x: 0, y: 0 }) + eye(122, 104, 15) + cheeks() +
        `<ellipse cx="100" cy="132" rx="7.5" ry="9.5" fill="${INK}"/><ellipse cx="100" cy="136" rx="4" ry="4.5" fill="#ff7d93"/>`
      );
    case 'thinking':
      return (
        `<path d="M64 88 Q78 84 92 90" fill="none" stroke="${INK}" stroke-width="4"/>` +
        eye(78, 106, 13, { x: 3, y: -4 }) + eye(122, 106, 13, { x: 3, y: -4 }) + cheeks() +
        `<path d="M90 131 q5 -5 10 0 t10 0" fill="none" stroke="${INK}" stroke-width="4.5"/>` +
        `<circle cx="150" cy="58" r="4" fill="#fff" stroke="${INK}" stroke-width="2.5"/><circle cx="160" cy="44" r="6" fill="#fff" stroke="${INK}" stroke-width="2.5"/>` +
        `<ellipse cx="176" cy="24" rx="17" ry="12" fill="#fff" stroke="${INK}" stroke-width="3"/><text x="176" y="30" text-anchor="middle" font-size="17" font-weight="800" fill="${INK}" stroke="none">?</text>`
      );
    case 'encourage':
      return (
        `<path d="M64 90 Q78 80 92 87" fill="none" stroke="${INK}" stroke-width="4"/><path d="M108 87 Q122 80 136 90" fill="none" stroke="${INK}" stroke-width="4"/>` +
        eye(78, 106, 13) + eye(122, 106, 13) + cheeks() + smile(true) +
        `<path d="M162 110 Q182 96 184 76" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/><path d="M162 110 Q182 96 184 76" fill="none" stroke="${CHEESE_DARK}" stroke-width="6" stroke-linecap="round"/>` +
        hand(184, 70) + star(26, 62, 11) + star(174, 38, 8)
      );
    case 'dance':
      return (
        eye(78, 104, 13) + eye(122, 104, 13) + cheeks() + smile(true) +
        `<path d="M40 112 Q22 98 20 76" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/><path d="M40 112 Q22 98 20 76" fill="none" stroke="${CHEESE_DARK}" stroke-width="6" stroke-linecap="round"/>` +
        `<path d="M160 112 Q178 98 180 76" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/><path d="M160 112 Q178 98 180 76" fill="none" stroke="${CHEESE_DARK}" stroke-width="6" stroke-linecap="round"/>` +
        hand(20, 70) + hand(180, 70) +
        `<text x="34" y="40" font-size="24" fill="${INK}" stroke="none">♪</text><text x="150" y="34" font-size="28" fill="${INK}" stroke="none">♫</text>`
      );
  }
}

/** The SVG of the cheese wedge with the given expression (viewBox 0 0 200 190). */
export function cheesySvg(e: Expression = 'happy'): string {
  return `<svg class="cheesy-svg" viewBox="0 0 200 190" xmlns="http://www.w3.org/2000/svg" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">
    <ellipse cx="100" cy="184" rx="58" ry="6" fill="#3a2f4b" opacity=".16" stroke="none"/>
    ${feet()}${body()}${face(e)}</svg>`;
}

/** A living wedge: breathes, squashes when pressed. `el` is the element to fill. */
export function mountCheesy(el: HTMLElement, e: Expression = 'happy', onPress?: () => void): { set(e: Expression): void; squish(): void; hop(): void } {
  el.classList.add('cheesy');
  const paint = (x: Expression): void => {
    el.innerHTML = cheesySvg(x);
    el.classList.toggle('dance', x === 'dance');
  };
  paint(e);
  const squish = (): void => {
    el.classList.remove('squish');
    void el.offsetWidth;
    el.classList.add('squish');
  };
  const hop = (): void => {
    el.classList.remove('hop');
    void el.offsetWidth;
    el.classList.add('hop');
  };
  el.addEventListener('pointerdown', () => {
    squish();
    onPress?.();
  });
  return { set: paint, squish, hop };
}
