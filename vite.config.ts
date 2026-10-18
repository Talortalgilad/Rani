import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the project at https://<user>.github.io/Rani/
const base = '/Rani/';

export default defineConfig({
  base,
  plugins: [
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
        background_color: '#fff3ef',
        theme_color: '#8e5cf0',
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
      },
    }),
  ],
});
