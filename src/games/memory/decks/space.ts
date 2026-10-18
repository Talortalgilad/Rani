import { INK, eye, smile, spikes, star5, type Deck } from './svg';

const art: Record<string, string> = {
  rocket:
    `<path d="M34 62 L14 82 L34 78Z" fill="#ff5d73"/><path d="M66 62 L86 82 L66 78Z" fill="#ff5d73"/>` +
    `<path d="M42 78 Q50 100 58 78Z" fill="#ffb627"/>` +
    `<path d="M50 4 C70 22 72 54 66 78 L34 78 C28 54 30 22 50 4Z" fill="#fff"/>` +
    `<path d="M50 4 C60 12 66 22 69 34 L31 34 C34 22 40 12 50 4Z" fill="#ff5d73"/>` +
    `<circle cx="50" cy="52" r="10" fill="#6ec6ff"/><circle cx="46" cy="48" r="3" fill="#fff" stroke="none"/>`,

  saturn:
    `<circle cx="50" cy="50" r="26" fill="#ffb347"/>` +
    `<ellipse cx="50" cy="52" rx="46" ry="13" fill="none" stroke-width="15" transform="rotate(-20 50 52)"/>` +
    `<ellipse cx="50" cy="52" rx="46" ry="13" fill="none" stroke="#b58cff" stroke-width="7" transform="rotate(-20 50 52)"/>` +
    eye(42, 42, 7) + eye(60, 40, 7) + smile(51, 52, 7),

  moon:
    `<path d="M64 8 C30 12 12 46 24 74 C36 98 76 98 92 72 C60 82 40 52 64 8Z" fill="#ffe48a"/>` +
    `<circle cx="38" cy="66" r="6" fill="#f0cc5a" stroke-width="3"/><circle cx="52" cy="82" r="4" fill="#f0cc5a" stroke-width="3"/>` +
    eye(40, 44, 8) + `<circle cx="30" cy="54" r="4" fill="#ffb3c1" stroke="none"/>`,

  sun:
    spikes(50, 50, 30, 48, 12, '#ffb627') +
    `<circle cx="50" cy="50" r="28" fill="#ffd23f"/>` + eye(40, 46, 7) + eye(60, 46, 7) + smile(50, 58, 10),

  star:
    `<path d="${star5(50, 54, 46, 21)}" fill="#ffd23f"/>` + eye(41, 50, 7) + eye(59, 50, 7) + smile(50, 62, 8),

  astronaut:
    `<path d="M14 98 C14 78 32 76 50 78 C68 76 86 78 86 98Z" fill="#fff"/>` +
    `<circle cx="50" cy="46" r="34" fill="#fff"/>` +
    `<ellipse cx="50" cy="48" rx="25" ry="21" fill="#3a4a8c"/>` +
    `<path d="M34 38 Q40 30 50 30" fill="none" stroke="#fff" stroke-width="4"/>` +
    eye(42, 52, 6) + eye(58, 52, 6) + `<rect x="44" y="84" width="12" height="8" rx="3" fill="#ff5d73" stroke-width="3"/>`,

  alien:
    `<path d="M36 28 L28 8 M64 28 L72 8" fill="none" stroke-width="4"/>` +
    `<circle cx="28" cy="8" r="5.5" fill="#ffd23f"/><circle cx="72" cy="8" r="5.5" fill="#ffd23f"/>` +
    `<ellipse cx="50" cy="54" rx="35" ry="31" fill="#7ddc5a"/>` +
    `<ellipse cx="36" cy="50" rx="10" ry="13" fill="${INK}" transform="rotate(-18 36 50)"/>` +
    `<ellipse cx="64" cy="50" rx="10" ry="13" fill="${INK}" transform="rotate(18 64 50)"/>` +
    `<circle cx="33" cy="46" r="3.5" fill="#fff" stroke="none"/><circle cx="61" cy="46" r="3.5" fill="#fff" stroke="none"/>` +
    smile(50, 72, 9),

  ufo:
    `<path d="M26 52 C26 14 74 14 74 52Z" fill="#bfe6ff"/>` +
    `<circle cx="50" cy="40" r="10" fill="#7ddc5a" stroke-width="3.5"/><circle cx="46" cy="38" r="2" fill="${INK}" stroke="none"/><circle cx="54" cy="38" r="2" fill="${INK}" stroke="none"/>` +
    `<ellipse cx="50" cy="58" rx="44" ry="15" fill="#a9b4c9"/>` +
    [22, 40, 58, 76].map((x, i) => `<circle cx="${x + (i === 3 ? 2 : -2)}" cy="60" r="4" fill="#ffd23f" stroke-width="2.5"/>`).join('') +
    `<path d="M38 74 L30 94 M50 76 L50 96 M62 74 L70 94" fill="none" stroke="#ffe48a" stroke-width="5"/>`,

  earth:
    `<circle cx="50" cy="50" r="38" fill="#4aa3ff"/>` +
    `<path d="M24 34 C30 22 46 22 44 34 C42 44 32 46 28 56 C20 50 18 42 24 34Z" fill="#3fb56b" stroke-width="3.5"/>` +
    `<path d="M62 54 C74 46 86 56 78 70 C72 80 60 76 58 66Z" fill="#3fb56b" stroke-width="3.5"/>` +
    eye(40, 46, 6) + eye(58, 46, 6) + smile(49, 60, 8),

  comet:
    `<path d="M72 30 C50 36 24 60 8 94 C34 84 64 66 82 44Z" fill="#ff9a3c"/>` +
    `<path d="M70 34 C52 42 34 60 22 80 C42 70 62 56 76 42Z" fill="#ffd23f" stroke="none"/>` +
    `<circle cx="74" cy="34" r="22" fill="#ffd23f"/>` + eye(68, 30, 7) + eye(84, 34, 6) + smile(76, 44, 7),

  mars:
    `<circle cx="50" cy="50" r="38" fill="#ff7d5a"/>` +
    `<ellipse cx="30" cy="68" rx="9" ry="6" fill="#d9573a" stroke-width="3"/><ellipse cx="74" cy="34" rx="7" ry="5" fill="#d9573a" stroke-width="3"/><ellipse cx="68" cy="72" rx="6" ry="4" fill="#d9573a" stroke-width="3"/>` +
    eye(38, 46, 7) + eye(60, 46, 7) + smile(49, 58, 7),

  satellite:
    `<g transform="rotate(-35 50 50)">` +
    `<rect x="2" y="38" width="30" height="24" rx="3" fill="#4a90e2"/><rect x="68" y="38" width="30" height="24" rx="3" fill="#4a90e2"/>` +
    `<path d="M12 38 V62 M22 38 V62 M78 38 V62 M88 38 V62" fill="none" stroke-width="3"/>` +
    `<rect x="32" y="46" width="36" height="8" fill="#a9b4c9"/>` +
    `<rect x="34" y="32" width="32" height="36" rx="8" fill="#fff"/>` +
    `<circle cx="50" cy="50" r="9" fill="#ffd23f"/><circle cx="50" cy="50" r="3.5" fill="${INK}" stroke="none"/>` +
    `<path d="M50 32 L50 18" fill="none" stroke-width="4"/><circle cx="50" cy="14" r="5" fill="#ff5d73"/></g>`,

  jupiter:
    `<clipPath id="jp"><circle cx="50" cy="50" r="38"/></clipPath>` +
    `<circle cx="50" cy="50" r="38" fill="#ffd9b0"/>` +
    `<g clip-path="url(#jp)" stroke="none"><rect x="0" y="20" width="100" height="12" fill="#e8a070"/><rect x="0" y="44" width="100" height="10" fill="#d98a5a"/><rect x="0" y="66" width="100" height="12" fill="#e8a070"/></g>` +
    `<ellipse cx="68" cy="62" rx="9" ry="6" fill="#e5484d" stroke-width="3"/>` +
    `<circle cx="50" cy="50" r="38" fill="none"/>` + eye(36, 40, 7) + eye(56, 38, 7) + smile(46, 54, 7),

  telescope:
    `<path d="M50 56 L28 94 M50 56 L72 94 M50 56 L50 94" fill="none" stroke-width="5"/>` +
    `<g transform="rotate(-28 50 46)">` +
    `<rect x="8" y="36" width="56" height="22" rx="4" fill="#4a90e2"/>` +
    `<rect x="60" y="30" width="30" height="34" rx="5" fill="#a9b4c9"/>` +
    `<path d="M26 36 V58 M44 36 V58" fill="none" stroke-width="3.5"/>` +
    `<ellipse cx="90" cy="47" rx="3" ry="14" fill="#bfe6ff" stroke-width="3"/></g>`,

  galaxy:
    `<circle cx="50" cy="50" r="42" fill="#3b2f8a" stroke-width="4"/>` +
    `<path d="M50 50 C50 40 62 38 66 48 C70 62 50 72 36 62 C20 50 28 26 50 22 C72 20 86 40 80 62" fill="none" stroke="#b58cff" stroke-width="9" stroke-linecap="round"/>` +
    `<path d="M50 50 C44 58 54 66 62 60" fill="none" stroke="#ff9fd0" stroke-width="6" stroke-linecap="round"/>` +
    `<circle cx="50" cy="50" r="9" fill="#ffd23f" stroke-width="3.5"/>` +
    [[22, 30, 2.4], [80, 24, 2], [18, 70, 2], [76, 82, 2.4], [86, 54, 1.8]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="none"/>`).join(''),
};

const back = `<svg viewBox="0 0 100 125" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <rect width="100" height="125" fill="#2e2a6b"/>
  ${[[14, 16, 2], [80, 12, 1.6], [30, 40, 1.4], [88, 52, 2.2], [12, 78, 2], [72, 98, 1.6], [40, 112, 1.4], [92, 112, 2], [58, 22, 1.2]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/>`).join('')}
  <g stroke="${INK}" stroke-width="4" stroke-linejoin="round">
    <path d="${star5(50, 64, 27, 12)}" fill="#ffd23f"/>
  </g>
  <ellipse cx="50" cy="64" rx="40" ry="10" fill="none" stroke="#b58cff" stroke-width="3" transform="rotate(-20 50 64)"/>
</svg>`;

export const space: Deck = { id: 'space', name: 'החלל', art, keys: Object.keys(art), back, frame: '#c3b5ff' };
