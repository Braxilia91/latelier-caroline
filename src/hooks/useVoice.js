import { useState, useRef, useCallback, useEffect } from 'react'

export function useVoice({ onResult }) {
  const [listening,  setListening]  = useState(false)
  const [interim,    setInterim]    = useState('')
  const [supported,  setSupported]  = useState(
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  )

  const recognitionRef  = useRef(null)
  const listeningRef    = useRef(false)   // ← source de vérité pour les callbacks
  const onResultRef     = useRef(onResult) // ← évite la stale closure sur onResult aussi
  const restartGuardRef = useRef(false)   // ← anti-double-relance

  // Maintenir onResultRef à jour sans recréer les callbacks
  useEffect(() => { onResultRef.current = onResult }, [onResult])

  const stop = useCallback(() => {
    listeningRef.current  = false
    restartGuardRef.current = false
    if (recognitionRef.current) {
      recognitionRef.current.onend = null   // débrancher avant stop pour éviter la boucle
      recognitionRef.current.onerror = null
      try { recognitionRef.current.stop() } catch (_) {}
      recognitionRef.current = null
    }
    setListening(false)
    setInterim('')
  }, [])

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setSupported(false); return }
    if (listeningRef.current) return   // déjà en cours, ne pas relancer

    listeningRef.current = true
    restartGuardRef.current = false
    setListening(true)

    const rec = new SR()
    rec.lang            = 'fr-FR'
    rec.continuous      = true
    rec.interimResults  = true
    rec.maxAlternatives = 1

    rec.onresult = (e) => {
      let finalText = ''; let interimText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) finalText += t + ' '
        else interimText += t
      }
      setInterim(interimText)
      if (finalText && onResultRef.current) onResultRef.current(finalText)
    }

    rec.onerror = (e) => {
      // 'no-speech' = silence normal, on ignore
      if (e.error === 'no-speech') return
      // Pour tout autre erreur on stoppe proprement
      stop()
    }

    rec.onend = () => {
      // Relancer uniquement si on est encore censé écouter
      // et qu'une relance n'est pas déjà en cours (anti-double)
      if (listeningRef.current && !restartGuardRef.current) {
        restartGuardRef.current = true
        setTimeout(() => {
          restartGuardRef.current = false
          if (listeningRef.current) {
            try {
              recognitionRef.current?.start()
            } catch (_) {
              // Si ça échoue quand même, on s'arrête proprement
              listeningRef.current = false
              setListening(false)
            }
          }
        }, 150) // petite pause pour laisser le navigateur relâcher le micro
      } else if (!listeningRef.current) {
        setListening(false)
        setInterim('')
      }
    }

    recognitionRef.current = rec
    try {
      rec.start()
    } catch (_) {
      listeningRef.current = false
      setListening(false)
    }
  }, [stop])

  const toggle = useCallback(() => {
    listeningRef.current ? stop() : start()
  }, [start, stop])

  // Nettoyage au démontage du composant
  useEffect(() => {
    return () => {
      listeningRef.current = false
      if (recognitionRef.current) {
        recognitionRef.current.onend = null
        recognitionRef.current.onerror = null
        try { recognitionRef.current.stop() } catch (_) {}
        recognitionRef.current = null
      }
    }
  }, [])

  return { listening, interim, supported, toggle, start, stop }
}
