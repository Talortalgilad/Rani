const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 412, height: 860 }, serviceWorkers: 'allow' });
  const p = await ctx.newPage();
  const log = { fail: [], err: [], net: [] };
  let phase = 'online';
  p.on('requestfailed', (r) => log.fail.push(`${phase} ${r.url()} ${r.failure()?.errorText}`));
  p.on('pageerror', (e) => log.err.push(`${phase} ${e.message.slice(0, 200)}`));
  p.on('console', (m) => { if (m.type() === 'error') log.err.push(`${phase} console: ${m.text().slice(0, 200)}`); });
  p.on('response', (r) => { if (phase !== 'online') log.net.push(`${r.status()} ${r.fromServiceWorker() ? 'SW' : 'NET'} ${r.url().replace('http://localhost:4173', '')}`); });
  await p.addInitScript(() => { if (!localStorage.getItem('rani-games-v1')) localStorage.setItem('rani-games-v1', JSON.stringify({ stars: 30, games: { traffic: { progress: { stars: {}, current: '76' } } }, settings: { lobby: '3d', sound: false, gateQuestions: 0 } })); });
  await p.goto('http://localhost:4173/#fps:medium');
  await p.waitForTimeout(3000);
  const swState = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; return r.active?.state; });
  console.log('sw', swState);
  await p.waitForTimeout(6000); // the precache fills
  const cached = await p.evaluate(async () => { const ks = await caches.keys(); let n = 0; for (const k of ks) n += (await (await caches.open(k)).keys()).length; return { keys: ks, n }; });
  console.log('cache', JSON.stringify(cached));
  phase = 'offline';
  await ctx.setOffline(true);
  const shot = async (name) => p.screenshot({ path: `offline/${name}.png` });
  await p.reload(); await p.waitForTimeout(6000); await shot('lobby');
  console.log('lobby canvas', await p.evaluate(() => !!document.querySelector('canvas')));
  for (const [g, wait] of [['brick-breaker', 4000], ['memory', 4000], ['traffic', 9000]]) {
    await p.evaluate((x) => { location.hash = `#/game/${x}`; }, g);
    await p.waitForTimeout(1500); await p.evaluate(() => document.querySelector('#start')?.click()); await p.waitForTimeout(wait); await shot(g);
    console.log(g, 'ok; canvas', await p.evaluate(() => !!document.querySelector('canvas')), 'title', await p.evaluate(() => (document.querySelector('.tr-title')?.textContent || document.body.innerText.slice(0, 40)).replace(/\s+/g, ' ')));
    await p.evaluate(() => { location.hash = '#/'; }); await p.waitForTimeout(1500);
  }
  // a memory level, offline: the menu, then the first level of the journey
  await p.evaluate(() => { location.hash = '#/game/memory'; }); await p.waitForTimeout(1500); await p.evaluate(() => document.querySelector('#start')?.click()); await p.waitForTimeout(2500);
  console.log('memory buttons', await p.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.id + ':' + b.className + ':' + b.textContent.trim().slice(0, 12)).slice(0, 14).join(' | ')));
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /מסע/.test(x.textContent)); b && b.click(); }); await p.waitForTimeout(2500); await shot('memory-journey');
  console.log('memory buttons 2', await p.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.id + ':' + b.className + ':' + b.textContent.trim().slice(0, 12)).slice(0, 14).join(' | ')));
  await p.evaluate(() => document.querySelector('.mm-stop.current')?.click()); await p.waitForTimeout(3500); await shot('memory-level'); console.log('memory level cards', await p.evaluate(() => document.querySelectorAll('[class*=card]').length), 'imgs/svg', await p.evaluate(() => document.querySelectorAll('svg,img').length));
  console.log('FAILED requests:', log.fail.length); log.fail.forEach((x) => console.log(' ', x));
  console.log('errors:', log.err.length); log.err.slice(0, 6).forEach((x) => console.log(' ', x));
  const nonSw = log.net.filter((x) => !x.includes(' SW '));
  console.log('responses offline', log.net.length, 'not from SW', nonSw.length); nonSw.slice(0, 8).forEach((x) => console.log(' ', x));
  await b.close();
})();
