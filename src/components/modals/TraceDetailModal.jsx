import { useState, useEffect, useRef } from 'react'
import Modal from '../ui/Modal'
import { X, Edit3, Check, Trash2, Archive, Tag, BookOpen, Sparkles } from 'lucide-react'
import useClickAway from '../../hooks/useClickAway'
import { runVisionOCR } from '../../lib/visionOCR'
import { runVisionInspire } from '../../lib/visionInspire'
import { buildTraceContinuationPrompt } from '../../lib/prompts'

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

  // ── FEAT-D — Faire parler l'image pour ouvrir des pistes d'écriture ──
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
      setInspireErr(err?.message || 'Erreur lors de la lecture sensible de l’image.')
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
      const briefText = buildTraceContinuationPrompt({
        trace: localTrace,
        ocrText: localTrace.ocrText || '',
        inspireText: inspireStatus === 'done' ? inspireText : '',
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
                    L’IA part des mots de Caroline, puis de l’image, pour proposer des pistes sans écrire à sa place.
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
                <span>La trace cherche ce qu’elle peut suggérer…</span>
              </div>
            )}

            {inspireStatus === 'done' && (
              <div style={S.inspireResult}>
                <p style={S.inspireResultLabel}>Pistes proposées par l’IA</p>
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
            <Sparkles size={14} /> {continuing ? 'En route…' : 'Continuer avec Léa'}
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

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(42,26,14,.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16,
  },
  modal: {
    background: '#FFFEFB',
    borderRadius: 18,
    width: '100%',
    maxWidth: 560,
    maxHeight: '88vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 60px rgba(42,26,14,.25)',
    overflow: 'hidden',
  },
  hdr: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '16px 20px 14px',
    borderBottom: '1px solid #EDE7DE',
    background: '#FAF7F2',
  },
  hdrLeft: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  hdrIcon: { display: 'flex', alignItems: 'center', marginTop: 2 },
  hdrTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#2A1A0E',
  },
  hdrSub: { fontSize: '.72rem', color: '#9C8878', marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    background: 'transparent',
    border: '1.5px solid #EDE7DE',
    color: '#9C8878',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '14px 20px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  preview: {
    width: '100%',
    aspectRatio: '4 / 3',
    background: '#EDE7DE',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  previewImg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
    borderRadius: 10,
  },
  statusRow: { display: 'flex', alignItems: 'center', gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  statusLabel: {
    fontSize: '.76rem',
    color: '#9C8878',
    fontFamily: "'Nunito', sans-serif",
    fontWeight: 600,
  },
  responses: { display: 'flex', flexDirection: 'column', gap: 12 },
  respBlock: { display: 'flex', flexDirection: 'column', gap: 4 },
  respHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  respLabel: {
    fontSize: '.7rem',
    color: '#9C8878',
    fontFamily: "'Nunito', sans-serif",
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    flex: 1,
  },
  editIconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    background: 'transparent',
    border: 'none',
    borderRadius: 6,
    color: '#8B6445',
    transition: 'opacity .15s ease',
    padding: 0,
    flexShrink: 0,
  },
  respText: {
    fontFamily: "'Lora', serif",
    fontStyle: 'italic',
    fontSize: '.88rem',
    color: '#2A1A0E',
    lineHeight: 1.7,
    margin: 0,
  },
  respEmpty: {
    fontFamily: "'Lora', serif",
    fontStyle: 'italic',
    fontSize: '.82rem',
    color: '#B0A090',
    lineHeight: 1.6,
    margin: 0,
  },
  editBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 2,
  },
  textarea: {
    width: '100%',
    minHeight: 88,
    padding: '10px 12px',
    fontFamily: "'Lora', serif",
    fontSize: '.9rem',
    color: '#2A1A0E',
    lineHeight: 1.6,
    background: '#FFFEFB',
    border: '1.5px solid #D8C9B8',
    borderRadius: 10,
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  editActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    padding: '7px 14px',
    background: 'transparent',
    border: '1.5px solid #EDE7DE',
    borderRadius: 10,
    fontSize: '.76rem',
    fontWeight: 600,
    fontFamily: "'Nunito', sans-serif",
    color: '#9C8878',
    cursor: 'pointer',
  },
  saveBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    background: '#8B6445',
    border: '1.5px solid #8B6445',
    borderRadius: 10,
    fontSize: '.76rem',
    fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    color: '#FFFEFB',
    cursor: 'pointer',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 20px',
    borderTop: '1px solid #EDE7DE',
    background: '#FAF7F2',
    flexWrap: 'wrap',
  },
  // Lot B — Rattachement chapitre
  chapterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    marginBottom: 4,
  },
  chapterSelect: {
    flex: 1,
    padding: '6px 10px',
    fontFamily: "'Nunito', sans-serif",
    fontSize: '.76rem',
    fontWeight: 600,
    color: '#2A1A0E',
    background: '#FFFEFB',
    border: '1.5px solid #EDE7DE',
    borderRadius: 10,
    outline: 'none',
    appearance: 'auto',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    background: '#FFFEFB',
    border: '1.5px solid #EDE7DE',
    borderRadius: 10,
    fontSize: '.76rem',
    fontWeight: 600,
    fontFamily: "'Nunito', sans-serif",
    color: '#8B6445',
    cursor: 'pointer',
  },
  statusDropdown: {
    position: 'absolute',
    bottom: 'calc(100% + 6px)',
    left: 0,
    background: '#FFFEFB',
    border: '1px solid #EDE7DE',
    borderRadius: 12,
    boxShadow: '0 8px 28px rgba(42,26,14,.14)',
    padding: '6px',
    zIndex: 50,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    width: 230,
    animation: 'slideUp .18s ease',
  },
  statusOption: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    background: 'transparent',
    border: '1.5px solid transparent',
    borderRadius: 8,
    fontSize: '.78rem',
    fontWeight: 600,
    fontFamily: "'Nunito', sans-serif",
    color: '#2A1A0E',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    transition: 'background .12s ease',
  },
  statusOptionCurrent: {
    background: '#F5F0E8',
    borderColor: '#D8C9B8',
  },
  statusOptionLabel: { flex: 1 },
  statusCheck: { color: '#6B8F71', flexShrink: 0 },
  // FEAT-F — Bandeau apiKey absent
  noApiKeyHint: {
    padding: '10px 14px',
    background: '#FAF7F2',
    border: '1px solid #EDE7DE',
    borderRadius: 12,
  },
  noApiKeyText: {
    margin: 0,
    fontFamily: "'Lora', serif",
    fontStyle: 'italic',
    fontSize: '.82rem',
    color: '#7A6555',
    lineHeight: 1.5,
  },
  // FEAT-E — CTA primaire "Continuer avec Léa"
  continueBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    background: '#8B6445',
    color: '#FFFEFB',
    border: '1.5px solid #8B6445',
    borderRadius: 10,
    fontSize: '.78rem',
    fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(139,100,69,.15)',
  },
  deleteBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    marginLeft: 'auto',
    background: 'transparent',
    border: '1.5px solid #EDE7DE',
    borderRadius: 10,
    color: '#B0A090',
    cursor: 'pointer',
  },
  ocrBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  visionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: '8px 14px',
    background: 'transparent',
    color: '#7A6555',
    border: '1.5px solid #D4B896',
    borderRadius: 10,
    fontSize: '.82rem',
    fontWeight: 600,
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  visionBtnSecondary: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    background: 'transparent',
    color: '#7A6555',
    border: '1.5px solid #D4B896',
    borderRadius: 10,
    fontSize: '.76rem',
    fontWeight: 600,
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer',
  },
  ocrRunning: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: '#F5F0E8',
    border: '1px solid #EDE7DE',
    borderRadius: 10,
    fontFamily: "'Lora', serif",
    fontStyle: 'italic',
    fontSize: '.82rem',
    color: '#7A6555',
  },
  ocrPreview: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '12px 14px',
    background: '#F5F0E8',
    border: '1px solid #D4B896',
    borderRadius: 12,
  },
  ocrPreviewLabel: {
    margin: 0,
    fontFamily: "'Nunito', sans-serif",
    fontSize: '.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    color: '#7A6555',
  },
  ocrPreviewText: {
    margin: 0,
    fontFamily: "'Lora', serif",
    fontStyle: 'italic',
    fontSize: '.88rem',
    color: '#2A1A0E',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },
  ocrPreviewActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'flex-end',
  },
  ocrErrRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    background: '#FEF0F0',
    border: '1px solid #E8A0A0',
    borderRadius: 10,
  },
  ocrErrMsg: {
    margin: 0,
    flex: 1,
    fontFamily: "'Nunito', sans-serif",
    fontSize: '.78rem',
    color: '#8B2020',
  },
  linkBtn: {
    background: 'transparent',
    border: 'none',
    color: '#8B6445',
    fontSize: '.78rem',
    fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'underline',
  },
  ocrSaved: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '12px 14px',
    background: '#FAF7F2',
    border: '1px solid #EDE7DE',
    borderRadius: 12,
  },
  ocrSavedLabel: {
    margin: 0,
    fontFamily: "'Nunito', sans-serif",
    fontSize: '.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    color: '#9C8878',
  },
  ocrSavedText: {
    margin: 0,
    fontFamily: "'Lora', serif",
    fontStyle: 'italic',
    fontSize: '.86rem',
    color: '#2A1A0E',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },
  ocrSavedActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'flex-end',
  },
  inspireBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '12px 14px',
    background: '#FFFEFB',
    border: '1.5px solid #E7D6BF',
    borderRadius: 14,
  },
  inspireIntro: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  inspireTitle: {
    margin: 0,
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '1rem',
    fontWeight: 700,
    color: '#6E3A1E',
  },
  inspireHint: {
    margin: '3px 0 0',
    fontFamily: "'Lora', serif",
    fontStyle: 'italic',
    fontSize: '.82rem',
    lineHeight: 1.55,
    color: '#7A6555',
  },
  inspireBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: '8px 14px',
    background: '#F5F0E8',
    color: '#6E3A1E',
    border: '1.5px solid #D4B896',
    borderRadius: 10,
    fontSize: '.82rem',
    fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  inspireRunning: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: '#F5F0E8',
    borderRadius: 10,
    fontFamily: "'Lora', serif",
    fontStyle: 'italic',
    fontSize: '.82rem',
    color: '#7A6555',
  },
  inspireResult: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  inspireResultLabel: {
    margin: 0,
    fontFamily: "'Nunito', sans-serif",
    fontSize: '.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    color: '#7A6555',
  },
  inspireResultText: {
    margin: 0,
    fontFamily: "'Lora', serif",
    fontSize: '.88rem',
    color: '#2A1A0E',
    lineHeight: 1.65,
    whiteSpace: 'pre-wrap',
  },
  inspireActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
}
