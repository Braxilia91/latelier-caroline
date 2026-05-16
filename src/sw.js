/**
 * sw.js — Service Worker personnalisé pour L'Atelier Caroline.
 *
 * Stratégie : injectManifest (vite-plugin-pwa).
 * self.__WB_MANIFEST est injecté au build par vite-plugin-pwa.
 *
 * Fonctionnalités :
 *   1. Précache des assets statiques (remplace generateSW automatique)
 *   2. Cache-First pour Google Fonts (réplique workbox.runtimeCaching précédent)
 *   3. Share Target : intercepte POST /share-target, stocke l'image, redirige /?share=pending
 *
 * FEAT-B — Share Target (Lot 2)
 */

import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

// ── FEAT-B — Share Target ─────────────────────────────────────────
// Intercepté EN PREMIER, avant workbox, pour éviter tout conflit avec
// le précache handler (qui ne gère que les requêtes GET).
// Cache key partagé avec App.jsx (lecture au montage via Cache API).
const SHARE_CACHE = 'share-target-v1'

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.pathname !== '/share-target' || event.request.method !== 'POST') return

  event.respondWith((async () => {
    try {
      const formData = await event.request.formData()
      const file = formData.get('image')
      if (file instanceof File && file.size > 0) {
        const cache = await caches.open(SHARE_CACHE)
        await cache.put(
          '/share-pending',
          new Response(file, {
            headers: {
              'Content-Type': file.type || 'image/jpeg',
              'X-Share-Filename': file.name || 'photo.jpg',
            }
          })
        )
      }
    } catch (err) {
      // Tolérant — si le stockage échoue, l'app s'ouvre quand même sans l'image
      console.warn('[SW/share-target] erreur stockage:', err)
    }
    // Redirect vers l'app avec marker — App.jsx lit le param et ouvre AddTraceFlow
    return Response.redirect('/?share=pending', 303)
  })())
})

// ── Précache des assets buildés ───────────────────────────────────
// __WB_MANIFEST injecté par vite-plugin-pwa au build.
// Gère les révisions et l'invalidation automatique au déploiement.
precacheAndRoute(self.__WB_MANIFEST)

// ── Google Fonts — Cache-First ─────────────────────────────────────
// Réplique exacte de workbox.runtimeCaching dans l'ancienne config generateSW.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 31_536_000 })
    ]
  })
)
