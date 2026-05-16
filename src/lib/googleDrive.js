// src/lib/googleDrive.js
// LOT 4F.2.1 — Auth Google Drive via Google Identity Services (GIS)
// LOT 4F.2.2 — Upload / update du snapshot JSON dans appDataFolder
// LOT 4F.2.3 — Download / restore du snapshot JSON depuis appDataFolder
// T8.3    — Versionning rotatif : 3 snapshots (current / prev / daily)
// T11/#4  — Surveillance expiration token : listeners onTokenExpiring +
//           onTokenExpired (toast pré-expiration 5 min + toast expiration)
// Lot B   — signInSilent : reconnexion sans interaction au boot via
//           GIS prompt='none'. Sécurité MVP préservée (pas de token
//           persisté), mais évite la déconnexion silencieuse au refresh
//           si Caroline est encore loggée à Google dans son navigateur.
//
// Rotation lors de chaque uploadSnapshot :
//   1. atelier-snapshot.json         → snapshot courant
//   2. atelier-snapshot.prev.json    → snapshot précédent (avant le PATCH courant)
//   3. atelier-snapshot.daily.json   → snapshot du jour (écrasé une fois/jour max)
//
// downloadSnapshot() essaie toujours le fichier courant en premier ;
// en cas d'échec (JSON invalide / 404) il tente prev, puis daily.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata openid email profile'
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

const SNAPSHOT_CURRENT = 'atelier-snapshot.json'
const SNAPSHOT_PREV    = 'atelier-snapshot.prev.json'
const SNAPSHOT_DAILY   = 'atelier-snapshot.daily.json'

const DRIVE_API    = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

// T11/#4 — Délai avant expiration où on prévient Caroline (5 minutes).
const EXPIRING_WARNING_MS = 5 * 60 * 1000

let tokenClient  = null
let currentToken = null
let currentEmail = null
let currentName  = null
let expiresAt    = null

// T11/#4 — Listeners + timers expiration (module-level).
const expiringListeners = new Set()  // callbacks ({ expiresAt }) → void
const expiredListeners  = new Set()  // callbacks () → void
let   expiringTimer     = null
let   expiredTimer      = null

// ─── Auth helpers ───────────────────────────────────────────────

function ensureSdkLoaded() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve()
    let elapsed = 0
    const interval = setInterval(() => {
      if (window.google?.accounts?.oauth2) { clearInterval(interval); resolve() }
      else if (elapsed >= 8000)            { clearInterval(interval); reject(new Error('SDK Google Identity Services non chargé (timeout 8 s)')) }
      elapsed += 200
    }, 200)
  })
}

async function ensureTokenClient() {
  if (tokenClient) return
  if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID non configuré au build (vérifie deploy.yml)')
  await ensureSdkLoaded()
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: () => {},
  })
}

