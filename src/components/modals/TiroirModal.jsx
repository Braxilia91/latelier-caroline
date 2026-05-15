// TiroirModal.jsx — T3 : thumbnail blob câblé via loadTraceBlob
// T4 : OCR non bloquant
// T6A.1 : pastille de statut en overlay sur chaque vignette

import { useState, useEffect } from 'react'
import { Archive, X, Plus } from 'lucide-react'
import Modal from '../ui/Modal'

// T6A.1 — palette dupliquée volontairement (cohérente avec TraceDetailModal).
// Extraction dans src/lib/traceStatus.js prévue au prochain lot qui touche ces fichiers.
const STATUS_LABELS = {
  private: { label: 'Gardée dans le tiroir', color: '#8A7563' },
  vrac:    { label: 'Envoyée au vrac',       color: '#E07A1F' },
  note:    { label: 'Note brute',            color: '#6E3A1E' },
  scene:   { label: 'Scène avec Léa',        color: '#3FA868' },
  letter:  { label: 'Lettre',                color: '#3D6FCF' },
}

export default function TiroirModal({
  onClose,
  traces = [],
  onAddTrace,
  onSelectTrace,
  loadTraceBlob,
}) {
  return (
    <Modal
      onClose={onClose}
      ariaLabel="Le Tiroir"
      overlayStyle={S.overlay}
      modalStyle={S.modal}
    >
      {/* Header */}
      <div style={S.hdr}>
        <div style={S.hdrLeft}>
          <span style={S.hdrIcon}>
            <Archive size={18} color="var(--brown)" strokeWidth={1.8} />
          </span>
          <div>
            <div style={S.hdrTitle}>Le Tiroir</div>
            <div style={S.hdrSub}>Tes traces de vie — photos, souvenirs, instants</div>
          </div>
        </div>
        <div style={S.hdrRight}>
          <button style={S.addBtn} onClick={onAddTrace} aria-label="Ajouter une trace">
            <Plus size={15} />
            <span>Ajouter</span>
          </button>
          <button style={S.closeBtn} onClick={onClose} aria-label="Fermer le tiroir">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Corps */}
      <div style={S.body}>
        {traces.length === 0 ? (
          <div style={S.empty}>
            <Archive size={44} color="var(--ink-ll)" strokeWidth={1.1} />
            <div style={S.emptyTitle}>Le tiroir est vide</div>
            <div style={S.emptySub}>Tes premières traces apparaîtront ici.</div>
            <button style={S.emptyAddBtn} onClick={onAddTrace}>
              <Plus size={15} />
              Ajouter une trace
            </button>
          </div>
        ) : (
          <div style={S.grid}>
            {traces.map((trace) => (
              <TraceCard
                key={trace.id}
                trace={trace}
                onClick={() => onSelectTrace?.(trace)}
                loadTraceBlob={loadTraceBlob}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

function TraceCard({ trace, onClick, loadTraceBlob }) {
  const [blobUrl, setBlobUrl] = useState(null)

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

  const dateStr = trace.createdAt
    ? new Date(trace.createdAt).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : ''

  const preview = trace.whyNow
    ? trace.whyNow.length > 60
      ? `${trace.whyNow.slice(0, 60)}…`
      : trace.whyNow
    : null

  // T6A.1 — statut affiché en pastille sur la vignette
  // Fallback 'private' si status absent ou inconnu (cohérent avec TraceDetailModal)
  const statusKey = trace.status && STATUS_LABELS[trace.status] ? trace.status : 'private'
  const statusInfo = STATUS_LABELS[statusKey]

  return (
    <button type="button" style={S.card} onClick={onClick} aria-label={`Trace du ${dateStr} — ${statusInfo.label}`}>
      <div style={S.cardThumb}>
        {blobUrl ? (
          <img src={blobUrl} alt="" style={S.cardImg} />
        ) : (
          <Archive size={28} color="var(--ink-ll)" strokeWidth={1.2} />
        )}
        {/* T6A.1 — pastille statut : où est rangée cette trace */}
        <span
          style={{ ...S.statusPin, background: statusInfo.color }}
          title={`Statut : ${statusInfo.label}`}
          aria-hidden="true"
        />
      </div>
      <div style={S.cardBody}>
        <div style={S.cardDate}>{dateStr}</div>
        {preview && <div style={S.cardPreview}>{preview}</div>}
      </div>
    </button>
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
    padding: '16px',
  },
  modal: {
    background: 'var(--paper)',
    borderRadius: 18,
    boxShadow: '0 16px 48px rgba(42,26,14,.18)',
    width: '100%',
    maxWidth: 680,
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  hdr: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid var(--border-l)',
    flexShrink: 0,
    gap: 10,
  },
  hdrLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  hdrRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  hdrIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    background: 'var(--gold-ll)',
    border: '1px solid var(--gold-l)',
    borderRadius: 10,
    flexShrink: 0,
  },
  hdrTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '1.05rem',
    fontWeight: 700,
    color: 'var(--brown)',
  },
  hdrSub: {
    fontSize: '.72rem',
    color: 'var(--ink-ll)',
    fontFamily: "'Nunito', sans-serif",
    marginTop: 1,
  },
  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '6px 13px',
    background: 'var(--brown)',
    color: '#fff',
    border: 'none',
    borderRadius: 9,
    fontSize: '.78rem',
    fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer',
    flexShrink: 0,
  },
  closeBtn: {
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: '1.5px solid var(--border-l)',
    borderRadius: 8,
    color: 'var(--ink-l)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    textAlign: 'center',
    padding: '48px 24px',
  },
  emptyTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '1.1rem',
    fontWeight: 600,
    color: 'var(--ink-l)',
    marginTop: 4,
  },
  emptySub: {
    fontSize: '.8rem',
    color: 'var(--ink-ll)',
    fontFamily: "'Nunito', sans-serif",
    maxWidth: 260,
    lineHeight: 1.5,
  },
  emptyAddBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: '9px 18px',
    background: 'var(--brown)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: '.82rem',
    fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--cream)',
    border: '1.5px solid var(--border-l)',
    borderRadius: 12,
    overflow: 'hidden',
    cursor: 'pointer',
    textAlign: 'left',
    padding: 0,
    transition: 'border-color .15s, box-shadow .15s',
  },
  cardThumb: {
    width: '100%',
    aspectRatio: '4 / 3',
    background: 'var(--gold-ll)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  cardImg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  // T6A.1 — pastille de statut en overlay coin haut-droit de la vignette
  statusPin: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: '2px solid #FFFFFF',
    boxShadow: '0 1px 4px rgba(42,26,14,0.35)',
    pointerEvents: 'none',   // ne vole pas le clic sur la carte
    zIndex: 2,
  },
  cardBody: {
    padding: '8px 10px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  cardDate: {
    fontSize: '.68rem',
    fontWeight: 700,
    color: 'var(--ink-ll)',
    fontFamily: "'Nunito', sans-serif",
    textTransform: 'uppercase',
    letterSpacing: '.04em',
  },
  cardPreview: {
    fontSize: '.78rem',
    color: 'var(--ink-l)',
    fontFamily: "'Lora', serif",
    fontStyle: 'italic',
    lineHeight: 1.4,
  },
}
