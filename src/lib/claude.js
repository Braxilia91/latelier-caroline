// ─── Client Léa (via Cloudflare Pages Functions proxy) ──────────
const CLAUDE_PROXY = '/api/claude'
const TTS_PROXY = '/api/openai-tts'
const WHISPER_PROXY = '/api/openai-whisper'

const MODEL = 'claude-sonnet-4-20250514'

// ─── Nettoyage du texte avant TTS ────────────────────────────
// Strip markdown (astérisques, headers, code, links), emojis, bullets
// pour que la voix ne lise pas "étoile astérisque etc"
export function cleanForTTS(text) {
  if (!text) return ''
  return text
    // Markdown bold/italic asterisks
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    // Markdown italic underscores
    .replace(/___(.+?)___/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/(?<!\w)_(.+?)_(?!\w)/g, '$1')
    // Markdown headers
    .replace(/^#{1,6}\s+/gm, '')
    // Markdown links [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Markdown code blocks ``` ... ```
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Emojis (large Unicode blocks)
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{1F000}-\u{1F02F}]/gu, '')
    .replace(/[\u{1F100}-\u{1F1FF}]/gu, '')
    .replace(/[\u{1FA00}-\u{1FAFF}]/gu, '')
    .replace(/\u{200D}|\u{FE0F}/gu, '')
    // Bullet markers en début de ligne
    .replace(/^[-•*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // fix(TTS/quality): guillemets typographiques → supprimés (le contexte suffit à l'oral)
    .replace(/[«»\u201C\u201D\u201E]/g, '')
    // fix(TTS/quality): apostrophes typographiques → apostrophe droite
    .replace(/[\u2018\u2019]/g, "'")
    // fix(TTS/quality): parenthèses → virgule (évite les pauses bizarres à la lecture)
    .replace(/\(([^)]+)\)/g, ', $1,')
    // Multiple newlines → pause naturelle
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    // Multiple spaces
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Lexique de prononciation FR ──────────────────────────────
// LOT 2.1 — Ciblé sur sigles, abréviations et symboles qui sonnent
// mal en TTS française (tts-1-hd nova). Pas de remplacement
// d'anglicismes courants (parking, weekend…) : la voix FR les rend
// déjà acceptablement avec un accent francisé.
// Format : { regex_string: replacement }. Tous appliqués avec flag 'g'.
// NOTE : '\u2026' (…) est intentionnellement absent : OpenAI TTS le restitue
// nativement comme une pause/hésitation naturelle. Ne pas le remplacer.
const FR_LEXICON = {
  // Sigles techniques (lettres séparées pour épellation forcée)
  '\\bIA\\b': 'I A',
  '\\bAI\\b': 'A I',
  '\\bOpenAI\\b': 'Open A I',
  '\\bAPI\\b': 'A P I',
  '\\bTTS\\b': 'T T S',
  '\\bPDF\\b': 'P D F',
  '\\bURL\\b': 'U R L',
  '\\bPWA\\b': 'P W A',
  '\\bSAP\\b': 'S A P',
  '\\bCRM\\b': 'C R M',
  '\\bRGPD\\b': 'R G P D',
  '\\bOK\\b': 'okay',
  // Abréviations courantes
  '\\betc\\.?(?=\\s|$)': 'etcetera',
  '\\bvs\\.?(?=\\s|$)': 'versus',
  '\\bM\\.\\s': 'Monsieur ',
  '\\bMme\\.?\\s': 'Madame ',
  '\\bMlle\\.?\\s': 'Mademoiselle ',
  '\\bDr\\.?\\s': 'Docteur ',
  '\\bSt\\.?\\s': 'Saint ',
  '\\bSte\\.?\\s': 'Sainte ',
  // Symboles
  '&': ' et ',
  '%': ' pour cent',
  '\u20ac': ' euros',
  '\\$': ' dollars',
  '\u00a3': ' livres',
  // Tirets cadratins/demi-cadratins → virgule (fluidité de narration)
  // '\u2026' (…) retiré : TTS le rend nativement comme hésitation naturelle
  '\\s—\\s': ', ',
  '\\s–\\s': ', ',
  '\\s;\\s': ', ',
}

function applyFrLexicon(text) {
  if (!text) return ''
  let out = text
  for (const [pattern, replacement] of Object.entries(FR_LEXICON)) {
    out = out.replace(new RegExp(pattern, 'g'), replacement)
  }
  return out.replace(/\s+/g, ' ').trim()
}

export function normalizeForNarrationFR(text) {
  return applyFrLexicon(cleanForTTS(text))
}

export async function askClaude({ apiKey, systemPrompt, messages, maxTokens = 600, onChunk }) {
  if (!apiKey) throw new Error('Mot de passe Léa manquant')

  const response = await fetch(CLAUDE_PROXY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Lea-Pass': apiKey,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
      stream: !!onChunk,
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const type = err.error?.type || ''
    const msg = err.error?.message || ''
    throw new Error([type, msg].filter(Boolean).join(' ') || `Erreur ${response.status}`)
  }

  if (onChunk) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let full = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
      for (const line of lines) {
        const data = line.slice(6).trim()
        if (data === '[DONE]') break
        try {
          const parsed = JSON.parse(data)
          const text = parsed?.delta?.text || ''
          if (text) { full += text; onChunk(full) }
        } catch (_) { /* skip */ }
      }
    }
    return full
  }

  const data = await response.json()
  return data.content?.[0]?.text || ''
}

