const WORDS = [
  'אפס', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע', 'עשר',
  'אחת עשרה', 'שתים עשרה', 'שלוש עשרה', 'ארבע עשרה', 'חמש עשרה', 'שש עשרה',
  'שבע עשרה', 'שמונה עשרה', 'תשע עשרה', 'עשרים',
];

/** Feminine Hebrew number words for 0–20 (used for read-aloud). */
export function numberToHebrew(n: number): string {
  return WORDS[n] ?? String(n);
}
