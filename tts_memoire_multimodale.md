# Mémoire multimodale, TTS et dictée – L’Atelier Caroline

## 1. Vision produit globale

- Passer d’une simple dictée à une **architecture mémoire multimodale** : voix live, notes vocales différées, OCR de papiers, souvenirs déclenchés par objets/lieux, puis insertion assistée dans le livre.[web:496]
- Séparer clairement trois espaces:
  - **Chapitre**: texte narratif propre destiné au livre.
  - **Boîte à idées / Fragments**: pensées brutes, notes vocales, OCR, souvenirs flash.
  - **Atelier d’assemblage IA**: espace où Léa aide à transformer les fragments en matériau narratif avant insertion.[web:500]
- Logique centrale: dictée live va vers le chapitre; vocal/OCR/photo vont vers des fragments; Léa propose l’assemblage; Caroline valide l’insertion.[web:498]

## 2. TTS / Voix de Léa

### 2.1 Problèmes observés

- Voix souvent **robotique**: prosodie plate, peu de variations, intonation linéaire.[web:496]
- Prononciation erronée: lit "explorer" comme "Internet Explorer" en anglais au lieu du verbe français.[web:498]
- Ponctuation mal gérée: enchaîne les phrases sans vraies pauses, comme si points et virgules n’étaient pas exploités pour le rythme.[web:496]
- Texte partiellement lu: certains mots entre guillemets ne sont pas prononcés, probablement à cause d’un pré‑traitement qui supprime ou tronque des segments entre guillemets.[web:498]
- Erreurs 429 sur `/api/openai-tts`: trop de requêtes ou dépassement de quota côté OpenAI TTS, déclenchant un fallback implicite vers la voix navigateur.[web:498]

### 2.2 Architecture actuelle (intentionnelle)

- `useCoach` tente d’abord `speakWithOpenAI(...)` puis bascule sur `speakBrowserManaged(...)` en cas d’erreur ou absence de `openAiKey`.
- En théorie, **OpenAI TTS est la voix principale** de Léa, le navigateur étant un **fallback**.
- En pratique, les erreurs silencieuses (catch sans log) font que le fallback navigateur est fréquent, sans que l’utilisateur ni le dev ne le voient.

### 2.3 Décisions produit/tech

- **Voix Léa = OpenAI TTS par défaut**.[web:498]
  - Voix navigateur Web Speech (`speechSynthesis`) = **mode dégradé** uniquement.
  - Le fallback navigateur doit être visible (état, log, `ttsState.mode = 'browser'`).
- Toujours:
  - logger clairement les erreurs OpenAI TTS (notamment 429),
  - éviter d’avaler les erreurs avec un simple `catch (_) { ... }`.
- Ajouter un indicateur (log ou label dev) pour savoir en temps réel si la voix entendue est OpenAI ou le fallback navigateur.

### 2.4 Nettoyage du texte pour TTS

- Utiliser une fonction de nettoyage (type `cleanForTTS`) **aussi pour OpenAI TTS**, pas seulement pour la voix navigateur.[web:498]
- Objectifs du nettoyage avant TTS:
  - supprimer markdown (`**`, `#`, listes, backticks),
  - retirer ou adapter les emojis,
  - transformer les listes en phrases complètes,
  - lisser la ponctuation excessive,
  - couper les textes trop longs (1–3 phrases orales max),
  - garder un style oral simple.
- Protéger le texte entre guillemets pour qu’il soit lu (ne pas le filtrer, ou le reformuler sans le supprimer).

### 2.5 Style de réponse adapté à la voix

- Ajuster les prompts système pour Léa afin que les réponses soient **“parlables”**:
  - phrases courtes,
  - ton oral naturel,
  - pas de markdown,
  - pas de listes complexes,
  - une idée par phrase,
  - éviter les formulations trop analytiques.
- But: améliorer la qualité perçue du TTS sans changer de moteur.

### 2.6 Choix et gestion de la voix OpenAI

