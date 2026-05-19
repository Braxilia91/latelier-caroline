import { useState, useEffect, useRef } from 'react'
import Modal from '../ui/Modal'
import {
  X,
  PencilSimple as Edit3,
  Check,
  Trash as Trash2,
  Archive,
  Tag,
  BookOpen,
  Sparkle as Sparkles,
  Microphone as Mic,
  Stop as Square,
  FileText,
} from '@phosphor-icons/react'
import useClickAway from '../../hooks/useClickAway'
import { runVisionOCR } from '../../lib/visionOCR'
import { runVisionInspire } from '../../lib/visionInspire'
import { inspireFromImage, fileToBase64, detectMediaType } from '../../lib/vision'
import { buildTraceContinuationPrompt } from '../../lib/prompts'
import { transcribeAudio } from '../../lib/claude'
import { S } from './TraceDetailModal.styles'

// T6A.1 — palette saturée (ADN atelier + distinctivité accrue pour les pastilles vignettes)
const STATUS_LABELS = {
  private: { label: 'Gardée dans le tiroir', color: '#8A7563' },
  vrac:    { label: 'Envoyée au vrac',       color: '#E07A1F' },
  note:    { label: 'Note brute',            color: '#6E3A1E' },
  scene:   { label: 'Scène avec Léa',        color: '#3FA868' },
  letter:  { label: 'Lettre',                color: '#3D6FCF' },
}

// T6A — ordre d'affichage des options dans le popover statut
const STATUS_ORDER = ['private', 'vrac', 'note', 'scene', 'letter']

// Champs de réponses Caroline — scope LOT 2A (cf docs/le-tiroir-v1.md §5)
const RESPONSE_FIELDS = [
  { key: 'whyNow',    label: 'Pourquoi cette photo, maintenant ?' },
  { key: 'detail',    label: 'Quel détail te frappe en premier ?' },
  { key: 'unseen',    label: "Qu'est-ce qu'on ne voit pas, mais qui était pourtant là ?" },
  { key: 'leftToday', label: "Qu'est-ce que cette trace te laisse aujourd'hui ?" },
]

const EMPTY_PLACEHOLDER = 'Pas encore écrit — clique sur ✎ pour répondre.'