export async function signIn() {
  await ensureTokenClient()
  return new Promise((resolve, reject) => {
    tokenClient.callback = async (response) => {
      if (response.error) return reject(new Error(response.error_description || response.error))
      currentToken = response.access_token
      const expiresInSec = Number(response.expires_in) || 3600
      expiresAt = new Date(Date.now() + expiresInSec * 1000)
      // T11/#4 — Programme les timers de pré-expiration / expiration.
      scheduleExpirationTimers()
      try {
        const r = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${currentToken}` } })
        if (!r.ok) throw new Error(`userinfo HTTP ${r.status}`)
        const info = await r.json()
        currentEmail = info.email || ''
        currentName  = info.name  || ''
        resolve({ email: currentEmail, name: currentName })
      } catch {
        currentEmail = ''
        currentName  = ''
        resolve({ email: '', name: '' })
      }
    }
    tokenClient.error_callback = (err) => {
      const type = err?.type
      let msg
      if (type === 'popup_closed')          msg = 'Popup fermée avant la fin'
      else if (type === 'popup_failed_to_open') msg = 'Popup bloquée par le navigateur. Autorise les popups pour ce site et réessaie.'
      else                                  msg = err?.message || 'Connexion annulée'
      reject(new Error(msg))
    }
    tokenClient.requestAccessToken({ prompt: '' })
  })
}

/**
 * Lot B — Reconnexion silencieuse au boot.
 *
 * Tente d'obtenir un nouvel access_token sans interaction utilisateur via
 * GIS requestAccessToken({ prompt: 'none' }). Si Caroline est encore loggée
 * à Google dans son navigateur (cas le plus fréquent — Google reste loggé
 * sur le même profil Chrome / Safari), la reconnexion réussit transparente.
 * Sinon : échec sans popup, retourne null.
 *
 * Caractéristique importante : aucune popup n'est ouverte même en cas
 * d'échec — Caroline ne voit aucune fenêtre s'ouvrir au boot.
 *
 * Sécurité : aucun token persisté en IDB / cookie. La reconnexion ne
 * marche que si Caroline a déjà autorisé l'app ET reste loggée à Google
 * dans CE navigateur. Sur un PC partagé, si l'autre utilisateur s'est
 * délogué de Google, signInSilent échoue → l'autre utilisateur n'a pas
 * accès au Drive de Caroline.
 *
 * @returns {Promise<{email: string, name: string} | null>}
 */
export async function signInSilent() {
  try {
    await ensureTokenClient()
  } catch (_) {
    // SDK pas chargé ou pas de CLIENT_ID : échec silencieux
    return null
  }
  return new Promise((resolve) => {
    tokenClient.callback = async (response) => {
      if (response.error || !response.access_token) return resolve(null)
      currentToken = response.access_token
      const expiresInSec = Number(response.expires_in) || 3600
      expiresAt = new Date(Date.now() + expiresInSec * 1000)
      scheduleExpirationTimers()
      try {
        const r = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${currentToken}` } })
        if (r.ok) {
          const info = await r.json()
          currentEmail = info.email || ''
          currentName  = info.name  || ''
        } else {
          currentEmail = ''
          currentName  = ''
        }
      } catch {
        currentEmail = ''
        currentName  = ''
      }
      resolve({ email: currentEmail, name: currentName })
    }
    // error_callback est appelé par GIS si prompt: 'none' échoue (session
    // expirée, utilisateur déloggué Google, etc.). On résout null sans
    // jamais throw, pour que App.jsx puisse retomber sur le toast.
    tokenClient.error_callback = () => resolve(null)
    try {
      tokenClient.requestAccessToken({ prompt: 'none' })
    } catch (_) {
      resolve(null)
    }
  })
}

export function getCurrentUser() {
  if (!currentToken) return null
  if (expiresAt && new Date() > expiresAt) { clearSession(); return null }
  return { email: currentEmail, name: currentName, token: currentToken, expiresAt }
}

function clearSession() {
  // T11/#4 — Tout clear est cohérent : token + identité + timers.
  clearExpirationTimers()
  currentToken = null
  currentEmail = null
  currentName  = null
  expiresAt    = null
}

function throwDriveError(status, text, op) {
  if (status === 401 || status === 403) clearSession()
  throw new Error(`Drive ${op} HTTP ${status} ${text.slice(0, 120)}`)
}

function escapeDriveQueryValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

// ─── T11/#4 — Surveillance expiration token ─────────────────────────

/**
 * Notifie les listeners "expiring" (5 min avant expiration).
 * Best-effort : un callback qui throw n'empêche pas les suivants.
 */
function notifyExpiring() {
  const snapshot = expiresAt ? new Date(expiresAt.getTime()) : null
  expiringListeners.forEach(cb => {
    try { cb({ expiresAt: snapshot }) }
    catch (e) { console.warn('[Drive] listener tokenExpiring error', e?.message) }
  })
}

/**
 * Notifie les listeners "expired". La session est clearée AVANT notification
 * pour que les listeners voient un état cohérent (getCurrentUser → null).
 */
function notifyExpired() {
  clearSession()  // ordre crucial : pas de race entre listener et getCurrentUser
  expiredListeners.forEach(cb => {
    try { cb() }
    catch (e) { console.warn('[Drive] listener tokenExpired error', e?.message) }
  })
}

function clearExpirationTimers() {
  if (expiringTimer) { clearTimeout(expiringTimer); expiringTimer = null }
  if (expiredTimer)  { clearTimeout(expiredTimer);  expiredTimer  = null }
}

/**
 * Programme les 2 timers : pré-expiration (5 min avant) et expiration.
 * Toujours clear avant de re-schedule (cas d'un signIn pendant une session
 * encore valide).
 * Cas edge :
 *   - expiresAt déjà passé → notifyExpired immédiat
 *   - expiresAt dans < 5 min → notifyExpiring immédiat + schedule expired
 */
