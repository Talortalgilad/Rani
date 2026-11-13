import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';

// Vercel serves the app from the domain root
const base = '/';

export default defineConfig({
  base,
  plugins: [
    // `ANALYZE=1 npm run build` writes dist/stats.json (and stats.html) with the size of every module
    ...(process.env.ANALYZE ? [visualizer({ filename: 'dist/stats.json', template: 'raw-data', gzipSize: true }), visualizer({ filename: 'dist/stats.html', template: 'treemap', gzipSize: true })] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'המשחקים של רני',
        short_name: 'רני',
        description: 'משחקים בלי פרסומות, עם תרגילי חשבון קצרים',
        lang: 'he',
        dir: 'rtl',
        id: base,
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        // the splash screen and the status bar match the lobby sky and the icon
        background_color: '#7cc0f4',
        theme_color: '#5ab2f5',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // woff2 only: every browser that can install the app supports it, so the .woff fallbacks stay out of the cache
        globPatterns: ['**/*.{js,css,html,png,woff2,webmanifest}'],
        globIgnores: ['**/*.woff'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        // the pictures of the English game are not in the main precache: a world's pictures are fetched when the world is entered and
        // kept for offline by this runtime cache
        runtimeCaching: [
          {
            urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/english/') || url.pathname.startsWith('/memory/') || url.pathname.startsWith('/blocks/'),
            handler: 'CacheFirst',
            // pictures and the recorded Hebrew voice (mp3: Safari asks for ranges)
            options: { cacheName: 'english-images', expiration: { maxEntries: 400 }, cacheableResponse: { statuses: [0, 200] }, rangeRequests: true },
          },
        ],
      },
    }),
  ],
});
