export type BrickKind = 'normal' | 'strong' | 'star' | 'surprise';

export interface BrickSpec { color: string; kind: BrickKind }

/** R/Y/G/B/P = brick colour, S = strong (2 hits), * = star, ? = surprise, . = empty. */
export const BRICKS: Record<string, BrickSpec> = {
  R: { color: '#ff5d73', kind: 'normal' },
  Y: { color: '#ffd23f', kind: 'normal' },
  G: { color: '#3fb56b', kind: 'normal' },
  B: { color: '#3aa0ff', kind: 'normal' },
  P: { color: '#b57bff', kind: 'normal' },
  S: { color: '#8c93b8', kind: 'strong' },
  '*': { color: '#5b4b8a', kind: 'star' },
  '?': { color: '#ff9a3c', kind: 'surprise' },
};

export const LEVELS: string[][] = [
  // 1-3: easy, plain bricks only
  ['RRRRRRRR',
   'YYYYYYYY'],

  ['RRRRRRRR',
   'YYYYYYYY',
   'GGGGGGGG'],

  ['..RRRR..',
   '.YYYYYY.',
   'GGGGGGGG',
   '.BBBBBB.'],

  // 4: first stars
  ['RRRRRRRR',
   'YY*YY*YY',
   'GGGGGGGG',
   '.BB**BB.'],

  // 5: first surprises
  ['PPPPPPPP',
   'R?RRRR?R',
   'YYYYYYYY',
   'G.GGGG.G'],

  // 6: first strong bricks
  ['SSSSSSSS',
   'RRRRRRRR',
   'Y?YYYY?Y',
   'GG*GG*GG'],

  // 7: heart
  ['.RR..RR.',
   'RRRRRRRR',
   'RR*RR?RR',
   '.RRRRRR.',
   '..RRRR..',
   '...RR...'],

  // 8: cat
  ['S......S',
   'YY....YY',
   'YYYYYYYY',
   'YGYYYYGY',
   'YYYYYYYY',
   'YYY**YYY',
   '.YYYYYY.'],

  // 9: flower
  ['..PPPP..',
   '.P?RR?P.',
   'PPR**RPP',
   '.PPRRPP.',
   '..PPPP..',
   '...GG...',
   '.G.GG.G.',
   '..GGGG..'],

  // 10: the number 7
  ['BBBBBBBB',
   'BPPPPPPB',
   '......SB',
   '.....SB.',
   '....BB..',
   '...?B...',
   '..BB....',
   '..S*....'],
];