function scheduleExpirationTimers() {
  clearExpirationTimers()
  if (!expiresAt) return

  const now        = Date.now()
  const expiresMs  = expiresAt.getTime()
  const expiringAt = expiresMs - EXPIRING_WARNING_MS

  // Token déjà expiré → notification immédiate
  if (expiresMs <= now) {
    notifyExpired()
    return
  }

  // Fenêtre pré-expiration dépassée mais token encore valide → notif immédiate
  if (expiringAt <= now) {
    notifyExpiring()
  } else {
    expiringTimer = setTimeout(notifyExpiring, expiringAt - now)
  }

  expiredTimer = setTimeout(notifyExpired, expiresMs - now)
}

/**
 * Abonne un callback aux notifications "token expire bientôt" (5 min avant).
 * @param {(payload: { expiresAt: Date | null }) => void} cb
 * @returns {() => void} fonction unsubscribe.
 */
export function onTokenExpiring(cb) {
  if (typeof cb !== 'function') return () => {}
  expiringListeners.add(cb)
  return () => expiringListeners.delete(cb)
}

/**
 * Abonne un callback aux notifications "token expiré".
 * Au moment du callback, la session est déjà clearée.
 * @param {() => void} cb
 * @returns {() => void} fonction unsubscribe.
 */
export function onTokenExpired(cb) {
  if (typeof cb !== 'function') return () => {}
  expiredListeners.add(cb)
  return () => expiredListeners.delete(cb)
}

// ─── Drive file lookup helpers ────────────────────────────────────────

/** Retourne l'id Drive du premier fichier correspondant au nom, ou null. */
async function findFileId(filename) {
  if (!currentToken) throw new Error('Non connecté à Google Drive')
  const params = new URLSearchParams({
    spaces:   'appDataFolder',
    q:        `name='${escapeDriveQueryValue(filename)}' and trashed=false`,
    orderBy:  'modifiedTime desc',
    fields:   'files(id,name,modifiedTime,size)',
    pageSize: '5',
  })
  const r = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${currentToken}` },
  })
  if (!r.ok) { const text = await r.text().catch(() => ''); throwDriveError(r.status, text, 'list') }
  const data = await r.json()
  return data.files?.[0]?.id || null
}

/** Alias historique — résout le fichier courant. */
async function findSnapshotFileId() {
  return findFileId(SNAPSHOT_CURRENT)
}

// ─── Drive write helpers ───────────────────────────────────────────

/** PATCH media d'un fichier existant (JSON string). */
async function patchFile(fileId, jsonString) {
  const r = await fetch(`${DRIVE_UPLOAD}/files/${fileId}?uploadType=media`, {
    method:  'PATCH',
    headers: {
      Authorization:  `Bearer ${currentToken}`,
      'Content-Type': 'application/json',
    },
    body: jsonString,
  })
  if (!r.ok) { const text = await r.text().catch(() => ''); throwDriveError(r.status, text, 'update') }
}

/** Crée un nouveau fichier JSON dans appDataFolder (multipart). */
async function createFile(filename, jsonString) {
  const boundary = `boundary_${Math.random().toString(36).slice(2)}`
  const metadata = { name: filename, parents: ['appDataFolder'], mimeType: 'application/json' }
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${jsonString}\r\n` +
    `--${boundary}--`
  const r = await fetch(`${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${currentToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  })
  if (!r.ok) { const text = await r.text().catch(() => ''); throwDriveError(r.status, text, 'create') }
  return (await r.json()).id
}

/** Lit le contenu texte d'un fichier Drive par fileId. Retourne null sur erreur. */
async function readFileText(fileId) {
  try {
    const r = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${currentToken}` },
    })
    if (!r.ok) return null
    return await r.text()
  } catch { return null }
}

// ─── Upload avec rotation ──────────────────────────────────────────

/**
 * T8.3 — Rotation de snapshots :
 *   1. Lit le contenu actuel de atelier-snapshot.json (avant écrasement)
 *   2. L'écrit dans atelier-snapshot.prev.json
 *   3. L'écrit dans atelier-snapshot.daily.json (une fois par jour seulement)
 *   4. PATCH atelier-snapshot.json avec le nouveau contenu
 *
 * Toutes les rotations sont best-effort : une erreur ne bloque pas l'upload principal.
 */
