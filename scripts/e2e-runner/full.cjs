const { chromium } = require('playwright'); const fs = require('fs');
const out = process.argv[2], mode = process.argv[3] || 'decent', video = process.argv[4] === 'video';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, ...(video ? { recordVideo: { dir: out + '/vid', size: { width: 360, height: 740 } } } : {}) });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:'+(process.env.PORT||5330)+'/?runner');
  await p.waitForFunction(() => window.__runner && document.querySelector('[data-go]'), null, { timeout: 15000 });
  await p.waitForTimeout(1500);
  const t0 = Date.now();
  await p.click('[data-go]');
  await p.evaluate(fs.readFileSync(__dirname + '/botpage.js', 'utf8'));
  await p.evaluate((m) => window.__bot(m), mode);
  const got = {}; let info;
  while (Date.now() - t0 < 110000) {
    await p.waitForTimeout(120);
    info = await p.evaluate(() => { const r = __runner.run, g = r.nextGate; return { st: __runner.state(), t: r.t, z: r.z, squish: r.squishT, gate: !!(g && g.prepared && g.z - r.z < 9 && g.z - r.z > 2), reveal: r.gates.some((x) => x.reveal > 0.3), help: !!(g && g.prepared && g.help && g.z - r.z < 14 && g.z - r.z > 3), phase: r.phase, finishT: r.finishT, caught: r.caught }; });
    if (info.gate && !got.gate) { await p.screenshot({ path: out + '/gate.png' }); got.gate = info.t; }
    if (info.squish > 0.28 && !got.hit) { await p.screenshot({ path: out + '/hit.png' }); got.hit = info.t; }
    if (info.help && !got.help) { await p.screenshot({ path: out + '/help.png' }); got.help = info.t; }
    if (info.reveal && !got.reveal) { await p.screenshot({ path: out + '/wrong.png' }); got.reveal = info.t; }
    if (info.phase === 'finish' && info.finishT > 1.6 && !got.fin) { await p.screenshot({ path: out + '/finish.png' }); got.fin = info.t; }
    if (info.st === 'end') { await p.waitForTimeout(600); await p.screenshot({ path: out + '/end.png' }); break; }
  }
  const sum = await p.evaluate(() => { const r = __runner.run; return { t: +r.t.toFixed(1), stars: r.stars, hits: r.hits, correct: r.correct, wrong: r.wrong, gates: r.gates.length, caught: r.caught, fps: Math.round(__runner.fps()), worst: Math.round(__runner.worst()) }; });
  console.log(JSON.stringify({ mode, got, sum, errs, startOffsetMs: 1500 }));
  await ctx.close(); await b.close();
})();
