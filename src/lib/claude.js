// ─── Client Léa (via Cloudflare Pages Functions proxy) ──────────
const CLAUDE_PROXY = '/api/claude'
const TTS_PROXY = '/api/openai-tts'
const WHISPER_PROXY = '/api/openai-whisper'

const MODEL = 'claude-sonnet-4-20250514'

// ─── Nettoyage du texte avant TTS ────────────────────────────────
// Strip markdown (asterisques, headers, code, links), emojis, bullets
// pour que la voix ne lise pas "astérisque astérisque etc"
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
    .replace(/[\u{200D}\u{FE0F}]/gu, '')
    // Bullet markers en début de ligne
    .replace(/^[-•*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // Multiple newlines → pause
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    // Multiple spaces
    .replace(/\s+/g, ' ')
    .trim()
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

// ─── TTS (voix de Léa via OpenAI proxy) ─────────────────────────
// Nettoyage du texte + speed param (0.5 - 2.0 selon préférence)
// Modèle tts-1-hd pour qualité supérieure (× 2 coût mais accents français mieux)
export async function speakWithOpenAI({ openAiKey, text, voice = 'nova', speed = 1.0, hd = true }) {
  if (!openAiKey) throw new Error('Mot de passe Léa manquant')
  const cleanText = cleanForTTS(text).slice(0, 4096)
  if (!cleanText) throw new Error('Texte vide après nettoyage')
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
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.text()).slice(0, 300) } catch {}
    const err = new Error(`TTS échoué [HTTP ${res.status}]${detail ? ' — ' + detail : ''}`)
    err.status = res.status
    err.body = detail
    throw err
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  audio.play()
  return audio
}

// ─── Transcription Whisper (proxy) ──────────────────────────────
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
