/**
 * The room behind each world's tasks: a wall, a floor and the things that belong to the world, in the same round, soft style.
 * Drawn as one SVG that fills the play area (viewBox 400 x 560, cut to fit).
 */
const defs = `<defs>
  <linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3ff"/><stop offset="1" stop-color="#d9f2ff"/></linearGradient>
  <radialGradient id="lamp" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff6b8" stop-opacity=".95"/><stop offset="1" stop-color="#fff6b8" stop-opacity="0"/></radialGradient>
</defs>`;

const cloud = (x: number, y: number, s = 1): string => `<g transform="translate(${x} ${y}) scale(${s})" fill="#fff"><ellipse cx="0" cy="0" rx="22" ry="12"/><ellipse cx="-16" cy="4" rx="14" ry="9"/><ellipse cx="16" cy="5" rx="15" ry="9"/><ellipse cx="4" cy="-8" rx="13" ry="10"/></g>`;

const ROOM = `${defs}
  <rect width="400" height="560" fill="#ffe9c9"/>
  <g fill="#ffd3a1" opacity=".55">${Array.from({ length: 6 }, (_, r) => Array.from({ length: 8 }, (_, c) => `<circle cx="${25 + c * 50 + (r % 2) * 25}" cy="${22 + r * 52}" r="5"/>`).join('')).join('')}</g>
  <!-- the window -->
  <rect x="34" y="40" width="140" height="150" rx="14" fill="#b07a4a"/><rect x="44" y="50" width="120" height="130" rx="8" fill="url(#sk)"/>
  <circle cx="132" cy="84" r="16" fill="#ffd23f"/>${cloud(80, 100, 1)}${cloud(120, 150, .7)}
  <rect x="102" y="50" width="4" height="130" fill="#b07a4a"/><rect x="44" y="113" width="120" height="4" fill="#b07a4a"/>
  <path d="M30 40 Q16 120 36 196 L52 196 Q38 120 52 40Z" fill="#ff9fc0" opacity=".9"/><path d="M178 40 Q192 120 172 196 L156 196 Q170 120 156 40Z" fill="#ff9fc0" opacity=".9"/>
  <!-- the shelf with books and a toy -->
  <rect x="226" y="120" width="150" height="12" rx="5" fill="#b07a4a"/>
  <rect x="236" y="78" width="16" height="42" rx="3" fill="#3fa0ff"/><rect x="254" y="86" width="14" height="34" rx="3" fill="#ff5d73"/><rect x="270" y="74" width="16" height="46" rx="3" fill="#3fb56b"/>
  <circle cx="332" cy="100" r="20" fill="#ffd23f"/><circle cx="326" cy="96" r="3" fill="#3a2f4b"/><circle cx="338" cy="96" r="3" fill="#3a2f4b"/><path d="M324 106 Q332 114 340 106" fill="none" stroke="#3a2f4b" stroke-width="3" stroke-linecap="round"/>
  <rect x="226" y="196" width="150" height="12" rx="5" fill="#b07a4a"/><rect x="238" y="160" width="26" height="36" rx="4" fill="#8e5cf0"/><rect x="270" y="168" width="34" height="28" rx="4" fill="#ff8a1f"/>
  <!-- the floor, a rug and a lamp -->
  <rect y="372" width="400" height="188" fill="#e6c79b"/><rect y="366" width="400" height="12" fill="#b9884c"/>
  <g stroke="#d4a96f" stroke-width="3" opacity=".7">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<path d="M${i * 66} 378 V560"/>`).join('')}</g>
  <ellipse cx="200" cy="470" rx="170" ry="62" fill="#ff7ad0"/><ellipse cx="200" cy="470" rx="140" ry="48" fill="#ffd23f"/><ellipse cx="200" cy="470" rx="108" ry="35" fill="#3fb5e6"/><ellipse cx="200" cy="470" rx="74" ry="23" fill="#fff"/>
  <circle cx="352" cy="244" r="52" fill="url(#lamp)"/><rect x="348" y="262" width="8" height="112" rx="3" fill="#8a6a45"/><path d="M328 262 L376 262 L366 228 L338 228Z" fill="#ff7aa8"/><ellipse cx="352" cy="378" rx="22" ry="7" fill="#8a6a45"/>`;

const KITCHEN = `${defs}
  <rect width="400" height="560" fill="#fff3d6"/>
  <g fill="#fff" stroke="#ffe3a8" stroke-width="3">${Array.from({ length: 7 }, (_, r) => Array.from({ length: 8 }, (_, c) => `<rect x="${c * 50}" y="${200 + r * 24}" width="50" height="24"/>`).join('')).join('')}</g>
  <rect y="0" width="400" height="110" fill="#8fd3c4"/><g fill="#fff" opacity=".9"><rect x="20" y="16" width="86" height="78" rx="8"/><rect x="114" y="16" width="86" height="78" rx="8"/><rect x="208" y="16" width="86" height="78" rx="8"/><rect x="302" y="16" width="86" height="78" rx="8"/></g>
  <g fill="#3a2f4b"><circle cx="100" cy="55" r="5"/><circle cx="122" cy="55" r="5"/><circle cx="296" cy="55" r="5"/><circle cx="310" cy="55" r="5"/></g>
  <rect x="150" y="124" width="100" height="72" rx="10" fill="#b07a4a"/><rect x="158" y="132" width="84" height="56" rx="6" fill="url(#sk)"/>
  <rect x="0" y="352" width="400" height="26" fill="#d9a066"/><rect y="378" width="400" height="182" fill="#e8d3b0"/>
  <g fill="#f4e4c4">${Array.from({ length: 3 }, (_, r) => Array.from({ length: 5 }, (_, c) => `<rect x="${c * 84 + (r % 2) * 42 - 20}" y="${390 + r * 56}" width="80" height="52" rx="4"/>`).join('')).join('')}</g>
  <rect x="22" y="300" width="70" height="54" rx="8" fill="#ff7aa8"/><rect x="30" y="288" width="54" height="16" rx="6" fill="#ffd23f"/>`;

const GARDEN = `${defs}
  <rect width="400" height="560" fill="url(#sk)"/>
  <circle cx="330" cy="70" r="34" fill="#ffd23f"/><g stroke="#ffd23f" stroke-width="6" stroke-linecap="round">${Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return `<path d="M${330 + Math.cos(a) * 44} ${70 + Math.sin(a) * 44} L${330 + Math.cos(a) * 56} ${70 + Math.sin(a) * 56}"/>`; }).join('')}</g>
  ${cloud(70, 80, 1.3)}${cloud(210, 130, 1)}
  <path d="M0 300 Q100 230 200 290 T400 270 V560 H0Z" fill="#9be36d"/><path d="M0 360 Q120 320 240 350 T400 340 V560 H0Z" fill="#7ed957"/>
  <g fill="#fff">${Array.from({ length: 9 }, (_, i) => `<rect x="${i * 46 - 10}" y="300" width="30" height="70" rx="8"/>`).join('')}</g><rect y="322" width="400" height="10" fill="#e8e2f0"/><rect y="348" width="400" height="10" fill="#e8e2f0"/>
  <g>${[[40, 440], [120, 500], [210, 450], [300, 510], [360, 430], [70, 520]].map(([x, y], i) => `<g transform="translate(${x} ${y})"><path d="M0 0 V22" stroke="#3fb56b" stroke-width="4"/><circle r="9" fill="${['#ff5d73', '#ffd23f', '#8e5cf0', '#ff8fd0', '#3fa0ff', '#ff8a1f'][i]}"/><circle r="3.5" fill="#fff6a8"/></g>`).join('')}</g>`;

const STUDIO = `${defs}
  <rect width="400" height="560" fill="#f3e8ff"/>
  <g>${[[60, 80, '#ff5d73', 34], [320, 60, '#3fa0ff', 28], [210, 120, '#ffd23f', 22], [350, 190, '#3fb56b', 30], [40, 220, '#8e5cf0', 24]].map(([x, y, c, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity=".5"/><circle cx="${(x as number) + 18}" cy="${(y as number) + 22}" r="${(r as number) / 3}" fill="${c}" opacity=".5"/>`).join('')}</g>
  <rect x="120" y="40" width="160" height="14" rx="6" fill="#b07a4a"/>${[['#ff5d73', 130], ['#ffd23f', 164], ['#3fa0ff', 198], ['#3fb56b', 232]].map(([c, x]) => `<rect x="${x}" y="8" width="26" height="34" rx="6" fill="${c}"/><rect x="${x}" y="8" width="26" height="9" rx="4" fill="#fff" opacity=".6"/>`).join('')}
  <rect x="26" y="150" width="104" height="132" rx="8" fill="#fff" stroke="#b07a4a" stroke-width="8"/><circle cx="78" cy="206" r="26" fill="#ffd23f"/><g stroke="#ffd23f" stroke-width="5" stroke-linecap="round"><path d="M78 164 V172 M78 240 V248 M36 206 H44 M112 206 H120"/></g><path d="M62 216 Q78 232 94 216" fill="none" stroke="#3a2f4b" stroke-width="4" stroke-linecap="round"/>
  <rect y="372" width="400" height="188" fill="#e6c79b"/><rect y="366" width="400" height="12" fill="#b9884c"/>
  <g transform="translate(200 470) rotate(-6)"><rect x="-120" y="-46" width="240" height="92" rx="8" fill="#fff" stroke="#d8d0e6" stroke-width="4"/><g>${[['#ff5d73', -80, -14], ['#3fa0ff', -10, 12], ['#ffd23f', 62, -10], ['#3fb56b', 20, -22]].map(([c, x, y]) => `<ellipse cx="${x}" cy="${y}" rx="26" ry="12" fill="${c}" opacity=".8"/>`).join('')}</g></g>`;

export const SCENES: Record<number, string> = { 1: ROOM, 2: KITCHEN, 3: GARDEN, 4: STUDIO };

/** The background SVG of a world (the room of world 1 for a world that has no scene yet). */
export const sceneSvg = (world: number): string =>
  `<svg class="scene-svg" viewBox="0 0 400 560" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${SCENES[world] ?? SCENES[1]}</svg>`;
