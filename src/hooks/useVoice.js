import { useState, useRef, useCallback } from 'react'

export function useVoice({ onResult }) {
  const [listening,  setListening]  = useState(false)
  const [interim,    setInterim]    = useState('')
  const [errorMsg,   setErrorMsg]   = useState('')
  const [supported,  setSupported]  = useState(
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  )
  const recognitionRef = useRef(null)
  const listeningRef   = useRef(false) // miroir stable — évite la stale closure dans onend

  const setListeningSync = useCallback((val) => {
    listeningRef.current = val
    setListening(val)
  }, [])

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    listeningRef.current = false
    setListening(false)
    setInterim('')
  }, [])

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setSupported(false); return }

    setErrorMsg('')
    const rec = new SR()
    rec.lang            = 'fr-FR'
    rec.continuous      = true
    rec.interimResults  = true
    rec.maxAlternatives = 1

    rec.onstart = () => setListeningSync(true)

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
      if (e.error === 'not-allowed' || e.error === 'audio-capture' || e.error === 'service-not-allowed') {
        setErrorMsg('Le micro n\'est pas autorisé. Vérifie les permissions de ton navigateur.')
        stop()
      } else if (e.error !== 'no-speech') {
        stop()
      }
    }

    rec.onend = () => {
      // listeningRef.current évite la stale closure — restart si toujours en écoute
      if (recognitionRef.current && listeningRef.current) {
        try { recognitionRef.current.start() } catch (_) { setListeningSync(false) }
      } else {
        setListeningSync(false)
      }
    }

    recognitionRef.current = rec
    try { rec.start() } catch (_) { setListeningSync(false) }
  }, [onResult, stop, setListeningSync])

  const toggle = useCallback(() => {
    listening ? stop() : start()
  }, [listening, start, stop])

  return { listening, interim, errorMsg, supported, toggle, start, stop }
}
