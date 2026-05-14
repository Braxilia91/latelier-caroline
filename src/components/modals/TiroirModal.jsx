import Modal from '../ui/Modal'
import { X, Plus, Archive } from 'lucide-react'

// Couleurs de point de statut par sortie (cf docs/le-tiroir-v1.md §6)
const STATUS_COLORS = {
  private: { dot: '#B0A090', label: 'gardée dans le tiroir' },
  vrac:    { dot: '#C4956A', label: 'envoyée au vrac' },
  note:    { dot: '#8B6445', label: 'note brute' },
  scene:   { dot: '#6B8F71', label: 'scène avec Léa' },
  letter:  { dot: '#8FA8D8', label: 'lettre' },
}

export default function TiroirModal({
  onClose,
  traces = [],
  onAddTrace,
  onOpenTrace,
  isMobile,     // optionnel, non utilisé en 2A — réservé pour 2B/3
}) {
  const hasTraces = Array.isArray(traces) && traces.length > 0

  const handleAddClick = () => {
    if (typeof onAddTrace === 'function') onAddTrace()
  }

  const handleOpenTrace = (trace) => {
    if (typeof onOpenTrace === 'function') onOpenTrace(trace)
  }

  return (
    <Modal
      onClose={onClose}
      ariaLabel="Le tiroir"
      overlayStyle={S.overlay}
      modalStyle={S.modal}
    >
      {/* Header */}
      <div style={S.hdr}>
        <div style={S.hdrLeft}>
          <span style={S.hdrIcon}><Archive size={22} color="#8B6445" /></span>
          <div>
            <div style={S.hdrTitle}>Le tiroir</div>
            <div style={S.hdrSub}>Faire venir un souvenir, l'accueillir, l'écrire si tu veux.</div>
          </div>
        </div>
        <button style={S.closeBtn} onClick={onClose} aria-label="Fermer le tiroir"><X size={18} /></button>
      </div>

      {/* Body */}
      {!hasTraces ? (
        <div style={S.empty}>
          <Archive size={48} color="#C4956A" strokeWidth={1.4} />
          <p style={S.emptyText}>
            Ton tiroir est vide pour l'instant.<br />
            Dépose une première trace — une photo, un document —<br />
            et regarde ce qu'elle te ramène.
          </p>
          <button style={S.addCta} onClick={handleAddClick}>
            <Plus size={16} /> Ajouter au tiroir
          </button>
        </div>
      ) : (
        <>
          <div style={S.toolbar}>
            <button style={S.addCtaSmall} onClick={handleAddClick}>
              <Plus size={14} /> Ajouter au tiroir
            </button>
            <span style={S.count}>{traces.length} trace{traces.length > 1 ? 's' : ''}</span>
          </div>
          <div style={S.grid}>
            {traces.map(trace => {
              const status = STATUS_COLORS[trace?.status] || STATUS_COLORS.private
              const dateStr = trace?.createdAt
                ? new Date(trace.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                : ''
              return (
                <button
                  key={trace.id}
                  style={S.thumb}
                  onClick={() => handleOpenTrace(trace)}
                  aria-label={`Ouvrir la trace du ${dateStr}`}
                >
                  <div style={S.thumbPreview}>
                    {/* Preview blob sera câblé en LOT 3 via loadTraceBlob */}
                    <Archive size={28} color="#9C8878" strokeWidth={1.2} />
                  </div>
                  <div style={S.thumbMeta}>
                    <span style={{ ...S.statusDot, background: status.dot }} aria-label={status.label} />
                    <span style={S.thumbDate}>{dateStr}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}
    </Modal>
  )
}

const S = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(42,26,14,.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: '#FFFEFB',
    borderRadius: 18,
    width: '100%', maxWidth: 720,
    maxHeight: '88vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 60px rgba(42,26,14,.25)',
    overflow: 'hidden',
  },
  hdr: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '16px 20px 14px',
    borderBottom: '1px solid #EDE7DE',
    background: '#FAF7F2',
  },
  hdrLeft: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  hdrIcon: { display: 'flex', alignItems: 'center', marginTop: 2 },
  hdrTitle: { fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', fontWeight: 700, color: '#2A1A0E' },
  hdrSub:   { fontSize: '.72rem', color: '#9C8878', marginTop: 2, fontStyle: 'italic', fontFamily: "'Lora', serif" },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    background: 'transparent', border: '1.5px solid #EDE7DE',
    color: '#9C8878', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  empty: {
    flex: 1,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '40px 24px',
    gap: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: "'Lora', serif", fontStyle: 'italic',
    fontSize: '.9rem', color: '#9C8878', lineHeight: 1.7,
    margin: 0, maxWidth: 380,
  },
  addCta: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '11px 22px',
    background: 'linear-gradient(135deg, #8B6445, #C4956A)',
    color: '#fff',
    border: 'none', borderRadius: 12,
    fontSize: '.88rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer',
    transition: 'filter .15s',
  },
  toolbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 20px',
    borderBottom: '1px solid #EDE7DE',
  },
  addCtaSmall: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 14px',
    background: 'linear-gradient(135deg, #8B6445, #C4956A)',
    color: '#fff',
    border: 'none', borderRadius: 10,
    fontSize: '.78rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer',
  },
  count: {
    fontSize: '.72rem', color: '#9C8878',
    fontFamily: "'Nunito', sans-serif",
  },
  grid: {
    flex: 1, overflowY: 'auto',
    padding: '14px 20px 20px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 12,
  },
  thumb: {
    display: 'flex', flexDirection: 'column',
    background: '#FAF7F2',
    border: '1.5px solid #EDE7DE',
    borderRadius: 12,
    padding: 0,
    cursor: 'pointer',
    overflow: 'hidden',
    textAlign: 'left',
  },
  thumbPreview: {
    aspectRatio: '4 / 3',
    width: '100%',
    background: '#EDE7DE',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  thumbMeta: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 10px',
  },
  statusDot: {
    width: 8, height: 8, borderRadius: '50%',
    flexShrink: 0,
  },
  thumbDate: {
    fontSize: '.72rem', color: '#9C8878',
    fontFamily: "'Nunito', sans-serif",
  },
}
