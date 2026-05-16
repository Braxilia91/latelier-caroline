// src/lib/driveSync.js
// T8.2 — Orchestrateur sync traceBlobs ↔ Google Drive appDataFolder
//
// Stratégie de sérialisation : un fichier Drive par blob, nommé
//   atelier-blob-{traceId}.b64
// Le fichier contient un JSON : { traceId, mimeType, data: "<base64>" }
// Séparé du snapshot JSON principal pour :
//   - Ne pas faire exploser le snapshot (blobs peuvent faire plusieurs Mo)
//   - Permettre un upload/download incrémental (seuls les blobs manquants)
//   - Rester dans appDataFolder (pas visible par l'utilisateur dans Drive)
//
// API publique :
//   uploadAllBlobs(traces)          → upload les blobs dont le Drive ne dispose pas encore
//   downloadAllBlobs(traces)        → restaure les blobs IDB manquants depuis Drive
//   deleteBlobFromDrive(traceId)    → supprime un blob Drive orphelin
//
// Dépendances :
//   googleDrive.js  → currentToken exposé via getToken()
//   db.js           → getTraceBlob, saveTraceBlob, getTraces

import { getTraceBlob, saveTraceBlob } from './db'

// ─── Helpers Drive low-level ────────────────────────────────────

const DRIVE_API    = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const BLOB_PREFIX  = 'atelier-blob-'

/**
 * Récupère le token Drive courant depuis googleDrive.js.
 * Évite une dépendance circulaire : on importe getCurrentUser dynamiquement.
 */
async function getToken() {
  const { getCurrentUser } = await import('./googleDrive')
  const user = getCurrentUser()
  if (!user?.token) throw new Error('Non connecté à Google Drive')
  return user.token
}

/**
 * Fix spam — Vérification non-throwing de la connexion Drive avant batch.
 * Évite de faire échouer N appels getToken() (1 par trace) quand on sait
 * déjà qu'on n'a pas de session. Un seul console.info au lieu de N warn.
 */
async function isDriveConnected() {
  try {
    const { getCurrentUser } = await import('./googleDrive')
    return !!getCurrentUser()?.token
  } catch (_) {
    return false
  }
}

function blobFilename(traceId) {
  return `${BLOB_PREFIX}${traceId}.b64`
}

/**
 * Cherche le fileId Drive d'un blob par traceId.
 * @returns {Promise<string|null>}
 */
async function findBlobFileId(traceId) {
  const token = await getToken()
  const name  = blobFilename(traceId)
  const params = new URLSearchParams({
    spaces:  'appDataFolder',
    q:       `name='${name}' and trashed=false`,
    fields:  'files(id,name,size)',
    pageSize: '5',
  })
  const r = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new Error(`Drive list blob HTTP ${r.status}`)
  const data = await r.json()
  return data.files?.[0]?.id || null
}

/**
 * Upload multipart d'un blob Drive (nouveau fichier).
 */
async function createBlobFile(traceId, payload) {
  const token    = await getToken()
  const boundary = `bnd_${Math.random().toString(36).slice(2)}`
  const metadata = {
    name:     blobFilename(traceId),
    parents:  ['appDataFolder'],
    mimeType: 'application/json',
  }
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${JSON.stringify(payload)}\r\n` +
    `--${boundary}--`

  const r = await fetch(`${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`Drive create blob HTTP ${r.status} ${text.slice(0, 120)}`)
  }
  return (await r.json()).id
}

/**
 * Met à jour un blob Drive existant (PATCH media).
 */
async function updateBlobFile(fileId, payload) {
  const token = await getToken()
  const r = await fetch(`${DRIVE_UPLOAD}/files/${fileId}?uploadType=media`, {
    method:  'PATCH',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`Drive update blob HTTP ${r.status} ${text.slice(0, 120)}`)
  }
}

/**
 * Télécharge et parse un blob Drive par fileId.
 * @returns {{ traceId, mimeType, data: string } | null}
 */
async function downloadBlobFile(fileId) {
  const token = await getToken()
  const r = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) return null
  try {
    return await r.json()
  } catch {
    return null
  }
}

// ─── Conversion Blob ↔ Base64 ───────────────────────────────────

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function base64ToBlob(b64, mimeType) {
  const binary = atob(b64)
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mimeType })
}

// ─── API publique ───────────────────────────────────────────────

/**
 * T8.2 — Upload tous les blobs IDB vers Drive.
 * Stratégie incrémentale : ne crée/met à jour que les blobs pas encore sur Drive.
 *
 * @param {Array} traces  - tableau de métadonnées traces (depuis getTraces())
 * @param {Function} [onProgress] - callback(done, total) optionnel
 * @returns {Promise<{ uploaded: number, skipped: number, errors: string[] }>}
 */
