/** R/Y/G/B/P = brick colour, . = empty. Special bricks (S * ?) arrive in stage 4. */
export const COLORS: Record<string, string> = {
  R: '#ff5d73',
  Y: '#ffd23f',
  G: '#3fb56b',
  B: '#3aa0ff',
  P: '#b57bff',
};

export const LEVELS: string[][] = [
  ['RRRRRRRR',
   'YYYYYYYY'],

  ['RRRRRRRR',
   'YYYYYYYY',
   'GGGGGGGG'],

  ['..RRRR..',
   '.YYYYYY.',
   'GGGGGGGG',
   '.BBBBBB.'],
];