export default function TraceDetailModal({
  trace,
  onClose,
  editTrace,
  onDelete,
  loadTraceBlob,
  chapters,        // Lot B — tableau de chapitres fourni par App.jsx
  currentChapter,  // FEAT-E — chapitre courant, utilisé pour le contexte du brief "Continuer avec Léa"
  apiKey = '',     // FEAT-C — mot de passe Léa pour /api/vision-ocr
  onContinueWithLea, // FEAT-E — callback (briefText, uiMessage) => Promise<void>, ouvre le Coach avec contexte
  openAiKey = '',           // Lot C — clé OpenAI pour transcribeAudio (Whisper)
  saveVoiceMemo,            // Lot C — async (traceId, blob, mimeType) => void
  getVoiceMemo,             // Lot C — async (traceId) => { blob, mimeType } | null
  deleteVoiceMemo,          // Lot C — async (traceId) => void
}) {
  const [blobUrl, setBlobUrl] = useState(null)
  const [traceBlob, setTraceBlob] = useState(null)

  // T7 — état édition inline
  const [localTrace,   setLocalTrace]   = useState(trace)
  const [editingField, setEditingField] = useState(null)
  const [draftValue,   setDraftValue]   = useState('')
  const [saving,       setSaving]       = useState(false)
  const textareaRef = useRef(null)

  // T6A — état popover statut
  const [statusOpen, setStatusOpen] = useState(false)
  const statusContainerRef = useRef(null)
  useClickAway(statusContainerRef, () => setStatusOpen(false))

  // FEAT-C — OCR vision a posteriori sur une trace existante
  const [visionStatus, setVisionStatus] = useState('idle')
  const [visionPreviewText, setVisionPreviewText] = useState('')
  const [visionErr, setVisionErr] = useState(null)
  const [visionSaving, setVisionSaving] = useState(false)

  // FEAT-D — "Faire parler cette trace" : inspiration visuelle volatile
  const [inspireStatus, setInspireStatus] = useState('idle')
  const [inspireText, setInspireText] = useState('')
  const [inspireErr, setInspireErr] = useState(null)
  const [inspireCopied, setInspireCopied] = useState(false)

  // ─── Lot C — Mémo vocal (Android + PC Chrome, 120s max) ───
  // Support détecté par feature-detection MediaRecorder (Safari iOS = pas supporté).
  // Voir P3 décisions produit : pas d'iOS Safari.
  const VOICE_MEMO_MAX_SEC = 120
  const voiceMemoSupported = typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined'
  const [voiceMemoBlob,    setVoiceMemoBlob]    = useState(null)   // Blob | null
  const [voiceMemoUrl,     setVoiceMemoUrl]     = useState(null)   // string | null (objectURL pour <audio>)
  const [voiceMemoMime,    setVoiceMemoMime]    = useState(null)   // string | null
  const [recording,        setRecording]        = useState(false)
  const [recordingElapsed, setRecordingElapsed] = useState(0)      // secondes
  const [recordError,      setRecordError]      = useState(null)   // string | null (permission refusée, etc.)
  const [transcribing,     setTranscribing]     = useState(false)
  const [transcript,       setTranscript]       = useState('')
  const [transcribeErr,    setTranscribeErr]    = useState(null)
  const mediaRecorderRef = useRef(null)
  const mediaStreamRef   = useRef(null)
  const audioChunksRef   = useRef([])
  const recordTimerRef   = useRef(null)
  const recordAutoStopRef = useRef(null)
  const [continuing, setContinuing] = useState(false)

  // Resync localTrace quand on change de trace
  useEffect(() => {
    setLocalTrace(trace)
    setEditingField(null)
    setDraftValue('')
    setSaving(false)
    setStatusOpen(false)
    setVisionStatus('idle')
    setVisionPreviewText('')
    setVisionErr(null)
    setVisionSaving(false)
    setInspireStatus('idle')
    setInspireText('')
    setInspireErr(null)
    setInspireCopied(false)
    // Lot C — reset également les états voicememo quand la trace change
    setTranscript('')
    setTranscribeErr(null)
    setRecordError(null)
    setContinuing(false)
  }, [trace?.id, trace])

  useEffect(() => {
    if (!loadTraceBlob || !trace?.id) {
      setBlobUrl(null)
      setTraceBlob(null)
      return
    }

    let cancelled = false
    let url = null

    setBlobUrl(null)
    setTraceBlob(null)

    loadTraceBlob(trace.id)
      .then((result) => {
        if (cancelled) return
        if (result?.blob instanceof Blob) {
          url = URL.createObjectURL(result.blob)
          setBlobUrl(url)
          setTraceBlob(result.blob)
        }
      })
      .catch(() => {
        if (!cancelled) { setBlobUrl(null); setTraceBlob(null) }
      })

    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [trace?.id, loadTraceBlob])

  // Autofocus textarea à l'entrée en édition + caret en fin de texte
  useEffect(() => {
    if (editingField && textareaRef.current) {
      const ta = textareaRef.current
      ta.focus()
      const len = ta.value.length
      try { ta.setSelectionRange(len, len) } catch { /* ignore */ }
    }
  }, [editingField])

  // T6A — Escape ferme le popover statut en priorité
  useEffect(() => {
    if (!statusOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setStatusOpen(false)
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [statusOpen])

  // ─── Lot C — Mémo vocal : load au mount + cleanup au unmount ───
  useEffect(() => {
    if (!trace?.id || typeof getVoiceMemo !== 'function') return
    let cancelled = false
    let createdUrl = null
    ;(async () => {
      try {
        const memo = await getVoiceMemo(trace.id)
        if (cancelled) return
        if (memo?.blob) {
          createdUrl = URL.createObjectURL(memo.blob)
          setVoiceMemoBlob(memo.blob)
          setVoiceMemoUrl(createdUrl)
          setVoiceMemoMime(memo.mimeType || 'audio/webm')
        } else {
          setVoiceMemoBlob(null)
          setVoiceMemoUrl(null)
          setVoiceMemoMime(null)
        }
      } catch (e) {
        console.warn('[VoiceMemo] load failed', trace.id, e?.message)
      }
    })()
    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [trace?.id, getVoiceMemo])

  // Cleanup global au unmount du composant : stop recording si en cours,
  // libérer le stream micro, clear les timers.
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null }
      if (recordAutoStopRef.current) { clearTimeout(recordAutoStopRef.current); recordAutoStopRef.current = null }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop() } catch {}
      }
      if (mediaStreamRef.current) {
        try { mediaStreamRef.current.getTracks().forEach(t => t.stop()) } catch {}
        mediaStreamRef.current = null
      }
    }
  }, [])

  if (!localTrace) return null

  const canEdit = typeof editTrace === 'function'

  const currentStatusKey = localTrace.status && STATUS_LABELS[localTrace.status]
    ? localTrace.status
    : 'private'
  const status = STATUS_LABELS[currentStatusKey]
  const dateStr = localTrace.createdAt
    ? new Date(localTrace.createdAt).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''

  // ── Édition inline ───────────────────────────────────────────
  const enterEdit = (fieldKey) => {
    if (editingField) return
    if (!canEdit) return
    setDraftValue(localTrace[fieldKey] ?? '')
    setEditingField(fieldKey)
  }

  const cancelEdit = () => {
    setEditingField(null)
    setDraftValue('')
  }

  const saveEdit = async () => {
    if (!editingField || saving) return
    if (!canEdit) {
      console.warn('[T7] editTrace prop manquante — édition impossible')
      cancelEdit()
      return
    }
    const fieldKey = editingField
    const next = draftValue.trim()
    const prev = (localTrace[fieldKey] ?? '').trim()
    if (next === prev) {
      cancelEdit()
      return
    }
    setSaving(true)
    try {
      await editTrace(localTrace.id, { [fieldKey]: next })
      setLocalTrace(t => ({ ...t, [fieldKey]: next, updatedAt: new Date().toISOString() }))
      setEditingField(null)
      setDraftValue('')
    } catch (err) {
      console.error('[T7] editTrace failed', err)
    } finally {
      setSaving(false)
    }
  }

  // ── T6A — Changement de statut ───────────────────────────────
  const handleChangeStatus = async (newStatus) => {
    setStatusOpen(false)
    if (!canEdit) return
    if (newStatus === currentStatusKey) return
    try {
      await editTrace(localTrace.id, { status: newStatus })
      setLocalTrace(t => ({
        ...t,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      }))
    } catch (err) {
      console.error('[T6A] changement de statut échoué', err)
    }
  }

  // ── Lot B — Rattachement chapitre ────────────────────────────
  const hasChapters = Array.isArray(chapters) && chapters.length > 0
  const handleChapterAttach = async (e) => {
    if (!canEdit) return
    const val = e.target.value   // '' = pas de rattachement, sinon id du chapitre
    const chapterId = val === '' ? null : val
    try {
      await editTrace(localTrace.id, { chapterId })
      setLocalTrace(t => ({ ...t, chapterId, updatedAt: new Date().toISOString() }))
    } catch (err) {
      console.error('[Tiroir] rattachement chapitre échoué', err)
    }
  }

  // ── FEAT-C — Lancer / relancer l'OCR vision a posteriori ─────
  const handleVisionOCR = async () => {
    if (!traceBlob || !apiKey || visionStatus === 'running') return
    setVisionStatus('running')
    setVisionErr(null)
    setVisionPreviewText('')
    try {
      const text = await runVisionOCR(traceBlob, apiKey)
      if (text && text.trim()) {
        setVisionPreviewText(text.trim())
        setVisionStatus('preview')
      } else {
        setVisionStatus('error')
        setVisionErr("L'IA n'a pas détecté de texte dans cette image.")
      }
    } catch (err) {
      setVisionStatus('error')
      setVisionErr(err?.message || 'Erreur lors de la lecture IA.')
    }
  }

  // ── FEAT-C — Garder le texte transcrit (persistance explicite) ──
  const handleKeepText = async () => {
    if (!canEdit || !visionPreviewText || visionSaving) return
    setVisionSaving(true)
    const now = new Date().toISOString()
    try {
      await editTrace(localTrace.id, {
        ocrText: visionPreviewText,
        ocrRunAt: now,
      })
      setLocalTrace(t => ({
        ...t,
        ocrText: visionPreviewText,
        ocrRunAt: now,
        updatedAt: now,
      }))
      setVisionStatus('idle')
      setVisionPreviewText('')
      setVisionErr(null)
    } catch (err) {
      console.error('[FEAT-C] editTrace ocrText failed', err)
      setVisionStatus('error')
      setVisionErr('Impossible de sauvegarder le texte transcrit.')
    } finally {
      setVisionSaving(false)
    }
  }

  // ── FEAT-C — Ignorer le texte transcrit (aucune persistance) ──
  const handleDiscardText = () => {
    if (visionSaving) return
    setVisionStatus('idle')
    setVisionPreviewText('')
    setVisionErr(null)
  }

  // ── FEAT-C — Effacer un OCR déjà sauvegardé ──────────────────
  const handleEraseOcr = async () => {
    if (!canEdit) return
    const ok = window.confirm("Effacer le texte transcrit par l'IA ? Cette action est irréversible.")
    if (!ok) return
    const now = new Date().toISOString()
    try {
      await editTrace(localTrace.id, { ocrText: null, ocrRunAt: null })
      setLocalTrace(t => ({
        ...t,
        ocrText: null,
        ocrRunAt: null,
        updatedAt: now,
      }))
      setVisionStatus('idle')
      setVisionPreviewText('')
      setVisionErr(null)
    } catch (err) {
      console.error('[FEAT-C] effacement ocrText failed', err)
    }
  }

  const formatDuration = (sec) => {
    const s = Math.max(0, Math.floor(sec || 0))
    const m = Math.floor(s / 60)
    const r = s % 60
    return `${m}:${String(r).padStart(2, '0')}`
  }

  const startRecording = async () => {
    if (recording || !voiceMemoSupported || !trace?.id) return
    setRecordError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        // Assemblage + persistance — onstop est appelé en interne par stop() ou par auto-stop 120s.
        const mime = recorder.mimeType || 'audio/webm'
        const blob = new Blob(audioChunksRef.current, { type: mime })
        audioChunksRef.current = []
        // Libère le micro immédiatement
        if (mediaStreamRef.current) {
          try { mediaStreamRef.current.getTracks().forEach(t => t.stop()) } catch {}
          mediaStreamRef.current = null
        }
        // Persist + update UI
        try {
          if (typeof saveVoiceMemo === 'function') await saveVoiceMemo(trace.id, blob, mime)
          // Révoque ancienne URL si existante (évite fuite mémoire)
          if (voiceMemoUrl) { try { URL.revokeObjectURL(voiceMemoUrl) } catch {} }
          const url = URL.createObjectURL(blob)
          setVoiceMemoBlob(blob)
          setVoiceMemoUrl(url)
          setVoiceMemoMime(mime)
        } catch (e) {
          console.warn('[VoiceMemo] save failed', trace.id, e?.message)
          setRecordError("Impossible d'enregistrer le mémo.")
        }
      }
      recorder.start()
      setRecording(true)
      setRecordingElapsed(0)
      recordTimerRef.current = setInterval(() => {
        setRecordingElapsed(prev => prev + 1)
      }, 1000)
      recordAutoStopRef.current = setTimeout(() => {
        stopRecording()
      }, VOICE_MEMO_MAX_SEC * 1000)
    } catch (e) {
      setRecordError(
        e?.name === 'NotAllowedError'
          ? 'Permission micro refusée. Autorise le micro dans les réglages du navigateur.'
          : 'Micro indisponible.'
      )
      console.warn('[VoiceMemo] getUserMedia failed', e?.message)
    }
  }

  const stopRecording = () => {
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null }
    if (recordAutoStopRef.current) { clearTimeout(recordAutoStopRef.current); recordAutoStopRef.current = null }
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop() } catch {}
    }
    setRecording(false)
    // recordingElapsed laissé tel quel pour info brève — sera reset au prochain record
  }

  const deleteVoiceMemoLocal = async () => {
    if (recording) return
    if (!window.confirm('Supprimer ce mémo vocal ?')) return
    try {
      if (typeof deleteVoiceMemo === 'function' && trace?.id) {
        await deleteVoiceMemo(trace.id)
      }
      if (voiceMemoUrl) { try { URL.revokeObjectURL(voiceMemoUrl) } catch {} }
      setVoiceMemoBlob(null)
      setVoiceMemoUrl(null)
      setVoiceMemoMime(null)
      setTranscript('')
      setTranscribeErr(null)
    } catch (e) {
      console.warn('[VoiceMemo] delete failed', trace?.id, e?.message)
    }
  }

  const runTranscription = async () => {
    if (transcribing || !voiceMemoBlob || !openAiKey) return
    setTranscribing(true)
    setTranscribeErr(null)
    try {
      const text = await transcribeAudio({ openAiKey, audioBlob: voiceMemoBlob })
      setTranscript(typeof text === 'string' ? text.trim() : String(text || '').trim())
    } catch (e) {
      setTranscribeErr(e?.message || 'Transcription impossible.')
      console.warn('[VoiceMemo] transcribe failed', e?.message)
    } finally {
      setTranscribing(false)
    }
  }

  const handleVisionInspire = async () => {
    if (!traceBlob || !apiKey || inspireStatus === 'running') return
    setInspireStatus('running')
    setInspireErr(null)
    setInspireText('')
    setInspireCopied(false)
    try {
      const text = await runVisionInspire(traceBlob, apiKey, {
        whyNow: localTrace.whyNow || '',
        detail: localTrace.detail || '',
        unseen: localTrace.unseen || '',
        leftToday: localTrace.leftToday || '',
        ocrText: localTrace.ocrText || '',
      })
      if (text && text.trim()) {
        setInspireText(text.trim())
        setInspireStatus('done')
      } else {
        setInspireStatus('error')
        setInspireErr("L'IA n'a pas réussi à proposer de pistes pour cette image.")
      }
    } catch (err) {
      setInspireStatus('error')
      setInspireErr(err?.message || 'Erreur lors de la lecture sensible de l\'image.')
    }
  }

  const handleCopyInspiration = async () => {
    if (!inspireText) return
    try {
      await navigator.clipboard.writeText(inspireText)
      setInspireCopied(true)
    } catch (err) {
      console.warn('[FEAT-D] copie inspiration impossible', err)
      setInspireCopied(false)
    }
  }

  const handleDiscardInspiration = () => {
    setInspireStatus('idle')
    setInspireText('')
    setInspireErr(null)
    setInspireCopied(false)
  }

  const tryClose = () => {
    if (editingField) {
      const ok = window.confirm('Vraiment fermer sans enregistrer cette réponse ?')
      if (!ok) return
    }
    if (visionStatus === 'preview') {
      const ok = window.confirm("Le texte transcrit par l'IA n'est pas encore enregistré. Fermer quand même ?")
      if (!ok) return
    }
    if (typeof onClose === 'function') onClose()
  }

  const handleDelete = () => { if (typeof onDelete === 'function') onDelete(localTrace) }

  // FEAT-E — "Continuer avec Léa" depuis cette trace
  // Mode B : si traceBlob dispo et pas d'inspireText déjà calculé,
  // on appelle inspireFromImage (Claude Vision natif) pour enrichir le brief.
  // Léa voit vraiment la photo au lieu d'opérer à l'aveugle.
  const handleContinueWithLea = async () => {
    if (continuing) return
    if (typeof onContinueWithLea !== 'function') return
    if (!apiKey) return
    // Protéger un brouillon en cours d'édition
    if (editingField) {
      const ok = window.confirm("Tu as une réponse en cours d'édition. Continuer avec Léa quand même ?")
      if (!ok) return
    }
    setContinuing(true)
    try {
      // Mode B — enrichissement visuel via Claude Vision si blob dispo et pas d'inspire déjà prêt
      let visionContext = inspireStatus === 'done' ? inspireText : ''
      if (!visionContext && traceBlob) {
        try {
          const mediaType = detectMediaType(traceBlob)
          const base64 = await fileToBase64(traceBlob)
          const chapterContext = (currentChapter?.content || '').slice(-500)
          visionContext = await inspireFromImage({ apiKey, imageBase64: base64, mediaType, chapterContext })
        } catch (visionErr) {
          // Echec silencieux : on continue sans contexte visuel
          console.warn('[Mode B] inspireFromImage échoué, brief sans vision', visionErr?.message)
          visionContext = ''
        }
      }

      const briefText = buildTraceContinuationPrompt({
        trace: localTrace,
        ocrText: localTrace.ocrText || '',
        inspireText: visionContext,
        chapterTitle: currentChapter?.title || '',
      })
      const uiMessage = "J'aimerais creuser cette trace avec toi."
      await onContinueWithLea(briefText, uiMessage)
    } finally {
      setContinuing(false)
    }
  }

  const hasBlob = !!traceBlob
  const hasOcrSaved = typeof localTrace.ocrText === 'string' && localTrace.ocrText.trim().length > 0
  const canRunVision = hasBlob && !!apiKey && canEdit
  const showVisionInitialBtn = canRunVision && !hasOcrSaved && visionStatus === 'idle'
  const showVisionRerunBtn = canRunVision && hasOcrSaved && visionStatus === 'idle'
  const canRunInspire = hasBlob && !!apiKey
  const showInspireBlock = canRunInspire || inspireStatus === 'running' || inspireStatus === 'done' || inspireStatus === 'error'

  return (
    <Modal
      onClose={tryClose}
      ariaLabel="Fiche trace"
      overlayStyle={S.overlay}
      modalStyle={S.modal}
    >
      {/* Header */}
      <div style={S.hdr}>
        <div style={S.hdrLeft}>
          <span style={S.hdrIcon}><Archive size={20} color="#8B6445" /></span>
          <div>
            <div style={S.hdrTitle}>Une trace</div>
            <div style={S.hdrSub}>{dateStr}</div>
          </div>
        </div>
        <button style={S.closeBtn} onClick={tryClose} aria-label="Fermer la fiche">
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div style={S.body}>
        {/* Preview photo */}
        <div style={S.preview}>
          {blobUrl ? (
            <img src={blobUrl} alt="" style={S.previewImg} />
          ) : (
            <Archive size={36} color="#9C8878" strokeWidth={1.2} />
          )}
        </div>

        {/* FEAT-F — Bandeau apiKey absent : explique pourquoi les boutons IA sont muets sur cet appareil */}
        {hasBlob && !apiKey && (
          <div style={S.noApiKeyHint}>
            <p style={S.noApiKeyText}>
              L'IA n'est pas activée sur cet appareil. Va dans Réglages — Mot de passe Léa pour activer la lecture de texte, les pistes d'écriture et la conversation avec Léa.
            </p>
          </div>
        )}

        {/* FEAT-C — Bloc OCR vision a posteriori */}
        {(showVisionInitialBtn || showVisionRerunBtn || hasOcrSaved || visionStatus === 'running' || visionStatus === 'preview' || visionStatus === 'error') && (
          <div style={S.ocrBlock}>
            {showVisionInitialBtn && (
              <button
                type="button"
                style={S.visionBtn}
                onClick={handleVisionOCR}
                aria-label="Lire le texte de l'image avec l'IA"
              >
                <Sparkles size={14} /> Lire le texte avec l'IA
              </button>
            )}

            {visionStatus === 'running' && (
              <div style={S.ocrRunning}>
                <Sparkles size={14} style={{ opacity: 0.6 }} />
                <span>Lecture en cours… (5 à 10 s)</span>
              </div>
            )}

            {visionStatus === 'preview' && (
              <div style={S.ocrPreview}>
                <p style={S.ocrPreviewLabel}>Texte transcrit par l'IA — à toi de juger :</p>
                <p style={S.ocrPreviewText}>{visionPreviewText}</p>
                <div style={S.ocrPreviewActions}>
                  <button
                    type="button"
                    onClick={handleDiscardText}
                    style={S.cancelBtn}
                    disabled={visionSaving}
                  >
                    Ignorer
                  </button>
                  <button
                    type="button"
                    onClick={handleKeepText}
                    style={{ ...S.saveBtn, opacity: visionSaving ? 0.65 : 1 }}
                    disabled={visionSaving}
                  >
                    <Check size={14} /> {visionSaving ? 'Enregistrement…' : 'Garder ce texte'}
                  </button>
                </div>
              </div>
            )}

            {visionStatus === 'error' && visionErr && (
              <div style={S.ocrErrRow}>
                <p style={S.ocrErrMsg}>{visionErr}</p>
                {canRunVision && (
                  <button type="button" onClick={handleVisionOCR} style={S.linkBtn}>
                    Réessayer
                  </button>
                )}
              </div>
            )}

            {hasOcrSaved && visionStatus !== 'preview' && (
              <div style={S.ocrSaved}>
                <p style={S.ocrSavedLabel}>Texte transcrit par l'IA</p>
                <p style={S.ocrSavedText}>{localTrace.ocrText}</p>
                <div style={S.ocrSavedActions}>
                  <button
                    type="button"
                    onClick={handleEraseOcr}
                    style={S.cancelBtn}
                    disabled={!canEdit}
                  >
                    Effacer
                  </button>
                  {showVisionRerunBtn && (
                    <button
                      type="button"
                      onClick={handleVisionOCR}
                      style={S.visionBtnSecondary}
                    >
                      <Sparkles size={14} /> Re-lire
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* FEAT-D — Faire parler cette trace : inspiration visuelle */}
        {showInspireBlock && (
          <div style={S.inspireBlock}>
            {inspireStatus === 'idle' && canRunInspire && (
              <div style={S.inspireIntro}>
                <div>
                  <p style={S.inspireTitle}>Faire parler cette trace</p>
                  <p style={S.inspireHint}>
                    L'IA part des mots de Caroline, puis de l'image, pour proposer des pistes sans écrire à sa place.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleVisionInspire}
                  style={S.inspireBtn}
                >
                  <Sparkles size={14} /> Me donner des pistes
                </button>
              </div>
            )}

            {inspireStatus === 'running' && (
              <div style={S.inspireRunning}>
                <Sparkles size={14} style={{ opacity: 0.6 }} />
                <span>La trace cherche ce qu'elle peut suggérer…</span>
              </div>
            )}

            {inspireStatus === 'done' && (
              <div style={S.inspireResult}>
                <p style={S.inspireResultLabel}>Pistes proposées par l'IA</p>
                <p style={S.inspireResultText}>{inspireText}</p>
                <div style={S.inspireActions}>
                  <button type="button" onClick={handleDiscardInspiration} style={S.cancelBtn}>
                    Ignorer
                  </button>
                  <button type="button" onClick={handleCopyInspiration} style={S.visionBtnSecondary}>
                    {inspireCopied ? 'Copié ✓' : 'Copier les pistes'}
                  </button>
                  <button type="button" onClick={handleVisionInspire} style={S.visionBtnSecondary}>
                    <Sparkles size={14} /> Relancer
                  </button>
                </div>
              </div>
            )}

            {inspireStatus === 'error' && inspireErr && (
              <div style={S.ocrErrRow}>
                <p style={S.ocrErrMsg}>{inspireErr}</p>
                {canRunInspire && (
                  <button type="button" onClick={handleVisionInspire} style={S.linkBtn}>
                    Réessayer
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Lot C — Mémo vocal (Android + PC Chrome, 2 min max) */}
        {voiceMemoSupported && (
          <div style={S.audioBlock}>
            <div style={S.audioHeader}>
              <span>Mémo vocal</span>
              {recording && (
                <span style={{ fontSize: '.78rem', fontWeight: 600, color: '#A4361A', fontFamily: "'Nunito', sans-serif" }}>
                  ● {formatDuration(recordingElapsed)} / {formatDuration(VOICE_MEMO_MAX_SEC)}
                </span>
              )}
            </div>

            <div style={S.audioControls}>
              {!recording && !voiceMemoBlob && (
                <button type="button" style={S.audioBtn} onClick={startRecording} aria-label="Enregistrer un mémo vocal">
                  <Mic size={14} /> Enregistrer
                </button>
              )}
              {recording && (
                <button
                  type="button"
                  style={{ ...S.audioBtn, ...S.audioBtnRec }}
                  onClick={stopRecording}
                  aria-label="Arrêter l'enregistrement"
                >
                  <Square size={14} /> Arrêter
                </button>
              )}
              {!recording && voiceMemoBlob && openAiKey && !transcript && (
                <button type="button" style={S.audioBtn} onClick={runTranscription} disabled={transcribing}>
                  <FileText size={14} /> {transcribing ? 'Transcription…' : 'Transcrire'}
                </button>
              )}
              {!recording && voiceMemoBlob && (
                <button type="button" style={S.audioBtn} onClick={deleteVoiceMemoLocal} aria-label="Supprimer le mémo vocal">
                  <Trash2 size={14} /> Supprimer
                </button>
              )}
            </div>

            {recordError && (
              <p style={{ margin: 0, fontSize: '.78rem', color: '#A4361A', fontFamily: "'Nunito', sans-serif" }}>
                {recordError}
              </p>
            )}

            {!recording && voiceMemoUrl && (
              <div style={S.audioPreview}>
                <audio
                  src={voiceMemoUrl}
                  controls
                  preload="metadata"
                  style={{ width: '100%' }}
                  onLoadedMetadata={(e) => {
                    // Bug Chrome/MediaRecorder : la duration est Infinity ou une valeur
                    // absurde (ex: 71h) car webm/opus genere n'a pas les metadata duration.
                    // Workaround : seek a +inf force le navigateur a lire le binaire
                    // jusqu'a la fin -> recalcule la vraie duree -> on remet a 0.
                    // Voir issue Chromium #642012 (jamais fixe).
                    const a = e.currentTarget
                    if (!isFinite(a.duration) || a.duration > 3600) {
                      const onTimeUpdate = () => {
                        if (isFinite(a.duration) && a.duration < 3600) {
                          a.removeEventListener('timeupdate', onTimeUpdate)
                          a.currentTime = 0
                        }
                      }
                      a.addEventListener('timeupdate', onTimeUpdate)
                      try { a.currentTime = 1e6 } catch { /* tolérant */ }
                    }
                  }}
                />
                {!openAiKey && !transcript && (
                  <p style={{ margin: 0, fontStyle: 'italic', color: '#7A6555' }}>
                    Configure ta clé OpenAI dans Réglages pour transcrire ce mémo.
                  </p>
                )}
                {transcribeErr && (
                  <p style={{ margin: 0, color: '#A4361A' }}>{transcribeErr}</p>
                )}
                {transcript && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <p style={S.inspireResultLabel}>Transcription</p>
                    <p style={{ ...S.inspireResultText, fontSize: '.82rem' }}>{transcript}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Statut */}
        <div style={S.statusRow}>
          <span style={{ ...S.statusDot, background: status.color }} />
          <span style={S.statusLabel}>{status.label}</span>
        </div>

        {/* Réponses */}
        <div style={S.responses}>
          {RESPONSE_FIELDS.map((f) => {
            const value     = localTrace[f.key] ?? ''
            const isEditing = editingField === f.key
            const isFilled  = String(value).trim().length > 0
            const otherEdit = editingField !== null && !isEditing
            const pencilDisabled = otherEdit || !canEdit

            return (
              <div key={f.key} style={S.respBlock}>
                <div style={S.respHead}>
                  <div style={S.respLabel}>{f.label}</div>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => enterEdit(f.key)}
                      disabled={pencilDisabled}
                      style={{
                        ...S.editIconBtn,
                        opacity: pencilDisabled ? 0.3 : 0.6,
                        cursor: pencilDisabled ? 'not-allowed' : 'pointer',
                      }}
                      aria-label={
                        !canEdit ? 'Édition indisponible'
                        : isFilled ? `Modifier : ${f.label}`
                        : `Répondre à : ${f.label}`
                      }
                      title={
                        !canEdit ? 'Édition indisponible'
                        : isFilled ? 'Modifier'
                        : 'Répondre'
                      }
                    >
                      <Edit3 size={12} />
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div style={S.editBox}>
                    <textarea
                      ref={textareaRef}
                      value={draftValue}
                      onChange={(e) => setDraftValue(e.target.value)}
                      rows={4}
                      style={S.textarea}
                      aria-label={f.label}
                    />
                    <div style={S.editActions}>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={saving}
                        style={S.cancelBtn}
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={saving}
                        style={S.saveBtn}
                      >
                        <Check size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
                      </button>
                    </div>
                  </div>
                ) : (
                  isFilled ? (
                    <p style={S.respText}>{value}</p>
                  ) : (
                    <p style={S.respEmpty}>{EMPTY_PLACEHOLDER}</p>
                  )
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={S.footer}>
        {/* Lot B — Rattacher à un chapitre (visible si chapitres disponibles) */}
        {hasChapters && (
          <div style={S.chapterRow}>
            <BookOpen size={14} color="#8B6445" style={{ flexShrink: 0 }} />
            <select
              value={localTrace.chapterId ?? ''}
              onChange={handleChapterAttach}
              disabled={!canEdit}
              style={{
                ...S.chapterSelect,
                opacity: canEdit ? 1 : 0.5,
                cursor: canEdit ? 'pointer' : 'not-allowed',
              }}
              aria-label="Rattacher à un chapitre"
            >
              <option value="">Aucun chapitre</option>
              {chapters.map(ch => (
                <option key={ch.id} value={ch.id}>
                  {ch.title || 'Sans titre'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* FEAT-E — CTA primaire "Continuer avec Léa" */}
        {!!apiKey && typeof onContinueWithLea === 'function' && (
          <button
            type="button"
            onClick={handleContinueWithLea}
            disabled={continuing}
            style={{
              ...S.continueBtn,
              opacity: continuing ? 0.6 : 1,
              cursor: continuing ? 'wait' : 'pointer',
            }}
            aria-label="Continuer cette trace avec Léa"
          >
            <Sparkles size={14} /> {continuing ? 'Léa regarde la photo…' : 'Continuer avec Léa'}
          </button>
        )}

        <div ref={statusContainerRef} style={{ position: 'relative' }}>
          <button
            type="button"
            style={{
              ...S.actionBtn,
              opacity: !canEdit ? 0.5 : 1,
              cursor: !canEdit ? 'not-allowed' : 'pointer',
            }}
            onClick={() => setStatusOpen(o => !o)}
            disabled={!canEdit}
            aria-haspopup="menu"
            aria-expanded={statusOpen}
            aria-label="Cette trace, j'en fais quoi ?"
          >
            <Tag size={14} /> Cette trace, j'en fais quoi ?
          </button>

          {statusOpen && (
            <div role="menu" style={S.statusDropdown}>
              {STATUS_ORDER.map((key) => {
                const opt = STATUS_LABELS[key]
                const isCurrent = currentStatusKey === key
                return (
                  <button
                    key={key}
                    role="menuitemradio"
                    aria-checked={isCurrent}
                    type="button"
                    onClick={() => handleChangeStatus(key)}
                    style={{
                      ...S.statusOption,
                      ...(isCurrent ? S.statusOptionCurrent : {}),
                    }}
                  >
                    <span style={{ ...S.statusDot, background: opt.color }} />
                    <span style={S.statusOptionLabel}>{opt.label}</span>
                    {isCurrent && <Check size={12} style={S.statusCheck} />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <button style={S.deleteBtn} onClick={handleDelete} aria-label="Supprimer cette trace">
          <Trash2 size={14} />
        </button>
      </div>
    </Modal>
  )
}
