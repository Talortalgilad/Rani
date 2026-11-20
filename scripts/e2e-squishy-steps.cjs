// A player who is wrong in every try must still reach the end of every step of the squishy workshop, in both modes (free creation and orders), with a finger (touch, 360 x 740).
// Needs the dev server:  npx vite --port 5310   then   node scripts/e2e-squishy-steps.cjs 5310
const { chromium } = require('playwright');
const port = process.argv[2] || '5310';
const LIMIT = 60000;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const results = [];
  const run = async (name, level, f) => {
    const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
    const t = { start: (x, y) => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }), move: (x, y) => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] }), end: () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }) };
    await p.goto(`http://localhost:${port}/#fps:medium`);
    await p.evaluate(() => { const g = JSON.parse(localStorage.getItem('rani-games-v1') || '{}'); g.settings = Object.assign(g.settings || {}, { lobby: '3d', sound: false, tts: false }); g.games = { english: { openAll: true } }; localStorage.setItem('rani-games-v1', JSON.stringify(g)); });
    await p.reload();
    await p.waitForSelector('.screen.home', { timeout: 40000 });
    await p.evaluate(async (level) => { const m = await import('/src/storage.ts'); m.update((s) => void (s.settings.mathLevel = level)); window.__grantPass('squishy'); location.hash = '#/game/squishy'; }, level);
    await p.waitForSelector('.sq-game');
    await p.waitForTimeout(600);
    const t0 = Date.now();
    let ok = false, note = '';
    try { note = await f(p, t) || ''; ok = true; } catch (e) { note = String(e).split('\n')[0].slice(0, 160); }
    results.push({ name, ok, ms: Date.now() - t0, note, errs: errs.slice(0, 2) });
    await ctx.close();
  };
  const center = async (p, sel) => { const r = await p.locator(sel).boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; };
  const wrongDrops = async (p, t, n) => {
    // drag the bowl to a place that is NOT the mold, n times
    for (let i = 0; i < n; i++) {
      if (!(await p.locator('#pbowl').isVisible().catch(() => false))) return;
      const bw = await center(p, '#pbowl');
      await t.start(bw.x, bw.y); await t.move(bw.x - 90, bw.y + 140); await t.move(bw.x - 100, bw.y + 150); await t.end();
      await p.waitForTimeout(450);
    }
  };
  const pourAndWait = async (p) => { await p.waitForSelector('#pm.ready', { timeout: 20000 }); await p.locator('#pm').click(); };
  const stirWrong = async (p, t) => {
    const f = await center(p, '.sqg-fill');
    await t.start(f.x + 60, f.y);
    for (let k = 0; k < 40; k++) { await t.move(f.x + (k % 2 ? -60 : 60), f.y + (k % 3) * 5); await p.waitForTimeout(25); }
    await t.end();
    await p.waitForSelector('.sqg-lvl', { timeout: 8000 });
  };
  const restOfFree = async (p) => {
    await p.locator('.sqg-tabs button[data-t="finish"]').click(); await p.waitForTimeout(300);
    await p.locator('#pnext').click(); await p.waitForSelector('.sqg-ftabs');
    await p.locator('#fnext').click(); await p.waitForSelector('#meter');
    await p.locator('#snext').evaluate((e) => (e.hidden = false)); await p.locator('#snext').click();
    await p.waitForSelector('#nm');
    await p.locator('#nm').fill('');           // an empty name
    await p.locator('#nok').click();            // is not a lock
    await p.waitForSelector('.sqg-foods');
    await p.locator('.sqg-foods button').first().click();
    await p.locator('#fok').click();
    await p.waitForSelector('.sqg-done');
  };
  // ---- free creation: every step, a player who is wrong
  await run('free: mold, spoons, stir, pour (3 drops beside the mold), paint, face, squeeze, empty name, food, done', 1, async (p, t) => {
    await p.locator('#mnew').click(); await p.waitForSelector('.sqg-tray');
    await p.locator('.sqg-mold[data-s="cat"]').click(); await p.waitForSelector('.sqg-jars');
    await p.locator('.sqg-jar').first().click(); await p.waitForTimeout(400);   // one spoon only
    await p.locator('#sready').click(); await p.waitForSelector('#stir');
    await stirWrong(p, t);
    await wrongDrops(p, t, 3);                      // the third miss pours by itself
    await pourAndWait(p);
    await p.waitForSelector('#stage');
    await restOfFree(p);
  });
  // ---- orders: the three recipes, a player who is wrong in every try, then the check that does not match
  const orderRun = (kind, level) => run(`orders (${kind}): recipe with wrong tries, stir, pour, paint, check that does not match, "give as is"`, level, async (p, t) => {
    await p.locator('.sqg-wait').first().click(); await p.waitForSelector('.sqg-tray');
    const text = (await p.locator('#oc').innerText()).split('\n').pop();
    const word = (text.match(/\b(cat|dog|rabbit|cupcake|star|flower|fish)\b/) || [])[1];
    await p.locator(`.sqg-mold[data-s="${word}"]`).click();
    const rec = await p.evaluate(async () => { await new Promise((r) => setTimeout(r, 700)); return window.__sqgame.store.draft.recipe; });
    if (rec.kind === 'spoons') {
      for (let i = 0; i < rec.n; i++) { await p.locator('.sqg-jar').first().click(); await p.waitForTimeout(350); }
      if (rec.white) for (let i = 0; i < rec.white; i++) { await p.locator('.sqg-jar').nth(1).click(); await p.waitForTimeout(350); }
      await p.waitForSelector('.sqg-choices button', { state: 'visible' });
      // wrong every time: the buttons that are not the answer, three tries
      for (let i = 0; i < 3; i++) { const wrong = p.locator(`.sqg-choices button:not([data-c="${rec.total}"])`).nth(i % 2); if (await wrong.count()) await wrong.click().catch(() => undefined); await p.waitForTimeout(500); if (!(await p.locator('.sqg-choices').count())) break; }
    } else {
      const cupStage = async () => {
        await p.waitForSelector('.sqg-cup');
        const line = await p.evaluate(() => parseFloat(document.querySelector('.tick.goal span').textContent) || 5);
        for (let tries = 0; tries < 16 && (await p.locator('.sqg-cup').count()); tries++) {
          const c = await center(p, '#tap');
          await t.start(c.x, c.y);
          const over = tries % 2 === 0;
          const target = over ? Math.min(9.8, line + 2.5) : Math.max(0.6, line - 2.5);
          const t0 = Date.now();
          while (Date.now() - t0 < 12000 && (await p.locator('.sqg-cup').count())) {
            const l = await p.evaluate(() => { const e = document.querySelector('#liq'); return e ? parseFloat(e.style.height) / 9.4 : 99; });
            if (over ? l >= target : l >= target || l >= line) break;
            await p.waitForTimeout(40);
          }
          await t.end(); await p.waitForTimeout(500);
          // too much: the drain button, a unit for each tap
          for (let i = 0; i < 12 && (await p.locator('#drain:not([hidden])').count()); i++) { const l = await p.evaluate(() => parseFloat(document.querySelector('#liq').style.height) / 9.4); if (l <= line - 0.5) break; await p.locator('#drain').click(); await p.waitForTimeout(250); }
        }
      };
      await cupStage();   // (the half-and-half recipe is two cups one after the other: the loop of tries goes through both)
    }
    await p.waitForSelector('#stir', { timeout: 15000 });
    await stirWrong(p, t);
    await wrongDrops(p, t, 3);
    await pourAndWait(p);
    await p.waitForSelector('#stage');
    // the paint step: next without painting; the face, the squeeze, then the check
    await p.locator('.sqg-tabs button[data-t="finish"]').click(); await p.waitForTimeout(300);
    await p.locator('#pnext').click(); await p.waitForSelector('.sqg-ftabs');
    await p.locator('#fnext').click(); await p.waitForSelector('#meter');
    await p.locator('#snext').evaluate((e) => (e.hidden = false)); await p.locator('#snext').click();
    await p.waitForSelector('.sqg-checks');
    await p.waitForSelector('#asis, #next', { timeout: 15000 });
    if (await p.locator('#asis').count()) await p.locator('#asis').click();   // it does not match: give it as it is (one heart, no failure)
    await p.waitForSelector('#next, #home', { timeout: 8000 });
    return `recipe ${rec.kind}`;
  });
  await orderRun('spoons', 1);
  await orderRun('measuring cup', 3);
  await orderRun('half and half', 4);
  for (const r of results) console.log((r.ok ? 'PASS' : 'FAIL') + `  ${r.name}  (${r.ms} ms) ${r.note} ${r.errs.join(' ')}`);
  await b.close();
  process.exit(results.every((r) => r.ok) ? 0 : 1);
})();
