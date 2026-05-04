// ─── Client Claude via Worker proxy ───────────────────────────
const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://latelier-api.atome-tdah-cloud.workers.dev'

export async function askClaude({ password, systemPrompt, messages, maxTokens = 600, onChunk }) {
  if (!password) throw new Error('Mot de passe manquant')

  const response = await fetch(`${WORKER_URL}/claude`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-atelier-password': password,
    },
    body: JSON.stringify({
      system: systemPrompt,
      messages,
      max_tokens: maxTokens,
      stream: !!onChunk,
    }),
  })

  if (response.status === 401) throw new Error('Mot de passe incorrect')
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `Erreur ${response.status}`)
  }

  // Streaming
  if (onChunk) {
    const reader  = response.body.getReader()
    const decoder = new TextDecoder()
    let full = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))
      for (const line of lines) {
        const data = line.slice(6).trim()
        if (data === '[DONE]') break
        try {
          const text = JSON.parse(data)?.delta?.text || ''
          if (text) { full += text; onChunk(full) }
        } catch (_) {}
      }
    }
    return full
  }

  // Non-streaming
  const data = await response.json()
  return data.content?.[0]?.text || ''
}

// ─── TTS (voix de Léa via Worker proxy) ───────────────────────
export async function speakWithOpenAI({ password, text, voice = 'nova' }) {
  if (!password) throw new Error('Mot de passe manquant')
  const res = await fetch(`${WORKER_URL}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-atelier-password': password },
    body: JSON.stringify({ text, voice }),
  })
  if (res.status === 401) throw new Error('Mot de passe incorrect')
  if (!res.ok) throw new Error('TTS échoué')
  const audio = new Audio(URL.createObjectURL(await res.blob()))
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
  return (await res.json()).text || ''
}
