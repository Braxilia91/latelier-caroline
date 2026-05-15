/**
 * logger.js — Logger centralisé léger (#25)
 *
 * Regroupe tous les événements d'erreur silencieux (Drive, sync, IDB)
 * dans une file en mémoire consultable depuis la console ou un futur
 * panneau de debug. Prêt pour un branchement Sentry post-onboarding.
 *
 * Usage :
 *   import { log } from './logger'
 *   log('drive', 'error', 'uploadAllBlobs échoué', err)
 *   log('sync',  'warn',  'Snapshot > 8 MB — risque 413')
 *
 * Consultation console : window.__atelierLogs()
 */

const MAX_ENTRIES = 200

const _entries = []

/**
 * @param {'sync'|'drive'|'idb'|'coach'|'audio'|'app'} domain
 * @param {'info'|'warn'|'error'} level
 * @param {string} message
 * @param {Error|unknown} [err]
 */
export function log(domain, level, message, err) {
  const entry = {
    ts:      new Date().toISOString(),
    domain,
    level,
    message,
    ...(err ? { errorMessage: err?.message || String(err) } : {}),
  }

  if (_entries.length >= MAX_ENTRIES) _entries.shift()
  _entries.push(entry)

  // Mirror vers la console native pour le dev
  const fn = level === 'error' ? console.error
            : level === 'warn'  ? console.warn
            : console.info
  fn(`[${domain}] ${message}`, ...(err ? [err] : []))

  // TODO post-onboarding : brancher Sentry ici
  // if (typeof Sentry !== 'undefined') Sentry.captureMessage(...)
}

/** Retourne une copie des entrées récentes (lecture seule). */
export function getLogs() {
  return [..._entries]
}

/** Efface le buffer (utile pour les tests). */
export function clearLogs() {
  _entries.length = 0
}

// Exposition console pour debug prod sans outils
if (typeof window !== 'undefined') {
  window.__atelierLogs = () => {
    console.table(_entries)
    return _entries
  }
}
