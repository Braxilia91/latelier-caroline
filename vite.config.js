import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // ── define racine : hérité par Vitest ET par le build Vite ────
  define: {
    // ⚠️ Ne PAS fournir de fallback en dur : une URL de test en prod = bug silencieux
    // Déclarer VITE_SYNC_WORKER_URL dans Cloudflare Pages → Settings → Env vars
    'import.meta.env.VITE_SYNC_WORKER_URL': JSON.stringify(
      process.env.VITE_SYNC_WORKER_URL || ''
    ),
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // FEAT-B — injectManifest : nécessaire pour gérer le Share Target POST dans sw.js
      // generateSW ne permet pas d'intercepter des requêtes POST custom.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: "L'Atelier — Mon Histoire",
        short_name: "L'Atelier",
        description: "Ton espace d'écriture autobiographique accompagné par Léa.",
        // BUG #3 — par défaut VitePWA générait `lang: "en"` dans manifest.webmanifest,
        // ce qui faisait suggérer des mots anglais au clavier virtuel Android et
        // dégradait le signal i18n/SEO. Aligné explicitement sur public/manifest.json.
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#FAF7F2',
        theme_color: '#8B6445',
        categories: ['productivity', 'lifestyle'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ],
        // FEAT-B — Share Target : L'Atelier apparaît dans le menu de partage iOS/Android
        // quand l'app est installée en PWA.
        // URL absolue obligatoire : Chrome Android rejette silencieusement les URL relatives
        // dans share_target.action (bug Chromium connu).
        share_target: {
          action: 'https://latelier-caroline.pages.dev/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            files: [{ name: 'image', accept: ['image/*'] }]
          }
        }
      }
      // workbox config supprimée — désormais gérée directement dans src/sw.js
    })
  ]
})