// ─── TTS streaming via MediaSource (voix de Léa via OpenAI proxy) ───
// Principe : dès les premiers octets du body HTTP, on alimente un
// SourceBuffer MPEG audio — l'audio commence sans attendre res.blob().
// Fallback transparent vers blob() si MediaSource non supporté (ex. Safari < 17).
//
// TTS/Phase 0 — onLatencyLog(event, extras) : inchangé
// autoPlay=false : inchangé, le caller attache ses listeners puis appelle play()

const SUPPORTS_MEDIA_SOURCE = (
  typeof MediaSource !== 'undefined' &&
  typeof MediaSource.isTypeSupported === 'function' &&
  MediaSource.isTypeSupported('audio/mpeg')
)

export async function speakWithOpenAI({ openAiKey, text, voice = 'nova', speed = 1.0, hd = true, autoPlay = true, onLatencyLog }) {
  if (!openAiKey) throw new Error('Mot de passe Léa manquant')
  const cleanText = normalizeForNarrationFR(text).slice(0, 4096)
  if (!cleanText) throw new Error('Texte vide après nettoyage')

  try { onLatencyLog?.('tts_fetch_start', { cleanTextLen: cleanText.length }) } catch (_) {}

  const res = await fetch(TTS_PROXY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Lea-Pass': openAiKey,
    },
    body: JSON.stringify({
      model: hd ? 'tts-1-hd' : 'tts-1',
      voice,
      input: cleanText,
      speed: Math.max(0.5, Math.min(2.0, speed)),
    }),
  })

  try { onLatencyLog?.('tts_response_headers', { status: res.status, ok: res.ok }) } catch (_) {}

  if (!res.ok) {
    let detail = ''
    try { detail = (await res.text()).slice(0, 300) } catch {}
    const err = new Error(`TTS échoué [HTTP ${res.status}]${detail ? ' — ' + detail : ''}`)
    err.status = res.status
    err.body = detail
    throw err
  }

  // ─ Streaming via MediaSource ─────────────────────────────────────
  if (SUPPORTS_MEDIA_SOURCE && res.body) {
    return new Promise((resolve, reject) => {
      const ms = new MediaSource()
      const audio = new Audio()
      audio.src = URL.createObjectURL(ms)

      ms.addEventListener('sourceopen', async () => {
        let sb
        try {
          sb = ms.addSourceBuffer('audio/mpeg')
        } catch (_e) {
          // MIME non supporté sur ce navigateur malgré isTypeSupported
          // Fallback blob
          ms.endOfStream()
          URL.revokeObjectURL(audio.src)
          try {
            const blob = await res.blob()
            const url2 = URL.createObjectURL(blob)
            const a2 = new Audio(url2)
            try { onLatencyLog?.('tts_blob_ready', { blobSizeKB: Math.round((blob?.size ?? 0) / 1024), note: 'mediasource_fallback' }) } catch (_) {}
            if (autoPlay) a2.play()
            resolve(a2)
          } catch (e2) { reject(e2) }
          return
        }

        sb.mode = 'sequence'
        const reader = res.body.getReader()
        let firstChunkAppended = false

        const pump = async () => {
          while (true) {
            const { done: d, value } = await reader.read()
            if (d) break
            if (!value?.length) continue

            // Attendre que le SourceBuffer soit prêt à recevoir
            if (sb.updating) {
              await new Promise(r => sb.addEventListener('updateend', r, { once: true }))
            }
            try {
              sb.appendBuffer(value)
            } catch (_) {
              // QuotaExceededError ou InvalidStateError — on stoppe proprement
              break
            }

            if (!firstChunkAppended) {
              firstChunkAppended = true
              try { onLatencyLog?.('tts_blob_ready', { note: 'mediasource_first_chunk' }) } catch (_) {}
              // L'audio peut déjà commencer à jouer
              resolve(audio)
              if (autoPlay) audio.play().catch(() => {})
            }
          }

          // Fin du stream : signaler la fin au MediaSource
          if (sb.updating) {
            await new Promise(r => sb.addEventListener('updateend', r, { once: true }))
          }
          try {
            if (ms.readyState === 'open') ms.endOfStream()
          } catch (_) {}
        }

        pump().catch(err => {
          // Erreur réseau en cours de stream
          try { if (ms.readyState === 'open') ms.endOfStream('network') } catch (_) {}
          if (!firstChunkAppended) reject(err)
          // Si déjà résolu, l'erreur mid-stream est absorbée (audio jouera jusqu'où il a reçu)
        })
      }, { once: true })

      ms.addEventListener('error', () => {
        reject(new Error('MediaSource error'))
      }, { once: true })
    })
  }

  // ─ Fallback : blob() classique (Safari < 17, ou MediaSource non dispo) ──
  const blob = await res.blob()
  try { onLatencyLog?.('tts_blob_ready', { blobSizeKB: Math.round((blob?.size ?? 0) / 1024), note: 'blob_fallback' }) } catch (_) {}
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  if (autoPlay) audio.play()
  return audio
}

// ─── Transcription Whisper (proxy) ─────────────────────────────
export async function transcribeAudio({ openAiKey, audioBlob }) {
  if (!openAiKey) throw new Error('Mot de passe Léa manquant')
  const form = new FormData()
  form.append('file', audioBlob, 'audio.webm')
  form.append('model', 'whisper-1')
  form.append('language', 'fr')
  const res = await fetch(WHISPER_PROXY, {
    method: 'POST',
    headers: { 'X-Lea-Pass': openAiKey },
    body: form,
  })
  if (!res.ok) throw new Error('Transcription échouée')
  const data = await res.json()
  return data.text || ''
}
