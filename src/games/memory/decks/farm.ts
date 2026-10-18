import { INK, eye, nostrils, svg, type Deck } from './svg';

const art: Record<string, string> = {
  cow:
    `<ellipse cx="14" cy="42" rx="11" ry="7" fill="#f3f0ea" transform="rotate(-25 14 42)"/>` +
    `<ellipse cx="86" cy="42" rx="11" ry="7" fill="#f3f0ea" transform="rotate(25 86 42)"/>` +
    `<path d="M30 28 L26 10 L42 22Z" fill="#f4d9a0"/><path d="M70 28 L74 10 L58 22Z" fill="#f4d9a0"/>` +
    `<ellipse cx="50" cy="52" rx="31" ry="30" fill="#fff"/>` +
    `<path d="M22 46 C20 32 34 24 46 28 C44 38 34 46 22 46Z" fill="#5a4a42" stroke="none"/>` +
    `<ellipse cx="50" cy="73" rx="21" ry="14" fill="#ffb3c1"/>` +
    nostrils(42, 58, 73) + eye(37, 49) + eye(63, 49),

  pig:
    `<path d="M24 32 L16 12 L42 24Z" fill="#ff9fb5"/><path d="M76 32 L84 12 L58 24Z" fill="#ff9fb5"/>` +
    `<circle cx="50" cy="54" r="35" fill="#ffb3c8"/>` +
    `<ellipse cx="50" cy="66" rx="17" ry="13" fill="#ff8fab"/>` +
    nostrils(43, 57, 66, 2.8, 5) + eye(35, 45) + eye(65, 45),

  chicken:
    `<path d="M36 24 C30 8 44 4 48 18 C50 2 64 4 60 20 C68 12 76 24 64 30Z" fill="#ff5d73"/>` +
    `<circle cx="50" cy="56" r="34" fill="#fff"/>` +
    `<ellipse cx="50" cy="80" rx="6" ry="9" fill="#ff5d73"/>` +
    `<path d="M40 56 L60 56 L50 72Z" fill="#ffb627"/>` + eye(36, 46) + eye(64, 46),

  sheep:
    `<ellipse cx="22" cy="60" rx="11" ry="6" fill="#5b4a55" transform="rotate(20 22 60)"/>` +
    `<ellipse cx="78" cy="60" rx="11" ry="6" fill="#5b4a55" transform="rotate(-20 78 60)"/>` +
    [[29, 36], [42, 24], [58, 24], [71, 36], [77, 52], [69, 68], [31, 68], [23, 52], [50, 44]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="14" fill="#fff9ef"/>`).join('') +
    `<ellipse cx="50" cy="60" rx="21" ry="26" fill="#5b4a55"/>` +
    `<ellipse cx="50" cy="76" rx="7" ry="5" fill="#ffb3c1" stroke-width="3"/>` + eye(40, 54, 8) + eye(60, 54, 8),

  horse:
    `<path d="M32 26 L28 6 L46 20Z" fill="#b5764a"/><path d="M68 26 L72 6 L54 20Z" fill="#b5764a"/>` +
    `<path d="M30 24 C36 4 64 4 70 24 L62 34 L38 34Z" fill="#5a3b2a"/>` +
    `<path d="M30 28 C30 20 70 20 70 28 C75 52 71 70 64 84 C58 95 42 95 36 84 C29 70 25 52 30 28Z" fill="#c98a5a"/>` +
    `<path d="M42 22 C46 38 54 38 58 22 C54 17 46 17 42 22Z" fill="#5a3b2a"/>` +
    `<ellipse cx="50" cy="79" rx="17" ry="13" fill="#f2d2b0"/>` + nostrils(43, 57, 79) + eye(38, 52, 8) + eye(62, 52, 8),

  duck:
    `<path d="M46 24 C42 10 56 8 54 24Z" fill="#ffd23f"/>` +
    `<circle cx="50" cy="54" r="34" fill="#ffd23f"/>` +
    `<ellipse cx="50" cy="68" rx="22" ry="12" fill="#ff9a3c"/>` +
    `<path d="M30 68 Q50 75 70 68" fill="none" stroke-width="3"/>` + eye(36, 44) + eye(64, 44),

  rabbit:
    `<ellipse cx="35" cy="26" rx="10" ry="24" fill="#fff" transform="rotate(-8 35 26)"/>` +
    `<ellipse cx="65" cy="26" rx="10" ry="24" fill="#fff" transform="rotate(8 65 26)"/>` +
    `<ellipse cx="35" cy="28" rx="4.5" ry="15" fill="#ffb3c1" stroke="none" transform="rotate(-8 35 28)"/>` +
    `<ellipse cx="65" cy="28" rx="4.5" ry="15" fill="#ffb3c1" stroke="none" transform="rotate(8 65 28)"/>` +
    `<circle cx="50" cy="63" r="29" fill="#fff"/>` +
    `<rect x="45.5" y="76" width="9" height="9" rx="2" fill="#fff" stroke-width="2.5"/>` +
    `<ellipse cx="50" cy="69" rx="5.5" ry="4" fill="#ff7d9a" stroke-width="2.5"/>` +
    `<path d="M50 73 L50 77 M43 77 Q50 82 50 77 Q50 82 57 77" fill="none" stroke-width="2.5"/>` +
    `<path d="M16 66 L32 68 M16 76 L32 73 M84 66 L68 68 M84 76 L68 73" fill="none" stroke-width="2.5"/>` +
    eye(38, 57, 8) + eye(62, 57, 8),

  goat:
    `<g transform="translate(10 7) scale(.8)">` +
    `<path d="M38 34 C20 30 16 10 30 2" fill="none" stroke-width="15"/><path d="M38 34 C20 30 16 10 30 2" fill="none" stroke="#f2e3c3" stroke-width="8"/>` +
    `<path d="M62 34 C80 30 84 10 70 2" fill="none" stroke-width="15"/><path d="M62 34 C80 30 84 10 70 2" fill="none" stroke="#f2e3c3" stroke-width="8"/>` +
    `<path d="M26 22 L34 24 M24 14 L32 17 M74 22 L66 24 M76 14 L68 17" fill="none" stroke-width="3"/>` +
    `<ellipse cx="14" cy="50" rx="13" ry="6" fill="#a8743f" transform="rotate(25 14 50)"/>` +
    `<ellipse cx="86" cy="50" rx="13" ry="6" fill="#a8743f" transform="rotate(-25 86 50)"/>` +
    `<path d="M26 36 C28 28 72 28 74 36 C78 56 70 74 62 82 C56 88 44 88 38 82 C30 74 22 56 26 36Z" fill="#c99a68"/>` +
    `<ellipse cx="50" cy="72" rx="14" ry="11" fill="#f1dfc8"/>` + nostrils(45, 55, 72, 2, 3) +
    `<path d="M32 78 C32 98 42 106 50 108 C58 106 68 98 68 78 Q50 88 32 78Z" fill="#fff"/>` +
    `<path d="M42 92 L50 104 L58 92" fill="none" stroke-width="3"/>` + eye(38, 52) + eye(62, 52) + `</g>`,

  dog:
    `<ellipse cx="17" cy="50" rx="12" ry="22" fill="#8a5a3c" transform="rotate(12 17 50)"/>` +
    `<ellipse cx="83" cy="50" rx="12" ry="22" fill="#8a5a3c" transform="rotate(-12 83 50)"/>` +
    `<circle cx="50" cy="54" r="31" fill="#e8b27a"/>` +
    `<ellipse cx="66" cy="45" rx="11" ry="13" fill="#8a5a3c" stroke="none"/>` +
    `<ellipse cx="50" cy="69" rx="17" ry="12" fill="#f7e3c8"/>` +
    `<path d="M45 73 L45 85 Q50 91 55 85 L55 73Z" fill="#ff7d9a"/>` +
    `<path d="M50 68 L50 74 M40 73 Q45 77 50 74 Q55 77 60 73" fill="none" stroke-width="3"/>` +
    `<ellipse cx="50" cy="62" rx="7.5" ry="5.5" fill="${INK}"/>` + eye(37, 46) + eye(63, 46),

  cat:
    `<path d="M20 42 L18 8 L47 26Z" fill="#ff9a3c"/><path d="M80 42 L82 8 L53 26Z" fill="#ff9a3c"/>` +
    `<path d="M25 34 L24 18 L38 28Z" fill="#ffb3c1" stroke="none"/><path d="M75 34 L76 18 L62 28Z" fill="#ffb3c1" stroke="none"/>` +
    `<ellipse cx="50" cy="58" rx="35" ry="31" fill="#ff9a3c"/>` +
    `<path d="M50 30 L50 40 M39 32 L42 40 M61 32 L58 40" fill="none" stroke="#c96a12" stroke-width="3.5"/>` +
    `<ellipse cx="50" cy="72" rx="13" ry="9" fill="#ffe2c4" stroke="none"/>` +
    `<path d="M45 66 L55 66 L50 72Z" fill="#ff7d9a" stroke-width="2.5"/>` +
    `<path d="M50 72 L50 76 M42 78 Q50 82 50 76 Q50 82 58 78" fill="none" stroke-width="2.5"/>` +
    `<path d="M10 68 L28 70 M10 78 L28 75 M90 68 L72 70 M90 78 L72 75" fill="none" stroke-width="2.5"/>` +
    eye(36, 54, 8.5) + eye(64, 54, 8.5),

  donkey:
    `<ellipse cx="30" cy="22" rx="9" ry="20" fill="#9a928c" transform="rotate(-14 30 22)"/>` +
    `<ellipse cx="70" cy="22" rx="9" ry="20" fill="#9a928c" transform="rotate(14 70 22)"/>` +
    `<ellipse cx="30" cy="24" rx="4" ry="12" fill="#f0c9c0" stroke="none" transform="rotate(-14 30 24)"/>` +
    `<ellipse cx="70" cy="24" rx="4" ry="12" fill="#f0c9c0" stroke="none" transform="rotate(14 70 24)"/>` +
    `<path d="M28 36 C28 30 72 30 72 36 C77 56 71 74 64 86 C58 94 42 94 36 86 C29 74 23 56 28 36Z" fill="#b3aca6"/>` +
    `<path d="M40 32 C44 22 56 22 60 32 C56 38 44 38 40 32Z" fill="#6f6862"/>` +
    `<ellipse cx="50" cy="77" rx="18" ry="14" fill="#f3ece4"/>` + nostrils(43, 57, 77) + eye(37, 54, 8) + eye(63, 54, 8),

  barn:
    `<path d="M10 48 L50 14 L90 48 L90 90 L10 90Z" fill="#e5484d"/>` +
    `<path d="M6 50 L50 12 L94 50" fill="none" stroke-width="7"/>` +
    `<circle cx="50" cy="38" r="9" fill="#ffe9a8"/>` +
    `<rect x="31" y="58" width="38" height="32" fill="#fff"/>` +
    `<path d="M31 58 L69 90 M69 58 L31 90" fill="none" stroke-width="3.5"/>`,
};

/** Grass-green card back with a flower, as in the farm world. */
const back = `<svg viewBox="0 0 100 125" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <rect width="100" height="125" fill="#8bd45b"/>
  <path d="M0 40 Q25 32 50 40 T100 40 V56 Q75 48 50 56 T0 56Z" fill="#7ac74f"/>
  <path d="M0 78 Q25 70 50 78 T100 78 V94 Q75 86 50 94 T0 94Z" fill="#7ac74f"/>
  <g stroke="${INK}" stroke-width="4" stroke-linejoin="round">
    ${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="50" cy="49" rx="9" ry="13" fill="#fff" transform="rotate(${a} 50 62)"/>`).join('')}
    <circle cx="50" cy="62" r="9" fill="#ffd23f"/>
  </g>
  <path d="M0 125 L8 108 L16 125 L24 106 L32 125 L40 108 L48 125 L56 106 L64 125 L72 108 L80 125 L88 106 L96 125Z" fill="#5faa3a"/>
</svg>`;

export const farm: Deck = {
  id: 'farm',
  name: 'החווה',
  art,
  keys: Object.keys(art),
  back,
  frame: '#ffd8a8',
};

export const farmSvg = (key: string): string => svg(art[key]);
