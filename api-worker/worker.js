/**
 * latelier-api — v4.1.0
 * Cloudflare Worker
 *
 * Routes :
 *   /health
 *   /claude          (proxy Anthropic)
 *   /tts             (proxy OpenAI TTS)
 *   /whisper         (proxy OpenAI Whisper)
 *   /request-otp     (reset PIN — email via Resend)
 *   /verify-otp
 *   /sync            GET  — pull snapshot (auth : x-sync-token)
 *   /sync            POST — push snapshot (auth : x-sync-token)
 *
 * Bindings KV requis :
 *   LATELIER_OTP  — OTP storage
 *   ATELIER_KV    — sync snapshots
 *
 * Secrets requis :
 *   CAROLINE_PASSWORD, CLAUDE_API_KEY, OPENAI_API_KEY,
 *   RESEND_API_KEY, SYNC_SECRET
 */

const ADMIN_EMAIL  = 'mourad.maziere@gmail.com'
const OTP_TTL_SEC  = 600
const OTP_ATTEMPTS = 5
const CLAUDE_URL   = 'https://api.anthropic.com/v1/messages'
const CLAUDE_MODEL = 'claude-sonnet-4-20250514'
const TTS_URL      = 'https://api.openai.com/v1/audio/speech'
const WHISPER_URL  = 'https://api.openai.com/v1/audio/transcriptions'
const MAX_SYNC_BYTES = 10 * 1024 * 1024  // 10 MB

const ALLOWED_ORIGINS = [
  'https://latelier-caroline.pages.dev',
  'http://localhost:5173',
  'http://localhost:4173',
]

function cors(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin':  allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-atelier-password, x-audio-type, x-sync-token',
  }
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...extra },
  })
}

