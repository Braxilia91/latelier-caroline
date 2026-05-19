import { useState } from 'react'

import Modal from '../ui/Modal'
import {
  X,
  Plus,
  Lightbulb,
  PaperPlaneTilt as Send,
  Trash as Trash2,
  CheckCircle,
} from '@phosphor-icons/react'

const TAGS = ['idée', 'scène', 'souvenir', 'émotion', 'dialogue', 'titre']

const TAG_COLORS = {
  'idée':     { bg: '#EEF4EC', border: '#9DB89A', color: '#3D6B45' },
  'scène':    { bg: '#EDF2FB', border: '#8FA8D8', color: '#2B4B8E' },
  'souvenir': { bg: '#FDF5E6', border: '#D4A847', color: '#7A5A00' },
  'émotion':  { bg: '#FEF0F0', border: '#E8A0A0', color: '#8B2020' },
  'dialogue': { bg: '#F3EEF8', border: '#B89ACD', color: '#5A3080' },
  'titre':    { bg: '#FEF3E2', border: '#F5C97A', color: '#A0620A' },
}

export default function VracModal({
  onClose, vracIdeas, addVracIdea, markVracUsed, removeVracIdea,
  currentChapter, onInjectToLea, hasKey,
}) {
  const [text,    setText]    = useState('')
  const [tag,     setTag]     = useState('idée')
  const [adding,  setAdding]  = useState(false)
  const [filter,  setFilter]  = useState('all')   // all | unused | used

  const handleAdd = async () => {
    const t = text.trim()
    if (!t) return
    setAdding(true)
    await addVracIdea({ text: t, tag, chapterId: currentChapter?.id || null })
    setText('')
    setAdding(false)
  }

  const handleInject = async (idea) => {
    if (!hasKey) return
    await markVracUsed(idea.id)
    onInjectToLea(idea)
    onClose()
  }

  // L4-1 — Confirmation avant suppression définitive d'une idée
  const handleRemove = (idea) => {
    const preview = (idea.text || '').slice(0, 60).replace(/\s+/g, ' ')
    const ok = window.confirm(
      `Supprimer cette idée ?\n\n« ${preview}${idea.text.length > 60 ? '…' : ''} »\n\nCette action est irréversible.`
    )
    if (ok) removeVracIdea(idea.id)
  }

  const displayed = vracIdeas.filter(v => {
    if (filter === 'unused') return !v.used
    if (filter === 'used')   return v.used
    return true
  })

  return (
    <Modal
      onClose={onClose}
      ariaLabel="Boîte à idées"
      overlayStyle={S.overlay}
      modalStyle={S.modal}
    >
        {/* Header */}
        <div style={S.hdr}>
          <div style={S.hdrLeft}>
            <span style={S.hdrIcon}>💡</span>
            <div>
              <div style={S.hdrTitle}>Vider ma tête</div>
              <div style={S.hdrSub}>Pose tes idées pêle-mêle — Léa les utilisera au bon moment</div>
            </div>
          </div>
          <button style={S.closeBtn} onClick={onClose} aria-label="Fermer la boîte à idées"><X size={18} /></button>
        </div>

        {/* Form d'ajout */}
        <div style={S.form}>
          <textarea
            style={S.textarea}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Une idée, une scène, un souvenir, une émotion, un dialogue, un titre…"
            rows={3}
            onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleAdd() }}
          />
          {/* Tags */}
          <div style={S.tagRow}>
            {TAGS.map(t => {
              const c = TAG_COLORS[t]
              return (
                <button
                  key={t}
                  style={{
                    ...S.tagBtn,
                    background: tag === t ? c.bg : '#FAF7F2',
                    border: `1.5px solid ${tag === t ? c.border : '#EDE7DE'}`,
                    color: tag === t ? c.color : '#9C8878',
                    fontWeight: tag === t ? 700 : 500,
                  }}
                  onClick={() => setTag(t)}
                >
                  {t}
                </button>
              )
            })}
          </div>
          <button
            style={{ ...S.addBtn, opacity: !text.trim() || adding ? .5 : 1 }}
            onClick={handleAdd}
            disabled={!text.trim() || adding}
          >
            <Plus size={15} /> Ajouter à ma boîte à idées
          </button>
        </div>

        {/* Filtres */}
        <div style={S.filters}>
          {[['all', 'Toutes', vracIdeas.length], ['unused', 'À utiliser', vracIdeas.filter(v => !v.used).length], ['used', 'Utilisées', vracIdeas.filter(v => v.used).length]].map(([k, label, count]) => (
            <button
              key={k}
              style={{ ...S.filterBtn, ...(filter === k ? S.filterActive : {}) }}
              onClick={() => setFilter(k)}
            >
              {label} <span style={S.filterCount}>{count}</span>
            </button>
          ))}
        </div>

        {/* Liste */}
        <div style={S.list}>
          {displayed.length === 0 && (
            <div style={S.empty}>
              <Lightbulb size={28} color="#C4956A" />
              <p>Ta boîte est vide pour l'instant.<br />Dépose tes premières idées ci-dessus 🌿</p>
            </div>
          )}
          {displayed.map(idea => {
            const c = TAG_COLORS[idea.tag] || TAG_COLORS['idée']
            return (
              <div key={idea.id} style={{ ...S.card, opacity: idea.used ? .6 : 1 }}>
                <div style={S.cardTop}>
                  <span style={{ ...S.tagPill, background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>
                    {idea.tag}
                  </span>
                  {idea.used && (
                    <span style={S.usedBadge}><CheckCircle size={11} /> utilisée</span>
                  )}
                  <span style={S.cardDate}>
                    {new Date(idea.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <p style={S.cardText}>{idea.text}</p>
                <div style={S.cardActions}>
                  {!idea.used && hasKey && (
                    <button style={S.injectBtn} onClick={() => handleInject(idea)}>
                      <Send size={12} /> Envoyer à Léa
                    </button>
                  )}
                  <button style={S.deleteBtn} onClick={() => handleRemove(idea)} aria-label="Supprimer cette idée">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )
          })}
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
    width: '100%', maxWidth: 540,
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
  hdrIcon: { fontSize: '1.5rem', marginTop: 2 },
  hdrTitle: { fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', fontWeight: 700, color: '#2A1A0E' },
  hdrSub:   { fontSize: '.72rem', color: '#9C8878', marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    background: 'transparent', border: '1.5px solid #EDE7DE',
    color: '#9C8878', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  form: {
    padding: '14px 20px 10px',
    borderBottom: '1px solid #EDE7DE',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  textarea: {
    width: '100%',
    padding: '10px 13px',
    border: '1.5px solid #EDE7DE',
    borderRadius: 12,
    fontFamily: "'Lora', serif",
    fontSize: '.85rem', lineHeight: 1.6,
    background: '#FAF7F2', color: '#2A1A0E',
    outline: 'none', resize: 'none',
    caretColor: '#8B6445',
    boxSizing: 'border-box',
  },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  tagBtn: {
    padding: '4px 11px',
    borderRadius: 20,
    fontSize: '.72rem',
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer',
    transition: 'all .15s',
  },
  addBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: '9px 18px',
    background: 'linear-gradient(135deg, #8B6445, #C4956A)',
    color: '#fff',
    border: 'none', borderRadius: 10,
    fontSize: '.82rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer',
    transition: 'filter .15s',
    alignSelf: 'flex-start',
  },
  filters: {
    display: 'flex', gap: 6, padding: '10px 20px',
    borderBottom: '1px solid #EDE7DE',
  },
  filterBtn: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '5px 12px',
    background: '#FAF7F2', border: '1.5px solid #EDE7DE',
    borderRadius: 20,
    fontSize: '.72rem', fontWeight: 600,
    fontFamily: "'Nunito', sans-serif",
    color: '#9C8878', cursor: 'pointer',
  },
  filterActive: {
    background: '#EDE7DE', border: '1.5px solid #C4956A',
    color: '#8B6445',
  },
  filterCount: {
    background: '#EDE7DE', borderRadius: 20,
    padding: '0 6px',
    fontSize: '.65rem',
  },
  list: {
    flex: 1, overflowY: 'auto',
    padding: '12px 20px 16px',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '32px 20px', gap: 12,
    textAlign: 'center',
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
  cardTop: { display: 'flex', alignItems: 'center', gap: 8 },
  tagPill: {
    padding: '2px 9px',
    borderRadius: 20,
    fontSize: '.67rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
  },
  usedBadge: {
    display: 'flex', alignItems: 'center', gap: 4,
    fontSize: '.67rem', color: '#6B8F71', fontFamily: "'Nunito', sans-serif",
    fontWeight: 700,
  },
  cardDate: {
    marginLeft: 'auto',
    fontSize: '.67rem', color: '#B0A090',
    fontFamily: "'Nunito', sans-serif",
  },
  cardText: {
    fontFamily: "'Lora', serif", fontStyle: 'italic',
    fontSize: '.83rem', color: '#2A1A0E', lineHeight: 1.6,
    margin: 0,
  },
  cardActions: { display: 'flex', gap: 8, alignItems: 'center' },
  injectBtn: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '5px 12px',
    background: 'linear-gradient(135deg, #6B8F71, #8B6445)',
    color: '#fff',
    border: 'none', borderRadius: 8,
    fontSize: '.72rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer',
  },
  deleteBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30,
    marginLeft: 'auto',
    background: 'transparent', border: '1.5px solid #EDE7DE',
    borderRadius: 8, color: '#B0A090', cursor: 'pointer',
  },
}
