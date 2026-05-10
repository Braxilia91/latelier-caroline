import { useState, useEffect, useCallback } from 'react'

import Modal from '../ui/Modal'
import { Mic, MicOff, Check, X } from 'lucide-react'
import { useVoice } from '../../hooks/useVoice'

export default function DictationModal({ onClose, onInsert }) {
  const [accumulated, setAccumulated] = useState('')

  // Callback stable — accumulateur React propre, sans window.__dictAcc__
  const handleResult = useCallback((text) => {
    setAccumulated(prev => prev + text)
  }, [])

  const { listening, interim, errorMsg, supported, toggle, stop } = useVoice({
    onResult: handleResult,
  })

  // Stop propre à la fermeture — stop est stable (useCallback [])
  useEffect(() => {
    return () => { stop() }
  }, [stop])

  const displayText = accumulated + (interim || '')

  const handleInsert = () => {
    const text = displayText.trim()
    if (text) onInsert(text)
    if (listening) stop()
    onClose()
  }

  const handleClear = () => {
    setAccumulated('')
  }

  return (
    <Modal
      onClose={onClose}
      ariaLabel="Dictée vocale"
      overlayClassName="modal-bg"
      modalClassName="modal-box"
    >
        <button className="modal-close" onClick={onClose} aria-label="Fermer la dictée"><X size={16} /></button>
        <h2 className="modal-title">🎤 Dicter</h2>

        {!supported && (
          <div style={styles.warn}>
            La dictée vocale n'est pas disponible sur ce navigateur.<br />
            Utilise <strong>Chrome</strong> ou <strong>Edge</strong>.
          </div>
        )}

        {supported && (
          <>
            {/* Erreur permission ou micro indisponible */}
            {errorMsg && (
              <div style={styles.warn}>{errorMsg}</div>
            )}

            {/* Bouton micro */}
            <div style={styles.micWrap}>
              <button
                style={{
                  ...styles.micBtn,
                  ...(listening ? styles.micActive : {}),
                }}
                onClick={toggle}
                aria-label={listening ? 'Arrêter' : 'Commencer à dicter'}
              >
                {/* Icône reflète l'ÉTAT (pas l'action) :
                    écoute active = Mic ouvert (cohérent avec micActive rouge + pulse)
                    inactif       = MicOff (= micro fermé) */}
                {listening ? <Mic size={28} /> : <MicOff size={28} />}
              </button>
              <p style={styles.micHint}>
                {listening ? 'Parle maintenant… clique pour arrêter' : 'Clique pour commencer à dicter'}
              </p>
              {listening && (
                <div style={styles.pulse} aria-hidden="true">
                  <style>{`
                    @keyframes dictationPulseDot {
                      0%, 100% { transform: scale(1);   opacity: .35; }
                      50%      { transform: scale(1.4); opacity: 1; }
                    }
                    .dictation-pulse-dot {
                      width: 8px; height: 8px; border-radius: 50%;
                      background: #C0392B;
                      animation: dictationPulseDot 1.1s ease-in-out infinite;
                    }
                    .dictation-pulse-dot:nth-child(2) { animation-delay: .15s; }
                    .dictation-pulse-dot:nth-child(3) { animation-delay: .30s; }
                  `}</style>
                  <span className="dictation-pulse-dot" />
                  <span className="dictation-pulse-dot" />
                  <span className="dictation-pulse-dot" />
                </div>
              )}
            </div>

            {/* Texte transcrit — interim affiché une seule fois, en gris */}
            <div style={styles.textBox}>
              {accumulated
                ? <>{accumulated}<span style={styles.interim}>{interim}</span></>
                : interim
                  ? <span style={styles.interim}>{interim}</span>
                  : <span style={styles.placeholder}>Le texte dicté apparaîtra ici…</span>
              }
            </div>

            {/* Actions */}
            <div style={styles.actions}>
              <button style={styles.clearBtn} onClick={handleClear}>
                Effacer
              </button>
              <button
                style={{ ...styles.insertBtn, opacity: displayText.trim() ? 1 : .5 }}
                onClick={handleInsert}
                disabled={!displayText.trim()}
              >
                <Check size={16} /> Insérer dans le chapitre
              </button>
            </div>
          </>
        )}
    </Modal>
  )
}
const styles = {
  warn: {
    background: '#FFF3E0', border: '1px solid #FFB74D',
    borderRadius: 10, padding: 14,
    fontSize: '.82rem', color: '#E65100', lineHeight: 1.6,
    marginBottom: 12,
  },
  micWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, margin: '20px 0' },
  micBtn: {
    width: 80, height: 80, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#FAF7F2', border: '3px solid #DDD5C8',
    color: '#8B6445', cursor: 'pointer',
    transition: 'all .2s', boxShadow: '0 4px 16px rgba(139,100,69,.1)',
  },
  micActive: {
    background: 'linear-gradient(135deg, #C0392B, #E74C3C)',
    borderColor: '#C0392B', color: '#fff',
    boxShadow: '0 4px 24px rgba(192,57,43,.4)',
  },
  micHint: { fontSize: '.8rem', color: '#9C8878', textAlign: 'center' },
  pulse: { display: 'flex', gap: 5, alignItems: 'center' },
  textBox: {
    minHeight: 100,
    background: '#FAF7F2', border: '1.5px solid #EDE7DE',
    borderRadius: 12, padding: '12px 16px',
    fontFamily: "'Lora', serif", fontSize: '.9rem', lineHeight: 1.7,
    color: '#2A1A0E', marginBottom: 16,
    whiteSpace: 'pre-wrap',
  },
  placeholder: { color: '#9C8878', fontStyle: 'italic' },
  interim: { color: '#9C8878', fontStyle: 'italic' },
  actions: { display: 'flex', gap: 10 },
  clearBtn: {
    padding: '9px 16px',
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
}
