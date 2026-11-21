const { chromium } = require('playwright');
const throttle = Number(process.argv[2] || 1);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const cdp = await ctx.newCDPSession(p);
  await p.goto('http://localhost:'+(process.env.PORT||5330)+'/?runner');
  await p.waitForFunction(() => window.__runner && document.querySelector('[data-go]'));
  await p.waitForTimeout(600);
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  // the start button with a real tap
  const bb = await (await p.$('[data-go]')).boundingBox();
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await touch('touchStart', bb.x + bb.width / 2, bb.y + bb.height / 2); await touch('touchEnd'); await p.waitForTimeout(500);
  const rnd = (a, b2) => a + Math.random() * (b2 - a);
  const results = [];
  const gesture = async (kind) => {
    // where she puts the finger: the lower middle of the screen, a bit of everywhere
    const x0 = rnd(110, 250), y0 = rnd(380, 600);
    let dx = 0, dy = 0, dur = rnd(70, 250), steps = 6;
    if (kind === 'right') { dx = rnd(45, 130); dy = rnd(-22, 22); }
    if (kind === 'left') { dx = -rnd(45, 130); dy = rnd(-22, 22); }
    if (kind === 'up') { dy = -rnd(55, 140); dx = rnd(-25, 25); }
    if (kind === 'tap') { dx = rnd(-4, 4); dy = rnd(-4, 4); dur = rnd(40, 160); steps = 2; }
    await touch('touchStart', x0, y0);
    for (let i = 1; i <= steps; i++) { await p.waitForTimeout(dur / steps); await touch('touchMove', x0 + (dx * i) / steps, y0 + (dy * i) / steps); }
    await touch('touchEnd');
  };
  const plan = []; for (let i = 0; i < 10; i++) plan.push(i % 2 ? 'left' : 'right'); for (let i = 0; i < 10; i++) plan.push(i % 2 ? 'up' : 'tap');
  // mix the order of the swipes and the jumps
  const order = plan.map((k, i) => [k, Math.random()]).sort((a, b2) => a[1] - b2[1]).map((x) => x[0]);
  let ok = { move: 0, jump: 0 }, total = { move: 0, jump: 0 };
  for (const k of order) {
    const before = await p.evaluate(() => ({ g: __runner.gestures.length, target: __runner.run.target, jt: __runner.run.jt, t: __runner.run.t }));
    await gesture(k);
    await p.waitForTimeout(70);
    const after = await p.evaluate(() => ({ g: __runner.gestures.slice(-3), n: __runner.gestures.length, target: __runner.run.target, jt: __runner.run.jt, state: __runner.state() }));
    const last = after.g[after.g.length - 1];
    const isMove = k === 'left' || k === 'right';
    const want = isMove ? { kind: 'move', dir: k === 'right' ? 1 : -1 } : { kind: 'jump' };
    const recognised = after.n === before.g + 1 && last.kind === want.kind && (!isMove || last.dir === want.dir);
    const effect = isMove ? after.target !== before.target || (k === 'right' && before.target === 1) || (k === 'left' && before.target === -1) : after.jt >= 0;
    total[isMove ? 'move' : 'jump']++; if (recognised && effect) ok[isMove ? 'move' : 'jump']++;
    results.push(`${k}:${recognised ? 'ok' : 'MISS'}${effect ? '' : '(no effect)'}`);
    await p.waitForTimeout(rnd(700, 900));
  }
  const fps = await p.evaluate(() => Math.round(__runner.fps()));
  console.log(JSON.stringify({ throttle, ok, total, results, fps, errs }));
  await b.close();
})();
