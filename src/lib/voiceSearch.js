// src/lib/voiceSearch.js
// VoiceSearchButton — mini enregistrement 10s pour DicoCaro
// Pas de player, UI pulse, transcription Whisper intégrée

import { useState, useRef, useCallback } from 'react'
import { Mic, MicOff, Loader2 } from 'lucide-react'

const isIOSSafari = () => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /iP(ad|hone|od)/.test(ua) && /Safari/.test(ua) && !/Chrome/.test(ua)
}

async function transcribeWithWhisper(blob, openAiKey) {
  const formData = new FormData()
  formData.append('file', blob, isIOSSafari() ? 'audio.mp4' : 'audio.webm')
  formData.append('model', 'whisper-1')
  formData.append('language', 'fr')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openAiKey}` },
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Whisper ${res.status}`)
  }
  const data = await res.json()
  return data.text || ''
}

/**
 * @param {Object}   props
 * @param {Function} props.onTranscript   — (text: string) => void
 * @param {string}  [props.openAiKey]     — clé OpenAI pour Whisper (optionnel)
 * @param {number}  [props.maxDuration=10000]
 * @param {boolean} [props.disabled=false]
 */
export function VoiceSearchButton({ onTranscript, openAiKey, maxDuration = 10000, disabled = false }) {
  const [phase, setPhase]           = useState('idle') // 'idle' | 'recording' | 'transcribing'
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(maxDuration / 1000))
  const [error, setError]           = useState(null)

  const recorderRef = useRef(null)
  const chunksRef   = useRef([])
  const timerRef    = useRef(null)
  const countRef    = useRef(null)

  const stop = useCallback(async () => {
    clearTimeout(timerRef.current)
    clearInterval(countRef.current)

    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop() } catch (_) {}
    }

    await new Promise(r => setTimeout(r, 300))

    const chunks = chunksRef.current
    chunksRef.current = []

    if (!chunks.length) {
      setPhase('idle')
      setError('Aucun son capté — réessaie')
      return
    }

    const mimeType = isIOSSafari() ? 'audio/mp4' : 'audio/webm'
    const blob = new Blob(chunks, { type: mimeType })
    setPhase('transcribing')

    try {
      let text = ''
      if (openAiKey) {
        text = await transcribeWithWhisper(blob, openAiKey)
      } else {
        // Fallback Web Speech API si pas de clé OpenAI
        setError('Clé OpenAI manquante — transcription impossible')
        setPhase('idle')
        setSecondsLeft(Math.ceil(maxDuration / 1000))
        return
      }

      if (text?.trim()) {
        onTranscript(text.trim())
        setError(null)
      } else {
        setError('Transcription vide — parle plus près du micro')
      }
    } catch (err) {
      console.error('[VoiceSearch]', err)
      setError(err.message || 'Erreur de transcription')
    } finally {
      setPhase('idle')
      setSecondsLeft(Math.ceil(maxDuration / 1000))
    }
  }, [onTranscript, openAiKey, maxDuration])

  const start = useCallback(async () => {
    setError(null)
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = isIOSSafari() ? 'audio/mp4'
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4')

      const recorder = new MediaRecorder(stream, { mimeType })
      recorderRef.current = recorder

      recorder.ondataavailable = e => { if (e.data?.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => stream.getTracks().forEach(t => t.stop())
      recorder.start(100)

      timerRef.current = setTimeout(stop, maxDuration)

      let rem = Math.ceil(maxDuration / 1000)
      setSecondsLeft(rem)
      countRef.current = setInterval(() => {
        rem -= 1
        setSecondsLeft(rem)
        if (rem <= 0) clearInterval(countRef.current)
      }, 1000)

      setPhase('recording')
    } catch (err) {
      console.error('[VoiceSearch] start', err)
      setError('Micro non accessible — vérifie les permissions')
    }
  }, [maxDuration, stop])

  const handleClick = () => {
    if (phase === 'recording') stop()
    else if (phase === 'idle') start()
  }

  const isRecording = phase === 'recording'

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <style>{`
        @keyframes dicoVoicePulse {
          0%,100% { transform: scale(1); opacity: .25; }
          50%      { transform: scale(1.4); opacity: .08; }
        }
        .dico-spin { animation: spin .8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {isRecording && (
        <div style={{
          position: 'absolute', width: 44, height: 44, borderRadius: '50%',
          background: '#C4956A', pointerEvents: 'none',
          animation: 'dicoVoicePulse 1.4s ease-in-out infinite',
        }} />
      )}

      <button
        onClick={handleClick}
        disabled={disabled || phase === 'transcribing'}
        title={isRecording ? 'Arrêter' : phase === 'transcribing' ? 'Transcription…' : 'Recherche vocale (10s)'}
        aria-label={isRecording ? "Arrêter l'enregistrement" : 'Recherche vocale 10s'}
        style={{
          width: 36, height: 36, borderRadius: 10,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: '1.5px solid #D4C4A8',
          background: isRecording ? '#C4956A' : '#FFFDF9',
          color: isRecording ? '#fff' : '#8B7355',
          cursor: disabled || phase === 'transcribing' ? 'not-allowed' : 'pointer',
          opacity: disabled || phase === 'transcribing' ? .5 : 1,
          transition: 'all .15s', position: 'relative', flexShrink: 0,
        }}
      >
        {phase === 'transcribing'
          ? <Loader2 size={16} className="dico-spin" />
          : isRecording
          ? <MicOff size={16} />
          : <Mic size={16} />}
      </button>

      {isRecording && (
        <span style={{
          fontSize: '.62rem', color: '#C4956A', marginTop: 2,
          fontFamily: "'Nunito', sans-serif", lineHeight: 1,
        }}>
          {secondsLeft}s
        </span>
      )}

      {error && (
        <span style={{
          position: 'absolute', bottom: 'calc(100% + 4px)',
          left: '50%', transform: 'translateX(-50%)',
          fontSize: '.62rem', color: '#92400E',
          background: '#FEF3E2', padding: '2px 8px', borderRadius: 4,
          whiteSpace: 'nowrap', fontFamily: "'Nunito', sans-serif",
          border: '1px solid #F5C97A',
        }}>
          {error}
        </span>
      )}
    </div>
  )
}
