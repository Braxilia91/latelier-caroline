import { useState, useRef, useEffect } from 'react'
import { Send, Volume2, VolumeX, Trash2, Scissors, BookOpen, AlertCircle, Lightbulb, Play, Pause, Square } from 'lucide-react'
import { LEA_COMMANDS } from '../../lib/commands'

export default function CoachPanel({
  coach, hasKey, currentChapter, chatHistory, welcomeMsg, onOpenVrac,
  isOnline = true,
  isMobile, isOpen, onClose: _onClose,
}) {
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const {
    loading, streaming, voiceOn, toggleVoice, sendMessage,
    findThread, expressDoubt, removeMessage,
    ttsState, ttsPlay, ttsPause, ttsStop, ttsSetSpeed,
  } = coach

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory, streaming])

  const handleSend = async () => {
    const txt = input.trim()
    if (!txt || loading) return
    setInput('')
    await sendMessage(txt)
  }

  const handleFindThread = async () => {
    if (!currentChapter?.content) return
    await findThread(currentChapter.content)
  }

  // L4-1 — Confirmation avant action destructive (effacement du chat)
  const handleClearChat = () => {
    if (!coach.clearChat) return
    if (chatHistory.length === 0) {
      coach.clearChat()
      return
    }
    const ok = window.confirm(
      'Effacer toute la conversation avec Léa ?\n\nCette action est irréversible — tes échanges seront perdus.'
    )
    if (ok) coach.clearChat()
  }

  // LOT 4C.2 — Suppression d'un message individuel (avec garde-fou loading)
  const handleDeleteMessage = (id) => {
    if (loading) return                 // garde-fou défense en profondeur
    if (id == null) return
    if (!removeMessage) return
    const ok = window.confirm('Supprimer ce message ?')
    if (ok) removeMessage(id)
  }

  const playerVisible = voiceOn && (ttsState?.playing || ttsState?.paused)
  const SPEEDS = [0.75, 1.0, 1.25, 1.5]

  const computedStyle = isMobile
    ? {
        ...styles.panelBase,
        ...styles.panelMobile,
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
      }
    : {
        ...styles.panelBase,
        ...styles.panelDesktop,
      }

  return (
    <aside style={computedStyle}>
      {/* Header */}
      <div style={styles.hdr}>
        <div>
          <div style={styles.hdrTitle}>🌿 Léa</div>
          <div style={styles.hdrSub}>
            {hasKey ? "Ton coach d'écriture" : 'En attente de ta clé API'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={styles.iconBtn} onClick={toggleVoice} title={voiceOn ? 'Couper la voix' : 'Activer la voix'} aria-label={voiceOn ? 'Couper la voix de Léa' : 'Activer la voix de Léa'}>
            {voiceOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <button style={styles.iconBtn} onClick={handleClearChat} title="Effacer la conversation" aria-label="Effacer la conversation avec Léa">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={styles.messages}>
        {chatHistory.length === 0 && !loading && (
          <div style={styles.welcome}>
            <div style={styles.welcomeIcon}>🌿</div>
            <p className="chat-welcome-text" style={styles.welcomeText}>
              {welcomeMsg || `Je suis là pour t'aider à écrire. Dis-moi comment tu te sens, ou pose-moi une question.`}
            </p>
          </div>
        )}
        {chatHistory.map((msg, i) => (
          <div
            key={msg.id ?? msg.timestamp ?? `${msg.role}-${i}-${String(msg.content).slice(0, 12)}`}
            style={msg.role === 'user' ? styles.userMsg : styles.leaMsg}
          >
            {msg.role === 'assistant' && <div style={styles.leaAvatar}>L</div>}
            <div
              className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-lea'}
              style={msg.role === 'user' ? styles.userBubble : styles.leaBubble}
            >
              {msg.content}
            </div>
            {/* LOT 4C.2 — Bouton supprimer (visible si id DB connu, désactivé pendant loading) */}
            {msg.id != null && (
              <button
                type="button"
                style={{
                  ...styles.delBubbleBtn,
                  opacity: loading ? 0.2 : (isMobile ? 1.0 : 0.65),
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
                onClick={() => handleDeleteMessage(msg.id)}
                disabled={loading}
                title="Supprimer ce message"
                aria-label="Supprimer ce message"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        ))}
        {(loading || streaming) && (
          <div style={styles.leaMsg}>
            <div style={styles.leaAvatar}>L</div>
            <div className="chat-bubble-lea" style={styles.leaBubble}>
              {streaming || (
                <div className="typing">
                  <span /><span /><span />
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Player TTS — visible quand voix active et audio en cours */}
      {playerVisible && (
        <div style={styles.player}>
          <button
            style={styles.playerBtn}
            onClick={ttsState?.paused ? ttsPlay : ttsPause}
            title={ttsState?.paused ? 'Reprendre' : 'Pause'}
            aria-label={ttsState?.paused ? 'Reprendre' : 'Pause'}
          >
            {ttsState?.paused ? <Play size={13} /> : <Pause size={13} />}
          </button>
          <button
            style={styles.playerBtn}
            onClick={ttsStop}
            title="Stop"
            aria-label="Stop"
          >
            <Square size={12} />
          </button>
          <div style={styles.speedGroup}>
            {SPEEDS.map(s => (
              <button
                key={s}
                style={{
                  ...styles.speedBtn,
                  ...(ttsState?.speed === s ? styles.speedBtnActive : {}),
                }}
                onClick={() => ttsSetSpeed(s)}
                title={`Vitesse ${s}x`}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Raccourcis */}
      <div style={styles.shortcuts}>
        {currentChapter?.content && (
          <>
            <button className="chat-shortcut" style={styles.shortBtn} onClick={handleFindThread} disabled={loading} title="Léa résume et relance l'écriture">
              <Scissors size={12} /> Retrouver le fil
            </button>
            <button
              className="chat-shortcut"
              style={styles.shortBtn}
              onClick={() => sendMessage(LEA_COMMANDS.RELIRE(currentChapter.content))}
              disabled={loading}
              title="Léa relit et commente"
            >
              <BookOpen size={12} /> Relire
            </button>
            <button
              className="chat-shortcut"
              style={{ ...styles.shortBtn, ...styles.doubtBtn }}
              onClick={() => expressDoubt(currentChapter.content)}
              disabled={loading}
              title="Léa analyse ton passage sur 5 angles bienveillants"
            >
              <AlertCircle size={12} /> Je doute
            </button>
          </>
        )}
        <button
          className="chat-shortcut"
          style={{ ...styles.shortBtn, ...styles.vracBtn }}
          onClick={onOpenVrac}
          title="Dépose tes idées pêle-mêle"
        >
          <Lightbulb size={12} /> Ma tête
        </button>
      </div>

      {/* Input */}
      {!hasKey ? (
        <div style={styles.noKey}>
          <p>Ajoute ta clé API dans <strong>Réglages</strong> pour activer Léa.</p>
        </div>
      ) : !isOnline ? (
        <div style={styles.offline}>
          <p>🌿 Léa est hors ligne — ton écriture est sauvegardée localement.</p>
        </div>
      ) : (
        <div style={styles.inputWrap}>
          <textarea
            ref={inputRef}
            className="chat-input"
            style={styles.input}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Écris à Léa…"
            rows={2}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
            }}
          />
          <button style={styles.sendBtn} onClick={handleSend} disabled={!input.trim() || loading} aria-label="Envoyer à Léa">
            <Send size={15} />
          </button>
        </div>
      )}
    </aside>
  )
}

// LOT 3.5 — Toutes les fontSize du chat sont multipliées par var(--chat-scale).
// Default --chat-scale = 1 (taille actuelle). Réglable via SettingsModal.
const styles = {
  panelBase: {
    background: 'var(--paper)',
    borderLeft: '1px solid var(--border-l)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  // LOT 4E.2 bis — Largeur pilotée par CSS var --coach-w (default 270px).
  // Mobile : globals.css force --coach-w à 0px, mais panelMobile override
  // ci-dessous avec width: 320 hardcodé (jamais touché).
  panelDesktop: {
    width: 'var(--coach-w, 270px)',
    flexShrink: 0,
  },
  panelMobile: {
    position: 'fixed',
    top: 52,
    bottom: 0,
    right: 0,
    width: 320,
    zIndex: 100,
    transition: 'transform 0.25s ease-out',
    boxShadow: '-4px 0 16px rgba(0,0,0,0.1)',
  },
  hdr: {
    padding: '12px 14px',
    borderBottom: '1px solid var(--border-l)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    background: 'var(--cream)',
  },
  hdrTitle: { fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', fontWeight: 600, color: 'var(--brown)' },
  hdrSub: { fontSize: '.67rem', color: 'var(--ink-ll)', marginTop: 1 },
  iconBtn: {
    width: 28, height: 28,
    borderRadius: 8,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent', border: '1.5px solid var(--border-l)',
    color: 'var(--ink-ll)', cursor: 'pointer', transition: 'all .15s',
  },
  messages: {
    flex: 1, overflowY: 'auto',
    padding: '12px 12px 8px',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  welcome: {
    background: 'var(--gold-ll)',
    borderRadius: 14, padding: '14px',
    textAlign: 'center',
  },
  welcomeIcon: { fontSize: '1.4rem', marginBottom: 6 },
  welcomeText: {
    fontFamily: "'Lora', serif", fontStyle: 'italic',
    fontSize: 'calc(.82rem * var(--chat-scale, 1))',
    color: 'var(--ink-l)', lineHeight: 1.6,
  },
  userMsg: { display: 'flex', justifyContent: 'flex-end' },
  leaMsg: { display: 'flex', gap: 8, alignItems: 'flex-start' },
  userBubble: {
    background: 'linear-gradient(135deg, var(--brown), var(--gold))',
    color: '#fff', borderRadius: '14px 14px 4px 14px',
    padding: '9px 13px',
    maxWidth: '92%',
    fontFamily: "'Nunito', sans-serif",
    fontSize: 'calc(.83rem * var(--chat-scale, 1))',
    lineHeight: 1.5,
  },
  leaBubble: {
    background: 'var(--cream)', border: '1px solid var(--border-l)',
    borderRadius: '4px 14px 14px 14px',
    padding: '9px 13px',
    maxWidth: '92%',
    fontFamily: "'Lora', serif", fontStyle: 'italic',
    fontSize: 'calc(.83rem * var(--chat-scale, 1))',
    lineHeight: 1.6, color: 'var(--ink)',
    whiteSpace: 'pre-wrap',
  },
  leaAvatar: {
    width: 26, height: 26,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6B8F71, #8B6445)',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '.9rem', fontWeight: 600, flexShrink: 0,
  },
  // LOT 4C.2 — bouton supprimer message (opacité gérée inline pour adaptation mobile/desktop)
  delBubbleBtn: {
    background: 'transparent',
    border: 'none',
    color: '#A09070',
    padding: 4,
    marginLeft: 4,
    transition: 'opacity .15s, color .15s, background .15s',
    flexShrink: 0,
    borderRadius: 6,
    alignSelf: 'flex-start',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Player TTS ───────────────────────────────────────────────
  player: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 10px',
    borderTop: '1px solid var(--border-l)',
    background: 'var(--gold-ll)',
  },
  playerBtn: {
    width: 28, height: 28,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--paper)',
    border: '1.5px solid var(--border-l)',
    borderRadius: 8,
    color: 'var(--brown)',
    cursor: 'pointer',
    transition: 'all .15s',
    flexShrink: 0,
  },
  speedGroup: {
    display: 'flex', gap: 3, marginLeft: 'auto',
  },
  speedBtn: {
    padding: '3px 7px',
    background: 'var(--paper)',
    border: '1.5px solid var(--border-l)',
    borderRadius: 6,
    fontSize: '.66rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    color: 'var(--ink-l)',
    cursor: 'pointer',
    transition: 'all .15s',
  },
  speedBtnActive: {
    background: 'var(--brown)',
    border: '1.5px solid var(--brown)',
    color: '#fff',
  },
  // ── Raccourcis ─────────────────────────────────────────────
  shortcuts: {
    display: 'flex', flexWrap: 'wrap', gap: 5, padding: '6px 10px',
    borderTop: '1px solid var(--border-l)',
  },
  shortBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    padding: '7px 11px',
    background: 'var(--cream)', border: '1.5px solid var(--border-l)',
    borderRadius: 8,
    fontSize: 'calc(.78rem * var(--chat-scale, 1))',
    fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    color: 'var(--brown)', cursor: 'pointer',
    transition: 'all .15s',
    whiteSpace: 'nowrap',
  },
  doubtBtn: {
    background: '#FEF3E2', border: '1.5px solid #F5C97A',
    color: '#A0620A',
  },
  vracBtn: {
    background: '#EEF4EC', border: '1.5px solid #9DB89A',
    color: '#3D6B45',
  },
  inputWrap: {
    display: 'flex', alignItems: 'flex-end', gap: 6,
    padding: '8px 12px 12px',
    borderTop: '1px solid var(--border-l)',
  },
  input: {
    flex: 1,
    padding: '8px 11px',
    border: '1.5px solid var(--border-l)',
    borderRadius: 10,
    fontFamily: "'Nunito', sans-serif",
    fontSize: 'calc(.82rem * var(--chat-scale, 1))',
    background: 'var(--cream)', color: 'var(--ink)',
    outline: 'none', resize: 'none',
    lineHeight: 1.5,
    caretColor: 'var(--brown)',
  },
  sendBtn: {
    width: 36, height: 36,
    borderRadius: 10,
    background: 'linear-gradient(135deg, var(--brown), var(--gold))',
    color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: 'none', cursor: 'pointer',
    transition: 'filter .15s', flexShrink: 0,
  },
  noKey: {
    padding: '10px 14px',
    borderTop: '1px solid var(--border-l)',
    background: 'var(--gold-ll)',
    fontSize: '.78rem', color: 'var(--brown)', lineHeight: 1.5,
    textAlign: 'center',
  },
  offline: {
    padding: '10px 14px',
    borderTop: '1px solid var(--border-l)',
    background: '#FEF3E2',
    border: '1px solid #F5C97A',
    fontSize: '.78rem', color: '#92400E', lineHeight: 1.5,
    textAlign: 'center',
  },
}
