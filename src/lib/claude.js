// ─── Client Claude (Anthropic API) ────────────────────────────
const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL   = 'claude-sonnet-4-20250514'

export async function askClaude({ apiKey, systemPrompt, messages, maxTokens = 600, onChunk }) {
  if (!apiKey) throw new Error('Clé API manquante')

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
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
    throw new Error(err.error?.message || `Erreur API ${response.status}`)
  }

  // Streaming
  if (onChunk) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let full = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      const lines  = chunk.split('\n').filter(l => l.startsWith('data: '))
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

  // Non-streaming
  const data = await response.json()
  return data.content?.[0]?.text || ''
}

// ─── TTS (voix de Léa via OpenAI) ─────────────────────────────
export async function speakWithOpenAI({ openAiKey, text, voice = 'nova' }) {
  if (!openAiKey) throw new Error('Clé OpenAI manquante')
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAiKey}`,
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

// ─── Transcription Whisper ─────────────────────────────────────
export async function transcribeAudio({ openAiKey, audioBlob }) {
  if (!openAiKey) throw new Error('Clé OpenAI manquante')
  const form = new FormData()
  form.append('file', audioBlob, 'audio.webm')
  form.append('model', 'whisper-1')
  form.append('language', 'fr')
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openAiKey}` },
    body: form,
  })
  if (!res.ok) throw new Error('Transcription échouée')
  const data = await res.json()
  return data.text || ''
}
