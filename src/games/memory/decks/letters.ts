import { INK, eye, smile, spikes, svg, thick } from './svg';

/** Extra pictures used only for the letter ↔ word cards (the rest are borrowed from the world decks). */
export const lettersArt: Record<string, string> = {
  lion:
    spikes(50, 52, 30, 48, 14, '#e0791a') + `<circle cx="50" cy="52" r="34" fill="#ff9a3c"/>` +
    `<circle cx="22" cy="28" r="9" fill="#ffd23f"/><circle cx="78" cy="28" r="9" fill="#ffd23f"/>` +
    `<circle cx="50" cy="56" r="25" fill="#ffd23f"/><ellipse cx="50" cy="64" rx="11" ry="8" fill="#fff3c4" stroke="none"/>` +
    `<path d="M44 58 L56 58 L50 65Z" fill="#ff7d9a" stroke-width="2.5"/>` + `<path d="M50 65 L50 70 M42 72 Q50 77 50 70 Q50 77 58 72" fill="none" stroke-width="2.5"/>` +
    eye(39, 48, 6) + eye(61, 48, 6),

  house:
    `<rect x="18" y="46" width="64" height="44" fill="#ffd8a8"/>` +
    `<path d="M8 50 L50 12 L92 50Z" fill="#e5484d"/>` +
    `<rect x="42" y="62" width="18" height="28" rx="3" fill="#8a5a3c"/>` +
    `<rect x="24" y="58" width="14" height="14" rx="2" fill="#bfe6ff"/><rect x="64" y="58" width="14" height="14" rx="2" fill="#bfe6ff"/>` +
    `<rect x="66" y="18" width="10" height="20" fill="#c96a4a"/>`,

  camel:
    `<circle cx="34" cy="38" r="13" fill="#d9a066"/><circle cx="58" cy="36" r="13" fill="#d9a066"/>` +
    `<path d="M26 74 V94 M38 76 V94 M62 76 V94 M74 74 V94" fill="none" stroke-width="7"/>` +
    `<ellipse cx="48" cy="62" rx="32" ry="18" fill="#e8b27a"/>` +
    thick('M76 58 C84 46 86 36 88 26', '#e8b27a', 13) +
    `<ellipse cx="88" cy="22" rx="11" ry="9" fill="#e8b27a"/><circle cx="92" cy="18" r="3" fill="${INK}" stroke="none"/>` +
    `<path d="M84 12 L82 6" fill="none" stroke-width="4"/>`,

  mountain:
    `<path d="M44 90 L74 40 L100 90Z" fill="#a3b4cf"/>` +
    `<path d="M2 90 L40 20 L80 90Z" fill="#7d8fb0"/>` +
    `<path d="M40 20 L54 46 L46 42 L40 52 L34 42 L26 46Z" fill="#fff"/>` +
    `<path d="M74 40 L82 54 L74 52 L68 54Z" fill="#fff" stroke-width="3.5"/>`,

  rose:
    thick('M50 56 C48 72 54 82 50 96', '#3fb56b', 6) +
    `<path d="M50 78 C66 66 80 74 82 82 C70 88 58 84 50 78Z" fill="#7ddc5a"/>` +
    `<circle cx="50" cy="34" r="28" fill="#ff4d6d"/>` +
    `<path d="M50 34 m0 0 a5 5 0 0 1 10 0 a10 10 0 0 1 -20 0 a16 16 0 0 1 32 0 a22 22 0 0 1 -44 0" fill="none" stroke="#c0203f" stroke-width="3.5"/>`,

  zebra:
    `<path d="M28 34 L22 12 L44 28Z" fill="#fff"/><path d="M72 34 L78 12 L56 28Z" fill="#fff"/>` +
    `<ellipse cx="50" cy="52" rx="28" ry="34" fill="#fff"/>` +
    `<path d="M26 34 L36 40 M24 50 L36 52 M26 66 L36 62 M74 34 L64 40 M76 50 L64 52 M74 66 L64 62 M44 20 L46 34 M56 20 L54 34" fill="none" stroke-width="6"/>` +
    `<ellipse cx="50" cy="76" rx="18" ry="13" fill="#6b6b73"/>` +
    `<ellipse cx="43" cy="76" rx="2.5" ry="3.5" fill="#fff" stroke="none"/><ellipse cx="57" cy="76" rx="2.5" ry="3.5" fill="#fff" stroke="none"/>` +
    eye(38, 48, 7) + eye(62, 48, 7),

  phone:
    `<rect x="26" y="6" width="48" height="88" rx="10" fill="#4a90e2"/>` +
    `<rect x="32" y="16" width="36" height="58" rx="3" fill="#cfe8ff" stroke-width="3.5"/>` +
    [[40, 26, '#ff5d73'], [50, 26, '#ffd23f'], [60, 26, '#3fb56b'], [40, 38, '#b57bff'], [50, 38, '#ff9a3c'], [60, 38, '#ff5d73']].map(([x, y, c]) => `<rect x="${(x as number) - 4}" y="${(y as number) - 4}" width="8" height="8" rx="2.5" fill="${c}" stroke-width="2.5"/>`).join('') +
    `<circle cx="50" cy="84" r="5" fill="#fff" stroke-width="3"/>`,

  hand:
    `<rect x="16" y="42" width="14" height="38" rx="7" fill="#ffcf9e" transform="rotate(-24 23 61)"/>` +
    [[30, 8, 0], [44, 4, 0], [58, 8, 0], [72, 18, 14]].map(([x, y, r]) => `<rect x="${x}" y="${y}" width="14" height="50" rx="7" fill="#ffcf9e" transform="rotate(${r} ${(x as number) + 7} 58)"/>`).join('') +
    `<rect x="26" y="46" width="56" height="46" rx="18" fill="#ffcf9e" stroke="none"/>` +
    `<path d="M26 60 V80 Q26 92 40 92 H68 Q82 92 82 78 V62" fill="none"/>`,

  heart:
    `<path d="M50 90 C14 62 4 42 12 26 C22 10 44 14 50 30 C56 14 78 10 88 26 C96 42 86 62 50 90Z" fill="#ff4d6d"/>` +
    `<path d="M24 30 Q28 22 36 22" fill="none" stroke="#ffb3c1" stroke-width="5"/>` + eye(38, 44, 7) + eye(62, 44, 7) + smile(50, 58, 9),

  airplane:
    `<path d="M18 50 L6 24 L32 44Z" fill="#e5484d"/>` +
    `<path d="M44 54 L70 14 L84 18 L72 58Z" fill="#4a90e2"/>` +
    `<ellipse cx="50" cy="58" rx="44" ry="15" fill="#fff"/>` +
    `<path d="M80 50 Q96 56 90 64" fill="none" stroke-width="3"/>` +
    [[28, 57], [42, 57], [56, 57]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.5" fill="#bfe6ff" stroke-width="3"/>`).join('') +
    `<path d="M40 70 L62 80" fill="none" stroke-width="5"/>`,

  snake:
    thick('M18 90 C12 68 74 74 76 50 C78 28 22 34 34 18', '#7ddc5a', 15) +
    `<path d="M30 70 L36 76 M58 66 L64 70 M64 40 L58 36 M40 32 L46 38" fill="none" stroke="#3fb56b" stroke-width="5"/>` +
    `<circle cx="34" cy="20" r="14" fill="#7ddc5a"/>` + eye(28, 16, 5) + eye(40, 16, 5) +
    `<path d="M34 34 L34 44 M34 44 L29 50 M34 44 L39 50" fill="none" stroke="#ff5d73" stroke-width="3.5"/>`,

  tree:
    `<rect x="42" y="56" width="16" height="38" rx="4" fill="#8a5a3c"/>` +
    `<circle cx="30" cy="48" r="22" fill="#3fb56b"/><circle cx="70" cy="48" r="22" fill="#3fb56b"/><circle cx="50" cy="28" r="24" fill="#4cc77a"/>` +
    [[34, 44], [62, 30], [74, 52], [48, 52]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#ff5d73" stroke-width="3"/>`).join(''),

  monkey:
    `<circle cx="14" cy="50" r="13" fill="#8a5a3c"/><circle cx="86" cy="50" r="13" fill="#8a5a3c"/>` +
    `<circle cx="14" cy="50" r="6" fill="#f2d2b0" stroke="none"/><circle cx="86" cy="50" r="6" fill="#f2d2b0" stroke="none"/>` +
    `<circle cx="50" cy="48" r="34" fill="#8a5a3c"/>` +
    `<path d="M24 40 C24 30 40 36 50 46 C60 36 76 30 76 40 C80 56 70 76 50 78 C30 76 20 56 24 40Z" fill="#f2d2b0"/>` +
    `<ellipse cx="50" cy="66" rx="14" ry="10" fill="#e8b88e" stroke="none"/><circle cx="45" cy="63" r="2" fill="${INK}" stroke="none"/><circle cx="55" cy="63" r="2" fill="${INK}" stroke="none"/>` +
    smile(50, 70, 9) + eye(38, 44, 7) + eye(62, 44, 7),

  train:
    `<circle cx="22" cy="14" r="7" fill="#e8eef7"/><circle cx="32" cy="8" r="5" fill="#e8eef7"/>` +
    `<rect x="12" y="22" width="14" height="22" fill="#3a2f4b"/>` +
    `<path d="M8 42 H62 V76 H8Z" fill="#e5484d"/>` +
    `<path d="M50 28 H90 V76 H50Z" fill="#4a90e2"/>` +
    `<rect x="58" y="36" width="24" height="16" rx="3" fill="#cfe8ff" stroke-width="3.5"/>` +
    `<path d="M4 80 H94" fill="none" stroke-width="5"/>` +
    [[24, 80], [44, 80], [72, 80]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#ffd23f" stroke-width="4"/>`).join(''),

  flower:
    thick('M50 52 C50 70 46 82 50 96', '#3fb56b', 6) +
    `<path d="M50 80 C34 70 22 76 20 84 C32 90 44 88 50 80Z" fill="#7ddc5a" stroke-width="3.5"/>` +
    [0, 72, 144, 216, 288].map((a) => `<circle cx="50" cy="20" r="14" fill="#ff9fd0" transform="rotate(${a} 50 36)"/>`).join('') +
    `<circle cx="50" cy="36" r="11" fill="#ffd23f"/>` + eye(46, 34, 3.5) + eye(55, 34, 3.5),

  apple:
    `<path d="M50 28 C60 8 80 20 86 44 C90 68 70 92 50 88 C30 92 10 68 14 44 C20 20 40 8 50 28Z" fill="#ff4d4d"/>` +
    `<path d="M50 28 L52 12" fill="none" stroke-width="5"/>` +
    `<path d="M52 20 C64 4 80 10 80 10 C78 24 62 28 52 20Z" fill="#7ddc5a" stroke-width="3.5"/>` +
    `<path d="M26 44 Q28 34 36 30" fill="none" stroke="#ffb3b3" stroke-width="5"/>` + eye(38, 52, 6) + eye(60, 52, 6) + smile(49, 66, 7),
};

export interface LetterEntry { letter: string; word: string; /** "deck:key" picture */ art: string }

/** 22 letters, each with a simple first-grade word that has a picture. */
export const LETTERS: LetterEntry[] = [
  { letter: 'א', word: 'אריה', art: 'letters:lion' },
  { letter: 'ב', word: 'בית', art: 'letters:house' },
  { letter: 'ג', word: 'גמל', art: 'letters:camel' },
  { letter: 'ד', word: 'דג', art: 'sea:fish' },
  { letter: 'ה', word: 'הר', art: 'letters:mountain' },
  { letter: 'ו', word: 'ורד', art: 'letters:rose' },
  { letter: 'ז', word: 'זברה', art: 'letters:zebra' },
  { letter: 'ח', word: 'חתול', art: 'farm:cat' },
  { letter: 'ט', word: 'טלפון', art: 'letters:phone' },
  { letter: 'י', word: 'יד', art: 'letters:hand' },
  { letter: 'כ', word: 'כוכב', art: 'space:star' },
  { letter: 'ל', word: 'לב', art: 'letters:heart' },
  { letter: 'מ', word: 'מטוס', art: 'letters:airplane' },
  { letter: 'נ', word: 'נחש', art: 'letters:snake' },
  { letter: 'ס', word: 'סוס', art: 'farm:horse' },
  { letter: 'ע', word: 'עץ', art: 'letters:tree' },
  { letter: 'פ', word: 'פרח', art: 'letters:flower' },
  { letter: 'צ', word: 'צב', art: 'sea:turtle' },
  { letter: 'ק', word: 'קוף', art: 'letters:monkey' },
  { letter: 'ר', word: 'רכבת', art: 'letters:train' },
  { letter: 'ש', word: 'שמש', art: 'space:sun' },
  { letter: 'ת', word: 'תפוח', art: 'letters:apple' },
];

export const lettersSvg = (key: string): string => svg(lettersArt[key]);
