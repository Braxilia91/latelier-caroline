// src/lib/googleDrive.js
// LOT 4F.2.1 — Auth Google Drive via Google Identity Services (GIS)
// LOT 4F.2.2 — Upload / update du snapshot JSON dans appDataFolder
// LOT 4F.2.3 — Download / restore du snapshot JSON depuis appDataFolder
//
// Préoccupations distinctes traitées dans un seul flow OAuth :
//   A. Autorisation Drive (scope drive.appdata) → access_token utilisable pour
//      lire/écrire dans le dossier appDataFolder de l'utilisateur.
//   B. Identification du compte (scopes openid + email + profile) → utilisé
//      pour fetch GET userinfo et afficher "Connecté à : email@gmail.com".
//
// Sécurité MVP :
//   - L'access_token + email/nom sont stockés en mémoire module-level uniquement
//     (variables JS). Aucun localStorage, aucun IndexedDB, aucun cookie.
//   - Au refresh de la page → state perdu, l'utilisateur reclique "Connecter".
//   - Le token expire ~1h après émission (champ expires_in renvoyé par GIS).
//     Pas de refresh token : MVP, Caroline reclique manuellement.
//   - Sur 401/403 côté Drive API, clearSession() nettoie l'état local pour
//     éviter d'afficher "Connecté à" avec un token mort (révocation distante).
//
// Note : le token renvoyé par GIS est un **access_token OAuth 2.0** (bearer),
// pas un ID token JWT séparé. On le présente à userinfo via header Authorization
// Bearer, ce qui suffit pour récupérer les claims standards email/name.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata openid email profile'
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

const SNAPSHOT_FILENAME = 'atelier-snapshot.json'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

let tokenClient = null
let currentToken = null
let currentEmail = null
let currentName = null
let expiresAt = null

function ensureSdkLoaded() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve()
    let elapsed = 0
    const interval = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(interval)
        resolve()
      } else if (elapsed >= 8000) {
        clearInterval(interval)
        reject(new Error('SDK Google Identity Services non chargé (timeout 8 s)'))
      }
      elapsed += 200
    }, 200)
  })
}

async function ensureTokenClient() {
  if (tokenClient) return
  if (!CLIENT_ID) {
    throw new Error('VITE_GOOGLE_CLIENT_ID non configuré au build (vérifie deploy.yml)')
  }
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
      if (response.error) {
        return reject(new Error(response.error_description || response.error))
      }
      currentToken = response.access_token
      const expiresInSec = Number(response.expires_in) || 3600
      expiresAt = new Date(Date.now() + expiresInSec * 1000)
      try {
        const r = await fetch(USERINFO_URL, {
          headers: { Authorization: `Bearer ${currentToken}` },
        })
        if (!r.ok) throw new Error(`userinfo HTTP ${r.status}`)
        const info = await r.json()
        currentEmail = info.email || ''
        currentName = info.name || ''
        resolve({ email: currentEmail, name: currentName })
      } catch {
        currentEmail = ''
        currentName = ''
        resolve({ email: '', name: '' })
      }
    }
    tokenClient.error_callback = (err) => {
      const type = err?.type
      let msg
      if (type === 'popup_closed') {
        msg = 'Popup fermée avant la fin'
      } else if (type === 'popup_failed_to_open') {
        msg = 'Popup bloquée par le navigateur. Autorise les popups pour ce site et réessaie.'
      } else {
        msg = err?.message || 'Connexion annulée'
      }
      reject(new Error(msg))
    }
    tokenClient.requestAccessToken({ prompt: 'select_account' })
  })
}

export function getCurrentUser() {
  if (!currentToken) return null
  if (expiresAt && new Date() > expiresAt) {
    clearSession()
    return null
  }
  return { email: currentEmail, name: currentName, token: currentToken, expiresAt }
}

// LOT 4F.2.3 — Nettoyage de session interne.
// Appelé : (1) sur expiration locale via getCurrentUser, (2) sur 401/403
// Drive API (token révoqué/invalide côté Google avant expiration locale),
// (3) sur signOut explicite. Permet à l'UI de repasser à "Connecter".
function clearSession() {
  currentToken = null
  currentEmail = null
  currentName = null
  expiresAt = null
}

