/**
 * visionInspire.js — Client "faire parler l'image" via Workers AI.
 *
 * API publique :
 *   runVisionInspire(blob, password, context): Promise<string>
 *
 * Pipeline :
 *   1. Blob → base64 (FileReader — compatible Safari/iOS)
 *   2. POST /api/vision-inspire avec { image: base64, context }
 *   3. Retourne une analyse courte des mots de Caroline + des pistes visuelles
 *
 * @throws {Error} si auth échoue, binding absent, ou erreur réseau
 */

export async function runVisionInspire(blob, password, context = {}) {
  if (!blob || !password) {
    throw new Error('runVisionInspire : blob et password sont requis')
  }

  const base64 = await blobToBase64(blob)

  const resp = await fetch('/api/vision-inspire', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Lea-Pass': password,
    },
    body: JSON.stringify({ image: base64, context }),
  })

  let data
  try {
    data = await resp.json()
  } catch {
    throw new Error(`Vision inspiration : réponse non-JSON (HTTP ${resp.status})`)
  }

  if (!resp.ok) {
    throw new Error(data?.error || `Vision inspiration : erreur HTTP ${resp.status}`)
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
