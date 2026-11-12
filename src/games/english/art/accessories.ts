/** Cheesy's accessories: one for every three worlds finished (SPEC-english.md 3.2). Drawn over the picture (a 100 x 100 box), so they follow its size. */
export interface Accessory { id: string; he: string; /** the world to finish for it */ world: number; svg: string }

const S = '#3a2f4b';
export const ACCESSORIES: Accessory[] = [
  { id: 'hat', he: 'כובע מסיבה', world: 3, svg: `<polygon points="50,-10 34,17 66,17" fill="#ff5fa2" stroke="${S}" stroke-width="2.4" stroke-linejoin="round"/><path d="M42,6 L58,10 M38,12 L62,16" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="-10" r="5" fill="#6fd3ff" stroke="${S}" stroke-width="2.2"/>` },
  { id: 'glasses', he: 'משקפיים', world: 6, svg: `<circle cx="36" cy="47" r="10" fill="rgba(255,255,255,.2)" stroke="${S}" stroke-width="3"/><circle cx="63" cy="47" r="10" fill="rgba(255,255,255,.2)" stroke="${S}" stroke-width="3"/><path d="M46,46 Q49.5,43 53,46 M26,46 L19,43 M73,46 L80,43" fill="none" stroke="${S}" stroke-width="3" stroke-linecap="round"/>` },
  { id: 'bow', he: 'פפיון', world: 9, svg: `<path d="M62,19 L78,8 L78,30 Z M62,19 L46,8 L46,30 Z" fill="#ff7ad0" stroke="${S}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="62" cy="19" r="5.5" fill="#ffb3e6" stroke="${S}" stroke-width="2.4"/>` },
  { id: 'crown', he: 'כתר זהב', world: 12, svg: `<path d="M38,19 L36,0 L44,9 L50,-6 L56,9 L64,0 L62,19 Z" fill="#ffc83a" stroke="${S}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="50" cy="-6" r="2.6" fill="#ff5f7a"/><circle cx="36" cy="0" r="2.4" fill="#6fd3ff"/><circle cx="64" cy="0" r="2.4" fill="#7ed957"/>` },
];

export const accessoryOf = (id: string | null | undefined): Accessory | undefined => ACCESSORIES.find((a) => a.id === id);
/** The accessories that are won: the worlds finished decide (the fifth station of a world is its rescue). */
export const unlockedAccessories = (done: Record<number, number>, stationsPerWorld: number): Accessory[] => ACCESSORIES.filter((a) => (done[a.world] ?? 0) >= stationsPerWorld);
export const accessorySvg = (a: Accessory): string => `<svg class="cheesy-acc" viewBox="0 0 100 100" aria-hidden="true">${a.svg}</svg>`;
