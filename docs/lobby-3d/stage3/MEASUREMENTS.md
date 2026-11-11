# Lobby 3D, stage 3: measurements

## FPS (production build, 390×780 @2x, CPU throttled 4× with Chrome DevTools)
Software WebGL (SwiftShader, no GPU), so the FPS of the 3D tiers is dominated by rasterisation on the CPU and says little
about a phone. The CPU-side cost of a frame (`js`: update + render calls, no GPU share) and the scene size are what carry over.

| tier | CPU | FPS (median, min–max) | js per frame | draw calls | triangles |
|---|---|---|---|---|---|
| high | 1× | 10 (8–14) | 1.6 ms | 71 | 54k |
| medium | 1× | 31 (27–38) | 0.9 ms | 59 | 36k |
| regular (2D) | 1× | 60 (60–60) | – | – | – |
| high | 4× | 8 (7–10) | 5.5 ms | 70 | 53k |
| medium | 4× | 27 (22–30) | 2.9 ms | 58 | 36k |
| regular (2D) | 4× | 60 (60–60) | – | – | – |

To measure on a phone: open the app with `#fps` at the end of the address (`#fps:high`, `#fps:medium` or `#fps:2d` pins a
tier and turns off the automatic fall-back). The setting lasts for the rest of the session.

## Bundle (gzip)
Eager (regular app): 34.7 KB. Lazy 3D part: ~153 KB, of which our code is ~9 KB.

| chunk | raw min | gzip | what |
|---|---|---|---|
| `index-*.js` (lobby) | 374 KB | 93.3 KB | `three.module.js`: the WebGL renderer (~228 KB raw / ~51 KB gz of it is GLSL shader source) + our lobby code (~25 KB raw / ~9 KB gz: index, islands, stage, jar, sky, carousel, pick) |
| `shapes-*.js` | 207 KB | 57.3 KB | `three.core.js`: maths, scene graph, geometries, materials, textures + our `shapes.ts` and `motion.ts` |
| `lobby-island-*.js` ×2, `particles-*.js` | 2–2.3 KB each | 1.2, 1.2, 0.8 KB | the two game miniatures and the particle system |

`ANALYZE=1 npm run build` writes `dist/stats.html` (treemap) and `dist/stats.json`; `python3 scripts/analyze-bundle.py` summarises it.
