/** The colours of world 4 (the drawing studio). They have no picture: a swatch. Their Leitner key is `color:<id>`. */
export interface ColorWord { id: string; hex: string; he: string }
export const COLORS: ColorWord[] = [
  { id: 'red', hex: '#ff4d5e', he: 'אדום' },
  { id: 'blue', hex: '#3a8bff', he: 'כחול' },
  { id: 'yellow', hex: '#ffd23f', he: 'צהוב' },
  { id: 'pink', hex: '#ff8fd0', he: 'ורוד' },
  { id: 'purple', hex: '#8e5cf0', he: 'סגול' },
  { id: 'green', hex: '#3fb56b', he: 'ירוק' },
];
export const colorById = (id: string): ColorWord => COLORS.find((c) => c.id === id) ?? COLORS[0];
export const colorKey = (id: string): string => `color:${id}`;
