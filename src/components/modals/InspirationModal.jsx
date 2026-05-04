import { useState } from 'react'
import { X, RefreshCw, ArrowRight } from 'lucide-react'
import { INSPIRATION_PROMPTS } from '../../lib/prompts'

export default function InspirationModal({ onClose, onSendToCoach, hasKey }) {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * INSPIRATION_PROMPTS.length))

  const prompt = INSPIRATION_PROMPTS[idx]
  const next = () => setIdx(i => (i + 1) % INSPIRATION_PROMPTS.length)
  const rand = () => setIdx(Math.floor(Math.random() * INSPIRATION_PROMPTS.length))

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <button className="modal-close" onClick={onClose}><X size={16} /></button>
        <h2 className="modal-title">💡 Inspiration du moment</h2>

        <div style={styles.card}>
          <span style={styles.cat}>{prompt.cat}</span>
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
          {INSPIRATION_PROMPTS.length} questions · {idx + 1}/{INSPIRATION_PROMPTS.length}
        </div>
      </div>
    </div>
  )
}

const styles = {
  card: {
    background: 'linear-gradient(135deg, #2D1B0E, #8B6445)',
    borderRadius: 16, padding: '24px',
    marginBottom: 16, textAlign: 'center',
  },
  cat: {
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
