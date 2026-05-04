import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Check, X, Trash2 } from 'lucide-react'
import { useVoice } from '../../hooks/useVoice'

export default function DictationModal({ onClose, onInsert }) {
  const [accumulated, setAccumulated] = useState('')
  const accRef = useRef('') // ref pour garder la valeur à jour dans le callback

  const { listening, interim, supported, toggle, stop } = useVoice({
    onResult: (text) => {
      accRef.current += text
      setAccumulated(accRef.current)
    }
  })

  const displayText = accumulated + (interim || '')

  const handleInsert = () => {
    const text = displayText.trim()
    if (text) onInsert(text)
    if (listening) stop()
    onClose()
  }

  const handleClear = () => {
    accRef.current = ''
    setAccumulated('')
  }

  useEffect(() => {
    // Nettoyer à la fermeture
    return () => {
      stop()
      accRef.current = ''
    }
  }, [])

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <button className="modal-close" onClick={onClose}><X size={16} /></button>
        <h2 className="modal-title">🎤 Dicter</h2>

        {!supported && (
          <div style={styles.warn}>
            La dictée vocale n'est pas disponible sur ce navigateur.<br />
            Utilise <strong>Chrome</strong> ou <strong>Edge</strong>.
          </div>
        )}

        {supported && (
          <>
            {/* Bouton micro */}
            <div style={styles.micWrap}>
              <button
                style={{ ...styles.micBtn, ...(listening ? styles.micActive : {}) }}
                onClick={toggle}
                aria-label={listening ? 'Arrêter' : 'Commencer à dicter'}
              >
                {listening ? <MicOff size={28} /> : <Mic size={28} />}
              </button>
              <p style={styles.micHint}>
                {listening
                  ? '🔴 Écoute en cours… clique pour arrêter'
                  : 'Clique pour commencer à dicter'}
              </p>
              {listening && (
                <div style={styles.pulse}>
                  <span style={styles.dot1} />
                  <span style={styles.dot2} />
                  <span style={styles.dot3} />
                </div>
              )}
            </div>

            {/* Texte transcrit */}
            <div style={styles.textBox}>
              {accumulated && (
                <span style={styles.final}>{accumulated}</span>
              )}
              {interim && (
                <span style={styles.interim}>{interim}</span>
              )}
              {!displayText && (
                <span style={styles.placeholder}>Le texte dicté apparaîtra ici…</span>
              )}
            </div>

            {/* Actions */}
            <div style={styles.actions}>
              <button
                style={{ ...styles.clearBtn, opacity: displayText ? 1 : .4 }}
                onClick={handleClear}
                disabled={!displayText}
                title="Effacer le texte"
              >
                <Trash2 size={14} /> Effacer
              </button>
              <button
                style={{ ...styles.insertBtn, opacity: displayText ? 1 : .4 }}
                onClick={handleInsert}
                disabled={!displayText}
              >
                <Check size={16} /> Insérer dans le chapitre
              </button>
            </div>

            <p style={styles.tip}>
              💡 Parle normalement — chaque phrase est transcrite automatiquement.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  warn: {
    background: '#FFF3E0', border: '1px solid #FFB74D',
    borderRadius: 10, padding: 14,
    fontSize: '.82rem', color: '#E65100', lineHeight: 1.6,
  },
  micWrap: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 10, margin: '20px 0',
  },
  micBtn: {
    width: 80, height: 80, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#FAF7F2', border: '3px solid #DDD5C8',
    color: '#8B6445', cursor: 'pointer',
    transition: 'all .2s', boxShadow: '0 4px 16px rgba(139,100,69,.1)',
    outline: 'none',
  },
  micActive: {
    background: 'linear-gradient(135deg, #C0392B, #E74C3C)',
    borderColor: '#C0392B', color: '#fff',
    boxShadow: '0 4px 24px rgba(192,57,43,.4)',
    animation: 'pulse-dot 1.5s ease-in-out infinite',
  },
  micHint: { fontSize: '.8rem', color: '#9C8878', textAlign: 'center' },
  pulse: { display: 'flex', gap: 6, alignItems: 'center' },
  dot1: { width: 8, height: 8, borderRadius: '50%', background: '#C0392B', animation: 'bounce 1.3s infinite' },
  dot2: { width: 8, height: 8, borderRadius: '50%', background: '#C0392B', animation: 'bounce 1.3s .2s infinite' },
  dot3: { width: 8, height: 8, borderRadius: '50%', background: '#C0392B', animation: 'bounce 1.3s .4s infinite' },
  textBox: {
    minHeight: 100, maxHeight: 200, overflowY: 'auto',
    background: '#FAF7F2', border: '1.5px solid #EDE7DE',
    borderRadius: 12, padding: '12px 16px',
    fontFamily: "'Lora', serif", fontSize: '.9rem', lineHeight: 1.7,
    color: '#2A1A0E', marginBottom: 16,
    whiteSpace: 'pre-wrap',
  },
  final: { color: '#2A1A0E' },
  interim: { color: '#9C8878', fontStyle: 'italic' },
  placeholder: { color: '#9C8878', fontStyle: 'italic' },
  actions: { display: 'flex', gap: 10, marginBottom: 10 },
  clearBtn: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '9px 14px',
    background: 'transparent', border: '1.5px solid #DDD5C8',
    borderRadius: 10, fontSize: '.85rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif", color: '#9C8878', cursor: 'pointer',
  },
  insertBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '9px 16px',
    background: 'linear-gradient(135deg, #6B8F71, #8B6445)',
    color: '#fff', border: 'none',
    borderRadius: 10, fontSize: '.85rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif", cursor: 'pointer',
  },
  tip: {
    fontSize: '.74rem', color: '#9C8878',
    textAlign: 'center', lineHeight: 1.5,
    fontFamily: "'Nunito', sans-serif",
  },
}
