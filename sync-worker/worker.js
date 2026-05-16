/**
 * Atelier Caroline — Sync Worker
 * Cloudflare Worker · last-write-wins · auth par token personnel
 *
 * KV binding requis : ATELIER_KV
 * Header auth (utilisateur) : x-sync-token (défini une fois dans les Réglages de l'app)
 *
 * ── Routes ──
 *   GET  /                  → pull le snapshot (auth x-sync-token)
 *   POST /                  → push le snapshot (auth x-sync-token)
 *
 *   GET  /admin/list                → lister tous les snapshots (auth x-admin-secret)
 *   GET  /admin/peek?owner=X        → voir le snapshot d'un user par _owner (debug)
 *   POST /admin/transfer            → réinitialiser le mdp d'un user (recovery)
 *                                     body : { ownerName, newToken }
 *                                     Cherche le snapshot par _owner, copie vers
 *                                     snapshot_<HMAC(newToken)>, supprime l'ancien.
 *                                     Utilisé quand Caroline oublie son mdp Sauvegarde.
 *
 * ── Env vars requises (Cloudflare → Workers → Settings → Variables) ──
 *   SYNC_SECRET   (secret)   — sel HMAC pour les clés KV (résistant dictionnaire)
 *   ADMIN_SECRET  (secret)   — token admin pour /admin/* (≥ 32 chars aléatoires)
 *
 * ── Utilisation admin (recovery) ──
 *   curl -X POST https://atelier-sync.atome-tdah-cloud.workers.dev/admin/transfer \
 *     -H "X-Admin-Secret: <ADMIN_SECRET>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"ownerName":"caroline","newToken":"<nouveau-mdp-≥20-chars>"}'
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-sync-token, x-admin-secret',
}
const MAX_BYTES = 10 * 1024 * 1024  // 10 MB — largement suffisant pour un livre

export default {
  async fetch(req, env) {
    const url  = new URL(req.url)
    const path = url.pathname

    // ── CORS preflight ─────────────────────────────────────────
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    // ── Routes admin (auth différente, KV recovery) ───────────
    if (path.startsWith('/admin/')) {
      return handleAdmin(req, env, path, url)
    }

    // ── Routes utilisateur (auth x-sync-token, comportement historique) ─
    return handleUser(req, env)
  },
}

// ─── User routes ─────────────────────────────────────────────────

async function handleUser(req, env) {
  const token = req.headers.get('x-sync-token')?.trim()
  if (!token || token.length < 20) {
    return json({ error: 'Token manquant ou trop court (20 caractères min)' }, 401)
  }

  // Clé KV = HMAC-SHA256(token, sel secret) — résistant à dictionnaire
  const secret = env.SYNC_SECRET || 'atelier-caroline-default-salt-change-me'
  const kvKey  = `snapshot_${await hmacSha256(token, secret)}`

  // GET — récupérer le snapshot distant
  if (req.method === 'GET') {
    const raw = await env.ATELIER_KV.get(kvKey)
    if (!raw) return json({ empty: true, syncedAt: null }, 200)
    return new Response(raw, { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  // POST — sauvegarder le snapshot local
  if (req.method === 'POST') {
    const body = await req.text()

    if (body.length > MAX_BYTES) {
      return json({ error: `Snapshot trop volumineux (${(body.length / 1024).toFixed(0)} KB > 10 MB)` }, 413)
    }

    let parsed
    try { parsed = JSON.parse(body) }
    catch { return json({ error: 'JSON invalide' }, 400) }

    if (!parsed.syncedAt) {
      return json({ error: 'Champ syncedAt manquant' }, 400)
    }

    // Last-write-wins avec garde-fou anti-conflit : refuser si distant plus récent
    const existing = await env.ATELIER_KV.get(kvKey)
    if (existing) {
      const remote = JSON.parse(existing)
      if (remote.syncedAt && new Date(remote.syncedAt) > new Date(parsed.syncedAt)) {
        return json({
          conflict: true,
          remoteSyncedAt: remote.syncedAt,
          message: 'Le distant est plus récent — pull d\'abord',
        }, 409)
      }
    }

    await env.ATELIER_KV.put(kvKey, body, {
      expirationTtl: 60 * 60 * 24 * 365,  // 1 an
    })

    return json({ ok: true, savedAt: parsed.syncedAt }, 200)
  }

  return json({ error: 'Méthode non supportée' }, 405)
}

// ─── Admin routes — pour Mourad uniquement ───────────────────────

async function handleAdmin(req, env, path, url) {
  // Auth admin obligatoire
  if (!env.ADMIN_SECRET) {
    return json({ error: 'ADMIN_SECRET non configuré sur le worker (configure-le dans Cloudflare → Workers → Settings → Variables)' }, 503)
  }
  const adminSecret = req.headers.get('x-admin-secret')?.trim()
  if (!adminSecret || adminSecret !== env.ADMIN_SECRET) {
    return json({ error: 'Admin secret invalide' }, 401)
  }

  const secret = env.SYNC_SECRET || 'atelier-caroline-default-salt-change-me'

  // GET /admin/list — lister tous les snapshots existants (debug, recovery)
  if (path === '/admin/list' && req.method === 'GET') {
    const list = await env.ATELIER_KV.list({ prefix: 'snapshot_' })
    const items = []
    for (const k of list.keys) {
      try {
        const raw = await env.ATELIER_KV.get(k.name)
        if (!raw) continue
        const parsed = JSON.parse(raw)
        items.push({
          kvKey:         k.name,
          owner:         parsed._owner || '(non renseigné — ancien snapshot)',
          syncedAt:      parsed.syncedAt || null,
          sizeBytes:     raw.length,
          chaptersCount: Array.isArray(parsed.chapters) ? parsed.chapters.length : 0,
        })
      } catch { /* skip malformé */ }
    }
    return json({ ok: true, count: items.length, items }, 200)
  }

  // GET /admin/peek?owner=X — voir le contenu brut d'un snapshot par owner (debug)
  if (path === '/admin/peek' && req.method === 'GET') {
    const ownerName = (url.searchParams.get('owner') || '').trim().toLowerCase()
    if (!ownerName) return json({ error: 'param ?owner=X requis' }, 400)

    const list = await env.ATELIER_KV.list({ prefix: 'snapshot_' })
    for (const k of list.keys) {
      try {
        const raw = await env.ATELIER_KV.get(k.name)
        if (!raw) continue
        const parsed = JSON.parse(raw)
        if ((parsed._owner || '').trim().toLowerCase() === ownerName) {
          return new Response(raw, { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
        }
      } catch { /* skip */ }
    }
    return json({ error: `Aucun snapshot avec _owner="${ownerName}"` }, 404)
  }

  // POST /admin/transfer — recovery : transférer un snapshot vers un nouveau token
  // Body : { ownerName: "caroline", newToken: "<nouveau-mdp-≥20-chars>" }
  if (path === '/admin/transfer' && req.method === 'POST') {
    let body
    try { body = await req.json() }
    catch { return json({ error: 'JSON invalide' }, 400) }

    const ownerName = (body?.ownerName || '').trim()
    const newToken  = (body?.newToken  || '').trim()
    if (!ownerName) {
      return json({ error: 'ownerName requis' }, 400)
    }
    if (!newToken || newToken.length < 20) {
      return json({ error: 'newToken requis et ≥ 20 caractères' }, 400)
    }

    // Chercher le snapshot par _owner (case-insensitive)
    const list = await env.ATELIER_KV.list({ prefix: 'snapshot_' })
    let foundKey   = null
    let foundValue = null
    const ownerLower = ownerName.toLowerCase()
    for (const k of list.keys) {
      try {
        const raw = await env.ATELIER_KV.get(k.name)
        if (!raw) continue
        const parsed = JSON.parse(raw)
        if ((parsed._owner || '').trim().toLowerCase() === ownerLower) {
          foundKey   = k.name
          foundValue = raw
          break
        }
      } catch { /* skip malformé */ }
    }
    if (!foundKey) {
      return json({ error: `Aucun snapshot avec _owner="${ownerName}". Si l'app n'a pas encore pushé avec ce tag, vérifier d'abord la liste via GET /admin/list.` }, 404)
    }

    // Calculer la nouvelle clé KV
    const newKvKey = `snapshot_${await hmacSha256(newToken, secret)}`

    // Si collision avec un snapshot d'un AUTRE utilisateur → refuser
    if (newKvKey !== foundKey) {
      const collision = await env.ATELIER_KV.get(newKvKey)
      if (collision) {
        return json({
          error: 'Le nouveau token est déjà utilisé par un autre snapshot existant. Choisis un autre mot de passe.',
        }, 409)
      }
    }

    // Copier l'ancienne valeur vers la nouvelle clé
    await env.ATELIER_KV.put(newKvKey, foundValue, {
      expirationTtl: 60 * 60 * 24 * 365,  // 1 an
    })

    // Supprimer l'ancienne clé (si différente — sinon c'était un no-op)
    if (newKvKey !== foundKey) {
      await env.ATELIER_KV.delete(foundKey)
    }

    let parsed = {}
    try { parsed = JSON.parse(foundValue) } catch { /* tolérant */ }

    return json({
      ok: true,
      transferred: ownerName,
      oldKvKey: foundKey,
      newKvKey,
      snapshotSize: foundValue.length,
      syncedAt: parsed.syncedAt || null,
      chaptersCount: Array.isArray(parsed.chapters) ? parsed.chapters.length : 0,
      message: `Snapshot de "${ownerName}" transféré. L'utilisateur doit maintenant faire "Restaurer depuis le cloud" dans l'app avec son nouveau mot de passe.`,
    }, 200)
  }

  return json({ error: `Endpoint admin non supporté : ${req.method} ${path}` }, 404)
}

// ─── Helpers ──────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/**
 * HMAC-SHA256 : résistant aux attaques par dictionnaire même sur tokens courts.
 * Le sel SYNC_SECRET est stocké en secret Cloudflare (jamais dans le code).
 */
async function hmacSha256(message, secret) {
  const enc    = new TextEncoder()
  const key    = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig    = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 40)
}
