// src/lib/googleDrive.js
// LOT 4F.2.1 — Auth Google Drive via Google Identity Services (GIS)
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
//
// Note : le token renvoyé par GIS est un **access_token OAuth 2.0** (bearer),
// pas un ID token JWT séparé. On le présente à userinfo via header Authorization
// Bearer, ce qui suffit pour récupérer les claims standards email/name.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata openid email profile'
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

let tokenClient = null
let currentToken = null     // access_token (string) ou null
let currentEmail = null
let currentName = null
let expiresAt = null        // Date d'expiration estimée ou null

/**
 * Attend que le SDK GIS (chargé async par index.html) soit prêt.
 * Polling 200 ms, timeout 8 s.
 */
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

/**
 * Initialise le tokenClient une seule fois.
 * Idempotent : appels suivants no-op.
 */
async function ensureTokenClient() {
  if (tokenClient) return
  if (!CLIENT_ID) {
    throw new Error('VITE_GOOGLE_CLIENT_ID non configuré au build (vérifie deploy.yml)')
  }
  await ensureSdkLoaded()
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: () => {}, // remplacé dynamiquement à chaque signIn()
  })
}

/**
 * Déclenche le flow OAuth (popup Google).
 * - Demande consentement utilisateur pour drive.appdata + openid + email + profile
 * - Récupère access_token
 * - Fetch userinfo pour email + name
 * @returns {Promise<{email: string, name: string}>}
 */
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
        // Token Drive obtenu mais userinfo a échoué — on garde le token,
        // l'UI affichera "Connecté à Google Drive" sans préciser l'email.
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
    // prompt 'select_account' : affiche le sélecteur de compte Google sans
    // reforcer l'écran de consentement à chaque connexion (moins intrusif que
    // 'consent'). Caroline reste libre de changer de compte si elle en a
    // plusieurs connectés au navigateur.
    tokenClient.requestAccessToken({ prompt: 'select_account' })
  })
}

/**
 * @returns {{email: string, name: string, token: string, expiresAt: Date} | null}
 * null si pas connecté ou token expiré (auto-nettoyage).
 */
export function getCurrentUser() {
  if (!currentToken) return null
  if (expiresAt && new Date() > expiresAt) {
    currentToken = null
    currentEmail = null
    currentName = null
    expiresAt = null
    return null
  }
  return { email: currentEmail, name: currentName, token: currentToken, expiresAt }
}

/**
 * Déconnexion : révoque l'access_token côté Google (best-effort) et vide le state local.
 * Le state local est toujours vidé, même si la révocation distante échoue.
 */
export async function signOut() {
  const tok = currentToken
  currentToken = null
  currentEmail = null
  currentName = null
  expiresAt = null
  if (tok && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(tok, () => {})
    } catch { /* tolérant — le state local est déjà vidé */ }
  }
}
