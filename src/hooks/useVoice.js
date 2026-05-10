import { useState, useRef, useCallback, useEffect } from 'react'

// LOT 4D.1 — Wake Lock support detection (Web Wake Lock API)
const WAKE_LOCK_SUPPORTED = typeof navigator !== 'undefined'
  && 'wakeLock' in navigator
  && typeof navigator.wakeLock?.request === 'function'

export function useVoice({ onResult }) {
  const [listening,  setListening]  = useState(false)
  const [interim,    setInterim]    = useState('')
  const [errorMsg,   setErrorMsg]   = useState('')
  const [supported,  setSupported]  = useState(
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  )
  // LOT 4D.1 — état Wake Lock pour feedback UX (bandeau si non dispo / refusé)
  // 'idle' (jamais tenté) | 'acquired' (actif) | 'released' (relâché normalement)
  // | 'unsupported' (API absente du navigateur) | 'denied' (OS a refusé : batterie, etc.)
  const [wakeLockState, setWakeLockState] = useState(WAKE_LOCK_SUPPORTED ? 'idle' : 'unsupported')

  const recognitionRef = useRef(null)
  const listeningRef   = useRef(false) // miroir stable — évite la stale closure dans onend
  const lastFinalRef   = useRef('')    // déduplication : évite d'émettre 2× le même final consécutif
  const wakeLockRef    = useRef(null)  // LOT 4D.1 — référence WakeLockSentinel pour pouvoir release

  const setListeningSync = useCallback((val) => {
    listeningRef.current = val
    setListening(val)
  }, [])

  // Reset partagé entre start() et stop() — évite oubli si on ajoute du state plus tard
  const resetSessionState = useCallback(() => {
    setInterim('')
    lastFinalRef.current = ''
  }, [])

  // LOT 4D.1 — Acquérir le verrou écran (empêche la mise en veille pendant la dictée)
  // Tolérant : si refusé/non supporté on continue la dictée, juste on ne tient pas l'écran allumé.
  const acquireWakeLock = useCallback(async () => {
    if (!WAKE_LOCK_SUPPORTED) { setWakeLockState('unsupported'); return }
    try {
      const sentinel = await navigator.wakeLock.request('screen')
      wakeLockRef.current = sentinel
      setWakeLockState('acquired')
      // Si l'OS relâche (passage en background, batterie faible…), on est notifié
      sentinel.addEventListener('release', () => {
        wakeLockRef.current = null
        // On ne passe à 'released' que si on n'est plus en écoute (sinon visibilitychange tentera de ré-acquérir)
        if (!listeningRef.current) setWakeLockState('released')
      })
    } catch (_) {
      wakeLockRef.current = null
      setWakeLockState('denied')
    }
  }, [])

  // LOT 4D.1 — Libérer le verrou écran proprement
  const releaseWakeLock = useCallback(async () => {
    const sentinel = wakeLockRef.current
    wakeLockRef.current = null
    if (sentinel) {
      try { await sentinel.release() } catch (_) {}
    }
    setWakeLockState(prev => (prev === 'unsupported' ? 'unsupported' : 'released'))
  }, [])

  // LOT 4D.1 — Quand l'app revient au premier plan ET qu'on est encore en dictée,
  // ré-acquérir le verrou (l'OS le libère auto en background).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && listeningRef.current && !wakeLockRef.current) {
        acquireWakeLock()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [acquireWakeLock])

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
    // LOT 4D.1 — release wake lock à l'arrêt (volontaire ou erreur)
    releaseWakeLock()
  }, [resetSessionState, releaseWakeLock])

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setSupported(false); return }

    setErrorMsg('')
    resetSessionState()
    // LOT 4D.1 — tente le wake lock avant de démarrer la reco (non bloquant)
    acquireWakeLock()
    const rec = new SR()
    rec.lang            = 'fr-FR'
    rec.continuous      = true
    rec.interimResults  = true
    rec.maxAlternatives = 1

    rec.onstart = () => setListeningSync(true)

    rec.onresult = (e) => {
      let finalText = ''
      let interimText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result     = e.results[i]
        const transcript = result[0]?.transcript || ''
        const conf       = result[0]?.confidence
        // Sur Android Chrome, isFinal peut être marqué même quand confidence=0 (résultat instable
        // qui sera re-tranché). On ne traite comme final QUE si confidence > 0,
        // OU si confidence n'est pas exposée par le navigateur (Firefox, vieux Safari → fallback safe).
        const isReallyFinal = result.isFinal && (conf === undefined || conf > 0)
        if (isReallyFinal) finalText += transcript + ' '
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
  }, [onResult, stop, setListeningSync, resetSessionState, acquireWakeLock])

  const toggle = useCallback(() => {
    listening ? stop() : start()
  }, [listening, start, stop])

  return { listening, interim, errorMsg, supported, toggle, start, stop, wakeLockState }
}
