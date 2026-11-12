import { INK } from '../../memory/decks/svg';

/** Bunny, the first squishy to be rescued (world 1). viewBox 0 0 200 200. */
export function bunnySvg(): string {
  return `<svg class="bunny-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">
    <ellipse cx="100" cy="188" rx="52" ry="6" fill="${INK}" opacity=".16" stroke="none"/>
    <g transform="rotate(-10 72 62)"><rect x="52" y="6" width="34" height="86" rx="17" fill="#fff"/><rect x="61" y="18" width="16" height="58" rx="8" fill="#ff9fb8" stroke="none"/></g>
    <g transform="rotate(10 128 62)"><rect x="114" y="6" width="34" height="86" rx="17" fill="#fff"/><rect x="123" y="18" width="16" height="58" rx="8" fill="#ff9fb8" stroke="none"/></g>
    <ellipse cx="100" cy="132" rx="62" ry="52" fill="#fff"/>
    <ellipse cx="82" cy="104" rx="15" ry="7" fill="#fff" opacity=".0"/>
    <ellipse cx="78" cy="118" rx="14" ry="14.5" fill="#fff" stroke-width="3.5"/><circle cx="81" cy="121" r="8" fill="${INK}" stroke="none"/><circle cx="78" cy="117" r="3" fill="#fff" stroke="none"/>
    <ellipse cx="122" cy="118" rx="14" ry="14.5" fill="#fff" stroke-width="3.5"/><circle cx="125" cy="121" r="8" fill="${INK}" stroke="none"/><circle cx="122" cy="117" r="3" fill="#fff" stroke="none"/>
    <ellipse cx="62" cy="140" rx="10" ry="6.5" fill="#ff9fb8" stroke="none" opacity=".9"/><ellipse cx="138" cy="140" rx="10" ry="6.5" fill="#ff9fb8" stroke="none" opacity=".9"/>
    <path d="M94 134 L106 134 L100 142Z" fill="#ff7d93" stroke-width="3.5"/><path d="M100 142 Q100 152 90 152 M100 142 Q100 152 110 152" fill="none" stroke-width="3.5"/>
    <rect x="94" y="152" width="12" height="9" rx="3" fill="#fff" stroke-width="3"/>
    <ellipse cx="72" cy="182" rx="20" ry="9" fill="#fff"/><ellipse cx="128" cy="182" rx="20" ry="9" fill="#fff"/>
    <circle cx="160" cy="160" r="14" fill="#fff"/>
  </svg>`;
}
