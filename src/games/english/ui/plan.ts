/** The first station of world 1 ("my room"): three new words, then five tasks. Pure data: tested. */
export type Step =
  | { kind: 'card'; word: string }
  | { kind: 'circle'; right: string; ids: string[] }
  | { kind: 'tap'; right: string; ids: string[] }
  | { kind: 'put'; right: string; others: string[] }
  | { kind: 'listen'; right: string; ids: string[] }
  | { kind: 'match'; ids: string[] };

export const NEW_WORDS = ['ball', 'book', 'bed'];

export function cardPlan(): Step[] {
  return [
    ...NEW_WORDS.map((w): Step => ({ kind: 'card', word: w })),
    { kind: 'circle', right: 'ball', ids: NEW_WORDS },
    { kind: 'tap', right: 'bed', ids: NEW_WORDS },
    { kind: 'put', right: 'book', others: ['ball', 'bed'] },
    { kind: 'listen', right: 'ball', ids: NEW_WORDS },
    { kind: 'match', ids: NEW_WORDS },
  ];
}