function genOTP() {
  const arr = new Uint8Array(6)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b % 10).join('')
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function sendEmail(resendKey, otp) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to: [ADMIN_EMAIL],
      subject: '🔐 L\'Atelier — Code de réinitialisation PIN',
      html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
        <h2 style="color:#8B6445">🪶 L'Atelier de Caroline</h2>
        <p>Demande de réinitialisation du code PIN.</p>
        <div style="background:#FAF7F2;border:2px solid #C4956A;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
          <p style="margin:0;font-size:14px;color:#6B5A4E">Code à transmettre à Caroline :</p>
          <p style="margin:8px 0 0;font-size:36px;font-weight:900;letter-spacing:12px;color:#2D1B0E">${otp}</p>
        </div>
        <p style="color:#9C8878;font-size:13px">⏱ Valide 10 minutes · usage unique</p>
      </div>`,
    }),
  })
  return r.ok
}

/**
 * HMAC-SHA256 — derive une cle KV a partir du token utilisateur.
 * Resiste aux attaques par dictionnaire meme sur tokens courts.
 * SYNC_SECRET est stocke en secret Cloudflare (jamais dans le code).
 */
async function hmacSha256(message, secret) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 40)
}

export default {
  async fetch(request, env) {
    const url     = new URL(request.url)
    const origin  = request.headers.get('Origin') || ''
    const headers = cors(origin)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })

    // ── Sante ──────────────────────────────────────────────────
    if (url.pathname === '/health')
      return json({ ok: true, service: 'latelier-api', version: '4.1.0' }, 200, headers)

    // ── Proxy Claude ───────────────────────────────────────────
    if (url.pathname === '/claude' && request.method === 'POST') {
      const pw = request.headers.get('x-atelier-password') || ''
      if (!safeEqual(pw, env.CAROLINE_PASSWORD || '')) return json({ error: 'unauthorized' }, 401, headers)
      if (!env.CLAUDE_API_KEY) return json({ error: 'api_key_not_configured' }, 500, headers)
      let body
      try { body = await request.json() } catch { return json({ error: 'invalid_body' }, 400, headers) }
      const claudeRes = await fetch(CLAUDE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': env.CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: body.max_tokens || 600, system: body.system, messages: body.messages, stream: body.stream ?? true }),
      })
      return new Response(claudeRes.body, {
        status: claudeRes.status,
        headers: { ...headers, 'Content-Type': claudeRes.headers.get('Content-Type') || 'text/event-stream', 'Cache-Control': 'no-cache' },
      })
    }

    // ── Proxy TTS OpenAI ───────────────────────────────────────
    if (url.pathname === '/tts' && request.method === 'POST') {
      const pw = request.headers.get('x-atelier-password') || ''
      if (!safeEqual(pw, env.CAROLINE_PASSWORD || '')) return json({ error: 'unauthorized' }, 401, headers)
      if (!env.OPENAI_API_KEY) return json({ error: 'openai_key_not_configured' }, 500, headers)
      let body
      try { body = await request.json() } catch { return json({ error: 'invalid_body' }, 400, headers) }
      const { text, voice = 'nova' } = body || {}
      if (!text) return json({ error: 'missing_text' }, 400, headers)
      const ttsRes = await fetch(TTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: 'tts-1', voice, input: text.slice(0, 4096) }),
      })
      if (!ttsRes.ok) return json({ error: 'tts_failed' }, ttsRes.status, headers)
      return new Response(ttsRes.body, {
        status: 200,
        headers: { ...headers, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-cache' },
      })
    }

    // ── Transcription Whisper ──────────────────────────────────
    if (url.pathname === '/whisper' && request.method === 'POST') {
      const pw = request.headers.get('x-atelier-password') || ''
      if (!safeEqual(pw, env.CAROLINE_PASSWORD || '')) return json({ error: 'unauthorized' }, 401, headers)
      if (!env.OPENAI_API_KEY) return json({ error: 'openai_key_not_configured' }, 500, headers)

      const audioType   = request.headers.get('x-audio-type') || 'audio/webm'
      const audioBuffer = await request.arrayBuffer()
      if (!audioBuffer.byteLength) return json({ error: 'empty_audio' }, 400, headers)

      const ext = audioType.includes('mp4') ? 'audio.mp4'
                : audioType.includes('ogg') ? 'audio.ogg'
                : 'audio.webm'

      const form = new FormData()
      form.append('file', new Blob([audioBuffer], { type: audioType }), ext)
      form.append('model', 'whisper-1')
      form.append('language', 'fr')
      form.append('response_format', 'text')

      const whisperRes = await fetch(WHISPER_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.OPENAI_API_KEY}` },
        body: form,
      })
      if (!whisperRes.ok) {
        const detail = await whisperRes.text()
        return json({ error: 'whisper_failed', detail }, whisperRes.status, headers)
      }
      const text = (await whisperRes.text()).trim()
      return json({ text }, 200, headers)
    }

    // ── OTP reset PIN ──────────────────────────────────────────
    if (url.pathname === '/request-otp' && request.method === 'POST') {
      const rl = await env.LATELIER_OTP.get('rate_limit')
      if (rl) return json({ error: 'too_many_requests', retry_after: 120 }, 429, headers)
      const otp = genOTP()
      await env.LATELIER_OTP.put('current_otp', JSON.stringify({ otp, attempts: 0, created: Date.now() }), { expirationTtl: OTP_TTL_SEC })
      await env.LATELIER_OTP.put('rate_limit', '1', { expirationTtl: 120 })
      const sent = await sendEmail(env.RESEND_API_KEY, otp)
      if (!sent) return json({ error: 'email_failed' }, 500, headers)
      return json({ ok: true, message: 'Code envoyé' }, 200, headers)
    }

    if (url.pathname === '/verify-otp' && request.method === 'POST') {
      let body
      try { body = await request.json() } catch { return json({ error: 'invalid_body' }, 400, headers) }
      const { code } = body || {}
      if (!code) return json({ error: 'missing_code' }, 400, headers)
      const raw = await env.LATELIER_OTP.get('current_otp')
      if (!raw) return json({ ok: false, error: 'expired_or_invalid' }, 400, headers)
      const stored = JSON.parse(raw)
      if (stored.attempts >= OTP_ATTEMPTS) {
        await env.LATELIER_OTP.delete('current_otp')
        return json({ ok: false, error: 'too_many_attempts' }, 400, headers)
      }
      if (!safeEqual(String(code).trim(), stored.otp)) {
        stored.attempts++
        await env.LATELIER_OTP.put('current_otp', JSON.stringify(stored), { expirationTtl: OTP_TTL_SEC })
        return json({ ok: false, error: 'invalid_code', attempts_left: OTP_ATTEMPTS - stored.attempts }, 400, headers)
      }
      await env.LATELIER_OTP.delete('current_otp')
      return json({ ok: true }, 200, headers)
    }

    // ── Sync snapshot (GET + POST /sync) ───────────────────────
    if (url.pathname === '/sync') {
      const token = request.headers.get('x-sync-token')?.trim()
      if (!token || token.length < 20) {
        return json({ error: 'Token manquant ou trop court (20 caracteres min)' }, 401, headers)
      }

      // Fail closed : sans secret configuré côté Cloudflare, on refuse plutôt
      // que de retomber sur un sel public (connu de tout le monde, ce repo
      // étant public sur GitHub).
      if (!env.SYNC_SECRET) {
        return json({ error: 'Synchronisation non configurée (SYNC_SECRET manquant côté serveur)' }, 503, headers)
      }
      const kvKey = `snapshot_${await hmacSha256(token, env.SYNC_SECRET)}`

      // GET — pull snapshot distant
      if (request.method === 'GET') {
        const raw = await env.ATELIER_KV.get(kvKey)
        if (!raw) return json({ empty: true, syncedAt: null }, 200, headers)
        return new Response(raw, {
          status: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
        })
      }

      // POST — push snapshot local
      if (request.method === 'POST') {
        const body = await request.text()

        if (body.length > MAX_SYNC_BYTES) {
          return json({ error: `Snapshot trop volumineux (${(body.length / 1024).toFixed(0)} KB > 10 MB)` }, 413, headers)
        }

        let parsed
        try { parsed = JSON.parse(body) }
        catch { return json({ error: 'JSON invalide' }, 400, headers) }

        if (!parsed.syncedAt) {
          return json({ error: 'Champ syncedAt manquant' }, 400, headers)
        }

        // Conflit : le distant est plus recent — le client doit pull d'abord
        const existing = await env.ATELIER_KV.get(kvKey)
        if (existing) {
          const remote = JSON.parse(existing)
          if (remote.syncedAt && new Date(remote.syncedAt) > new Date(parsed.syncedAt)) {
            return json({
              conflict: true,
              remoteSyncedAt: remote.syncedAt,
              message: "Le distant est plus recent — pull d'abord",
            }, 409, headers)
          }
        }

        await env.ATELIER_KV.put(kvKey, body, { expirationTtl: 60 * 60 * 24 * 365 })
        return json({ ok: true, savedAt: parsed.syncedAt }, 200, headers)
      }

      return json({ error: 'Methode non supportee' }, 405, headers)
    }

    return json({ error: 'not_found' }, 404, headers)
  },
}
