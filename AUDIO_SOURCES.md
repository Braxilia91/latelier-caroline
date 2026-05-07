# AUDIO_SOURCES.md — L'Atelier — Mon Histoire
## Sources audio — Ambiance d'écriture

Politique : **Freesound CC0 prioritaire**. Aucune voix intelligible. Pas d'événements agressifs. Les boucles doivent rester agréables sur une écoute prolongée (≥ 10 min en répétition).

---

## Pack V1.5 intégré (`public/sounds/`)

| Fichier produit | Source Freesound | Auteur | Licence | Durée | Statut |
|---|---|---|---|---|---|
| `pluie.mp3` | [#789162](https://freesound.org/people/FOSSarts/sounds/789162/) | FOSSarts | CC0 | 10 s (loop) | ✅ Intégré |
| `feu.mp3` | [#508110](https://freesound.org/people/ahriik/sounds/508110/) | ahriik | À revalider | 27 s (loop) | ✅ Intégré |
| `cafe.mp3` | [#366483](https://freesound.org/people/paultherocker3000/sounds/366483/) | paultherocker3000 | À revalider | 4 min | ✅ Intégré |
| `foret.mp3` | [#687053](https://freesound.org/people/deadrobotmusic/sounds/687053/) | deadrobotmusic | CC0 explicite | 50 s (loop) | ✅ Intégré |

> **Avant mise en production commerciale** : revalider la licence de `feu` (ahriik) et `cafe` (paultherocker3000) directement sur leur page Freesound respective.

---

## Conversion appliquée

- Format source → MP3 128 kbps, 44 100 Hz (stéréo)
- Outil : ffmpeg 4.4.2
- Lecture en boucle native : `audio.loop = true` (HTML5 Audio API)

---

## Candidats de secours (non intégrés)

| Ambiance | Source | Auteur | URL | Statut |
|---|---|---|---|---|
| Pluie variante | Freesound #790664 | Sadiquecat | https://freesound.org/s/790664/ | MAYBE |
| Pluie légère | Freesound #518863 | idomusics | https://freesound.org/people/idomusics/sounds/518863/ | MAYBE |
| Feu cheminée | Freesound #802230 | Sadiquecat | https://freesound.org/people/Sadiquecat/sounds/802230/ | GO (non téléchargé) |
| Café variante | Freesound #511924 | Artemis_R_Swann | https://freesound.org/people/Artemis_R_Swann/sounds/511924/ | MAYBE |
| Forêt vivante | Freesound pack #45499 | GammaGool | https://freesound.org/people/GammaGool/packs/45499/ | GO (non intégré) |

---

## Mapping humeur → ambiance suggérée (V1.5, suggestion uniquement)

| Humeur | Son suggéré | Logique |
|---|---|---|
| Triste | Feu calme | Contenante, chaleureuse |
| Nostalgique | Pluie douce ou Café | Évocatrice |
| Confuse | Forêt légère | Stable, peu intrusive |
| Fatiguée | Feu calme | Lente, enveloppante |
| Motivée | Café feutré | Légèrement dynamique |

---

## Règles UX (non négociables)

- Pas d'autoplay forcé — démarrage uniquement sur action utilisateur
- `ambientEnabled` toujours `false` au démarrage (pas de persistance de l'état on/off)
- `ambientSound` et `ambientVolume` sont persistés (IndexedDB via `useDB`)
- Volume initial recommandé : **28%** (`ambientVolume = 0.28`)
- Suggestion selon humeur → toujours optionnelle, jamais imposée

---

## V2 backlog audio

- Mixage 2 couches (pluie + feu, forêt + café)
- Bruit brun (concentration pure)
- Bibliothèque / pages
- Train lointain
- Analytics locales : quelle ambiance = plus de mots écrits
- Reprise automatique de la dernière ambiance (opt-in)
