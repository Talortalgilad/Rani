export interface Word {
  /** the key: the name of the picture file (/english/words/<id>.webp, one picture per word in the whole game); lower case, no spaces */
  id: string;
  /** what is shown and read aloud when it differs from the key ("TV", "ice cream", "monkey bars") */
  label?: string;
  world: number;
  /** what Cheesy says in Hebrew when the word first appears */
  he: string;
  /** a thing that can be held or pointed at ("Can I have the...", "What is it?"): not a verb, not family, not weather */
  askable: boolean;
}

/** The 108 words of the 12 worlds, nine in each, in the order of the picture sheets. */
const RAW: Omit<Word, 'askable'>[] = [
  { id: 'phone', world: 1, he: 'טלפון' },
  { id: 'tv', label: 'TV', world: 1, he: 'טלוויזיה' },
  { id: 'ball', world: 1, he: 'כדור' },
  { id: 'doll', world: 1, he: 'בובה' },
  { id: 'bed', world: 1, he: 'מיטה' },
  { id: 'book', world: 1, he: 'ספר' },
  { id: 'box', world: 1, he: 'קופסה' },
  { id: 'lamp', world: 1, he: 'מנורה' },
  { id: 'chair', world: 1, he: 'כיסא' },
  { id: 'pizza', world: 2, he: 'פיצה' },
  { id: 'cheese', world: 2, he: 'גבינה' },
  { id: 'pasta', world: 2, he: 'פסטה' },
  { id: 'meat', world: 2, he: 'בשר' },
  { id: 'apple', world: 2, he: 'תפוח' },
  { id: 'banana', world: 2, he: 'בננה' },
  { id: 'milk', world: 2, he: 'חלב' },
  { id: 'cake', world: 2, he: 'עוגה' },
  { id: 'egg', world: 2, he: 'ביצה' },
  { id: 'slide', world: 3, he: 'מגלשה' },
  { id: 'swing', world: 3, he: 'נדנדה' },
  { id: 'tree', world: 3, he: 'עץ' },
  { id: 'bike', world: 3, he: 'אופניים' },
  { id: 'skates', world: 3, he: 'גלגיליות' },
  { id: 'helmet', world: 3, he: 'קסדה' },
  { id: 'flower', world: 3, he: 'פרח' },
  { id: 'bench', world: 3, he: 'ספסל' },
  { id: 'kite', world: 3, he: 'עפיפון' },
  { id: 'pencil', world: 4, he: 'עיפרון' },
  { id: 'brush', world: 4, he: 'מכחול' },
  { id: 'crayons', world: 4, he: 'צבעי שעווה' },
  { id: 'paper', world: 4, he: 'נייר' },
  { id: 'palette', world: 4, he: 'פלטת צבעים' },
  { id: 'scissors', world: 4, he: 'מספריים' },
  { id: 'glue', world: 4, he: 'דבק' },
  { id: 'picture', world: 4, he: 'תמונה' },
  { id: 'easel', world: 4, he: 'כן ציור' },
  { id: 'candy', world: 5, he: 'סוכרייה' },
  { id: 'lollipop', world: 5, he: 'סוכריה על מקל' },
  { id: 'cupcake', world: 5, he: 'קאפקייק' },
  { id: 'icecream', label: 'ice cream', world: 5, he: 'גלידה' },
  { id: 'cookie', world: 5, he: 'עוגייה' },
  { id: 'donut', world: 5, he: 'סופגנייה' },
  { id: 'chocolate', world: 5, he: 'שוקולד' },
  { id: 'balloon', world: 5, he: 'בלון' },
  { id: 'gift', world: 5, he: 'מתנה' },
  { id: 'mom', world: 6, he: 'אמא' },
  { id: 'dad', world: 6, he: 'אבא' },
  { id: 'brother', world: 6, he: 'אח' },
  { id: 'sister', world: 6, he: 'אחות' },
  { id: 'baby', world: 6, he: 'תינוק' },
  { id: 'grandma', world: 6, he: 'סבתא' },
  { id: 'grandpa', world: 6, he: 'סבא' },
  { id: 'family', world: 6, he: 'משפחה' },
  { id: 'friends', world: 6, he: 'חברים' },
  { id: 'shirt', world: 7, he: 'חולצה' },
  { id: 'shorts', world: 7, he: 'מכנסיים קצרים' },
  { id: 'dress', world: 7, he: 'שמלה' },
  { id: 'skirt', world: 7, he: 'חצאית' },
  { id: 'shoes', world: 7, he: 'נעליים' },
  { id: 'socks', world: 7, he: 'גרביים' },
  { id: 'hat', world: 7, he: 'כובע' },
  { id: 'jacket', world: 7, he: 'מעיל' },
  { id: 'glasses', world: 7, he: 'משקפיים' },
  { id: 'jump', world: 8, he: 'לקפוץ' },
  { id: 'clap', world: 8, he: 'למחוא כפיים' },
  { id: 'dance', world: 8, he: 'לרקוד' },
  { id: 'sing', world: 8, he: 'לשיר' },
  { id: 'run', world: 8, he: 'לרוץ' },
  { id: 'sleep', world: 8, he: 'לישון' },
  { id: 'eat', world: 8, he: 'לאכול' },
  { id: 'drink', world: 8, he: 'לשתות' },
  { id: 'wave', world: 8, he: 'לנופף' },
  { id: 'sun', world: 9, he: 'שמש' },
  { id: 'cloud', world: 9, he: 'ענן' },
  { id: 'rain', world: 9, he: 'גשם' },
  { id: 'snowflake', world: 9, he: 'פתית שלג' },
  { id: 'wind', world: 9, he: 'רוח' },
  { id: 'rainbow', world: 9, he: 'קשת' },
  { id: 'umbrella', world: 9, he: 'מטרייה' },
  { id: 'snowman', world: 9, he: 'איש שלג' },
  { id: 'storm', world: 9, he: 'סערה' },
  { id: 'cat', world: 10, he: 'חתול' },
  { id: 'dog', world: 10, he: 'כלב' },
  { id: 'lion', world: 10, he: 'אריה' },
  { id: 'monkey', world: 10, he: 'קוף' },
  { id: 'fish', world: 10, he: 'דג' },
  { id: 'bird', world: 10, he: 'ציפור' },
  { id: 'elephant', world: 10, he: 'פיל' },
  { id: 'giraffe', world: 10, he: 'ג׳ירפה' },
  { id: 'rabbit', world: 10, he: 'ארנב' },
  { id: 'rope', world: 11, he: 'חבל' },
  { id: 'wall', label: 'climbing wall', world: 11, he: 'קיר טיפוס' },
  { id: 'beam', label: 'balance beam', world: 11, he: 'קורת שיווי משקל' },
  { id: 'bars', label: 'monkey bars', world: 11, he: 'מקבילים' },
  { id: 'tunnel', world: 11, he: 'מנהרה' },
  { id: 'crate', world: 11, he: 'ארגז' },
  { id: 'bridge', world: 11, he: 'גשר' },
  { id: 'mat', world: 11, he: 'מזרן' },
  { id: 'ladder', world: 11, he: 'סולם' },
  { id: 'stage', world: 12, he: 'במה' },
  { id: 'microphone', world: 12, he: 'מיקרופון' },
  { id: 'guitar', world: 12, he: 'גיטרה' },
  { id: 'drum', world: 12, he: 'תוף' },
  { id: 'piano', world: 12, he: 'פסנתר' },
  { id: 'trumpet', world: 12, he: 'חצוצרה' },
  { id: 'star', world: 12, he: 'כוכב' },
  { id: 'crown', world: 12, he: 'כתר' },
  { id: 'flowers', world: 12, he: 'זר פרחים' },
];

