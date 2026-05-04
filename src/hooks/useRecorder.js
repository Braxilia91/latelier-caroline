import { useState, useRef, useCallback, useEffect } from 'react'

// Formats audio supportés, par ordre de préférence
const MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
]

function getBestMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  return MIME_TYPES.find(t => MediaRecorder.isTypeSupported(t)) || ''
}

export function useRecorder() {
  const [recording,  setRecording]  = useState(false)
  const [duration,   setDuration]   = useState(0)    // secondes
  const [supported,  setSupported]  = useState(
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  )

  const mediaRecorderRef = useRef(null)
  const chunksRef        = useRef([])
  const streamRef        = useRef(null)
  const timerRef         = useRef(null)
  const mimeTypeRef      = useRef('')

  const start = useCallback(async () => {
    if (recording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current  = stream
      mimeTypeRef.current = getBestMimeType()

      const options = mimeTypeRef.current ? { mimeType: mimeTypeRef.current } : {}
      const mr = new MediaRecorder(stream, options)
      chunksRef.current = []

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.start(1000)   // chunk toutes les secondes
      mediaRecorderRef.current = mr

      setRecording(true)
      setDuration(0)
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } catch (err) {
      setSupported(false)
      throw err
    }
  }, [recording])

  const stop = useCallback(() => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) { resolve(null); return }
      clearInterval(timerRef.current)

      mediaRecorderRef.current.onstop = () => {
        const mimeType = mimeTypeRef.current || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current        = null
        mediaRecorderRef.current = null
        chunksRef.current        = []
        setRecording(false)
        resolve({ blob, mimeType })
      }
      try { mediaRecorderRef.current.stop() } catch (_) { resolve(null) }
    })
  }, [])

  const cancel = useCallback(() => {
    clearInterval(timerRef.current)
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null
      try { mediaRecorderRef.current.stop() } catch (_) {}
      mediaRecorderRef.current = null
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current  = null
    chunksRef.current  = []
    setRecording(false)
    setDuration(0)
  }, [])

  // Nettoyage au démontage
  useEffect(() => () => cancel(), [cancel])

  // Durée formatée mm:ss
  const durationFmt = `${String(Math.floor(duration / 60)).padStart(2,'0')}:${String(duration % 60).padStart(2,'0')}`

  return { recording, duration, durationFmt, supported, start, stop, cancel }
}