export async function uploadAllBlobs(traces = [], onProgress = null) {
  // Fix spam — early-return si Drive déconnecté. Évite N warn cascade
  // (un par trace) quand on sait déjà qu'aucun upload ne réussira.
  if (!(await isDriveConnected())) {
    console.info('[driveSync] uploadAllBlobs annulé — non connecté à Google Drive')
    return { uploaded: 0, skipped: 0, errors: ['Non connecté à Google Drive'] }
  }

  let uploaded = 0
  let skipped  = 0
  const errors = []

  const total = traces.length
  let done = 0

  for (const trace of traces) {
    try {
      const blobRecord = await getTraceBlob(trace.id)
      if (!blobRecord?.blob) {
        // Pas de blob IDB pour cette trace (trace texte pure) — skip silencieux
        done++
        onProgress?.(done, total)
        continue
      }

      // Vérifier si déjà sur Drive
      const existingId = await findBlobFileId(trace.id)

      const b64  = await blobToBase64(blobRecord.blob)
      const payload = {
        traceId:  trace.id,
        mimeType: blobRecord.mimeType || 'image/jpeg',
        data:     b64,
      }

      if (existingId) {
        await updateBlobFile(existingId, payload)
      } else {
        await createBlobFile(trace.id, payload)
      }
      uploaded++
    } catch (err) {
      errors.push(`${trace.id}: ${err?.message || 'erreur inconnue'}`)
      console.warn('[driveSync] uploadBlob error', trace.id, err)
    }
    done++
    onProgress?.(done, total)
  }

  return { uploaded, skipped, errors }
}

/**
 * T8.2 — Restaure les blobs Drive manquants dans IDB.
 * Ne touche pas aux blobs déjà présents en IDB (non destructif).
 *
 * @param {Array} traces  - tableau de métadonnées traces
 * @param {Function} [onProgress] - callback(done, total) optionnel
 * @returns {Promise<{ restored: number, skipped: number, errors: string[] }>}
 */
export async function downloadAllBlobs(traces = [], onProgress = null) {
  // Fix spam — symétrique : early-return si Drive déconnecté.
  if (!(await isDriveConnected())) {
    console.info('[driveSync] downloadAllBlobs annulé — non connecté à Google Drive')
    return { restored: 0, skipped: 0, errors: ['Non connecté à Google Drive'] }
  }

  let restored = 0
  let skipped  = 0
  const errors = []

  const total = traces.length
  let done = 0

  for (const trace of traces) {
    try {
      // Si blob déjà en IDB, skip
      const existing = await getTraceBlob(trace.id)
      if (existing?.blob) {
        skipped++
        done++
        onProgress?.(done, total)
        continue
      }

      const fileId = await findBlobFileId(trace.id)
      if (!fileId) {
        // Blob absent de Drive aussi (trace texte pure ou jamais uploadé)
        done++
        onProgress?.(done, total)
        continue
      }

      const payload = await downloadBlobFile(fileId)
      if (!payload?.data || !payload?.mimeType) {
        errors.push(`${trace.id}: payload Drive invalide`)
        done++
        onProgress?.(done, total)
        continue
      }

      const blob = base64ToBlob(payload.data, payload.mimeType)
      await saveTraceBlob(trace.id, blob, payload.mimeType)
      restored++
    } catch (err) {
      errors.push(`${trace.id}: ${err?.message || 'erreur inconnue'}`)
      console.warn('[driveSync] downloadBlob error', trace.id, err)
    }
    done++
    onProgress?.(done, total)
  }

  return { restored, skipped, errors }
}

/**
 * T8.2 — Supprime un blob Drive par traceId (appelé depuis deleteTrace).
 * Tolérant au 404 (déjà supprimé ou jamais uploadé).
 *
 * @param {string} traceId
 * @returns {Promise<boolean>} true si supprimé, false si introuvable
 */
export async function deleteBlobFromDrive(traceId) {
  try {
    const token  = await getToken()
    const fileId = await findBlobFileId(traceId)
    if (!fileId) return false

    const r = await fetch(`${DRIVE_API}/files/${fileId}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!r.ok && r.status !== 404) {
      console.warn(`[driveSync] deleteBlobFromDrive HTTP ${r.status}`)
      return false
    }
    return true
  } catch (err) {
    console.warn('[driveSync] deleteBlobFromDrive error', traceId, err)
    return false
  }
}
