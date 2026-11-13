/** The pictures made for the letters journey (written by scripts/english-letters-art.py): public/english/letter-words/<word>.webp and letter-squishies/<letter>.webp. */
export const LETTER_WORD_PICS: string[] = [];
export const LETTER_SQUISHY_PICS: string[] = [];

export const letterWordUrl = (word: string): string => `${import.meta.env.BASE_URL}english/letter-words/${word}.webp`;
