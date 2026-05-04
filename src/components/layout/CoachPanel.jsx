import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Volume2, VolumeX, Trash2, Scissors, BookOpen, Mic, MicOff, Loader } from 'lucide-react'
import { useRecorder } from '../../hooks/useRecorder'
import { transcribeWhisper } from '../../lib/claude'

export default function CoachPanel({ coach, hasKey, currentChapter, chatHistory, password }) {
  const [input,       setInput]       = useState('')
  const [voiceState,  setVoiceState]  = useState('idle') // idle | recording | transcribing
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  const { loading, streaming, voiceOn, toggleVoice, sendMessage, findThread } = coach
  const rec = useRecorder()

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

  // ── Micro "Parler à Léa" ──────────────────────────────────
  const handleMicClick = useCallback(async () => {
    if (voiceState === 'idle') {
      // Démarrer l'enregistrement
      try {
        await rec.start()
        setVoiceState('recording')
      } catch {
        setVoiceState('idle')
      }
    } else if (voiceState === 'recording') {
      // Arrêter et transcrire
      setVoiceState('transcribing')
      const result = await rec.stop()
      if (!result?.blob) { setVoiceState('idle'); return }
      try {
        const text = await transcribeWhisper({ password, blob: result.blob, mimeType: result.mimeType })
        setInput(text.trim())
        setVoiceState('idle')
        setTimeout(() => inputRef.current?.focus(), 50)
      } catch {
        setVoiceState('idle')
      }
    }
  }, [voiceState, rec, password])

  const cancelMic = useCallback(() => {
    rec.cancel()
    setVoiceState('idle')
  }, [rec])

  const micIcon = voiceState === 'recording'
    ? <MicOff size={15} />
    : voiceState === 'transcribing'
    ? <Loader size={15} style={{ animation: 'spin .8s linear infinite' }} />
    : <Mic size={15} />

  const micTitle = voiceState === 'recording'
    ? `🔴 ${rec.durationFmt} — cliquer pour envoyer`
    : voiceState === 'transcribing'
    ? 'Transcription…'
    : 'Parler à Léa'

  return (
    <aside style={styles.panel}>
      {/* Header */}
      <div style={styles.hdr}>
        <div>
          <div style={styles.hdrTitle}>🌿 Léa</div>
          <div style={styles.hdrSub}>
            {hasKey ? 'Ton coach d\'écriture' : 'En attente du mot de passe'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={styles.iconBtn} onClick={toggleVoice} title={voiceOn ? 'Couper la voix' : 'Activer la voix de Léa'}>
            {voiceOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <button style={styles.iconBtn} onClick={coach.clearChat} title="Effacer la conversation">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={styles.messages}>
        {chatHistory.length === 0 && !loading && (
          <div style={styles.welcome}>
            <div style={styles.welcomeIcon}>🌿</div>
            <p style={styles.welcomeText}>
              Bonjour {currentChapter ? `— je vois que tu travailles sur "${currentChapter.title}"` : ''}.
              Je suis là pour t'aider à écrire. Dis-moi comment tu te sens, ou pose-moi une question.
            </p>
          </div>
        )}

        {chatHistory.map((msg, i) => (
          <div key={i} style={msg.role === 'user' ? styles.userMsg : styles.leaMsg}>
            {msg.role === 'assistant' && <div style={styles.leaAvatar}>L</div>}
            <div style={msg.role === 'user' ? styles.userBubble : styles.leaBubble}>
              {msg.content}
            </div>
          </div>
        ))}

        {(loading || streaming) && (
          <div style={styles.leaMsg}>
            <div style={styles.leaAvatar}>L</div>
            <div style={styles.leaBubble}>
              {streaming || <div className="typing"><span /><span /><span /></div>}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Raccourcis */}
      {currentChapter?.content && (
        <div style={styles.shortcuts}>
          <button style={styles.shortBtn} onClick={handleFindThread} disabled={loading}>
            <Scissors size={12} /> Retrouver le fil
          </button>
          <button
            style={styles.shortBtn}
            onClick={() => sendMessage(`Lis ce que j'ai écrit et dis-moi ce que tu en penses : "${currentChapter.content.slice(0, 600)}"`)}
            disabled={loading}
          >
            <BookOpen size={12} /> Relire avec moi
          </button>
        </div>
      )}

      {/* Input */}
      {hasKey ? (
        <div style={styles.inputArea}>
          {/* Bandeau d'enregistrement */}
          {voiceState === 'recording' && (
            <div style={styles.recBanner}>
              <div style={styles.recDot} />
              <span style={styles.recTimer}>{rec.durationFmt}</span>
              <span style={styles.recHint}>Je t'écoute… clique 🎤 pour finir</span>
              <button style={styles.recCancel} onClick={cancelMic}>Annuler</button>
            </div>
          )}
          {voiceState === 'transcribing' && (
            <div style={styles.recBanner}>
              <Loader size={13} style={{ animation: 'spin .8s linear infinite', color: '#8B6445' }} />
              <span style={styles.recHint}>Transcription en cours…</span>
            </div>
          )}

          <div style={styles.inputWrap}>
            <textarea
              ref={inputRef}
              style={styles.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={voiceState === 'recording' ? '🔴 Enregistrement…' : 'Écris ou parle à Léa…'}
              rows={2}
              disabled={voiceState === 'transcribing'}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
              }}
            />
            {/* Bouton micro */}
            <button
              style={{
                ...styles.micBtn,
                ...(voiceState === 'recording' ? styles.micBtnActive : {}),
                ...(voiceState === 'transcribing' ? styles.micBtnLoading : {}),
              }}
              onClick={handleMicClick}
              title={micTitle}
              disabled={voiceState === 'transcribing'}
            >
              {micIcon}
            </button>
            {/* Bouton envoyer */}
            <button
              style={styles.sendBtn}
              onClick={handleSend}
              disabled={!input.trim() || loading || voiceState !== 'idle'}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.noKey}>
          <p>Configure le mot de passe dans <strong>Réglages</strong> pour activer Léa.</p>
        </div>
      )}
    </aside>
  )
}

const styles = {
  panel:     { width:270, flexShrink:0, background:'#FFFEFB', borderLeft:'1px solid #EDE7DE', display:'flex', flexDirection:'column', overflow:'hidden' },
  hdr:       { padding:'12px 14px', borderBottom:'1px solid #EDE7DE', display:'flex', alignItems:'flex-start', justifyContent:'space-between', background:'#FAF7F2' },
  hdrTitle:  { fontFamily:"'Cormorant Garamond',serif", fontSize:'1.05rem', fontWeight:600, color:'#8B6445' },
  hdrSub:    { fontSize:'.67rem', color:'#9C8878', marginTop:1 },
  iconBtn:   { width:28, height:28, borderRadius:8, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'1.5px solid #EDE7DE', color:'#9C8878', cursor:'pointer', transition:'all .15s' },
  messages:  { flex:1, overflowY:'auto', padding:'12px 12px 8px', display:'flex', flexDirection:'column', gap:10 },
  welcome:   { background:'#F7EFE3', borderRadius:14, padding:14, textAlign:'center' },
  welcomeIcon: { fontSize:'1.4rem', marginBottom:6 },
  welcomeText: { fontFamily:"'Lora',serif", fontStyle:'italic', fontSize:'.82rem', color:'#6B5A4E', lineHeight:1.6 },
  userMsg:   { display:'flex', justifyContent:'flex-end' },
  leaMsg:    { display:'flex', gap:8, alignItems:'flex-start' },
  userBubble:{ background:'linear-gradient(135deg,#8B6445,#C4956A)', color:'#fff', borderRadius:'14px 14px 4px 14px', padding:'9px 13px', maxWidth:'85%', fontFamily:"'Nunito',sans-serif", fontSize:'.83rem', lineHeight:1.5 },
  leaBubble: { background:'#FAF7F2', border:'1px solid #EDE7DE', borderRadius:'4px 14px 14px 14px', padding:'9px 13px', maxWidth:'85%', fontFamily:"'Lora',serif", fontStyle:'italic', fontSize:'.83rem', lineHeight:1.6, color:'#2A1A0E', whiteSpace:'pre-wrap' },
  leaAvatar: { width:26, height:26, borderRadius:'50%', background:'linear-gradient(135deg,#6B8F71,#8B6445)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Cormorant Garamond',serif", fontSize:'.9rem', fontWeight:600, flexShrink:0 },
  shortcuts: { display:'flex', gap:6, padding:'6px 12px', borderTop:'1px solid #EDE7DE' },
  shortBtn:  { flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:5, padding:'6px 8px', background:'#FAF7F2', border:'1.5px solid #EDE7DE', borderRadius:8, fontSize:'.7rem', fontWeight:700, fontFamily:"'Nunito',sans-serif", color:'#8B6445', cursor:'pointer', transition:'all .15s' },
  inputArea: { borderTop:'1px solid #EDE7DE' },
  recBanner: { display:'flex', alignItems:'center', gap:7, padding:'6px 12px', background:'#FFF3E0', borderBottom:'1px solid #FFD599', fontSize:'.72rem', fontFamily:"'Nunito',sans-serif" },
  recDot:    { width:8, height:8, borderRadius:'50%', background:'#C0392B', flexShrink:0, animation:'recBlink 1.2s ease infinite' },
  recTimer:  { fontWeight:800, color:'#C0392B', letterSpacing:1 },
  recHint:   { flex:1, color:'#8B6445' },
  recCancel: { background:'none', border:'none', color:'#9C8878', fontSize:'.7rem', cursor:'pointer', fontFamily:"'Nunito',sans-serif", padding:0 },
  inputWrap: { display:'flex', alignItems:'flex-end', gap:5, padding:'8px 10px 10px' },
  input:     { flex:1, padding:'8px 11px', border:'1.5px solid #EDE7DE', borderRadius:10, fontFamily:"'Nunito',sans-serif", fontSize:'.82rem', background:'#FAF7F2', color:'#2A1A0E', outline:'none', resize:'none', lineHeight:1.5, caretColor:'#8B6445' },
  micBtn:    { width:34, height:34, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', background:'#FAF7F2', border:'1.5px solid #EDE7DE', color:'#8B6445', cursor:'pointer', flexShrink:0, transition:'all .2s' },
  micBtnActive:  { background:'linear-gradient(135deg,#C0392B,#E74C3C)', borderColor:'#C0392B', color:'#fff', boxShadow:'0 2px 10px rgba(192,57,43,.35)' },
  micBtnLoading: { opacity:.6, cursor:'not-allowed' },
  sendBtn:   { width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#8B6445,#C4956A)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', border:'none', cursor:'pointer', transition:'filter .15s', flexShrink:0 },
  noKey:     { padding:'10px 14px', borderTop:'1px solid #EDE7DE', background:'#F7EFE3', fontSize:'.78rem', color:'#8B6445', lineHeight:1.5, textAlign:'center' },
}
