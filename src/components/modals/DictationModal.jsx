import { useEffect } from 'react'
import { Mic, MicOff, Check, X } from 'lucide-react'
import { useVoice } from '../../hooks/useVoice'

export default function DictationModal({ onClose, onInsert }) {
  const voice = useVoice({
    onResult: (text) => {
      // Accumule dans le textarea via state géré localement
    }
  })

  // Accumuler le texte dicté
  const [accumulated, setAccumulated] = window.__dictAccum__ || [[], null]

  // Hack simple : utiliser un ref dans le parent — ici on gère localement
  const [dictText, setDictText] = [
    window.__dictText__ || '',
    (t) => { window.__dictText__ = t }
  ]

  // Meilleure approche : re-déclencher useVoice avec callback accumulateur
  const { listening, interim, supported, toggle, stop } = useVoice({
    onResult: (text) => {
      window.__dictAcc__ = (window.__dictAcc__ || '') + text
    }
  })

  const getText = () => (window.__dictAcc__ || '') + (interim || '')

  const handleInsert = () => {
    const text = getText().trim()
    if (text) onInsert(text)
    window.__dictAcc__ = ''
    if (listening) stop()
    onClose()
  }

  useEffect(() => {
    window.__dictAcc__ = ''
    return () => {
      window.__dictAcc__ = ''
      stop()
    }
  }, [])

  const displayText = getText()

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
                style={{
                  ...styles.micBtn,
                  ...(listening ? styles.micActive : {}),
                }}
                onClick={toggle}
                aria-label={listening ? 'Arrêter' : 'Commencer à dicter'}
              >
                {listening ? <MicOff size={28} /> : <Mic size={28} />}
              </button>
              <p style={styles.micHint}>
                {listening ? 'Parle maintenant… clique pour arrêter' : 'Clique pour commencer à dicter'}
              </p>
              {listening && (
                <div style={styles.pulse}>
                  <span /><span /><span />
                </div>
              )}
            </div>

            {/* Texte transcrit */}
            <div style={styles.textBox}>
              {displayText || <span style={styles.placeholder}>Le texte dicté apparaîtra ici…</span>}
              {interim && <span style={styles.interim}>{interim}</span>}
            </div>

            {/* Actions */}
            <div style={styles.actions}>
              <button
                style={styles.clearBtn}
                onClick={() => { window.__dictAcc__ = '' }}
              >
                Effacer
              </button>
              <button
                style={{ ...styles.insertBtn, opacity: displayText ? 1 : .5 }}
                onClick={handleInsert}
                disabled={!displayText}
              >
                <Check size={16} /> Insérer dans le chapitre
              </button>
            </div>
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
  pulse: {
    display: 'flex', gap: 5, alignItems: 'center',
  },
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
