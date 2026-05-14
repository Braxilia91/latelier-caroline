// TiroirModal.jsx — T1 : socle inert, état vide uniquement
// T2 : chargement traces + grille thumbs
// T3 : AddTraceFlow (flow photo)
// T4 : OCR non bloquant

import { Archive, X } from 'lucide-react'
import Modal from '../ui/Modal'

export default function TiroirModal({ onClose }) {
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
        <button style={S.closeBtn} onClick={onClose} aria-label="Fermer le tiroir">
          <X size={18} />
        </button>
      </div>

      {/* Corps — état vide T1 */}
      <div style={S.body}>
        <div style={S.empty}>
          <Archive size={44} color="var(--ink-ll)" strokeWidth={1.1} />
          <div style={S.emptyTitle}>Le tiroir est vide</div>
          <div style={S.emptySub}>
            Tes premières traces apparaîtront ici.
          </div>
        </div>
      </div>
    </Modal>
  )
}

const S = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(42,26,14,.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
  },
  modal: {
    background: 'var(--paper)',
    borderRadius: 18,
    boxShadow: '0 16px 48px rgba(42,26,14,.18)',
    width: '100%',
    maxWidth: 640,
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  hdr: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-l)',
    flexShrink: 0,
  },
  hdrLeft: {
    display: 'flex', alignItems: 'center', gap: 10,
  },
  hdrIcon: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 36, height: 36,
    background: 'var(--gold-ll)',
    border: '1px solid var(--gold-l)',
    borderRadius: 10,
    flexShrink: 0,
  },
  hdrTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '1.05rem', fontWeight: 700,
    color: 'var(--brown)',
  },
  hdrSub: {
    fontSize: '.72rem', color: 'var(--ink-ll)',
    fontFamily: "'Nunito', sans-serif",
    marginTop: 1,
  },
  closeBtn: {
    width: 32, height: 32,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent',
    border: '1.5px solid var(--border-l)',
    borderRadius: 8,
    color: 'var(--ink-l)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '48px 24px',
    overflowY: 'auto',
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 12, textAlign: 'center',
  },
  emptyTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '1.1rem', fontWeight: 600,
    color: 'var(--ink-l)',
    marginTop: 4,
  },
  emptySub: {
    fontSize: '.8rem', color: 'var(--ink-ll)',
    fontFamily: "'Nunito', sans-serif",
    maxWidth: 260,
    lineHeight: 1.5,
  },
}
