/** The pictures made for the letters journey (written by scripts/english-letters-art.py): public/english/letter-words/<word>.webp and letter-squishies/<letter>.webp. */
export const LETTER_WORD_PICS: string[] = ['bat', 'bus', 'cup', 'fox', 'hen', 'igloo', 'jam', 'man', 'map', 'mat', 'mug', 'nap', 'nest', 'net', 'octopus', 'pan', 'pat', 'pig', 'pin', 'queen', 'sat', 'tap', 'tin', 'van', 'web', 'yoyo', 'zebra'];
export const LETTER_SQUISHY_PICS: string[] = ['f', 'g', 'm', 'r', 's', 'z'];

export const letterWordUrl = (word: string): string => `${import.meta.env.BASE_URL}english/letter-words/${word}.webp`;
