# PWA refresh

- Precache: 40 entries, 1,524 KiB (about 1.5 MB), well under 5 MB. Heaviest: the Traffic levels chunk (483 KB, holds levels.json), Three.js (350 KB + 215 KB), the main chunk (110 KB), the Traffic scene (46 KB), the 10 woff2 fonts (Rubik + Fredoka, 5-19 KB each).
- Offline check (`offline-check.cjs`, against `vite preview`): after the first visit the lobby reloads offline, and a brick-breaker level, the memory journey (a level) and Traffic level 76 (carnival) all open with 0 failed requests; every response comes from the service worker.
- Updates: `registerType: 'autoUpdate'` (skipWaiting + clientsClaim). Measured: open 2 (new version online) still shows the old version while the new one installs; open 3 shows the new version.
