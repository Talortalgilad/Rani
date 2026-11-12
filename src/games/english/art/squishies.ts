import { INK } from '../../memory/decks/svg';
import { bunnySvg } from './bunny';

/** The squishies that are rescued, one in each world (stage 1: worlds 1-4). Same round, thick-outlined style as the cheese wedge. */
export interface Squishy { name: string; world: number; svg: string }

const eyes = (x1: number, x2: number, y: number, r = 11): string =>
  [x1, x2].map((x) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="3.5"/><circle cx="${x + 2}" cy="${y + 2}" r="${r * 0.55}" fill="${INK}" stroke="none"/><circle cx="${x - 1}" cy="${y - 2}" r="${r * 0.2}" fill="#fff" stroke="none"/>`).join('');
const cheeks = (x1: number, x2: number, y: number): string => `<ellipse cx="${x1}" cy="${y}" rx="8" ry="5" fill="#ff8fa8" opacity=".85" stroke="none"/><ellipse cx="${x2}" cy="${y}" rx="8" ry="5" fill="#ff8fa8" opacity=".85" stroke="none"/>`;
const wrap = (inner: string): string => `<svg class="bunny-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><ellipse cx="100" cy="188" rx="52" ry="6" fill="${INK}" opacity=".16" stroke="none"/>${inner}</svg>`;

const PIZZA = wrap(`
  <path d="M100 176 L34 54 Q100 22 166 54Z" fill="#ffc83a"/>
  <path d="M34 54 Q100 22 166 54 L160 66 Q100 38 40 66Z" fill="#d98a2b"/>
  <circle cx="78" cy="78" r="9" fill="#e8453c"/><circle cx="122" cy="82" r="9" fill="#e8453c"/><circle cx="100" cy="120" r="9" fill="#e8453c"/><circle cx="104" cy="60" r="4" fill="#3fb56b"/>
  ${eyes(86, 114, 98, 9)}${cheeks(72, 128, 112)}<path d="M92 112 Q100 122 108 112" fill="none"/>
  <ellipse cx="82" cy="184" rx="14" ry="7" fill="#f2a21a"/><ellipse cx="118" cy="184" rx="14" ry="7" fill="#f2a21a"/>`);

const LEAFY = wrap(`
  <path d="M100 24 Q172 60 160 132 Q150 176 100 178 Q50 176 40 132 Q28 60 100 24Z" fill="#7ed957"/>
  <path d="M100 30 V176" fill="none" stroke-width="4"/><path d="M100 80 Q130 70 146 84 M100 110 Q70 100 54 114 M100 140 Q128 132 142 144" fill="none" stroke-width="3" opacity=".6"/>
  ${eyes(80, 120, 96, 11)}${cheeks(64, 136, 114)}<path d="M90 118 Q100 130 110 118" fill="none"/>
  <ellipse cx="80" cy="186" rx="14" ry="6" fill="#5fb840"/><ellipse cx="120" cy="186" rx="14" ry="6" fill="#5fb840"/>`);

const RAINBOW = wrap(`
  <path d="M26 150 A74 74 0 0 1 174 150" fill="none" stroke="${INK}" stroke-width="52"/>
  <path d="M26 150 A74 74 0 0 1 174 150" fill="none" stroke="#ff5d73" stroke-width="44"/><path d="M38 150 A62 62 0 0 1 162 150" fill="none" stroke="#ffd23f" stroke-width="22"/><path d="M52 150 A48 48 0 0 1 148 150" fill="none" stroke="#3fb56b" stroke-width="14"/><path d="M62 150 A38 38 0 0 1 138 150" fill="none" stroke="#3fa0ff" stroke-width="12"/>
  <ellipse cx="42" cy="158" rx="30" ry="18" fill="#fff"/><ellipse cx="158" cy="158" rx="30" ry="18" fill="#fff"/>
  ${eyes(34, 52, 156, 7)}<path d="M38 166 Q44 172 50 166" fill="none" stroke-width="3"/>`);

export const SQUISHIES: Record<number, Squishy> = {
  1: { name: 'Bunny', world: 1, svg: bunnySvg() },
  2: { name: 'Pizza', world: 2, svg: PIZZA },
  3: { name: 'Leafy', world: 3, svg: LEAFY },
  4: { name: 'Rainbow', world: 4, svg: RAINBOW },
};