- Utiliser le paramètre `voice` d’OpenAI TTS pour sélectionner une voix stable et adaptée au français.[web:498]
- Stratégie:
  - tester un petit set de voix (2–4),
  - fixer une voix officielle “Léa” (douce, claire, non démonstrative),
  - éviter de multiplier les options côté utilisateur.

### 2.7 Gestion des erreurs et des quotas

- Erreurs `/api/openai-tts` en 429: signalent un dépassement de limites (RPS/RPM ou quota global).
- Actions recommandées:
  - implémenter un **throttling** côté front (ne pas spammer l’API),
  - implémenter des retries avec backoff raisonnable,
  - montrer un message clair en cas de mode dégradé,
  - ne pas basculer en silence sur le navigateur.


## 3. Dictée live

### 3.1 Rôle

- Permettre à Caroline de **dicter directement dans un chapitre**.
- Doit gérer trois modes d’insertion:
  1. insertion au curseur,
  2. remplacement d’une sélection,
  3. ajout en fin de chapitre si aucune position exploitable.

### 3.2 Point d’ancrage

- La dictée live passe par un callback du type `onResult(finalText)`.
- Fichiers critiques:
  - `DictationModal.jsx`,
  - `WritingArea.jsx`,
  - éventuellement `App.jsx` si la logique remonte.
- C’est là qu’on détermine:
  - où le texte est inséré,
  - s’il est brut ou déjà nettoyé,
  - si le curseur est rétabli correctement.

### 3.3 Logique cible d’insertion

- Si un chapitre est actif et le curseur positionné → **insertion au curseur**.
- Si une sélection existe → **remplacement de la sélection**.
- Sinon → **ajout en fin de chapitre** (avec séparateur type double saut de ligne).
- Nettoyage léger de la dictée live:
  - normaliser les espaces,
  - éventuellement lisser les répétitions évidentes ("euh euh"),
  - ne pas réécrire le contenu au point de perdre la confiance de Caroline.

### 3.4 Moteur d’insertion pur

- Utiliser une fonction pure de type:

```js
insertTextIntoChapter({ content, text, selectionStart, selectionEnd, caretPosition })
```

- Retourne:
  - le nouveau `content`,
  - le `mode` utilisé (`replace_selection`, `insert_at_caret`, `append_to_end`).
- Avantage: testable, réutilisable pour dictée live et insertions de fragments.


## 4. Notes vocales smartphone

### 4.1 Philosophie produit

- Les notes vocales smartphone **ne doivent pas être injectées directement dans un chapitre**.
- Elles servent de **fragments narratifs horodatés** à traiter plus tard sur PC.[web:381]

### 4.2 Pipeline recommandé

1. Capture audio via `MediaRecorder` (navigateur ou app mobile):
   - stockage d’un blob audio (type `audio/webm` ou similaire),
   - métadonnées: timestamp, device, chapitre en cours éventuel.[web:381]
2. Transcription:
   - immédiate si possible,
   - ou différée (serveur / reconnection).
3. Création d’un **fragment vocal**:
   - `rawText` (transcription brute),
   - `cleanText` (nettoyage léger),
   - `summary` (résumé IA 1 phrase),
   - tags (`emotionTags`, `themeTags`, `memoryTags`).[web:500]
4. Sur PC: affichage dans l’Inbox avec tri par date, thème, chapitre suggéré.

### 4.3 Rôle de Léa sur ces fragments

- Ne pas imposer l’insertion.
- Proposer:
  - chapitre probable,
  - position probable (début, milieu, fin),
  - type narratif (scène, souvenir court, note brute).
- Actions utilisateur possibles:
  - insérer dans un chapitre,
  - transformer en scène,
  - garder en souvenir brut,
  - archiver/ignorer.


## 5. OCR de notes papier et photos

### 5.1 Cas d’usage

- Notes manuscrites nocturnes,
- papiers divers,
- post-it, carnets.

### 5.2 Pipeline OCR recommandé

1. Photo prise par l’app (mobile ou desktop avec webcam).
2. OCR via Tesseract.js ou équivalent:
   - extraction `rawText`,
   - score de confiance.[web:499]
