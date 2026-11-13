/**
 * Counters with numbers in Hebrew text ("10 מתוך 26 אותיות"): each number is isolated (<bdi>), so that the direction of the text can never
 * turn "10 מתוך 26" into "26 מתוך 10", and the whole counter does not break across lines (class cnt: white-space nowrap).
 */
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const bdiNumbers = (escaped: string): string => escaped.replace(/\d+/g, '<bdi>$&</bdi>');
export const counter = (text: string): string => `<span class="cnt">${bdiNumbers(esc(text))}</span>`;

/** A fraction of progress ("3/5"): progress first, then the target, in this order whatever the direction of the text round it. */
export const fraction = (cur: number, target: number): string => `<span class="cnt frac" dir="ltr"><bdi>${cur}</bdi>/<bdi>${target}</bdi></span>`;
