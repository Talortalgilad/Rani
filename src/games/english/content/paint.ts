/** The white objects of the colouring task (public/english/paint/<id>.webp): painted with multiply, so the shading stays. */
export interface PaintObject { id: string; he: string }
export const PAINT: PaintObject[] = [
  { id: 'ball', he: 'כדור' }, { id: 'balloon', he: 'בלון' }, { id: 'star', he: 'כוכב' }, { id: 'car', he: 'מכונית' }, { id: 'flower', he: 'פרח' },
  { id: 'house', he: 'בית' }, { id: 'shirt', he: 'חולצה' }, { id: 'butterfly', he: 'פרפר' }, { id: 'heart', he: 'לב' },
  { id: 'apple', he: 'תפוח' }, { id: 'book', he: 'ספר' }, { id: 'hat', he: 'כובע' }, { id: 'kite', he: 'עפיפון' },
];
export const paintUrl = (id: string): string => `${import.meta.env.BASE_URL}english/paint/${id}.webp`;