export async function uploadSnapshot(jsonString) {
  if (!currentToken)                                   return { ok: false, message: 'Non connecté à Google Drive' }
  if (typeof jsonString !== 'string' || !jsonString)  return { ok: false, message: 'Snapshot vide ou invalide' }

  try {
    const size       = new Blob([jsonString]).size
    const currentId  = await findSnapshotFileId()

    // ── Rotation best-effort ────────────────────────────────────────────
    if (currentId) {
      // 1. Lire le snapshot courant avant écrasement
      const prevJson = await readFileText(currentId)

      if (prevJson) {
        // 2. Écrire dans prev
        try {
          const prevId = await findFileId(SNAPSHOT_PREV)
          if (prevId) await patchFile(prevId, prevJson)
          else        await createFile(SNAPSHOT_PREV, prevJson)
        } catch (e) { console.warn('[Drive] rotation prev failed', e?.message) }

        // 3. Écrire dans daily (max 1 fois/jour)
        try {
          const dailyId  = await findFileId(SNAPSHOT_DAILY)
          const todayKey = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
          let   shouldWriteDaily = true
          if (dailyId) {
            const dailyText = await readFileText(dailyId)
            if (dailyText) {
              try {
                const dailySnap = JSON.parse(dailyText)
                const dailyDay  = (dailySnap.syncedAt || '').slice(0, 10)
                if (dailyDay === todayKey) shouldWriteDaily = false
              } catch { /* JSON invalide → on réécrit */ }
            }
          }
          if (shouldWriteDaily) {
            if (dailyId) await patchFile(dailyId, prevJson)
            else         await createFile(SNAPSHOT_DAILY, prevJson)
          }
        } catch (e) { console.warn('[Drive] rotation daily failed', e?.message) }
      }

      // 4. PATCH le fichier courant avec le nouveau snapshot
      await patchFile(currentId, jsonString)
      return {
        ok:      true,
        message: `Sauvegarde mise à jour sur Drive (${Math.round(size / 1024)} KB) ✓`,
        fileId:  currentId,
        size,
      }
    }

    // Première écriture — créer le fichier courant
    const fileId = await createFile(SNAPSHOT_CURRENT, jsonString)
    return {
      ok:      true,
      message: `Première sauvegarde sur Drive (${Math.round(size / 1024)} KB) ✓`,
      fileId,
      size,
    }
  } catch (err) {
    return { ok: false, message: err?.message || 'Erreur upload Drive' }
  }
}

// ─── Download avec fallback ─────────────────────────────────────────

/**
 * T8.3 — Download avec fallback :
 *   Essaie current → prev → daily
 *   Retourne le premier snapshot valide trouvé.
 *   Si le snapshot courant est corrompu, le message précise que c'est un backup.
 */
export async function downloadSnapshot() {
  if (!currentToken) return { ok: false, message: 'Non connecté à Google Drive' }

  const candidates = [
    { name: SNAPSHOT_CURRENT, label: 'courant'   },
    { name: SNAPSHOT_PREV,    label: 'précédent' },
    { name: SNAPSHOT_DAILY,   label: 'journalier' },
  ]

  try {
    for (const { name, label } of candidates) {
      const fileId = await findFileId(name)
      if (!fileId) continue

      const jsonText = await readFileText(fileId)
      if (!jsonText) continue

      let data
      try { data = JSON.parse(jsonText) } catch { continue }

      const blob = new Blob([jsonText], { type: 'application/json' })
      let file
      try { file = new File([blob], name, { type: 'application/json' }) } catch { file = blob }

      const isFallback = name !== SNAPSHOT_CURRENT
      return {
        ok:         true,
        data,
        file,
        size:       blob.size,
        isFallback,
        message: isFallback
          ? `Snapshot ${label} restauré (courant corrompu) — ${Math.round(blob.size / 1024)} KB`
          : `Snapshot téléchargé (${Math.round(blob.size / 1024)} KB)`,
      }
    }
    return { ok: false, message: 'Aucune sauvegarde Drive exploitable trouvée' }
  } catch (err) {
    return { ok: false, message: err?.message || 'Erreur téléchargement Drive' }
  }
}

export async function signOut() {
  const tok = currentToken
  clearSession()
  if (tok && window.google?.accounts?.oauth2) {
    try { window.google.accounts.oauth2.revoke(tok, () => {}) } catch { /* tolérant */ }
  }
}