3. Nettoyage léger (`cleanOcrText`).
4. Création d’un **fragment OCR**:
   - image source conservée,
   - texte OCR brut + nettoyé,
   - suggestion IA (type de note, thèmes).

### 5.3 Point clé

- Toujours garder un lien vers **l’image originale**, car l’OCR sur manuscrit se trompe souvent.[web:495]
- Permettre à Caroline de corriger le texte avant insertion dans le manuscrit.


## 6. Fragments / Inbox / Modèle de données

### 6.1 Rôle des fragments

- Unifier toutes les captures (dictée différée, vocal, OCR, photo mémoire, notes texte) dans une structure unique:
  - **sourceType**: dictée live, voice note, ocr, photo memory, text note,
  - **status**: brut, relu, prêt à insérer, inséré, archivé.[web:500]
- L’Inbox mémoire est le **premier étage**: tout arrive là avant de toucher le manuscrit.

### 6.2 Champs typiques d’un fragment

- Identité/temps:
  - `id`,
  - `createdAt`,
  - `updatedAt`,
  - `sourceDevice`,
  - `chapterIdAtCapture` (chapitre actif au moment de la capture si connu).
- Contenu:
  - `rawText`,
  - `cleanText`,
  - `summary`.
- Médias liés:
  - `audio` (blob, type, taille),
  - `image` (URL / blob / id).
- Sémantique:
  - `emotionTags`,
  - `themeTags`,
  - `memoryTags`.
- Suggestions IA:
  - `suggestedChapterId`,
  - `suggestedTimelinePeriod`,
  - `suggestedInsertMode`.
- Statut et confiance:
  - `status` (raw, reviewed, ready, inserted, archived),
  - `confidence` (transcription, ocr, chapterMatch, timelineMatch).


## 7. Atelier d’assemblage IA

### 7.1 Rôles de Léa

1. **Reformulation douce** (sans trahison):
   - garder une version brute,
   - produire une version légèrement nettoyée,
   - proposer une version “récit possible”.
2. **Clarification**:
   - poser des questions sur l’âge, l’émotion, le contexte,
   - aider Caroline à préciser le souvenir.
3. **Proposition d’emplacement**:
   - suggérer un chapitre et une position,
   - proposer une insertion, mais toujours avec validation.

### 7.2 Matching chapitre / timeline

- Double axe:
  - **temps réel de capture** (quand l’idée est venue),
  - **temps du récit** (période de vie concernée: enfance, adolescence, etc.).[web:500]
- Léa fait le pont entre les deux en analysant le texte.
- Fonctions possibles:
  - scoring d’un fragment vs un chapitre (titres, intentions, tags),
  - suggestion de chapitre le plus probable,
  - suggestion de période de vie.

### 7.3 Propositions d’insertion

- Construire des objets “proposition d’insertion” contenant:
  - `fragmentId`,
  - `chapterId`,
  - `mode` (insert_at_caret, replace_selection, append_to_end, review_required),
  - un texte de prévisualisation,
  - un flag `needsUserValidation`.
- Application via le moteur d’insertion pur réutilisé.


## 8. Architecture technique (modules & hooks)

### 8.1 Modules capture

- `useLiveDictation`: encapsule la dictée live, produit du texte final et des callbacks d’insertion.
- `useVoiceNotes`: enregistre des notes vocales (MediaRecorder), renvoie un blob et crée des fragments audio.[web:381]
- `useOcrCapture`: gère sélection d’image + OCR + création de fragment OCR.[web:499]
- `useMemoryCapture`: capture combinée photo + vocal + texte autour d’un objet/rue/scène.

### 8.2 Modules fragments

- `fragmentTypes`: enums et fonctions de création de fragments.
- `fragmentStore`: CRUD et persistance (IndexedDB ou équivalent).
- `fragmentSelectors`: dérivés (inbox, filtrage, tri).
- `fragmentSync`: éventuelle sync cross-device.

### 8.3 Modules insertion

- `insertionEngine`: implémente `insertTextIntoChapter` et les modes d’insertion.
- `chapterMatcher`: scoring fragment vs chapitres.
- `timelineMatcher`: mapping vers les périodes de vie.

