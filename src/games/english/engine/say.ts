/**
 * Forgiving matching of what the speech recognition heard against the word that was asked for (SPEC-english.md 4.5/4.6): a child who
 * speaks Hebrew says "piza" or "pitsa", the recogniser writes something near it. Pure: no browser.
 */
const norm = (s: string): string => s.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

export function levenshtein(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** A rough sound key (like Soundex): the first letter, then the consonant sounds; vowels, doubles and h/w/y are dropped. */
export function soundKey(s: string): string {
  const t = norm(s).replace(/ /g, '').replace(/ph/g, 'f').replace(/ts/g, 's').replace(/ck/g, 'k').replace(/^kn/, 'n');
  if (!t) return '';
  const code: Record<string, string> = { b: '1', f: '1', p: '1', v: '1', c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2', d: '3', t: '3', l: '4', m: '5', n: '5', r: '6' };
  let out = t[0];
  let last = code[t[0]] ?? '';
  for (const ch of t.slice(1)) {
    const c = code[ch] ?? '';
    if (c && c !== last) out += c;
    last = c;
  }
  return out;
}

/** True when one of the things that were heard is the word, or close enough to it. */
export function heardWord(heard: string[], target: string): boolean {
  const want = norm(target);
  if (!want) return false;
  const maxDist = want.length <= 5 ? 1 : 2;
  return heard.some((h) => {
    const x = norm(h);
    if (!x) return false;
    if (x === want || x.split(' ').includes(want) || x.includes(want)) return true;
    // each word she may have said, or the whole thing
    return [x, ...x.split(' ')].some((part) => levenshtein(part, want) <= maxDist || (soundKey(part) === soundKey(want) && Math.abs(part.length - want.length) <= 2));
  });
}
