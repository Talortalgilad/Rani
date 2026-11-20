/**
 * The catalog of the carnival (SPEC-carnival.md 5.2): what can be built, what it costs in stars, which wish it fills, and what opens it (unlocks.ts).
 * Pure data. The pictures are in public/park/items/<img>.webp. Prices are round and easy to count: stalls 10-30, rides 20-50, decorations 2-8.
 */
export type ItemKind = 'food' | 'drink' | 'fun' | 'rest' | 'shop' | 'decor';
/** where it stands: a stall place, a ride place, or a decoration place */
export type SlotKind = 'stall' | 'ride' | 'decor';
export type WishKind = 'food' | 'drink' | 'fun' | 'rest';

export type Unlock =
  | { kind: 'always' }
  /** the world of the word journey was finished (all five stations) */
  | { kind: 'world'; n: number }
  /** all the lessons of a unit of Miss Lolly were done */
  | { kind: 'unit'; n: number };

export interface Item {
  id: string;
  kind: ItemKind;
  slot: SlotKind;
  he: string;
  /** the English word of the sign (said when it is tapped) and the word that the residents order with */
  en: string;
  price: number;
  /** the wish that it fills (none for a shop or a decoration) */
  fills: WishKind | null;
  unlock: Unlock;
  /** the recording of the order ("Pizza, please!"), if there is one; without it the word and then "please" */
  order?: string;
}

const A: Unlock = { kind: 'always' };
const W = (n: number): Unlock => ({ kind: 'world', n });
const U = (n: number): Unlock => ({ kind: 'unit', n });

