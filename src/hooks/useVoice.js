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
  const lastFinalRef   = useRef('')    // déduplication : évite d'émettre 2× le même final consécutif

  const setListeningSync = useCallback((val) => {
    listeningRef.current = val
    setListening(val)
  }, [])

  const resetSessionState = useCallback(() => {
    setInterim('')
    lastFinalRef.current = ''
  }, [])

  const stop = useCallback(() => {
    const rec = recognitionRef.current
    if (rec) {
      rec.onend = null
      rec.stop()
      recognitionRef.current = null
    }
    listeningRef.current = false
    setListening(false)
    resetSessionState()
  }, [resetSessionState])

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setSupported(false)
      return
    }

    setErrorMsg('')
    resetSessionState()

    const rec = new SR()
    rec.lang = 'fr-FR'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onstart = () => setListeningSync(true)

    rec.onresult = (e) => {
      let finalText = ''
      let interimText = ''

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        const transcript = result[0]?.transcript || ''

        if (result.isFinal) finalText += transcript + ' '
        else interimText += transcript
      }

      setInterim(interimText)

      const normalizedFinal = finalText.trim()
      if (normalizedFinal && onResult && normalizedFinal !== lastFinalRef.current) {
        lastFinalRef.current = normalizedFinal
        onResult(finalText)
      }
    }

    rec.onerror = (e) => {
      if (
        e.error === 'not-allowed' ||
        e.error === 'audio-capture' ||
        e.error === 'service-not-allowed'
      ) {
        setErrorMsg('Le micro n\'est pas autorisé. Vérifie les permissions de ton navigateur.')
        stop()
      } else if (e.error !== 'no-speech') {
        stop()
      }
    }

    rec.onend = () => {
      if (recognitionRef.current && listeningRef.current) {
        try {
          recognitionRef.current.start()
        } catch (_) {
          setListeningSync(false)
        }
      } else {
        setListeningSync(false)
      }
    }

    recognitionRef.current = rec

    try {
      rec.start()
    } catch (_) {
      setListeningSync(false)
    }
  }, [onResult, stop, setListeningSync, resetSessionState])

  const toggle = useCallback(() => {
    listening ? stop() : start()
  }, [listening, start, stop])

  return { listening, interim, errorMsg, supported, toggle, start, stop }
}
