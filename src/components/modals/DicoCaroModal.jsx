import { useState } from 'react'

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(42,26,14,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '16px',
  },
  modal: {
    background: '#FFFEFB', borderRadius: '12px', width: '100%',
    maxWidth: '520px', boxShadow: '0 20px 60px rgba(42,26,14,0.25)',
    display: 'flex', flexDirection: 'column', maxHeight: '80vh',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 24px 0', borderBottom: '1px solid #EDE7DE',
    paddingBottom: '16px',
  },
  title: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: '22px', fontWeight: 600, color: '#2A1A0E', margin: 0,
  },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: '20px', color: '#9C8878', padding: '4px', lineHeight: 1,
  },
  body: { padding: '20px 24px', flex: 1, overflowY: 'auto' },
  inputRow: { display: 'flex', gap: '10px', marginBottom: '20px' },
  input: {
    flex: 1, padding: '10px 14px', border: '1px solid #DDD5C8',
    borderRadius: '8px', fontSize: '16px', fontFamily: "'Lora', Georgia, serif",
    background: '#FAF7F2', color: '#2A1A0E', outline: 'none',
  },
  searchBtn: {
    padding: '10px 20px', background: '#8B6445', color: '#FFFEFB',
    border: 'none', borderRadius: '8px', cursor: 'pointer',
    fontSize: '15px', fontWeight: 500, whiteSpace: 'nowrap',
  },
  searchBtnDisabled: {
    padding: '10px 20px', background: '#DDD5C8', color: '#9C8878',
    border: 'none', borderRadius: '8px', cursor: 'not-allowed',
    fontSize: '15px', fontWeight: 500, whiteSpace: 'nowrap',
  },
  resultBox: {
    background: '#FAF7F2', borderRadius: '8px', padding: '16px 18px',
    border: '1px solid #EDE7DE', minHeight: '80px',
  },
  resultText: {
    fontFamily: "'Lora', Georgia, serif", fontSize: '16px',
    lineHeight: 1.8, color: '#2A1A0E', margin: 0, whiteSpace: 'pre-wrap',
  },
  placeholder: {
    color: '#9C8878', fontStyle: 'italic', fontSize: '15px',
    fontFamily: "'Lora', Georgia, serif",
  },
  noKey: {
    background: '#FDF3EC', border: '1px solid #E8D5B8', borderRadius: '8px',
    padding: '14px 16px', color: '#8B6445', fontSize: '14px',
    fontFamily: "'Lora', Georgia, serif", lineHeight: 1.6,
  },
}

// defineWord(word) streame via coach.streaming — pas de callback externe
export default function DicoCaroModal({ onClose, defineWord, loading, streaming, hasKey }) {
  const [word, setWord] = useState('')
  const [done, setDone] = useState('')

  const handleSearch = async () => {
    const trimmed = word.trim()
    if (!trimmed || loading) return
    setDone('')
    try {
      const result = await defineWord(trimmed)
      if (result) setDone(result)
    } catch {
      setDone('Léa ne peut pas répondre pour le moment. Vérifie ta connexion.')
    }
  }

  const handleKey = (e) => { if (e.key === 'Enter') handleSearch() }

  // Affiche le streaming en cours, puis le résultat final
  const display = loading ? streaming : done

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>✒️ Vocabulaire</h2>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Fermer">✕</button>
        </div>

        <div style={styles.body}>
          {!hasKey ? (
            <div style={styles.noKey}>
              Configure le mot de passe dans Réglages pour activer le vocabulaire avec Léa.
            </div>
          ) : (
            <>
              <div style={styles.inputRow}>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="Un mot, une expression..."
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  onKeyDown={handleKey}
                  autoFocus
                />
                <button
                  style={loading || !word.trim() ? styles.searchBtnDisabled : styles.searchBtn}
                  onClick={handleSearch}
                  disabled={loading || !word.trim()}
                >
                  {loading ? '...' : 'Chercher'}
                </button>
              </div>

              <div style={styles.resultBox}>
                {display ? (
                  <p style={styles.resultText}>{display}</p>
                ) : (
                  <p style={styles.placeholder}>
                    Tape un mot pour que Léa te l&apos;explique avec des exemples.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
