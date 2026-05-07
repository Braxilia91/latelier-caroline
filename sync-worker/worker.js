/**
 * Atelier Caroline — Sync Worker
 * Cloudflare Worker · last-write-wins · auth par token personnel
 *
 * KV binding requis : ATELIER_KV
 * Header auth      : x-sync-token (défini une fois dans les Réglages de l'app)
 */

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-sync-token',
}
const MAX_BYTES = 10 * 1024 * 1024  // 10 MB — largement suffisant pour un livre

export default {
  async fetch(req, env) {

    // ── CORS preflight ─────────────────────────────────────────
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    // ── Auth ───────────────────────────────────────────────────
    const token = req.headers.get('x-sync-token')?.trim()
    if (!token || token.length < 20) {
      return json({ error: 'Token manquant ou trop court (20 caractères min)' }, 401)
    }

    // Clé KV = HMAC-SHA256(token, sel secret) — résistant à dictionnaire
    // SYNC_SECRET doit être défini dans Cloudflare Workers → Settings → Variables (secret)
    const secret = env.SYNC_SECRET || 'atelier-caroline-default-salt-change-me'
    const kvKey  = `snapshot_${await hmacSha256(token, secret)}`

    // ── GET — récupérer le snapshot distant ───────────────────
    if (req.method === 'GET') {
      const raw = await env.ATELIER_KV.get(kvKey)
      if (!raw) return json({ empty: true, syncedAt: null }, 200)
      return new Response(raw, { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    // ── POST — sauvegarder le snapshot local ──────────────────
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

      // Vérifier si le distant est plus récent → refuser (client doit pull d'abord)
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
}

// ── Helpers ──────────────────────────────────────────────────────

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
