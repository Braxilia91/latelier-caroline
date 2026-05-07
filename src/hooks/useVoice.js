import { useState, useRef, useCallback } from 'react'

export function useVoice({ onResult }) {
  const [listening,  setListening]  = useState(false)
  const [interim,    setInterim]    = useState('')
  const [supported,  setSupported]  = useState(
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  )
  const recognitionRef = useRef(null)

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setSupported(false); return }

    const rec = new SR()
    rec.lang            = 'fr-FR'
    rec.continuous      = true
    rec.interimResults  = true
    rec.maxAlternatives = 1

    rec.onstart = () => setListening(true)

    rec.onresult = (e) => {
      let finalText = ''; let interimText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) finalText += t + ' '
        else interimText += t
      }
      setInterim(interimText)
      if (finalText && onResult) onResult(finalText)
    }

    rec.onerror = (e) => {
      if (e.error !== 'no-speech') stop()
    }

    rec.onend = () => {
      // Relancer si toujours en écoute
      if (recognitionRef.current && listening) {
        try { recognitionRef.current.start() } catch (_) { setListening(false) }
      } else {
        setListening(false)
      }
    }

    recognitionRef.current = rec
    try { rec.start() } catch (_) { setListening(false) }
  }, [onResult, listening])

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setListening(false)
    setInterim('')
  }, [])

  const toggle = useCallback(() => {
    listening ? stop() : start()
  }, [listening, start, stop])

  return { listening, interim, supported, toggle, start, stop }
}
