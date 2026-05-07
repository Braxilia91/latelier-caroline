# L'Atelier — Mon Histoire

Application web PWA pour écrire son autobiographie. Interface intimiste, coach IA Léa, ambiance sonore, dictée vocale, synchronisation multi-appareils.

Déployée sur **Cloudflare Pages** à partir de la branche `main`.

---

## Stack

| Couche | Techno |
|--------|--------|
| UI | React 19, Vite 8 |
| PWA | vite-plugin-pwa (Workbox) |
| Stockage local | IndexedDB (lib `src/lib/db.js`) |
| Sync cloud | Cloudflare Worker (KV) |
| IA coach | Claude API (Anthropic) + OpenAI TTS |
| Icons | lucide-react |
| Fonts | Cormorant Garamond · Lora · Nunito (Google Fonts) |
| Tests | Vitest + jsdom |
| Déploiement | Cloudflare Pages (auto-deploy sur `main`) |

---

## Structure

```
src/
  components/
    layout/        Header, Sidebar, CoachPanel
    modals/        DictationModal, SettingsModal, ExportModal, VracModal, …
    onboarding/    Onboarding (premier lancement)
    ui/            Toast
    writing/       WritingArea
  hooks/
    useDB.js       État global + persistence IndexedDB
    useCoach.js    Logique coach IA Léa
    useVoice.js    Web Speech API (dictée)
    useAutoSave.js Auto-save debounced
  lib/
    db.js          IndexedDB CRUD
    sync.js        Push/pull snapshot Cloudflare Worker
    prompts.js     Système de prompts Léa
  styles/
    globals.css    Thèmes (jour / soir / bougie), animations

public/
  sounds/          Ambiance d'écriture MP3 (pluie, feu, café, forêt)
  icon-192.png
  icon-512.png
```

---

## Lancer en développement

```bash
npm install
npm run dev        # http://localhost:5173
```

---

## Scripts

| Commande | Action |
|----------|--------|
| `npm run dev` | Serveur dev HMR |
| `npm run build` | Build production (`dist/`) |
| `npm run preview` | Preview du build local |
| `npm run lint` | ESLint flat config |
| `npm run test` | Vitest (run unique) |
| `npm run test:watch` | Vitest en mode watch |
| `npm run check` | lint + test + build (CI local) |

---

## Variables d'environnement

À configurer dans **Cloudflare Pages → Settings → Environment variables** :

| Variable | Requis | Description |
|----------|--------|-------------|
| `VITE_SYNC_WORKER_URL` | Optionnel | URL du Cloudflare Worker de sync. Si absent, la sync inter-appareils est désactivée silencieusement. |

> Ne jamais mettre de valeur de fallback en dur dans `vite.config.js` — un Worker de test en prod crée une perte de données silencieuse.

---

## PWA & offline

- Service worker géré par Workbox via `vite-plugin-pwa`
- Stratégie : `autoUpdate` (mise à jour silencieuse)
- Assets pré-cachés : JS, CSS, HTML, images, fonts, **MP3** (sons ambiance)
- Données utilisateur : IndexedDB (persist storage demandé au navigateur)

---

## Ambiance sonore

Voir [`AUDIO_SOURCES.md`](./AUDIO_SOURCES.md) pour les sources, licences et backlog audio.

---

## Déploiement

Push sur `main` → build automatique Cloudflare Pages → déploiement ~1 min.

```bash
git add .
git commit -m "feat: description"
git push origin main
```

---

## Développeur

Mourad — projet solo, 2025–2026.
