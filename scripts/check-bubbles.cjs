/**
 * Renders every speech bubble of the English game in a real browser and checks the direction of what is on the screen:
 * in a right-to-left line the start is the RIGHT end, so no line may begin (at its right end) with "!", "?" or ".", and a bubble
 * that ends with "!" must show it at the left end of its last line.
 * Needs the dev server: `npm run dev -- --port 5199`, then `node scripts/check-bubbles.cjs`.
 */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 412, height: 860 } })).newPage();
  await p.addInitScript(() => localStorage.setItem('rani-games-v1', JSON.stringify({ stars: 0, games: { english: { companion: { name: 'צ׳יזי' } } }, settings: { lobby: '2d', sound: false, tts: false } })));
  await p.goto(`http://localhost:${process.env.PORT || 5199}/#/game/english`);
  await p.waitForSelector('.english-root');
  const bad = await p.evaluate(async () => {
    const { allBubbleTexts } = await import('/src/games/english/content/bubbles.ts');
    const { mixed } = await import('/src/games/english/ui/text.ts');
    const root = document.querySelector('.english-root');
    const problems = [];
    let n = 0;
    for (const text of allBubbleTexts()) {
      const bub = document.createElement('div');
      bub.className = 'bubble';
      bub.style.cssText = 'position:absolute;top:100px;right:10px;width:260px;';
      bub.innerHTML = mixed(text);
      root.appendChild(bub);
      n++;
      // the rect of every character, grouped into lines
      const walker = document.createTreeWalker(bub, NodeFilter.SHOW_TEXT);
      const chars = [];
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        for (let i = 0; i < t.data.length; i++) {
          if (!t.data[i].trim()) continue;
          const r = document.createRange();
          r.setStart(t, i);
          r.setEnd(t, i + 1);
          const q = r.getBoundingClientRect();
          chars.push({ c: t.data[i], l: q.left, r: q.right, y: Math.round(q.top / 6) });
        }
      }
      const lines = new Map();
      for (const ch of chars) lines.set(ch.y, [...(lines.get(ch.y) || []), ch]);
      const sorted = [...lines.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
      sorted.forEach((ln, i) => {
        const right = ln.reduce((a, c) => (c.r > a.r ? c : a));
        if (/[!?.]/.test(right.c)) problems.push(`${text}: line ${i + 1} starts (at its right end) with "${right.c}"`);
      });
      const last = sorted[sorted.length - 1];
      if (/[!?]$/.test(text.trim()) && last) {
        const left = last.reduce((a, c) => (c.l < a.l ? c : a));
        if (!/[!?]/.test(left.c)) problems.push(`${text}: the closing "${text.trim().slice(-1)}" is not at the left end of the last line (it is "${left.c}")`);
      }
      bub.remove();
    }
    return { n, problems };
  });
  console.log(`${bad.n} bubbles checked`);
  if (bad.problems.length) { console.log(bad.problems.join('\n')); process.exitCode = 1; } else console.log('OK: no line starts with "!" "?" or ".", and every closing mark is at the end');
  await b.close();
})();
