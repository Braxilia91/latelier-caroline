// LOT 4C.3 — Modale "Ce que Léa se rappelle"
// Donne à Caroline la transparence + le contrôle sur la mémoire long-terme de Léa.
// Backend déjà existant (lea_memory en KV, extractKeyPointInBackground en fond).
// Ce LOT n'ajoute QUE la couche visibilité + contrôle utilisateur.

import { useState } from 'react'
import Modal from '../ui/Modal'
import {
  X,
  Brain,
  Trash as Trash2,
  Warning as AlertTriangle,
} from '@phosphor-icons/react'

export default function LeaMemoryModal({ leaMemory, updateLeaMemory, resetLeaMemory, onClose }) {
  const [confirmReset, setConfirmReset] = useState(false)

  const m = leaMemory || {}
  const keyPoints = Array.isArray(m.keyPoints) ? m.keyPoints : []
  const hasMemory = !!(m.lastSession || m.lastChapter || keyPoints.length || m.toCelebrate)

  // Format de date relative cohérent avec buildWelcomeMessage
  const formatRelative = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const days = Math.floor((Date.now() - d.getTime()) / 86400000)
    if (days === 0) return "aujourd'hui"
    if (days === 1) return 'hier'
    if (days < 30) return `il y a ${days} jours`
    return d.toLocaleDateString('fr-FR')
  }

  const handleDeleteKeyPoint = (point) => {
    if (!window.confirm('Supprimer ce souvenir de la mémoire de Léa ?')) return
    updateLeaMemory(prev => ({
      keyPoints: (prev?.keyPoints || []).filter(p => p !== point),
    }))
  }

  // Pattern double-clic 3s, cohérent avec resetAllData de SettingsModal
  const handleReset = () => {
    if (confirmReset) {
      resetLeaMemory()
      setConfirmReset(false)
      onClose()
    } else {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset(false), 5000)
    }
  }

  return (
    <Modal onClose={onClose} ariaLabel="Mémoire de Léa" overlayStyle={S.overlay} modalStyle={S.modal}>
      <div style={S.hdr}>
        <div style={S.hdrLeft}>
          <Brain size={18} color="#8B6445" />
          <span style={S.hdrTitle}>Ce que Léa se rappelle</span>
        </div>
        <button style={S.closeBtn} onClick={onClose} aria-label="Fermer la mémoire de Léa">
          <X size={16} />
        </button>
      </div>

      <div style={S.body}>
        {!hasMemory && (
          <div style={S.empty}>
            <div style={S.emptyIcon}>🌱</div>
            <p style={S.emptyText}>
              Léa n'a encore rien retenu de vos échanges. Au fil de vos conversations,
              elle gardera en tête les faits importants que tu lui partages.
            </p>
          </div>
        )}

        {hasMemory && (
          <>
            {/* ── Métadonnées : dernière session + chapitre ── */}
            {(m.lastSession || m.lastChapter) && (
              <div style={S.metaBox}>
                {m.lastSession && (
                  <div style={S.metaLine}>
                    <span style={S.metaLbl}>Dernière session</span>
                    <span style={S.metaVal}>{formatRelative(m.lastSession)}</span>
                  </div>
                )}
                {m.lastChapter && (
                  <div style={S.metaLine}>
                    <span style={S.metaLbl}>Dernier chapitre</span>
                    <span style={S.metaVal}>{m.lastChapter}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── À célébrer ── */}
            {m.toCelebrate && (
              <div style={S.celebrateBox}>
                <span style={S.celebrateIcon}>✨</span>
                <span><strong>À célébrer :</strong> {m.toCelebrate}</span>
              </div>
            )}

            {/* ── Souvenirs (keyPoints) ── */}
            <div style={S.section}>
              <div style={S.sectionTitle}>
                Souvenirs <span style={S.sectionCount}>({keyPoints.length}/10)</span>
              </div>
              {keyPoints.length === 0 && (
                <div style={S.hint}>
                  Aucun souvenir spécifique pour le moment. Léa extrait automatiquement les faits
                  notables de vos échanges (souvenirs précis, émotions, décisions narratives).
                </div>
              )}
              {keyPoints.map((point, i) => (
                <div key={`${i}-${(point || '').slice(0, 16)}`} style={S.keyPointRow}>
                  <span style={S.keyPointTxt}>{point}</span>
                  <button
                    style={S.delBtn}
                    onClick={() => handleDeleteKeyPoint(point)}
                    title="Supprimer ce souvenir"
                    aria-label="Supprimer ce souvenir"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            {/* ── Zone danger : reset complet ── */}
            <div style={S.dangerZone}>
              <div style={S.dangerHdr}>
                <AlertTriangle size={13} color="#C0392B" />
                <span style={S.dangerTitle}>Tout effacer</span>
              </div>
              <p style={S.dangerTxt}>
                Léa repartira de zéro à votre prochain échange. Cette action est irréversible.
              </p>
              <button style={S.dangerBtn} onClick={handleReset}>
                {confirmReset ? '⚠️ Confirmer — effacer toute la mémoire ?' : 'Effacer toute la mémoire de Léa'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

// ── Styles (cohérents avec SettingsModal) ─────────────────────────
const S = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(42,26,14,.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: '#FFFEFB', borderRadius: 18,
    width: '100%', maxWidth: 540,
    maxHeight: '90vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 60px rgba(42,26,14,.25)',
    overflow: 'hidden',
  },
  hdr: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #EDE7DE',
    background: '#FAF7F2', flexShrink: 0,
  },
  hdrLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  hdrTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '1.15rem', fontWeight: 700, color: '#2A1A0E',
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    background: 'transparent', border: '1.5px solid #EDE7DE',
    color: '#9C8878', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  body: {
    flex: 1, overflowY: 'auto',
    padding: '16px 20px 20px',
    display: 'flex', flexDirection: 'column', gap: 12,
  },

  // État vide
  empty: {
    background: '#FAF7F2',
    border: '1px dashed #DDD5C8',
    borderRadius: 12,
    padding: '24px 20px',
    textAlign: 'center',
  },
  emptyIcon: { fontSize: '1.6rem', marginBottom: 8 },
  emptyText: {
    fontFamily: "'Lora', serif", fontStyle: 'italic',
    fontSize: '.85rem', color: '#6B5A4E', lineHeight: 1.6,
    margin: 0,
  },

  // Méta (lastSession, lastChapter)
  metaBox: {
    background: '#FAF7F2',
    border: '1px solid #EDE7DE',
    borderRadius: 12,
    padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  metaLine: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
    gap: 12,
    fontFamily: "'Nunito', sans-serif", fontSize: '.8rem',
  },
  metaLbl: { color: '#9C8878', fontWeight: 600 },
  metaVal: { color: '#2A1A0E', fontWeight: 700, textAlign: 'right' },

  // À célébrer
  celebrateBox: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    background: '#FFF8E7', border: '1.5px solid #E5C46B',
    borderRadius: 12,
    padding: '10px 14px',
    fontSize: '.82rem', color: '#5C4A1F',
    fontFamily: "'Nunito', sans-serif", lineHeight: 1.5,
  },
  celebrateIcon: { fontSize: '1.1rem', flexShrink: 0 },

  // Section souvenirs
  section: {
    background: '#FAF7F2',
    border: '1px solid #EDE7DE',
    borderRadius: 12,
    padding: '12px 14px',
  },
  sectionTitle: {
    fontSize: '.72rem', fontWeight: 800,
    fontFamily: "'Nunito', sans-serif",
    color: '#8B6445', textTransform: 'uppercase', letterSpacing: '.8px',
    marginBottom: 10,
  },
  sectionCount: {
    fontWeight: 600, color: '#9C8878', textTransform: 'none', letterSpacing: 0,
  },
  hint: {
    fontSize: '.78rem', color: '#9C8878', fontStyle: 'italic',
    fontFamily: "'Nunito', sans-serif", lineHeight: 1.5,
    padding: '4px 2px',
  },
  keyPointRow: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    padding: '8px 10px',
    background: '#FFFEFB',
    border: '1px solid #EDE7DE',
    borderRadius: 8,
    marginBottom: 6,
  },
  keyPointTxt: {
    flex: 1,
    fontFamily: "'Lora', serif",
    fontSize: '.85rem', color: '#2A1A0E', lineHeight: 1.5,
  },
  delBtn: {
    flexShrink: 0,
    background: 'transparent',
    border: 'none',
    color: '#A09070',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 6,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: 0.65,
    transition: 'opacity .15s, color .15s, background .15s',
  },

  // Zone danger
  dangerZone: {
    background: '#FFF5F5', border: '1.5px solid #FECACA',
    borderRadius: 12, padding: '12px 14px',
  },
  dangerHdr: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 },
  dangerTitle: {
    fontSize: '.72rem', fontWeight: 800, color: '#C0392B',
    textTransform: 'uppercase', letterSpacing: '.5px',
    fontFamily: "'Nunito', sans-serif",
  },
  dangerTxt: {
    fontSize: '.78rem', color: '#7F1D1D', lineHeight: 1.5,
    fontFamily: "'Nunito', sans-serif", marginBottom: 10,
  },
  dangerBtn: {
    padding: '8px 14px',
    background: '#C0392B', color: '#fff', border: 'none',
    borderRadius: 8, fontSize: '.78rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif", cursor: 'pointer',
  },
}
