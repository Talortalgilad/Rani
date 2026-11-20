/**
 * The coloured things of the lessons (`thing:<thing>:<color>`, SPEC-tutor.md section 4). All eight have a WHITE object (public/english/paint) and are painted the way the colouring task
 * of the English game paints it: the colour is multiplied over the white picture, so the light and the shade stay. (apple, book, hat and kite were made from their pictures of the words:
 * the saturation taken out and the light matched to the white objects, the shading kept.) A thing with no white object would show its picture on a tile of the colour (THINGS_MISSING).
 */
import { imageUrl } from '../art/images';
import { paintUrl, PAINT } from '../content/paint';
import { colorById } from '../content/colors';

/** the things that have a white object in the repo */
export const PAINTABLE: string[] = ['balloon', 'ball', 'star', 'flower', 'apple', 'book', 'hat', 'kite'].filter((t) => PAINT.some((p) => p.id === t));
/** the things of the lessons that have no white object yet (the list of what is missing: pictures) */
export const THINGS_MISSING: string[] = [];
export const isPaintable = (thing: string): boolean => PAINTABLE.includes(thing);

/** the html of a thing in a colour (`color`: an id of the six colours; null: not painted yet, white) */
export function thingHtml(thing: string, color: string | null): string {
  const hex = color ? colorById(color).hex : null;
  if (isPaintable(thing)) {
    const u = paintUrl(thing);
    return `<span class="thing paint" data-thing="${thing}"><img class="item-img" src="${u}" alt="" draggable="false"><span class="paint-tint" style="-webkit-mask-image:url(${u});mask-image:url(${u});background:${hex ?? 'transparent'};opacity:${hex ? 1 : 0}"></span></span>`;
  }
  // no white picture: the real picture of the word, on a tile of the colour
  return `<span class="thing tile" data-thing="${thing}" style="--tile:${hex ?? '#fff'}"><img class="item-img" src="${imageUrl(thing)}" alt="" draggable="false"></span>`;
}
/** paints a thing that is on the screen (the `.thing` element) with a colour id (null: white again) */
export function paintThing(el: HTMLElement, color: string | null): void {
  const hex = color ? colorById(color).hex : null;
  const tint = el.querySelector<HTMLElement>('.paint-tint');
  if (tint) {
    tint.style.background = hex ?? 'transparent';
    tint.style.opacity = hex ? '1' : '0';
  } else el.style.setProperty('--tile', hex ?? '#fff');
}
