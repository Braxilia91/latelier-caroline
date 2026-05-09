import { useState } from 'react'

import Modal from '../ui/Modal'
import { X, BookOpen, ChevronDown, ChevronUp, Check } from 'lucide-react'

export default function PlanModal({ chapters, onClose, updateChapter }) {
  const [editingId,  setEditingId]  = useState(null)
  const [editVal,    setEditVal]    = useState('')
  const [expanded,   setExpanded]   = useState({})

  const sorted = [...chapters].sort((a, b) => a.order - b.order)

  const totalWords = chapters.reduce(
    (acc, c) => acc + (c.content?.split(/\s+/).filter(Boolean).length ?? 0), 0
  )

  const startEdit = (ch) => {
    setEditingId(ch.id)
    setEditVal(ch.intention || '')
  }

  const saveEdit = async (id) => {
    await updateChapter(id, { intention: editVal.trim() })
    setEditingId(null)
  }

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <Modal
      onClose={onClose}
      ariaLabel="Plan du livre"
      overlayStyle={S.overlay}
      modalStyle={S.modal}
    >

        {/* Header */}
        <div style={S.hdr}>
          <div style={S.hdrLeft}>
            <span style={S.hdrIcon}><BookOpen size={20} color="#C4956A" /></span>
            <div>
              <div style={S.hdrTitle}>Plan du livre</div>
              <div style={S.hdrSub}>{sorted.length} chapitre{sorted.length > 1 ? 's' : ''} · {totalWords.toLocaleString('fr-FR')} mots au total</div>
            </div>
          </div>
          <button style={S.closeBtn} onClick={onClose} aria-label="Fermer le plan"><X size={18} /></button>
        </div>

        {/* Liste */}
        <div style={S.list}>
          {sorted.length === 0 && (
            <div style={S.empty}>
              <p>Aucun chapitre pour l'instant.<br />Crée ton premier chapitre dans la barre latérale 🌿</p>
            </div>
          )}

          {sorted.map((ch, idx) => {
            const words   = ch.content?.split(/\s+/).filter(Boolean).length ?? 0
            const preview = ch.content?.trim().slice(0, 120)
            const isOpen  = expanded[ch.id]
            const isEdit  = editingId === ch.id

            return (
              <div key={ch.id} style={S.card}>
                {/* Numéro + titre + mots */}
                <div style={S.cardTop}>
                  <span style={S.num}>{idx + 1}</span>
                  <div style={S.cardMeta}>
                    <span style={S.chTitle}>{ch.title || 'Sans titre'}</span>
                    <span style={S.wordCount}>{words} mot{words > 1 ? 's' : ''}</span>
                  </div>
                  <button
                    style={S.expandBtn}
                    onClick={() => toggleExpand(ch.id)}
                    title={isOpen ? 'Réduire' : 'Aperçu'}
                  >
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                {/* Intention */}
                <div style={S.intentionRow}>
                  {isEdit ? (
                    <div style={S.editRow}>
                      <input
                        style={S.intentionInput}
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        placeholder="Quelle est l'intention de ce chapitre ?"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') saveEdit(ch.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                      />
                      <button style={S.saveBtn} onClick={() => saveEdit(ch.id)}>
                        <Check size={13} />
                      </button>
                    </div>
                  ) : (
                    <button style={S.intentionBtn} onClick={() => startEdit(ch)}>
                      {ch.intention
                        ? <span style={S.intentionText}>✦ {ch.intention}</span>
                        : <span style={S.intentionEmpty}>+ Ajouter une intention…</span>
                      }
                    </button>
                  )}
                </div>

                {/* Aperçu contenu (dépliable) */}
                {isOpen && preview && (
                  <p style={S.preview}>
                    {preview}{ch.content?.length > 120 ? '…' : ''}
                  </p>
                )}
                {isOpen && !preview && (
                  <p style={S.previewEmpty}>Ce chapitre est encore vide.</p>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <span style={S.footerNote}>
            Clique sur une intention pour la modifier · Entrée pour valider · Échap pour annuler
          </span>
          <button style={S.closeFooterBtn} onClick={onClose}>Fermer</button>
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
  hdrLeft:  { display: 'flex', alignItems: 'flex-start', gap: 12 },
  hdrIcon:  { marginTop: 2 },
  hdrTitle: { fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', fontWeight: 700, color: '#2A1A0E' },
  hdrSub:   { fontSize: '.72rem', color: '#9C8878', marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    background: 'transparent', border: '1.5px solid #EDE7DE',
    color: '#9C8878', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  list: {
    flex: 1, overflowY: 'auto',
    padding: '16px 20px',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  empty: {
    textAlign: 'center', padding: '32px 0',
    fontFamily: "'Lora', serif", fontStyle: 'italic',
    fontSize: '.85rem', color: '#9C8878', lineHeight: 1.7,
  },
  card: {
    background: '#FAF7F2',
    border: '1.5px solid #EDE7DE',
    borderRadius: 12,
    padding: '12px 14px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  cardTop: { display: 'flex', alignItems: 'center', gap: 10 },
  num: {
    width: 24, height: 24, flexShrink: 0,
    background: '#EDE7DE', borderRadius: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '.68rem', fontWeight: 800,
    fontFamily: "'Nunito', sans-serif", color: '#8B6445',
  },
  cardMeta:  { flex: 1, display: 'flex', flexDirection: 'column', gap: 1 },
  chTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '.95rem', fontWeight: 600, color: '#2A1A0E',
  },
  wordCount: {
    fontSize: '.67rem', color: '#B0A090',
    fontFamily: "'Nunito', sans-serif",
  },
  expandBtn: {
    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
    background: 'transparent', border: '1.5px solid #EDE7DE',
    color: '#9C8878', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  intentionRow: { paddingLeft: 34 },
  editRow: { display: 'flex', gap: 6, alignItems: 'center' },
  intentionInput: {
    flex: 1,
    padding: '6px 10px',
    border: '1.5px solid #C4956A', borderRadius: 8,
    fontFamily: "'Lora', serif", fontSize: '.82rem',
    background: '#FFFEFB', color: '#2A1A0E',
    outline: 'none', caretColor: '#8B6445',
  },
  saveBtn: {
    width: 30, height: 30, flexShrink: 0,
    background: 'linear-gradient(135deg, #8B6445, #C4956A)',
    border: 'none', borderRadius: 8,
    color: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  intentionBtn: {
    background: 'none', border: 'none',
    padding: '2px 0', cursor: 'pointer', textAlign: 'left',
    width: '100%',
  },
  intentionText: {
    fontFamily: "'Lora', serif", fontStyle: 'italic',
    fontSize: '.8rem', color: '#8B6445',
  },
  intentionEmpty: {
    fontFamily: "'Nunito', sans-serif",
    fontSize: '.75rem', color: '#C4956A',
    opacity: .7,
  },
  preview: {
    paddingLeft: 34,
    fontFamily: "'Lora', serif", fontStyle: 'italic',
    fontSize: '.78rem', color: '#9C8878', lineHeight: 1.6,
    margin: 0,
    borderTop: '1px dashed #EDE7DE', paddingTop: 8,
  },
  previewEmpty: {
    paddingLeft: 34,
    fontFamily: "'Lora', serif", fontStyle: 'italic',
    fontSize: '.78rem', color: '#C4956A', opacity: .6,
    margin: 0,
  },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 20px',
    borderTop: '1px solid #EDE7DE',
    background: '#FAF7F2',
    gap: 10,
  },
  footerNote: {
    fontSize: '.68rem', color: '#B0A090',
    fontFamily: "'Nunito', sans-serif", fontStyle: 'italic',
  },
  closeFooterBtn: {
    padding: '8px 18px',
    background: 'transparent', border: '1.5px solid #EDE7DE',
    borderRadius: 10, fontSize: '.82rem', fontWeight: 600,
    fontFamily: "'Nunito', sans-serif", color: '#9C8878',
    cursor: 'pointer', flexShrink: 0,
  },
}
