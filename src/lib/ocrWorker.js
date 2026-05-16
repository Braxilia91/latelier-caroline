/**
 * ocrWorker.js — Singleton Tesseract.js worker mutualisé.
 *
 * API publique :
 *   runOCR(blob): Promise<{ text: string, confidence: number }>
 *   OCR_CONFIDENCE_THRESHOLD: number  (calibrable, valeur initiale 60)
 *
 * Worker lifecycle :
 *   - Lazy-chargé au 1er appel runOCR.
 *   - Singleton : plusieurs appels simultanés partagent la même promesse d'init.
 *   - Auto-libéré après IDLE_MS ms d'inactivité (reset à chaque runOCR).
 *   - Langue : fra+eng — codes ISO 639-2/T utilisés par Tesseract.js.
 *
 * Spec : docs/le-tiroir-v1.md §4 étape 3 + §9 Stack technique.
 * LOT 4A — fichier inert (aucun caller en prod à ce stade).
 * T5/Phase 1 — Instrumentation transparente : console.info compact par OCR.
 *   Aucun changement d'API ni de comportement applicatif (seuil 60 reste actif).
 * FEAT-A — Prétraitement Otsu branché avant worker.recognize (imagePreprocess.js).
 *   ensureWorker + preprocessForOCR sont parallélisés (Promise.all) pour minimiser
 *   la latence au 1er appel.
 */

import { createWorker } from 'tesseract.js'
import { preprocessForOCR } from './imagePreprocess'

export const OCR_CONFIDENCE_THRESHOLD = 60 // calibrable — seuil empirique à ajuster selon retours réels

const IDLE_MS = 5 * 60 * 1000 // 5 minutes

let _workerPromise = null // Promise<Worker> — singleton partagé
let _idleTimer = null

/**
 * Retourne le worker Tesseract, en le créant si nécessaire.
 * Si plusieurs appels concurrents arrivent avant la fin de l'init,
 * ils partagent tous la même promesse (pas de double init).
 */
function ensureWorker() {
  if (!_workerPromise) {
    _workerPromise = createWorker(['fra', 'eng'])
  }
  return _workerPromise
}

/**
 * (Re)démarre le timer d'inactivité.
 * Appelé à chaque runOCR pour repousser la libération automatique.
 */
function resetIdleTimer() {
  if (_idleTimer) clearTimeout(_idleTimer)
  _idleTimer = setTimeout(async () => {
    if (_workerPromise) {
      try {
        const worker = await _workerPromise
        await worker.terminate()
      } catch (_) {
        // tolérant — le worker était peut-être déjà terminé
      } finally {
        _workerPromise = null
        _idleTimer = null
      }
    }
  }, IDLE_MS)
}

/**
 * Horloge monotone si dispo, fallback Date.now().
 */
function now() {
  return (typeof performance !== 'undefined' && performance.now)
    ? performance.now()
    : Date.now()
}

/**
 * Lance l'OCR sur un Blob image.
 *
 * @param {Blob|File} blob — image à analyser (en prod : blob compressé 1600px, cf. AddTraceFlow.jsx)
 * @returns {Promise<{ text: string, confidence: number }>}
 *   text       : texte brut extrait (peut être vide ou contenir du bruit)
 *   confidence : score global Tesseract 0-100
 * @throws si le worker ou la reconnaissance échoue
 *
 * FEAT-A — preprocessForOCR(blob) applique grayscale + Otsu avant recognize.
 *   ensureWorker et preprocessForOCR tournent en parallèle (Promise.all).
 *   Le log T5 conserve sizeKB et fileName du blob original (non transformé).
 *
 * T5/Phase 1 — Émet un log structuré [T5/OCR] par appel :
 *   { runId, fileName, width, height, sizeKB, durationMs, confidence, textLen, status, textPreview }
 *   status = 'accepted' | 'skipped' selon OCR_CONFIDENCE_THRESHOLD + text non vide.
 *   Le log est purement passif : aucun effet sur la valeur de retour ni sur l'UI.
 */
export async function runOCR(blob) {
  // FEAT-A — Parallélisation : init worker + prétraitement Otsu simultanés.
  // Gain ~120ms au 1er appel ; appels suivants (worker chaud) : gain prétraitement seul.
  const [worker, ocrBlob] = await Promise.all([
    ensureWorker(),
    preprocessForOCR(blob),
  ])
  resetIdleTimer()

  const t0 = now()
  const { data } = await worker.recognize(ocrBlob)
  const t1 = now()

  const text = data.text ?? ''
  const confidence = data.confidence ?? 0

  // T5/Phase 1 — Instrumentation transparente (hors chemin critique).
  // try/catch global : un échec de log ne doit jamais casser l'OCR.
  try {
    let width = null
    let height = null
    try {
      if (typeof createImageBitmap === 'function' && blob) {
        const bmp = await createImageBitmap(blob)
        width = bmp.width
        height = bmp.height
        if (typeof bmp.close === 'function') bmp.close()
      }
    } catch (_) { /* dimensions optionnelles, on continue sans */ }

    const status =
      confidence >= OCR_CONFIDENCE_THRESHOLD && text.trim().length > 0
        ? 'accepted'
        : 'skipped'

    console.info('[T5/OCR]', {
      runId: 'r_' + Math.random().toString(36).slice(2, 9),
      fileName: blob?.name ?? null,
      width,
      height,
      sizeKB: Math.round((blob?.size ?? 0) / 1024),
      durationMs: Math.round(t1 - t0),
      confidence: Math.round(confidence * 10) / 10,
      textLen: text.length,
      status,
      textPreview: text.slice(0, 80).replace(/\s+/g, ' ').trim(),
    })
  } catch (_) {
    /* tolérant : aucune raison qu'un log casse l'OCR */
  }

  return { text, confidence }
}