### 8.4 Modules IA

- `memoryAssistant`: logique de reformulation, questions, propositions d’emplacement.
- `transcriptionService`: appels STT.
- `ttsService`: encapsulation OpenAI TTS + fallback navigateur.
- `ocrService`: encapsulation OCR.
- `objectMemoryService`: analyse d’objets/photos déclencheurs.

### 8.5 UI React

- `DictationModal`: pilotage dictée live dans un chapitre.
- `VoiceNoteModal`: capture de notes vocales.
- `OcrCaptureModal`: capture OCR.
- `MemoryCaptureSheet`: capture "ça me rappelle".
- `FragmentInboxPanel`: liste et gestion des fragments.
- `FragmentReviewCard`: review individuelle, actions (insérer, archiver, transformer).
- `InsertSuggestionModal`: UI de validation d’une proposition d’insertion.


## 9. Contraintes de travail avec un LLM externe

### 9.1 Mode de travail recommandé avec Claude

- Source de vérité = **uniquement** les fichiers complets collés dans le chat.
- Ne jamais lui demander: "complète les fichiers manquants" ou "fais au mieux".
- Séquence:
  1. lui imposer un mode de travail ultra contraint (pas de fichiers inventés, pas de workspace local),
  2. lui faire demander le **lot minimal de fichiers** nécessaires pour un chantier,
  3. lui fournir ces fichiers complets,
  4. lui faire livrer le code **fichier par fichier**, prêt à coller,
  5. valider via CI entre chaque lot.[web:493]

### 9.2 Prompt système conseillé

- Exiger qu’il:
  - ne s’appuie que sur les fichiers vus,
  - ne crée pas d’APIs ou modules non montrés,
  - stoppe et demande les fichiers manquants si un point d’ancrage manque,
  - donne toujours:
    - COMPRÉHENSION,
    - CONTRATS,
    - RISQUES,
    - DÉCISION,
    - CODE ou FICHIERS MANQUANTS,
    - VALIDATION.
- Minimiser le rayon d’explosion: préférer des petits patches exacts à des refactors larges.


## 10. TODO synthétique

### 10.1 TTS / Voix Léa

- [ ] Rendre OpenAI TTS réellement principal (logs, pas de fallback silencieux).[web:498]
- [ ] Exposer `ttsState.mode` dans le player ou la console pour savoir si la voix vient d’OpenAI ou du navigateur.[web:498]
- [ ] Nettoyer le texte pour OpenAI TTS (markdown, listes, longueur, guillemets).[web:496]
- [ ] Tester et fixer une voix Léa OpenAI adaptée au français.
- [ ] Gérer les erreurs 429 avec throttling, backoff, et message explicite.

### 10.2 Dictée live

- [ ] Brancher proprement `onResult(finalText)` jusqu’au moteur d’insertion.
- [ ] Implémenter `insertTextIntoChapter` (3 modes: curseur, sélection, fin).
- [ ] Nettoyage léger de la dictée (espaces, répétitions évidentes).

### 10.3 Notes vocales & OCR

- [ ] Implémenter `useVoiceNotes` avec `MediaRecorder` et création de fragments.
- [ ] Implémenter `useOcrCapture` avec Tesseract.js et création de fragments OCR.[web:381][web:499]
- [ ] S’assurer que les blobs audio restent gérables (taille, persistance).
- [ ] Toujours lier les fragments OCR à l’image source.

### 10.4 Fragments / Inbox / IA

- [ ] Finaliser le modèle de données `Fragment` unifié.
- [ ] Créer le store fragments (IndexedDB v3) et le state React associé.
- [ ] Créer `FragmentInboxPanel` pour afficher et gérer les fragments.
- [ ] Implémenter les enrichissements IA (résumé, tags, suggestions de chapitre/période).
- [ ] Implémenter les propositions d’insertion et la validation utilisateur.

### 10.5 Collaboration avec le LLM

- [ ] Mettre en place le prompt système contraint pour Claude.
- [ ] Travailler par lots successifs avec CI verte entre chaque batch de fichiers.

