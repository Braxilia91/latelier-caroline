import Modal from '../ui/Modal'
import { X, Edit3, RefreshCw, Trash2, Archive } from 'lucide-react'

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
  { key: 'unseen',    label: 'Qu\'est-ce qu\'on ne voit pas, mais qui était pourtant là ?' },
  { key: 'leftToday', label: 'Qu\'est-ce que cette trace te laisse aujourd\'hui ?' },
]

export default function TraceDetailModal({
  trace,
  onClose,
  onEdit,
  onDelete,
  isMobile,     // optionnel, non utilisé en 2A — réservé pour 2B/3
}) {
  if (!trace) return null

  const status = STATUS_LABELS[trace.status] || STATUS_LABELS.private
  const dateStr = trace.createdAt
    ? new Date(trace.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  const handleEdit   = () => { if (typeof onEdit === 'function')   onEdit(trace) }
  const handleDelete = () => { if (typeof onDelete === 'function') onDelete(trace) }
  // "Changer ce que j'en fais" : bouton présent visuellement, handler no-op en 2A.
  // Câblage prévu dans un lot ultérieur (sortie privé/vrac/note/scène/lettre).
  const handleChangeStatusNoop = () => {}

  // Filtre les réponses présentes — masque celles laissées vides (cf spec §4 étape 5 récap)
  const filledResponses = RESPONSE_FIELDS.filter(
    f => trace[f.key] && String(trace[f.key]).trim().length > 0
  )

  return (
    <Modal
      onClose={onClose}
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
        <button style={S.closeBtn} onClick={onClose} aria-label="Fermer la fiche"><X size={18} /></button>
      </div>

      {/* Body */}
      <div style={S.body}>
        {/* Preview photo placeholder (câblage LOT 3 via loadTraceBlob) */}
        <div style={S.preview}>
          <Archive size={36} color="#9C8878" strokeWidth={1.2} />
        </div>

        {/* Statut */}
        <div style={S.statusRow}>
          <span style={{ ...S.statusDot, background: status.color }} />
          <span style={S.statusLabel}>{status.label}</span>
        </div>

        {/* Réponses (4 champs stricts) */}
        {filledResponses.length > 0 ? (
          <div style={S.responses}>
            {filledResponses.map(f => (
              <div key={f.key} style={S.respBlock}>
                <div style={S.respLabel}>{f.label}</div>
                <p style={S.respText}>{trace[f.key]}</p>
              </div>
            ))}
          </div>
        ) : (
          <p style={S.noResponses}>Aucune réponse écrite pour cette trace.</p>
        )}
      </div>

      {/* Footer actions */}
      <div style={S.footer}>
        <button style={S.actionBtn} onClick={handleEdit}>
          <Edit3 size={14} /> Compléter mes réponses
        </button>
        <button style={S.actionBtn} onClick={handleChangeStatusNoop}>
          <RefreshCw size={14} /> Changer ce que j'en fais
        </button>
        <button style={S.deleteBtn} onClick={handleDelete} aria-label="Supprimer cette trace">
          <Trash2 size={14} />
        </button>
      </div>
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
    width: '100%', maxWidth: 560,
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
  hdrSub:   { fontSize: '.72rem', color: '#9C8878', marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    background: 'transparent', border: '1.5px solid #EDE7DE',
    color: '#9C8878', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  body: {
    flex: 1, overflowY: 'auto',
    padding: '14px 20px 16px',
    display: 'flex', flexDirection: 'column', gap: 14,
  },
  preview: {
    width: '100%',
    aspectRatio: '4 / 3',
    background: '#EDE7DE',
    borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  statusRow: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  statusDot: {
    width: 10, height: 10, borderRadius: '50%',
    flexShrink: 0,
  },
  statusLabel: {
    fontSize: '.76rem', color: '#9C8878',
    fontFamily: "'Nunito', sans-serif", fontWeight: 600,
  },
  responses: {
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  respBlock: {
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  respLabel: {
    fontSize: '.7rem', color: '#9C8878',
    fontFamily: "'Nunito', sans-serif", fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '.05em',
  },
  respText: {
    fontFamily: "'Lora', serif", fontStyle: 'italic',
    fontSize: '.88rem', color: '#2A1A0E', lineHeight: 1.7,
    margin: 0,
  },
  noResponses: {
    fontFamily: "'Lora', serif", fontStyle: 'italic',
    fontSize: '.82rem', color: '#9C8878',
    textAlign: 'center',
    margin: '8px 0',
  },
  footer: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '12px 20px',
    borderTop: '1px solid #EDE7DE',
    background: '#FAF7F2',
  },
  actionBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 12px',
    background: '#FFFEFB',
    border: '1.5px solid #EDE7DE',
    borderRadius: 10,
    fontSize: '.76rem', fontWeight: 600,
    fontFamily: "'Nunito', sans-serif",
    color: '#8B6445',
    cursor: 'pointer',
  },
  deleteBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 36, height: 36,
    marginLeft: 'auto',
    background: 'transparent', border: '1.5px solid #EDE7DE',
    borderRadius: 10, color: '#B0A090', cursor: 'pointer',
  },
}
