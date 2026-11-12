import { INK, svg } from '../../memory/decks/svg';

/** The things in the room of world 1, in the same round, thick-outlined style as the memory game. */
export const ITEM_ART: Record<string, string> = {
  ball: svg(`
    <path d="M50 52 L50.0 18.0 A34 34 0 0 1 79.4 35.0 Z" fill="#ff5d73" stroke-width="2.5"/><path d="M50 52 L79.4 35.0 A34 34 0 0 1 79.4 69.0 Z" fill="#ffd23f" stroke-width="2.5"/><path d="M50 52 L79.4 69.0 A34 34 0 0 1 50.0 86.0 Z" fill="#3fa0ff" stroke-width="2.5"/><path d="M50 52 L50.0 86.0 A34 34 0 0 1 20.6 69.0 Z" fill="#ff5d73" stroke-width="2.5"/><path d="M50 52 L20.6 69.0 A34 34 0 0 1 20.6 35.0 Z" fill="#ffd23f" stroke-width="2.5"/><path d="M50 52 L20.6 35.0 A34 34 0 0 1 50.0 18.0 Z" fill="#3fa0ff" stroke-width="2.5"/>
    <circle cx="50" cy="52" r="34" fill="none"/><circle cx="50" cy="52" r="5" fill="#fff" stroke-width="3"/>
    <ellipse cx="37" cy="36" rx="7" ry="4.5" fill="#fff" stroke="none" opacity=".6" transform="rotate(-35 37 36)"/>`),
  book: svg(`
    <rect x="22" y="16" width="58" height="70" rx="8" fill="#3fb56b"/>
    <rect x="22" y="16" width="14" height="70" rx="6" fill="#2f9a58"/>
    <rect x="44" y="28" width="28" height="22" rx="5" fill="#fff6d6" stroke-width="3.5"/>
    <path d="M46 62 H70 M46 72 H62" stroke-width="4" fill="none"/>
    <path d="M26 86 H80" fill="none" stroke-width="3"/>`),
  bed: svg(`
    <rect x="12" y="34" width="10" height="46" rx="4" fill="#b07a4a"/><rect x="78" y="46" width="10" height="34" rx="4" fill="#b07a4a"/>
    <rect x="12" y="58" width="76" height="16" rx="6" fill="#d9a066"/>
    <path d="M22 58 V48 Q22 42 30 42 H78 Q84 42 84 50 V58Z" fill="#7ad3ff"/>
    <rect x="22" y="42" width="28" height="16" rx="8" fill="#fff"/>
    <path d="M54 46 Q62 52 54 58 M66 46 Q74 52 66 58" fill="none" stroke-width="3" stroke="#3fa0ff"/>
    <rect x="16" y="74" width="8" height="10" rx="3" fill="#b07a4a"/><rect x="76" y="74" width="8" height="10" rx="3" fill="#b07a4a"/>`),
  box: svg(`
    <path d="M14 42 L50 30 L86 42 L50 54Z" fill="#e8b878"/>
    <path d="M14 42 V76 L50 90 V54Z" fill="#d9a066"/><path d="M86 42 V76 L50 90 V54Z" fill="#c78d52"/>
    <path d="M50 54 V90" fill="none" stroke-width="3.5"/>
    <path d="M14 42 L4 30 L36 24 M86 42 L96 30 L64 24" fill="#e8b878" stroke-width="3.5"/>`),
  phone: svg(`
    <rect x="30" y="12" width="40" height="76" rx="9" fill="#5b5f8a"/><rect x="35" y="22" width="30" height="48" rx="3" fill="#bfe9ff" stroke-width="3"/>
    <circle cx="50" cy="79" r="4.5" fill="#fff" stroke-width="3"/>`),
  tv: svg(`
    <rect x="12" y="24" width="76" height="52" rx="10" fill="#5b5f8a"/><rect x="19" y="31" width="62" height="38" rx="5" fill="#8fe3c9" stroke-width="3"/>
    <path d="M38 24 L28 12 M62 24 L72 12" fill="none"/><path d="M34 82 H66" fill="none" stroke-width="6"/>`),
  doll: svg(`
    <circle cx="50" cy="30" r="17" fill="#ffd9b3"/><path d="M33 28 Q34 10 50 10 Q66 10 67 28 Q60 20 50 20 Q40 20 33 28Z" fill="#8a4b2a"/>
    <path d="M36 48 L64 48 L72 84 L28 84Z" fill="#ff7aa8"/>
    <circle cx="44" cy="31" r="2.6" fill="${INK}" stroke="none"/><circle cx="56" cy="31" r="2.6" fill="${INK}" stroke="none"/><path d="M45 38 Q50 42 55 38" fill="none" stroke-width="3"/>`),
};

/** Pictures drawn as their own little SVG element. */
export const itemSvg = (key: string): string => ITEM_ART[key] ?? ITEM_ART.ball;
