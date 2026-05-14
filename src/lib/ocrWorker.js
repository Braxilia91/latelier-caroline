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
 */

import { createWorker } from 'tesseract.js'

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
 * Lance l'OCR sur un Blob image.
 *
 * @param {Blob} blob — image à analyser (compressée JPEG 1600px, cf. imageCompress.js)
 * @returns {Promise<{ text: string, confidence: number }>}
 *   text       : texte brut extrait (peut être vide ou contenir du bruit)
 *   confidence : score global Tesseract 0-100
 * @throws si le worker ou la reconnaissance échoue
 */
export async function runOCR(blob) {
  const worker = await ensureWorker()
  resetIdleTimer()
  const { data } = await worker.recognize(blob)
  return {
    text: data.text ?? '',
    confidence: data.confidence ?? 0,
  }
}
