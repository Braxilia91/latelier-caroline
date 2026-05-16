/**
 * sync.js — Sync inter-appareils
 *
 * URL Worker : variable d'env Vite VITE_SYNC_WORKER_URL
 * Définie dans Cloudflare Pages → Settings → Environment variables
 */

import { log } from './logger'

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
  } catch (err) {
    log('sync', 'error', 'pushSnapshot réseau échoué', err)
    if (!navigator.onLine) throw new SyncError('Pas de connexion internet. La sync reprendra automatiquement.', 0)
    throw new SyncError('Le service de synchronisation est temporairement indisponible. Réessaie dans quelques minutes.', 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    log('sync', 'error', `pushSnapshot HTTP ${res.status}`, new Error(data.error))
    throw new SyncError(httpErrorMessage(res.status, data.error), res.status)
  }
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
  } catch (err) {
    log('sync', 'error', 'pullSnapshot réseau échoué', err)
    if (!navigator.onLine) throw new SyncError('Pas de connexion internet. La sync reprendra automatiquement.', 0)
    throw new SyncError('Le service de synchronisation est temporairement indisponible. Réessaie dans quelques minutes.', 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    log('sync', 'error', `pullSnapshot HTTP ${res.status}`, new Error(data.error))
    throw new SyncError(httpErrorMessage(res.status, data.error), res.status)
  }
  return data
}

/**
 * buildSnapshot inclut les traces (métadonnées uniquement, jamais les blobs).
 * Exclut apiKey et openAiKey.
 * #21 — retourne aussi chatTruncated=true si le chat dépasse 500 messages.
 */
export function buildSnapshot({ chapters, vrac, kvData, traces = [], chat = [] }) {
  const safeKv = { ...kvData }
  KEYS_NO_SYNC.forEach(k => delete safeKv[k])

  const safeTraces = traces.map(({ id, title, date, createdAt, updatedAt, whyNow, status, mimeType }) => ({
    id, title, date, createdAt, updatedAt, whyNow, status, mimeType,
  }))

  const CAP = 500
  const chatTruncated = chat.length > CAP
  if (chatTruncated) {
    log('sync', 'warn', `Chat tronqué à ${CAP} messages (${chat.length} total) — les anciens ne seront pas synchronisés.`)
  }

  // Tag d'identification pour la recovery admin : permet à Mourad de retrouver
  // le snapshot d'un utilisateur par son prénom via /admin/transfer quand il
  // a oublié son mot de passe Sauvegarde. Pas un secret — visible côté KV.
  const ownerName = ((kvData && kvData.name) || '').toString().trim() || null

  return {
    version:      3,
    syncedAt:     new Date().toISOString(),
    _owner:       ownerName,
    chapters,
    vrac,
    traces:       safeTraces,
    kv:           safeKv,
    chatTruncated,
  }
}

/**
 * #20 — whoWins amélioré : last-write-wins sur timestamp, mais en cas d'égalité
 * ou d'écart < 5s (horloges légèrement désynchronisées), on préfère le snapshot
 * avec le plus de contenu (totalChars = somme des longueurs de chapitres).
 *
 * Retourne 'local' | 'remote' | 'equal'
 */
export function whoWins(localSyncedAt, remoteSyncedAt, localChapters = [], remoteChapters = []) {
  if (!remoteSyncedAt) return 'local'
  if (!localSyncedAt)  return 'remote'

  const l = new Date(localSyncedAt).getTime()
  const r = new Date(remoteSyncedAt).getTime()
  const CLOCK_SKEW_MS = 5_000  // 5s de tolérance horloge

  // Écart significatif → timestamp gagne
  if (l - r >  CLOCK_SKEW_MS) return 'local'
  if (r - l >  CLOCK_SKEW_MS) return 'remote'

  // Timestamps quasi-identiques → le plus riche en contenu gagne
  const localChars  = localChapters.reduce((sum, ch)  => sum + (ch.content?.length  || 0), 0)
  const remoteChars = remoteChapters.reduce((sum, ch) => sum + (ch.content?.length || 0), 0)

  if (localChars  > remoteChars) {
    log('sync', 'info', `whoWins tie-break chars : local ${localChars} > remote ${remoteChars} → local gagne`)
    return 'local'
  }
  if (remoteChars > localChars) {
    log('sync', 'info', `whoWins tie-break chars : remote ${remoteChars} > local ${localChars} → remote gagne`)
    return 'remote'
  }
  return 'equal'
}

// ── Helpers ──────────────────────────────────────────────────────

function assertWorkerUrl() {
  if (!WORKER_URL) throw new SyncError(
    'URL du Worker non configurée. Ajoute VITE_SYNC_WORKER_URL dans tes variables d\'env Cloudflare Pages.',
    0
  )
}

function httpErrorMessage(status, serverMsg) {
  switch (status) {
    case 401: return 'Mot secret incorrect ou expiré. Vérifie tes réglages de synchronisation — le même mot secret doit être utilisé sur tous tes appareils.'
    case 409: return 'Conflit de synchronisation détecté. Ouvre l\'app sur l\'autre appareil et synchronise d\'abord depuis celui-ci.'
    case 413: return 'Tes données sont trop volumineuses pour la synchronisation (limite 10 MB). Essaie d\'exporter une sauvegarde locale depuis le menu Exporter.'
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
