import { useState, useEffect, useRef } from 'react'
import Modal from '../ui/Modal'
import { X, Edit3, Check, Trash2, Archive } from 'lucide-react'

const STATUS_LABELS = {
  private: { label: 'Gardée dans le tiroir', color: '#B0A090' },
  vrac:    { label: 'Envoyée au vrac',       color: '#C4956A' },
  note:    { label: 'Note brute',            color: '#8B6445' },
  scene:   { label: 'Scène avec Léa',        color: '#6B8F71' },
  letter:  { label: 'Lettre',                color: '#8FA8D8' },
}

// Champs de réponses Caroline — scope LOT 2A (cf docs/le-tiroir-v1.md §5)
// Strict : 4 champs uniquement (pas whatItStirs ni autre, qui viendront en LOT 5)
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
  editTrace,       // T7 — (id, fields) => Promise<void> (remplace onEdit no-op)
  onDelete,
  isMobile,        // optionnel, non utilisé en 2A — réservé pour 2B/3
  loadTraceBlob,   // T3 — fourni par App.jsx via db.loadTraceBlob
}) {
  const [blobUrl, setBlobUrl] = useState(null)

  // T7 — état édition inline
  // localTrace : reflet optimiste de la trace courante (mis à jour après save)
  // editingField : clé du champ en édition, ou null en lecture
  // draftValue   : valeur du textarea en cours
  // saving       : flag anti double-clic / disable boutons pendant l'écriture IDB
  const [localTrace,   setLocalTrace]   = useState(trace)
  const [editingField, setEditingField] = useState(null)
  const [draftValue,   setDraftValue]   = useState('')
  const [saving,       setSaving]       = useState(false)
  const textareaRef = useRef(null)

  // Resync localTrace quand on change de trace (réouverture sur une autre fiche)
  useEffect(() => {
    setLocalTrace(trace)
    setEditingField(null)
    setDraftValue('')
    setSaving(false)
  }, [trace?.id, trace])

  useEffect(() => {
    if (!loadTraceBlob || !trace?.id) {
      setBlobUrl(null)
      return
    }

    let cancelled = false
    let url = null

    setBlobUrl(null)

    loadTraceBlob(trace.id)
      .then((result) => {
        if (cancelled) return
        if (result?.blob instanceof Blob) {
          url = URL.createObjectURL(result.blob)
          setBlobUrl(url)
        }
      })
      .catch(() => {
        if (!cancelled) setBlobUrl(null)
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

  if (!localTrace) return null

  // T7 — capacité d'édition : si editTrace n'est pas branchée, on grise les crayons
  // (état défensif : ne devrait jamais arriver en prod car App.jsx fournit db.editTrace).
  const canEdit = typeof editTrace === 'function'

  const status = STATUS_LABELS[localTrace.status] || STATUS_LABELS.private
  const dateStr = localTrace.createdAt
    ? new Date(localTrace.createdAt).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : ''

  // ── Édition inline ───────────────────────────────────────────
  const enterEdit = (fieldKey) => {
    if (editingField) return                     // un seul champ à la fois
    if (!canEdit) return                         // garde-fou : pas d'entrée en édition sans editTrace
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
      // Défense double — ne devrait jamais s'exécuter car enterEdit est bloqué.
      console.warn('[T7] editTrace prop manquante — édition impossible')
      cancelEdit()
      return
    }
    const fieldKey = editingField
    const next = draftValue.trim()
    const prev = (localTrace[fieldKey] ?? '').trim()
    // Aucun changement réel → on sort sans appel DB (pas de bump updatedAt inutile)
    if (next === prev) {
      cancelEdit()
      return
    }
    setSaving(true)
    try {
      // editTrace côté useDB → updateTrace côté db.js applique updatedAt automatiquement
      await editTrace(localTrace.id, { [fieldKey]: next })
      setLocalTrace(t => ({ ...t, [fieldKey]: next, updatedAt: new Date().toISOString() }))
      setEditingField(null)
      setDraftValue('')
    } catch (err) {
      console.error('[T7] editTrace failed', err)
      // On garde le mode édition pour permettre une nouvelle tentative
    } finally {
      setSaving(false)
    }
  }

  const tryClose = () => {
    if (editingField) {
      const ok = window.confirm('Vraiment fermer sans enregistrer cette réponse ?')
      if (!ok) return
    }
    if (typeof onClose === 'function') onClose()
  }

  const handleDelete = () => { if (typeof onDelete === 'function') onDelete(localTrace) }

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
        {/* Preview photo — T3 : blob chargé via loadTraceBlob, fallback Archive */}
        <div style={S.preview}>
          {blobUrl ? (
            <img src={blobUrl} alt="" style={S.previewImg} />
          ) : (
            <Archive size={36} color="#9C8878" strokeWidth={1.2} />
          )}
        </div>

        {/* Statut — pastille colorée informationnelle (pas un contrôle) */}
        <div style={S.statusRow}>
          <span style={{ ...S.statusDot, background: status.color }} />
          <span style={S.statusLabel}>{status.label}</span>
        </div>

        {/* Réponses — T7 : tous les champs affichés, édition par champ */}
        <div style={S.responses}>
          {RESPONSE_FIELDS.map((f) => {
            const value     = localTrace[f.key] ?? ''
            const isEditing = editingField === f.key
            const isFilled  = String(value).trim().length > 0
            const otherEdit = editingField !== null && !isEditing
            // Crayon désactivé si : un autre champ est en édition, OU editTrace n'est pas branchée
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

      {/* Footer actions
          T7 : bouton "Compléter mes réponses" retiré (remplacé par les crayons par champ).
          Bouton "Changer ce que j'en fais" retiré : était no-op, sans promesse produit
          claire (anti-pattern UX). Sera rebranché en T6 quand les destinations
          vrac/note/scène/lettre auront un comportement réel. STATUS_LABELS et S.actionBtn
          conservés volontairement pour réutilisation T6. */}
      <div style={S.footer}>
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
}
