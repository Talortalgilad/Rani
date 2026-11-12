/**
 * Hebrew text with English in it. Every piece is its own isolated run, so the order on the screen never depends on how the browser
 * resolves punctuation between scripts: an English phrase (with its comma) is an LTR run, the Hebrew round it is an RTL run, and the
 * sentence's closing punctuation ("!", "?", ".") always belongs to the Hebrew sentence: it ends the line, at its left end.
 * "On, זה על!" is the English "On," at the start (right), then "זה על!" and the "!" at the end (left).
 */
export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// an English phrase with its comma/colon (when it is followed by Hebrew), or a single English letter
const LATIN = /[A-Za-z][A-Za-z0-9'’\- ]*[A-Za-z0-9](?:[,.:;])?|[A-Za-z](?:[,.:;])?/g;

export type Run = { dir: 'ltr' | 'rtl'; text: string };

/** The runs of a text, in the order they are written. */
export function runsOf(text: string): Run[] {
  const m = text.match(/^([\s\S]*?)([!?.…]+)\s*$/);
  const body = m ? m[1] : text;
  const tail = m ? m[2] : '';
  const runs: Run[] = [];
  let last = 0;
  const push = (dir: Run['dir'], t: string): void => {
    const x = t.trim();
    if (x) runs.push({ dir, text: x });
  };
  for (const hit of body.matchAll(LATIN)) {
    push('rtl', body.slice(last, hit.index));
    push('ltr', hit[0]);
    last = (hit.index ?? 0) + hit[0].length;
  }
  push('rtl', body.slice(last));
  if (tail) {
    const end = runs[runs.length - 1];
    if (end && end.dir === 'rtl') end.text += tail;
    else runs.push({ dir: 'rtl', text: tail });
  }
  return runs;
}

/** The HTML of a text (safe: the text is escaped). A text with no English stays one plain run. */
export function mixed(text: string): string {
  if (!/[A-Za-z]/.test(text)) return esc(text);
  return runsOf(text).map((r) => `<span class="run ${r.dir === 'ltr' ? 'en' : 'he'}" dir="${r.dir}">${esc(r.text)}</span>`).join(' ');
}
