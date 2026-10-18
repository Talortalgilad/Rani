import { INK, eye, smile, spikes, star5, thick, type Deck } from './svg';

const art: Record<string, string> = {
  fish:
    `<path d="M76 50 L96 32 L96 68Z" fill="#ff7d3c"/>` +
    `<path d="M38 28 Q50 10 64 28Z" fill="#ff7d3c"/>` +
    `<ellipse cx="46" cy="52" rx="36" ry="26" fill="#ff9a3c"/>` +
    `<path d="M54 30 Q58 52 54 74 M66 34 Q69 52 66 70" fill="none" stroke="#fff" stroke-width="5"/>` +
    eye(28, 46, 9) + `<path d="M12 58 Q19 63 26 59" fill="none" stroke-width="3.5"/>`,

  tang:
    `<path d="M78 50 L96 36 L96 64Z" fill="#ffd23f"/>` +
    `<path d="M34 24 Q52 6 70 26Z" fill="#ffd23f"/>` +
    `<circle cx="48" cy="52" r="32" fill="#3aa0ff"/>` +
    `<path d="M58 22 Q70 52 58 82" fill="none" stroke="#ffd23f" stroke-width="12"/>` +
    eye(34, 46, 9) + smile(30, 66, 8),

  whale:
    `<path d="M50 30 L50 18 M50 18 Q42 4 34 10 M50 18 Q58 4 66 10" fill="none" stroke="#6ec6ff" stroke-width="5"/>` +
    `<path d="M84 52 C96 46 98 34 92 26 C90 40 82 44 76 46Z" fill="#4a90e2"/>` +
    `<path d="M8 64 C8 38 34 30 60 34 C84 36 94 50 90 64 C86 78 68 86 46 86 C22 86 8 78 8 64Z" fill="#4a90e2"/>` +
    `<path d="M14 68 C30 80 68 82 86 70 C82 80 66 86 46 86 C28 86 16 78 14 68Z" fill="#cfe8ff" stroke="none"/>` +
    eye(30, 56, 8) + smile(26, 70, 9),

  octopus:
    thick('M30 60 C18 74 28 88 20 92', '#a66bff', 11) + thick('M42 66 C38 80 46 90 40 94', '#a66bff', 11) +
    thick('M58 66 C62 80 54 90 60 94', '#a66bff', 11) + thick('M70 60 C82 74 72 88 80 92', '#a66bff', 11) +
    `<ellipse cx="50" cy="42" rx="31" ry="30" fill="#a66bff"/>` +
    `<circle cx="34" cy="26" r="4" fill="#c9a6ff" stroke="none"/><circle cx="64" cy="24" r="3" fill="#c9a6ff" stroke="none"/>` +
    eye(38, 46, 9) + eye(62, 46, 9) + smile(50, 62, 9),

  crab:
    `<path d="M20 64 L8 74 M24 72 L14 86 M80 64 L92 74 M76 72 L86 86" fill="none" stroke-width="5"/>` +
    `<path d="M26 54 L14 36 M74 54 L86 36" fill="none" stroke-width="6"/>` +
    `<path d="M14 36 C0 34 0 14 12 12 C14 20 20 22 24 24 C20 28 18 32 14 36Z" fill="#ff5d5d"/>` +
    `<path d="M86 36 C100 34 100 14 88 12 C86 20 80 22 76 24 C80 28 82 32 86 36Z" fill="#ff5d5d"/>` +
    `<path d="M38 40 L38 30 M62 40 L62 30" fill="none" stroke-width="4"/>` +
    `<ellipse cx="50" cy="62" rx="33" ry="24" fill="#ff5d5d"/>` +
    eye(38, 28, 8) + eye(62, 28, 8) + smile(50, 66, 11),

  starfish:
    `<path d="${star5(50, 54, 46, 21)}" fill="#ffb347"/>` +
    [[50, 30], [38, 56], [62, 56], [50, 70]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#e0791a" stroke="none"/>`).join('') +
    eye(42, 48, 7) + eye(58, 48, 7) + smile(50, 62, 7),

  jellyfish:
    thick('M32 56 C26 68 38 74 30 88', '#ff9fd0', 7) + thick('M44 58 C40 70 50 78 44 92', '#ff9fd0', 7) +
    thick('M56 58 C60 70 50 78 56 92', '#ff9fd0', 7) + thick('M68 56 C74 68 62 74 70 88', '#ff9fd0', 7) +
    `<path d="M16 58 C14 14 86 14 84 58 Q67 50 50 58 Q33 50 16 58Z" fill="#ff9fd0"/>` +
    `<circle cx="34" cy="26" r="4" fill="#ffd0e8" stroke="none"/>` + eye(38, 42, 8) + eye(62, 42, 8) + smile(50, 52, 7),

  turtle:
    `<ellipse cx="18" cy="72" rx="13" ry="8" fill="#7ddc5a" transform="rotate(-25 18 72)"/>` +
    `<ellipse cx="82" cy="72" rx="13" ry="8" fill="#7ddc5a" transform="rotate(25 82 72)"/>` +
    `<path d="M12 66 C10 14 90 14 88 66Z" fill="#3fb56b"/>` +
    `<path d="M50 20 L50 38 M34 30 L42 44 M66 30 L58 44 M26 54 L40 50 M74 54 L60 50" fill="none" stroke-width="3.5"/>` +
    `<path d="M50 38 L40 46 L44 58 L56 58 L60 46Z" fill="#7ddc5a" stroke-width="3.5"/>` +
    `<circle cx="50" cy="74" r="17" fill="#7ddc5a"/>` + eye(43, 72, 6) + eye(57, 72, 6) + smile(50, 82, 5),

  shark:
    `<path d="M82 50 L98 32 L96 68Z" fill="#6f8fb8"/>` +
    `<path d="M42 38 L52 10 L64 40Z" fill="#6f8fb8"/>` +
    `<path d="M4 58 C18 32 60 28 88 52 C78 72 36 78 4 58Z" fill="#7a9cc6"/>` +
    `<path d="M10 62 C34 76 70 70 84 56 C70 74 34 80 10 62Z" fill="#e8f1fb" stroke="none"/>` +
    `<path d="M10 58 Q30 68 50 62" fill="none" stroke-width="3.5"/>` +
    `<path d="M16 61 L20 55 L24 63 L29 57 L33 65 L38 59" fill="#fff" stroke-width="2.5"/>` + eye(30, 46, 8),

  puffer:
    spikes(50, 52, 28, 44, 12, '#ffb627') +
    `<path d="M80 50 L96 40 L96 62Z" fill="#ffb627"/>` +
    `<circle cx="50" cy="52" r="31" fill="#ffd23f"/>` +
    `<ellipse cx="50" cy="70" rx="10" ry="7" fill="#ff7d3c"/>` +
    `<ellipse cx="50" cy="70" rx="3.5" ry="2.5" fill="${INK}" stroke="none"/>` + eye(37, 44, 9) + eye(63, 44, 9),

  shell:
    `<path d="M50 90 L12 52 C4 26 28 10 50 10 C72 10 96 26 88 52Z" fill="#ffb3c8"/>` +
    `<path d="M50 90 L26 22 M50 90 L38 14 M50 90 L50 10 M50 90 L62 14 M50 90 L74 22" fill="none" stroke-width="3.5"/>` +
    `<rect x="34" y="84" width="32" height="10" rx="4" fill="#f5d6b0"/>` + eye(40, 52, 7) + eye(60, 52, 7),

  seahorse:
    `<path d="M70 20 L88 22 L86 30 L70 30Z" fill="#ffb627"/>` +
    thick('M56 38 C42 48 52 62 60 68 C70 76 62 92 46 88 C38 84 40 74 48 76', '#ffb627', 14) +
    `<path d="M50 14 L56 4 L60 14 L68 8 L66 20Z" fill="#ff9a3c"/>` +
    `<circle cx="58" cy="26" r="15" fill="#ffb627"/>` + eye(60, 24, 6) +
    `<path d="M46 52 L38 54 M50 62 L42 66" fill="none" stroke-width="3.5"/>`,
};

const back = `<svg viewBox="0 0 100 125" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <rect width="100" height="125" fill="#4aa3df"/>
  ${[18, 44, 70, 96].map((y, i) => `<path d="M${i % 2 ? -10 : 0} ${y} q12.5 -12 25 0 t25 0 t25 0 t25 0 t25 0" fill="none" stroke="#8fd0f5" stroke-width="5" stroke-linecap="round"/>`).join('')}
  <g stroke="${INK}" stroke-width="4" stroke-linejoin="round">
    <path d="${star5(50, 62, 24, 11)}" fill="#ffb347"/>
    <circle cx="50" cy="62" r="4" fill="#ffd23f"/>
  </g>
  <circle cx="20" cy="104" r="4" fill="#cfeeff"/><circle cx="82" cy="22" r="3" fill="#cfeeff"/><circle cx="84" cy="100" r="5" fill="#cfeeff"/>
</svg>`;

export const sea: Deck = { id: 'sea', name: 'הים', art, keys: Object.keys(art), back, frame: '#9fd8ff' };
