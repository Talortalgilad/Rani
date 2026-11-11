import { INK, eye, smile, type Deck } from './svg';

const art: Record<string, string> = {
  lollipop:
    `<rect x="45" y="58" width="10" height="36" rx="4" fill="#fff"/>` +
    `<circle cx="50" cy="36" r="30" fill="#ff8fab"/>` +
    `<path d="M50 36 a4 4 0 0 1 8 0 a10 10 0 0 1 -20 0 a17 17 0 0 1 34 0 a24 24 0 0 1 -48 0" fill="none" stroke="#fff" stroke-width="5.5"/>`,

  candy:
    `<path d="M30 50 L6 32 L6 68Z" fill="#ffd23f"/><path d="M70 50 L94 32 L94 68Z" fill="#ffd23f"/>` +
    `<ellipse cx="50" cy="50" rx="26" ry="20" fill="#ff5d73"/>` +
    `<path d="M32 38 Q40 50 32 62 M68 38 Q60 50 68 62" fill="none" stroke="#fff" stroke-width="5"/>` +
    eye(42, 46, 6) + eye(58, 46, 6) + smile(50, 56, 6),

  cupcake:
    `<path d="M20 54 L80 54 L72 92 L28 92Z" fill="#ffb347"/>` +
    `<path d="M34 56 L37 90 M50 56 L50 90 M66 56 L63 90" fill="none" stroke="#e0791a" stroke-width="3"/>` +
    `<ellipse cx="50" cy="52" rx="36" ry="14" fill="#ff9fc4"/>` +
    `<ellipse cx="50" cy="38" rx="25" ry="13" fill="#ffb8d6"/>` +
    `<ellipse cx="50" cy="26" rx="14" ry="10" fill="#ffd0e6"/>` +
    `<circle cx="50" cy="14" r="6" fill="#ff3d5a" stroke-width="3.5"/>` +
    eye(40, 72, 6) + eye(60, 72, 6) + smile(50, 82, 6),

  icecream:
    `<path d="M26 52 L74 52 L50 96Z" fill="#e8b27a"/>` +
    `<path d="M33 62 L56 62 M40 74 L60 74 M32 52 L58 88 M68 52 L44 88" fill="none" stroke="#c98a4a" stroke-width="3"/>` +
    `<circle cx="50" cy="30" r="22" fill="#9ae6c8"/>` +
    `<ellipse cx="50" cy="52" rx="28" ry="12" fill="#ff9fc4"/>` +
    `<circle cx="50" cy="8" r="5.5" fill="#ff3d5a" stroke-width="3"/>` +
    eye(42, 28, 6) + eye(58, 28, 6) + smile(50, 38, 6),

  donut:
    `<circle cx="50" cy="50" r="40" fill="#f2c28a"/>` +
    `<path d="M50 16 C70 14 84 30 84 50 C84 72 68 86 50 84 C30 86 16 70 16 50 C16 30 30 14 50 16Z" fill="#ff8fab" stroke-width="3.5"/>` +
    `<circle cx="50" cy="50" r="13" fill="#fff"/>` +
    [[30, 32, 20, '#fff'], [68, 30, -30, '#ffd23f'], [76, 54, 60, '#6ec6ff'], [64, 72, 10, '#fff'], [34, 70, -50, '#ffd23f'], [22, 52, 80, '#6ec6ff']]
      .map(([x, y, r, c]) => `<rect x="${(x as number) - 6}" y="${(y as number) - 2}" width="12" height="4.5" rx="2" fill="${c}" stroke="none" transform="rotate(${r} ${x} ${y})"/>`).join(''),

  cookie:
    `<circle cx="50" cy="50" r="38" fill="#d9a066"/>` +
    [[32, 30, 6], [66, 28, 5], [74, 56, 6], [60, 76, 5], [28, 66, 6]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${(r as number) * 0.8}" fill="#6b4226" stroke-width="2.5"/>`).join('') +
    eye(40, 46, 7) + eye(60, 46, 7) + smile(50, 60, 9),

  cake:
    `<path d="M8 52 L92 52 L92 90 L8 90Z" fill="#ffe0b0"/>` +
    `<path d="M8 70 H92" fill="none" stroke="#ff8fab" stroke-width="7"/>` +
    `<path d="M8 52 Q8 38 22 38 L78 38 Q92 38 92 52 Q82 62 72 52 Q62 62 52 52 Q42 62 32 52 Q22 62 8 52Z" fill="#fff"/>` +
    `<circle cx="50" cy="28" r="8" fill="#ff3d5a" stroke-width="3.5"/><path d="M50 20 Q54 12 60 12" fill="none" stroke-width="3"/>` +
    eye(36, 80, 6) + eye(64, 80, 6),

  gummy:
    `<circle cx="32" cy="14" r="9" fill="#ff5d73"/><circle cx="68" cy="14" r="9" fill="#ff5d73"/>` +
    `<ellipse cx="22" cy="58" rx="9" ry="16" fill="#ff5d73" transform="rotate(25 22 58)"/><ellipse cx="78" cy="58" rx="9" ry="16" fill="#ff5d73" transform="rotate(-25 78 58)"/>` +
    `<ellipse cx="34" cy="86" rx="11" ry="9" fill="#ff5d73"/><ellipse cx="66" cy="86" rx="11" ry="9" fill="#ff5d73"/>` +
    `<ellipse cx="50" cy="66" rx="24" ry="26" fill="#ff5d73"/>` +
    `<circle cx="50" cy="30" r="22" fill="#ff5d73"/>` +
    `<path d="M36 60 Q34 72 40 80" fill="none" stroke="#ffb3be" stroke-width="5"/>` +
    eye(42, 28, 6) + eye(58, 28, 6) + smile(50, 38, 6),

  cane:
    `<path d="M66 92 L66 40 C66 12 30 12 30 42" fill="none" stroke="${INK}" stroke-width="26"/>` +
    `<path d="M66 92 L66 40 C66 12 30 12 30 42" fill="none" stroke="#fff" stroke-width="17"/>` +
    `<path d="M66 92 L66 40 C66 12 30 12 30 42" fill="none" stroke="#ff5d73" stroke-width="17" stroke-dasharray="8 13"/>`,

  chocolate:
    `<g transform="rotate(-12 50 50)">` +
    `<rect x="22" y="8" width="56" height="84" rx="8" fill="#8a5a3c"/>` +
    `<path d="M22 36 H78 M22 64 H78 M50 8 V40" fill="none" stroke="#6b4226" stroke-width="3.5"/>` +
    `<path d="M22 52 H78 V84 Q78 92 70 92 H30 Q22 92 22 84Z" fill="#ff5d73"/>` +
    `<path d="M22 52 L34 58 L48 50 L62 58 L78 52" fill="none" stroke-width="3.5"/>` +
    `<circle cx="50" cy="74" r="8" fill="#ffd23f" stroke-width="3"/></g>` + eye(42, 24, 6) + eye(58, 22, 6),

  popsicle:
    `<rect x="44" y="66" width="12" height="28" rx="5" fill="#f5d6b0"/>` +
    `<path d="M26 40 C26 14 74 14 74 40 L74 66 L26 66Z" fill="#3aa0ff"/>` +
    `<path d="M26 40 C26 14 74 14 74 40 L74 48 Q62 40 50 48 Q38 40 26 48Z" fill="#ff9fd0" stroke="none"/>` +
    `<path d="M26 40 C26 14 74 14 74 40 L74 66 L26 66Z" fill="none"/>` +
    `<path d="M34 28 Q38 20 46 20" fill="none" stroke="#fff" stroke-width="4"/>` + eye(42, 54, 6) + eye(58, 54, 6),

  cottoncandy:
    `<path d="M32 62 L68 62 L58 94 L42 94Z" fill="#fff"/><path d="M38 62 L45 94 M50 62 L50 94 M62 62 L55 94" fill="none" stroke="#ff8fab" stroke-width="3.5"/>` +
    [[30, 44, 18, '#ffb3d9'], [70, 44, 18, '#a6d8ff'], [50, 24, 20, '#ffb3d9'], [50, 48, 22, '#d6c0ff'], [36, 26, 13, '#a6d8ff'], [64, 26, 13, '#ffd3ea']]
      .map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke-width="3.5"/>`).join('') +
    eye(42, 46, 6) + eye(58, 46, 6) + smile(50, 56, 6),

  macaron:
    `<ellipse cx="50" cy="36" rx="36" ry="20" fill="#ffa6c9"/>` +
    `<path d="M16 50 Q50 60 84 50 L82 62 Q50 72 18 62Z" fill="#fff4d6"/>` +
    `<ellipse cx="50" cy="72" rx="34" ry="16" fill="#ffa6c9"/>` +
    `<path d="M20 38 Q50 22 80 38" fill="none" stroke="#ffd0e6" stroke-width="4"/>` + eye(40, 40, 6) + eye(60, 40, 6) + smile(50, 46, 6),

  jellybeans:
    `<ellipse cx="32" cy="38" rx="22" ry="14" fill="#ff5d73" transform="rotate(-30 32 38)"/>` +
    `<ellipse cx="68" cy="44" rx="22" ry="14" fill="#7ddc5a" transform="rotate(25 68 44)"/>` +
    `<ellipse cx="48" cy="76" rx="22" ry="14" fill="#ffd23f" transform="rotate(-8 48 76)"/>` +
    `<path d="M20 34 Q26 26 34 26" fill="none" stroke="#ffb3be" stroke-width="4"/><path d="M58 38 Q66 32 74 34" fill="none" stroke="#c8f5b4" stroke-width="4"/>` +
    eye(44, 74, 5) + eye(58, 74, 5),

  strawberry:
    `<path d="M50 90 C20 70 10 44 22 30 C34 18 44 26 50 26 C56 26 66 18 78 30 C90 44 80 70 50 90Z" fill="#ff4d5a"/>` +
    `<path d="M50 28 C42 18 30 18 26 26 C36 30 44 30 50 28Z M50 28 C58 18 70 18 74 26 C64 30 56 30 50 28Z M50 28 L50 14" fill="#7ddc5a" stroke-width="3.5"/>` +
    [[34, 46], [66, 46], [42, 64], [58, 64], [50, 78]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.2" ry="3.2" fill="#ffd23f" stroke="none"/>`).join('') +
    eye(40, 44, 6) + eye(60, 44, 6) + smile(50, 56, 7),
};

const back = `<svg viewBox="0 0 100 125" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <rect width="100" height="125" fill="#ff8fab"/>
  ${Array.from({ length: 8 }, (_, i) => `<path d="M${-30 + i * 24} 125 L${10 + i * 24} 0" stroke="#fff" stroke-width="9" opacity=".75"/>`).join('')}
  <circle cx="50" cy="62" r="22" fill="#fff" stroke="${INK}" stroke-width="4"/>
  <path d="M50 62 a3 3 0 0 1 6 0 a8 8 0 0 1 -16 0 a13 13 0 0 1 26 0" fill="none" stroke="#ff5d73" stroke-width="4.5"/>
</svg>`;

export const sweets: Deck = { id: 'sweets', name: 'הממתקים', art, keys: Object.keys(art), back, frame: '#ffc0d3' };
