import { generate, lastFail, paramsFor } from '../src/games/traffic/engine/generator';
for (const L of [15, 25]) {
  const base = paramsFor(L);
  console.log(L, JSON.stringify(base));
  for (const [name, p] of [['asis', { ...base, minDensity: 0.5 }], ['fewer', { ...base, minDensity: 0.5, vehicles: base.vehicles - 2 }]] as const) {
    const fails: Record<string, number> = {};
    let ok = 0;
    const t0 = Date.now();
    for (let s = 1; s <= 12; s++) { const b = generate(p as any, 500 * L + s); if (b) ok++; else { const k = lastFail.slice(0, 60); fails[k] = (fails[k] ?? 0) + 1; } }
    console.log(' ', name, 'ok', ok, JSON.stringify(fails), Date.now() - t0, 'ms');
  }
}