/** The weather words (world 9): to see, not to ask for. The umbrella and the snowman are things. */
const WEATHER = new Set(['sun', 'cloud', 'rain', 'snowflake', 'wind', 'rainbow', 'storm']);
export const WORDS: Word[] = RAW.map((w) => ({ ...w, askable: !(w.world === 6 /* family */ || w.world === 8 /* verbs */ || WEATHER.has(w.id)) }));

export const WORLD_NAMES: Record<number, string> = { 1: 'My room', 2: 'The kitchen', 3: 'The garden', 4: 'Drawing studio', 5: 'Candy shop', 6: 'My family', 7: 'The wardrobe', 8: 'Dance party', 9: 'Weather', 10: 'The zoo', 11: 'Ninja park', 12: 'The big show' };

/** The words of a world (its pictures are loaded when the world is entered). */
export const wordsOfWorld = (world: number): Word[] => WORDS.filter((w) => w.world === world);
export const wordById = (id: string): Word => WORDS.find((w) => w.id === id) ?? WORDS[0];
/** The English text of a word, as shown and read aloud. */
export const labelOf = (id: string): string => WORDS.find((w) => w.id === id)?.label ?? id;

/** The verbs of the instructions, with a short Hebrew explanation the first times. */
export const VERBS: Record<string, { en: string; he: string }> = {
  find: { en: 'Find', he: 'למצוא' },
  color: { en: 'Color', he: 'לצבוע' },
  count: { en: 'How many', he: 'כמה יש' },
  big: { en: 'Big', he: 'גדול' },
  small: { en: 'Small', he: 'קטן' },
  on: { en: 'On', he: 'על' },
  over: { en: 'Over', he: 'מעל' },
  in: { en: 'In', he: 'בתוך' },
  under: { en: 'Under', he: 'מתחת' },
  sentence: { en: 'Make a sentence', he: 'לבנות משפט' },
  circle: { en: 'Circle', he: 'להקיף בעיגול' },
  tap: { en: 'Tap', he: 'להקיש' },
  put: { en: 'Put', he: 'לשים' },
  match: { en: 'Match', he: 'לחבר' },
  listen: { en: 'Listen', he: 'להקשיב' },
};

/** The plural of a word, for "Find all the ___!" and "How many ___?". */
export function pluralOf(id: string): string {
  const l = labelOf(id);
  if (l === 'fish') return 'fish';
  if (/man$/.test(l)) return `${l.slice(0, -3)}men`; // snowman: snowmen
  if (/ss$|x$|ch$|sh$/.test(l)) return `${l}es`;
  if (/s$/.test(l)) return l; // already a plural: glasses, scissors, skates, shoes
  if (/[^aeiou]y$/.test(l)) return `${l.slice(0, -1)}ies`;
  return `${l}s`;
}
