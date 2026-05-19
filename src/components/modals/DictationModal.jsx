import { useState, useEffect, useCallback, useRef } from 'react'

import Modal from '../ui/Modal'
import {
  Microphone as Mic,
  MicrophoneSlash as MicOff,
  Check,
  X,
  ArrowCounterClockwise as RotateCcw,
} from '@phosphor-icons/react'
import { useVoice } from '../../hooks/useVoice'
// LOT 4D.1 — auto-save dictée dans IndexedDB (KV store) pour résister aux crashs/veille tueuse
import { getKV, setKV } from '../../lib/db'

const DRAFT_KEY = 'dictation_draft'
const AUTOSAVE_DEBOUNCE_MS = 500

export default function DictationModal({ onClose, onInsert }) {
  const [accumulated, setAccumulated] = useState('')
  // LOT 4D.1 — bandeau "Reprendre / Effacer" si un draft a été trouvé au mount
  const [pendingDraft, setPendingDraft] = useState(null)
  const saveTimerRef = useRef(null)
  // Verrou pour ne pas écraser un draft existant tant que l'utilisateur n'a pas tranché Reprendre/Effacer
  const draftDecisionMadeRef = useRef(false)

  const handleResult = useCallback((text) => {
    setAccumulated(prev => prev + text)
  }, [])

  const { listening, interim, errorMsg, supported, toggle, stop, wakeLockState } = useVoice({
    onResult: handleResult,
  })

  // LOT 4D.1 — Au mount, lire un draft éventuel et le proposer (pas d'auto-restore silencieux)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const saved = await getKV(DRAFT_KEY, '')
        if (!cancelled && typeof saved === 'string' && saved.trim()) {
          setPendingDraft(saved)
        } else {
          // Pas de draft à proposer → l'utilisateur peut écrire librement
          draftDecisionMadeRef.current = true
        }
      } catch (_) {
        draftDecisionMadeRef.current = true
      }
    })()
    return () => { cancelled = true }
  }, [])

  // LOT 4D.1 — Auto-save debounced à chaque update de accumulated, mais SEULEMENT
  // après que l'utilisateur ait décidé du sort d'un éventuel draft (sinon on l'écrase).
  useEffect(() => {
    if (!draftDecisionMadeRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      // accumulated peut être vide → on écrit '' (équivalent à clear logique du draft)
      setKV(DRAFT_KEY, accumulated).catch(() => {})
    }, AUTOSAVE_DEBOUNCE_MS)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [accumulated])

  useEffect(() => {
    return () => { stop() }
  }, [stop])

  const displayText = accumulated + (interim || '')

  // LOT 4D.1 — Vider explicitement le draft persisté (insert, effacement manuel, restore "Effacer")
  const clearDraftStorage = useCallback(async () => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }
    try { await setKV(DRAFT_KEY, '') } catch (_) {}
  }, [])

  const handleInsert = async () => {
    const text = displayText.trim()
    if (text) onInsert(text)
    if (listening) stop()
    await clearDraftStorage()
    onClose()
  }

  const handleClear = async () => {
    setAccumulated('')
    await clearDraftStorage()
  }

  // LOT 4D.1 — bandeau actions
  const handleResumeDraft = () => {
    if (pendingDraft) setAccumulated(pendingDraft)
    setPendingDraft(null)
    draftDecisionMadeRef.current = true
  }
  const handleDiscardDraft = async () => {
    setPendingDraft(null)
    draftDecisionMadeRef.current = true
    await clearDraftStorage()
  }

  return (
    <Modal
      onClose={onClose}
      ariaLabel="Dictée vocale"
      overlayClassName="modal-bg"
      modalClassName="modal-box"
    >
      <style>{`
        @keyframes dictationMicHalo {
          0%, 100% {
            transform: scale(1);
            box-shadow:
              0 0 0 0 rgba(192,57,43,0.00),
              0 4px 22px rgba(192,57,43,0.40);
          }
          50% {
            transform: scale(1.08);
            box-shadow:
              0 0 0 14px rgba(192,57,43,0.18),
              0 6px 30px rgba(192,57,43,0.60);
          }
        }
      `}</style>

      <button className="modal-close" onClick={onClose} aria-label="Fermer la dictée">
        <X size={16} />
      </button>
      <h2 className="modal-title">🎤 Dicter</h2>

      {/* LOT 4D.1 — bandeau "Reprendre / Effacer" si un draft a été retrouvé */}
      {pendingDraft && (
        <div style={styles.draftBanner}>
          <div style={styles.draftBannerIcon}><RotateCcw size={16} /></div>
          <div style={styles.draftBannerText}>
            <strong>Une dictée précédente a été retrouvée.</strong>
            <span style={styles.draftBannerHint}>
              {pendingDraft.length > 80 ? pendingDraft.slice(0, 80) + '…' : pendingDraft}
            </span>
          </div>
          <div style={styles.draftBannerActions}>
            <button style={styles.draftBtnResume} onClick={handleResumeDraft}>Reprendre</button>
            <button style={styles.draftBtnDiscard} onClick={handleDiscardDraft}>Effacer</button>
          </div>
        </div>
      )}

      {/* LOT 4D.1 — info écran : si Wake Lock non dispo / refusé, on conseille */}
      {supported && listening && (wakeLockState === 'unsupported' || wakeLockState === 'denied') && (
        <div style={styles.wakeLockInfo}>
          💡 Garde l'écran allumé pendant la dictée — la mise en veille peut interrompre l'enregistrement.
        </div>
      )}

      {!supported && (
        <div style={styles.warn}>
          La dictée vocale n'est pas disponible sur ce navigateur.<br />
          Utilise <strong>Chrome</strong> ou <strong>Edge</strong>.
        </div>
      )}

      {supported && (
        <>
          {errorMsg && (
            <div style={styles.warn}>{errorMsg}</div>
          )}

          <div style={styles.micWrap}>
            <button
              style={{
                ...styles.micBtn,
                ...(listening ? styles.micActive : {}),
              }}
              onClick={toggle}
              aria-label={listening ? 'Arrêter' : 'Commencer à dicter'}
            >
              {listening ? <Mic size={28} /> : <MicOff size={28} />}
            </button>

            <p style={styles.micHint}>
              {listening ? 'Parle maintenant… clique pour arrêter' : 'Clique pour commencer à dicter'}
            </p>
          </div>

          <div style={styles.textBox}>
            {accumulated
              ? <>{accumulated}<span style={styles.interim}>{interim}</span></>
              : interim
                ? <span style={styles.interim}>{interim}</span>
                : <span style={styles.placeholder}>Le texte dicté apparaîtra ici…</span>
            }
          </div>

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
    background: '#FFF3E0',
    border: '1px solid #FFB74D',
    borderRadius: 10,
    padding: 14,
    fontSize: '.82rem',
    color: '#E65100',
    lineHeight: 1.6,
    marginBottom: 12,
  },
  // LOT 4D.1 — bandeau reprise dictée
  draftBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: '#FFF8E7',
    border: '1.5px solid #E5C46B',
    borderRadius: 12,
    padding: '12px 14px',
    marginBottom: 14,
  },
  draftBannerIcon: {
    color: '#9C7A1F',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  },
  draftBannerText: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontFamily: "'Nunito', sans-serif",
    fontSize: '.78rem',
    color: '#5C4A1F',
    lineHeight: 1.4,
    minWidth: 0,
  },
  draftBannerHint: {
    fontSize: '.72rem',
    color: '#8B7A4A',
    fontStyle: 'italic',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  draftBannerActions: {
    display: 'flex',
    gap: 6,
    flexShrink: 0,
  },
  draftBtnResume: {
    padding: '6px 12px',
    background: 'linear-gradient(135deg, #6B8F71, #8B6445)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: '.78rem',
    fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer',
  },
  draftBtnDiscard: {
    padding: '6px 12px',
    background: 'transparent',
    border: '1.5px solid #D4C4A8',
    borderRadius: 8,
    fontSize: '.78rem',
    fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    color: '#8B7355',
    cursor: 'pointer',
  },
  // LOT 4D.1 — bandeau info Wake Lock indisponible
  wakeLockInfo: {
    background: '#EEF4EC',
    border: '1px solid #9DB89A',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: '.78rem',
    color: '#3D6B45',
    lineHeight: 1.5,
    marginBottom: 12,
  },
  micWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    margin: '20px 0',
  },
  micBtn: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#FAF7F2',
    border: '3px solid #DDD5C8',
    color: '#8B6445',
    cursor: 'pointer',
    transition: 'all .2s',
    boxShadow: '0 4px 16px rgba(139,100,69,.1)',
  },
  micActive: {
    background: 'linear-gradient(135deg, #C0392B, #E74C3C)',
    borderColor: '#C0392B',
    color: '#fff',
    boxShadow: '0 4px 24px rgba(192,57,43,.4)',
    animation: 'dictationMicHalo 1.05s ease-in-out infinite',
    transformOrigin: 'center center',
  },
  micHint: {
    fontSize: '.8rem',
    color: '#9C8878',
    textAlign: 'center',
  },
  textBox: {
    minHeight: 100,
    background: '#FAF7F2',
    border: '1.5px solid #EDE7DE',
    borderRadius: 12,
    padding: '12px 16px',
    fontFamily: "'Lora', serif",
    fontSize: '.9rem',
    lineHeight: 1.7,
    color: '#2A1A0E',
    marginBottom: 16,
    whiteSpace: 'pre-wrap',
  },
  placeholder: {
    color: '#9C8878',
    fontStyle: 'italic',
  },
  interim: {
    color: '#9C8878',
    fontStyle: 'italic',
  },
  actions: {
    display: 'flex',
    gap: 10,
  },
  clearBtn: {
    padding: '9px 16px',
    background: 'transparent',
    border: '1.5px solid #DDD5C8',
    borderRadius: 10,
    fontSize: '.85rem',
    fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    color: '#9C8878',
    cursor: 'pointer',
  },
  insertBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '9px 16px',
    background: 'linear-gradient(135deg, #6B8F71, #8B6445)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: '.85rem',
    fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer',
  },
}
