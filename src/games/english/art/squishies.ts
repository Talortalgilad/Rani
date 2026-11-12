/** The twelve squishies, one rescued in each world; their pictures are in public/english/squishies/<id>.webp. */
export interface Squishy { id: string; /** English name, as said and shown */ name: string; world: number; he: string }

export const SQUISHIES: Squishy[] = [
  { id: 'bunny', name: 'Bunny', world: 1, he: 'ארנבון' },
  { id: 'pizza', name: 'Pizza', world: 2, he: 'פיצה' },
  { id: 'leafy', name: 'Leafy', world: 3, he: 'עלה' },
  { id: 'rainbow', name: 'Rainbow', world: 4, he: 'קשת' },
  { id: 'cookie', name: 'Cookie', world: 5, he: 'עוגייה' },
  { id: 'cloud', name: 'Cloud', world: 6, he: 'ענן' },
  { id: 'panda', name: 'Panda', world: 7, he: 'פנדה' },
  { id: 'discoball', name: 'Disco Ball', world: 8, he: 'כדור דיסקו' },
  { id: 'sunny', name: 'Sunny', world: 9, he: 'שמשון' },
  { id: 'kitty', name: 'Kitty', world: 10, he: 'חתלתול' },
  { id: 'ninjacat', name: 'Ninja Cat', world: 11, he: 'חתול נינג׳ה' },
  { id: 'unicorn', name: 'Unicorn', world: 12, he: 'חד קרן' },
];

export const squishyOfWorld = (world: number): Squishy => SQUISHIES.find((s) => s.world === world) ?? SQUISHIES[0];
export const squishyUrl = (id: string): string => `${import.meta.env.BASE_URL}english/squishies/${id}.webp`;
export const squishyImg = (id: string): string => `<img class="squishy-img" src="${squishyUrl(id)}" alt="" draggable="false" decoding="async">`;
