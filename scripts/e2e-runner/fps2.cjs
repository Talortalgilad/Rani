const { chromium } = require('playwright');
const [throttle, dpr] = [Number(process.argv[2] || 4), Number(process.argv[3] || 2)];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await p.goto('http://localhost:'+(process.env.PORT||5330)+'/?runner');
  await p.waitForFunction(() => window.__runner && document.querySelector('[data-go]'));
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await p.click('[data-go]');
  await p.evaluate(require('fs').readFileSync(__dirname + '/botpage.js', 'utf8')); await p.evaluate(() => window.__bot('good'));
  const all = [];
  for (let i = 0; i < 40; i++) { await p.waitForTimeout(1000); all.push(await p.evaluate(() => Math.round(__runner.fps()))); }
  const half = all.slice(10).sort((a, b2) => a - b2);
  console.log(JSON.stringify({ throttle, dpr, first10s: all.slice(0, 10), after10s: { min: half[0], median: half[Math.floor(half.length / 2)], max: half[half.length - 1] }, scale: await p.evaluate(() => document.querySelector('canvas').width / 360) }));
  await b.close();
})();