export const ITEMS: Item[] = [
  // food
  { id: 'pizzastand', kind: 'food', slot: 'stall', he: 'דוכן פיצה', en: 'PIZZA', price: 0, fills: 'food', unlock: A, order: 'carn_order_pizza' },
  { id: 'cheesestand', kind: 'food', slot: 'stall', he: 'דוכן גבינות', en: 'CHEESE', price: 10, fills: 'food', unlock: W(2), order: 'carn_order_cheese' },
  { id: 'pastastand', kind: 'food', slot: 'stall', he: 'דוכן פסטה', en: 'PASTA', price: 10, fills: 'food', unlock: W(2), order: 'carn_order_pasta' },
  { id: 'grillstand', kind: 'food', slot: 'stall', he: 'מנגל', en: 'MEAT', price: 20, fills: 'food', unlock: W(2), order: 'carn_order_meat' },
  { id: 'icecreamstand', kind: 'food', slot: 'stall', he: 'דוכן גלידה', en: 'ICE CREAM', price: 15, fills: 'food', unlock: W(5), order: 'carn_order_icecream' },
  { id: 'cottoncandycart', kind: 'food', slot: 'stall', he: 'צמר גפן מתוק', en: 'COTTON CANDY', price: 15, fills: 'food', unlock: W(5), order: 'carn_order_cottoncandy' },
  { id: 'popcorncart', kind: 'food', slot: 'stall', he: 'פופקורן', en: 'POPCORN', price: 15, fills: 'food', unlock: W(5), order: 'carn_order_popcorn' },
  // drink
  { id: 'waterfountain', kind: 'drink', slot: 'stall', he: 'ברזייה', en: 'WATER', price: 10, fills: 'drink', unlock: A, order: 'carn_order_water' },
  { id: 'juicestand', kind: 'drink', slot: 'stall', he: 'דוכן מיץ', en: 'JUICE', price: 15, fills: 'drink', unlock: W(2), order: 'carn_order_juice' },
  { id: 'lemonadestand', kind: 'drink', slot: 'stall', he: 'לימונדה', en: 'LEMONADE', price: 20, fills: 'drink', unlock: W(3), order: 'carn_order_lemonade' },
  // fun (rides, and the stall of balloons)
  { id: 'swingride', kind: 'fun', slot: 'ride', he: 'נדנדות', en: 'SWING', price: 20, fills: 'fun', unlock: W(3) },
  { id: 'carousel', kind: 'fun', slot: 'ride', he: 'קרוסלה', en: 'CAROUSEL', price: 30, fills: 'fun', unlock: W(8) },
  { id: 'showstage', kind: 'fun', slot: 'ride', he: 'במה', en: 'STAGE', price: 30, fills: 'fun', unlock: W(8) },
  { id: 'minitrain', kind: 'fun', slot: 'ride', he: 'רכבת קטנה', en: 'TRAIN', price: 35, fills: 'fun', unlock: W(10) },
  { id: 'ninjacourse', kind: 'fun', slot: 'ride', he: 'פארק נינג׳ה', en: 'NINJA PARK', price: 40, fills: 'fun', unlock: W(11) },
  { id: 'bouncycastle', kind: 'fun', slot: 'ride', he: 'טירה מתנפחת', en: 'BOUNCY CASTLE', price: 40, fills: 'fun', unlock: W(11) },
  { id: 'ferriswheel', kind: 'fun', slot: 'ride', he: 'גלגל ענק', en: 'BIG WHEEL', price: 50, fills: 'fun', unlock: W(12) },
  { id: 'bumpercars', kind: 'fun', slot: 'ride', he: 'מכוניות מתנגשות', en: 'BUMPER CARS', price: 45, fills: 'fun', unlock: W(11) },
  { id: 'balloonstand', kind: 'fun', slot: 'stall', he: 'דוכן בלונים', en: 'BALLOON', price: 20, fills: 'fun', unlock: W(5), order: 'carn_order_balloon' },
  { id: 'photobooth', kind: 'fun', slot: 'stall', he: 'תא צילום', en: 'PHOTO', price: 25, fills: 'fun', unlock: W(7) },
  // rest
  { id: 'bench', kind: 'rest', slot: 'stall', he: 'ספסל', en: 'BENCH', price: 10, fills: 'rest', unlock: A },
  { id: 'picnictable', kind: 'rest', slot: 'stall', he: 'שולחן פיקניק', en: 'PICNIC', price: 15, fills: 'rest', unlock: W(3) },
  { id: 'hammock', kind: 'rest', slot: 'stall', he: 'ערסל', en: 'HAMMOCK', price: 20, fills: 'rest', unlock: W(6) },
  // shops
  { id: 'hatshop', kind: 'shop', slot: 'stall', he: 'חנות כובעים', en: 'HATS', price: 25, fills: null, unlock: W(7) },
  { id: 'toyshop', kind: 'shop', slot: 'stall', he: 'חנות צעצועים', en: 'TOYS', price: 25, fills: null, unlock: W(10) },
  // decorations
  { id: 'parklamp', kind: 'decor', slot: 'decor', he: 'פנס', en: 'LAMP', price: 2, fills: null, unlock: W(1) },
  { id: 'flagpole', kind: 'decor', slot: 'decor', he: 'דגל', en: 'FLAG', price: 2, fills: null, unlock: W(1) },
  { id: 'roundtree', kind: 'decor', slot: 'decor', he: 'עץ', en: 'TREE', price: 3, fills: null, unlock: W(3) },
  { id: 'pine', kind: 'decor', slot: 'decor', he: 'אורן', en: 'PINE', price: 3, fills: null, unlock: W(3) },
  { id: 'palm', kind: 'decor', slot: 'decor', he: 'דקל', en: 'PALM', price: 3, fills: null, unlock: W(3) },
  { id: 'bush', kind: 'decor', slot: 'decor', he: 'שיח', en: 'BUSH', price: 2, fills: null, unlock: W(3) },
  { id: 'flowerbed', kind: 'decor', slot: 'decor', he: 'ערוגת פרחים', en: 'FLOWERS', price: 3, fills: null, unlock: W(3) },
  { id: 'balloons', kind: 'decor', slot: 'decor', he: 'בלונים', en: 'BALLOONS', price: 4, fills: null, unlock: W(4) },
  { id: 'starstatue', kind: 'decor', slot: 'decor', he: 'פסל כוכב', en: 'STAR', price: 6, fills: null, unlock: W(6) },
  { id: 'fountain', kind: 'decor', slot: 'decor', he: 'מזרקה', en: 'FOUNTAIN', price: 6, fills: null, unlock: W(9) },
  { id: 'fireworksbox', kind: 'decor', slot: 'decor', he: 'זיקוקים', en: 'FIREWORKS', price: 8, fills: null, unlock: W(12) },
  { id: 'entrancearch', kind: 'decor', slot: 'decor', he: 'שער כניסה', en: 'GATE', price: 8, fills: null, unlock: U(2) },
  { id: 'wishingwell', kind: 'decor', slot: 'decor', he: 'באר משאלות', en: 'WISHING WELL', price: 8, fills: null, unlock: U(3) },
  { id: 'hotairballoon', kind: 'decor', slot: 'decor', he: 'כדור פורח', en: 'HOT AIR BALLOON', price: 8, fills: null, unlock: U(1) },
];

export const itemById = (id: string): Item | undefined => ITEMS.find((i) => i.id === id);
export const itemsOfSlot = (s: SlotKind): Item[] => ITEMS.filter((i) => i.slot === s);
export const itemImg = (id: string): string => `${import.meta.env?.BASE_URL ?? '/'}park/items/${id}.webp`;
/** the first stall: free, built with the guide */
export const FIRST_ITEM = 'pizzastand';
/** the three that are open from the start (SPEC-carnival.md 5.6): the first stall, the water fountain and the bench */
export const ALWAYS_OPEN = ITEMS.filter((i) => i.unlock.kind === 'always').map((i) => i.id);
export const KIND_LABEL: Record<ItemKind, string> = { food: 'אוכל', drink: 'שתייה', fun: 'כיף', rest: 'מנוחה', shop: 'חנויות', decor: 'קישוטים' };
export const KIND_ICON: Record<ItemKind, string> = { food: '🍕', drink: '🧃', fun: '🎈', rest: '💤', shop: '🛍️', decor: '🌳' };