// LOT 4F.2.3 — Si status auth (401/403), invalide la session locale avant throw.
function throwDriveError(status, text, op) {
  if (status === 401 || status === 403) {
    clearSession()
  }
  throw new Error(`Drive ${op} HTTP ${status} ${text.slice(0, 120)}`)
}

// Échappe une valeur pour la query Drive Search (apostrophes, antislashes).
function escapeDriveQueryValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

async function findSnapshotFileId() {
  if (!currentToken) throw new Error('Non connecté à Google Drive')
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name='${escapeDriveQueryValue(SNAPSHOT_FILENAME)}' and trashed=false`,
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,modifiedTime,size)',
    pageSize: '10',
  })
  const r = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${currentToken}` },
  })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throwDriveError(r.status, text, 'list')
  }
  const data = await r.json()
  return data.files?.[0]?.id || null
}

export async function uploadSnapshot(jsonString) {
  if (!currentToken) {
    return { ok: false, message: 'Non connecté à Google Drive' }
  }
  if (typeof jsonString !== 'string' || jsonString.length === 0) {
    return { ok: false, message: 'Snapshot vide ou invalide' }
  }
  try {
    const size = new Blob([jsonString]).size
    const existingId = await findSnapshotFileId()

    if (existingId) {
      const url = `${DRIVE_UPLOAD}/files/${existingId}?uploadType=media`
      const r = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${currentToken}`,
          'Content-Type': 'application/json',
        },
        body: jsonString,
      })
      if (!r.ok) {
        const text = await r.text().catch(() => '')
        throwDriveError(r.status, text, 'update')
      }
      return {
        ok: true,
        message: `Sauvegarde mise à jour sur Drive (${Math.round(size / 1024)} KB) ✓`,
        fileId: existingId,
        size,
      }
    }

    const boundary = `boundary_${Math.random().toString(36).slice(2)}`
    const metadata = {
      name: SNAPSHOT_FILENAME,
      parents: ['appDataFolder'],
      mimeType: 'application/json',
    }
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${jsonString}\r\n` +
      `--${boundary}--`

    const r = await fetch(`${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${currentToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    })
    if (!r.ok) {
      const text = await r.text().catch(() => '')
      throwDriveError(r.status, text, 'create')
    }
    const data = await r.json()
    return {
      ok: true,
      message: `Première sauvegarde sur Drive (${Math.round(size / 1024)} KB) ✓`,
      fileId: data.id,
      size,
    }
  } catch (err) {
    return { ok: false, message: err?.message || 'Erreur upload Drive' }
  }
}

export async function downloadSnapshot() {
  if (!currentToken) {
    return { ok: false, message: 'Non connecté à Google Drive' }
  }
  try {
    const fileId = await findSnapshotFileId()
    if (!fileId) {
      return { ok: false, message: 'Aucune sauvegarde Drive trouvée' }
    }
    const r = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${currentToken}` },
    })
    if (!r.ok) {
      const text = await r.text().catch(() => '')
      throwDriveError(r.status, text, 'download')
    }
    const jsonText = await r.text()
    let data
    try {
      data = JSON.parse(jsonText)
    } catch {
      return { ok: false, message: 'Snapshot Drive corrompu (JSON invalide)' }
    }
    const blob = new Blob([jsonText], { type: 'application/json' })
    let file
    try {
      file = new File([blob], SNAPSHOT_FILENAME, { type: 'application/json' })
    } catch {
      file = blob
    }
    return {
      ok: true,
      data,
      file,
      size: blob.size,
      message: `Snapshot téléchargé (${Math.round(blob.size / 1024)} KB)`,
    }
  } catch (err) {
    return { ok: false, message: err?.message || 'Erreur téléchargement Drive' }
  }
}

export async function signOut() {
  const tok = currentToken
  clearSession()
  if (tok && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(tok, () => {})
    } catch { /* tolérant */ }
  }
}
