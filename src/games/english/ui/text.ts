/** Hebrew text with English words inside it: every English phrase is wrapped in <bdi dir="ltr"> so that it keeps its own direction. */
export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const LATIN = /[A-Za-z][A-Za-z0-9'’,.!?\- ]*[A-Za-z0-9!?.]|[A-Za-z]/g;

/** The HTML of a text (safe: the text is escaped first). */
export function mixed(text: string): string {
  return esc(text).replace(LATIN, (m) => `<bdi dir="ltr">${m}</bdi>`);
}
