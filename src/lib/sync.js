/**
 * sync.js — Sync inter-appareils · last-write-wins
 *
 * URL Worker : variable d'env Vite VITE_SYNC_WORKER_URL
 * Définie dans Cloudflare Pages → Settings → Environment variables
 */

const WORKER_URL = import.meta.env.VITE_SYNC_WORKER_URL || ''

// Données jamais synchronisées vers le cloud (sécurité)
const KEYS_NO_SYNC = ['apiKey', 'openAiKey']

/** Pousse le snapshot local vers le Worker. */
export async function pushSnapshot({ token, snapshot }) {
  assertWorkerUrl()
  let res
  try {
    res = await fetch(WORKER_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-sync-token': token },
      body:    JSON.stringify(snapshot),
    })
  } catch {
    if (!navigator.onLine) throw new SyncError('Pas de connexion internet. La sync reprendra automatiquement.', 0)
    throw new SyncError('Le service de synchronisation est temporairement indisponible. Réessaie dans quelques minutes.', 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new SyncError(httpErrorMessage(res.status, data.error), res.status)
  return data
}

/** Tire le snapshot distant depuis le Worker. */
export async function pullSnapshot({ token }) {
  assertWorkerUrl()
  let res
  try {
    res = await fetch(WORKER_URL, {
      headers: { 'x-sync-token': token },
    })
  } catch {
    if (!navigator.onLine) throw new SyncError('Pas de connexion internet. La sync reprendra automatiquement.', 0)
    throw new SyncError('Le service de synchronisation est temporairement indisponible. Réessaie dans quelques minutes.', 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new SyncError(httpErrorMessage(res.status, data.error), res.status)
  return data   // { empty: true } si premier sync, sinon snapshot complet
}

/**
 * Construit le snapshot local à partir des données useDB.
 * Exclut apiKey et openAiKey.
 */
export function buildSnapshot({ chapters, vrac, kvData }) {
  const safeKv = { ...kvData }
  KEYS_NO_SYNC.forEach(k => delete safeKv[k])
  return {
    version:  2,
    syncedAt: new Date().toISOString(),
    chapters,
    vrac,
    kv:       safeKv,
  }
}

/**
 * Stratégie last-write-wins :
 * retourne 'local' | 'remote' | 'equal'
 */
export function whoWins(localSyncedAt, remoteSyncedAt) {
  if (!remoteSyncedAt) return 'local'
  if (!localSyncedAt)  return 'remote'
  const l = new Date(localSyncedAt).getTime()
  const r = new Date(remoteSyncedAt).getTime()
  if (l > r)  return 'local'
  if (r > l)  return 'remote'
  return 'equal'
}

// ── Helpers ──────────────────────────────────────────────────────

function assertWorkerUrl() {
  if (!WORKER_URL) throw new SyncError(
    'URL du Worker non configurée. Ajoute VITE_SYNC_WORKER_URL dans tes variables d\'env Cloudflare Pages.',
    0
  )
}

/**
 * Messages d'erreur HTTP explicites pour Caroline (pas de codes techniques).
 * Couvre les cas critiques : 401 (secret changé), 409 (conflit), 413 (trop lourd).
 */
function httpErrorMessage(status, serverMsg) {
  switch (status) {
    case 401: return 'Mot secret incorrect ou expiré. Vérifie tes réglages de synchronisation — le même mot secret doit être utilisé sur tous tes appareils.'
    case 409: return 'Conflit de synchronisation détecté. Ouvre l\'app sur l\'autre appareil et synchronise d\'abord depuis celui-ci.'
    case 413: return 'Tes données sont trop volumineuses pour la sync (> 10 MB). Contacte le support.'
    case 429: return 'Trop de tentatives de synchronisation. Attends quelques minutes avant de réessayer.'
    case 503:
    case 504: return 'Le serveur de sync est temporairement indisponible. Réessaie dans quelques minutes.'
    default:  return serverMsg || `Erreur de synchronisation (${status}). Vérifie ta connexion internet.`
  }
}

export class SyncError extends Error {
  constructor(message, status) {
    super(message)
    this.name   = 'SyncError'
    this.status = status
  }
}
