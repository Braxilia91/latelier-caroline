// ─── Client Léa (via Cloudflare Pages Functions proxy) ──────────
// Les vraies clés API sont côté serveur (Cloudflare Pages secrets).
// L'utilisateur saisit un "Mot de passe Léa" passé en header X-Lea-Pass.

const CLAUDE_PROXY  = '/api/claude'
const TTS_PROXY     = '/api/openai-tts'
const WHISPER_PROXY = '/api/openai-whisper'

const MODEL = 'claude-sonnet-4-20250514'

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
// Note : openAiKey est en réalité le même mot de passe Léa
export async function speakWithOpenAI({ openAiKey, text, voice = 'nova' }) {
  if (!openAiKey) throw new Error('Mot de passe Léa manquant')
  const res = await fetch(TTS_PROXY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Lea-Pass': openAiKey,
    },
    body: JSON.stringify({ model: 'tts-1', voice, input: text.slice(0, 4096) }),
  })
  if (!res.ok) throw new Error('TTS échoué')
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
