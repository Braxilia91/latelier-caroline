/**
 * visionOCR.js — Client OCR Vision via Workers AI (LLaVA 1.5 7B).
 *
 * API publique :
 *   runVisionOCR(blob, password): Promise<string>
 *
 * Pipeline :
 *   1. Blob → base64 (FileReader — compatible Safari/iOS)
 *   2. POST /api/vision-ocr avec { image: base64 }
 *   3. Retourne le texte transcrit (string, peut être vide)
 *
 * @throws {Error} si auth échoue, binding absent, ou erreur réseau
 */

export async function runVisionOCR(blob, password) {
  if (!blob || !password) {
    throw new Error('runVisionOCR : blob et password sont requis')
  }

  const base64 = await blobToBase64(blob)

  const resp = await fetch('/api/vision-ocr', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Lea-Pass': password,
    },
    body: JSON.stringify({ image: base64 }),
  })

  let data
  try {
    data = await resp.json()
  } catch (_) {
    throw new Error(`Vision OCR : réponse non-JSON (HTTP ${resp.status})`)
  }

  if (!resp.ok) {
    throw new Error(data?.error || `Vision OCR : erreur HTTP ${resp.status}`)
  }

  return typeof data.text === 'string' ? data.text : ''
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      const commaIdx = result.indexOf(',')
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result)
    }
    reader.onerror = () => reject(new Error('FileReader : impossible de lire le blob'))
    reader.readAsDataURL(blob)
  })
}
