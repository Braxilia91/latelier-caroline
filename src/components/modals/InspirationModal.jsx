import { useState, useMemo } from 'react'

import Modal from '../ui/Modal'
import {
  X,
  ArrowsClockwise as RefreshCw,
  ArrowRight,
} from '@phosphor-icons/react'
import { INSPIRATION_PROMPTS } from '../../lib/prompts'

const ALL_CATS = ['Toutes', ...Array.from(new Set(INSPIRATION_PROMPTS.map(p => p.cat)))]

export default function InspirationModal({ onClose, onSendToCoach, hasKey }) {
  const [cat,  setCat]  = useState('Toutes')
  const [idx,  setIdx]  = useState(() => Math.floor(Math.random() * INSPIRATION_PROMPTS.length))

  const pool = useMemo(
    () => cat === 'Toutes' ? INSPIRATION_PROMPTS : INSPIRATION_PROMPTS.filter(p => p.cat === cat),
    [cat]
  )

  // keep idx in bounds when pool shrinks
  const safeIdx = idx % pool.length
  const prompt  = pool[safeIdx]

  const next = () => setIdx(i => (i + 1) % pool.length)
  const rand = () => setIdx(Math.floor(Math.random() * pool.length))

  const handleCat = (c) => {
    setCat(c)
    setIdx(Math.floor(Math.random() * (c === 'Toutes' ? INSPIRATION_PROMPTS.length : INSPIRATION_PROMPTS.filter(p => p.cat === c).length)))
  }

  return (
    <Modal
      onClose={onClose}
      ariaLabel="Inspiration"
      overlayClassName="modal-bg"
      modalClassName="modal-box"
    >
        <button className="modal-close" onClick={onClose} aria-label="Fermer l'inspiration"><X size={16} /></button>
        <h2 className="modal-title">💡 Inspiration du moment</h2>

        {/* Filtre catégories */}
        <div style={styles.catRow}>
          {ALL_CATS.map(c => (
            <button
              key={c}
              style={{ ...styles.catPill, ...(cat === c ? styles.catPillActive : {}) }}
              onClick={() => handleCat(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <div style={styles.card}>
          <span style={styles.catBadge}>{prompt.cat}</span>
          <p style={styles.question}>{prompt.q}</p>
        </div>

        <div style={styles.actions}>
          <button style={styles.btn} onClick={rand}>
            <RefreshCw size={14} /> Autre question
          </button>
          <button style={styles.btnNext} onClick={next}>
            Suivante <ArrowRight size={14} />
          </button>
        </div>

        {hasKey && (
          <button
            style={styles.coachBtn}
            onClick={() => {
              onSendToCoach(`Je veux écrire sur cette question d'inspiration : "${prompt.q}". Aide-moi à commencer.`)
              onClose()
            }}
          >
            Demander à Léa de m'aider avec cette question →
          </button>
        )}

        <div style={styles.hint}>
          {pool.length} question{pool.length > 1 ? 's' : ''}{cat !== 'Toutes' ? ` · ${cat}` : ''} · {safeIdx + 1}/{pool.length}
        </div>
    </Modal>
  )
}
const styles = {
  catRow: {
    display: 'flex', gap: 6, flexWrap: 'wrap',
    marginBottom: 14,
  },
  catPill: {
    padding: '4px 12px',
    border: '1.5px solid #DDD5C8', borderRadius: 20,
    background: 'transparent',
    fontSize: '.72rem', fontWeight: 600,
    fontFamily: "'Nunito', sans-serif", color: '#9C8878',
    cursor: 'pointer', transition: 'all .15s',
  },
  catPillActive: {
    background: '#F7EFE3', border: '1.5px solid #C4956A', color: '#8B6445',
  },
  card: {
    background: 'linear-gradient(135deg, #2D1B0E, #8B6445)',
    borderRadius: 16, padding: '24px',
    marginBottom: 16, textAlign: 'center',
  },
  catBadge: {
    display: 'inline-block',
    background: 'rgba(255,255,255,.15)',
    color: '#E8D5B8',
    borderRadius: 20, padding: '3px 12px',
    fontSize: '.7rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '1px',
    marginBottom: 12,
  },
  question: {
    fontFamily: "'Cormorant Garamond', serif",
    fontStyle: 'italic', fontSize: '1.2rem',
    color: '#FAF7F2', lineHeight: 1.6,
  },
  actions: { display: 'flex', gap: 8, marginBottom: 10 },
  btn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '9px 16px',
    background: 'transparent', border: '1.5px solid #DDD5C8',
    borderRadius: 10, fontSize: '.82rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif", color: '#8B6445', cursor: 'pointer',
  },
  btnNext: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '9px 16px',
    background: '#F7EFE3', border: '1.5px solid #E8D5B8',
    borderRadius: 10, fontSize: '.82rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif", color: '#8B6445', cursor: 'pointer',
  },
  coachBtn: {
    width: '100%',
    padding: '10px 16px',
    background: 'linear-gradient(135deg, #6B8F71, #8B6445)',
    color: '#fff', border: 'none',
    borderRadius: 10, fontSize: '.82rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif", cursor: 'pointer',
    marginBottom: 12,
  },
  hint: { textAlign: 'center', fontSize: '.7rem', color: '#9C8878' },
}
