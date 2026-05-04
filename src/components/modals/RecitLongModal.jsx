import { useState, useCallback } from 'react'
import { X, Mic, Square, RotateCcw, Check, BookOpen, FileText } from 'lucide-react'
import { useRecorder } from '../../hooks/useRecorder'
import { transcribeWhisper } from '../../lib/claude'

// États de la modal
const STATES = { IDLE: 'idle', RECORDING: 'recording', PROCESSING: 'processing', DONE: 'done', ERROR: 'error' }

export default function RecitLongModal({ onClose, onInsert, password }) {
  const [phase, setPhase]   = useState(STATES.IDLE)
  const [text,  setText]    = useState('')
  const [error, setError]   = useState('')

  const rec = useRecorder()

  const handleStart = useCallback(async () => {
    setError('')
    try {
      await rec.start()
      setPhase(STATES.RECORDING)
    } catch {
      setError('Impossible d\'accéder au microphone. Vérifie les permissions du navigateur.')
      setPhase(STATES.ERROR)
    }
  }, [rec])

  const handleStop = useCallback(async () => {
    setPhase(STATES.PROCESSING)
    const result = await rec.stop()
    if (!result?.blob) { setPhase(STATES.IDLE); return }

    try {
      const transcription = await transcribeWhisper({ password, blob: result.blob, mimeType: result.mimeType })
      setText(transcription)
      setPhase(STATES.DONE)
    } catch (err) {
      setError(err.message || 'Transcription échouée. Réessaie.')
      setPhase(STATES.ERROR)
    }
  }, [rec, password])

  const handleReset = useCallback(() => {
    rec.cancel()
    setText('')
    setError('')
    setPhase(STATES.IDLE)
  }, [rec])

  const handleInsertChapter = () => {
    if (text.trim()) onInsert(text.trim(), 'chapter')
    onClose()
  }

  const handleInsertDraft = () => {
    if (text.trim()) onInsert(text.trim(), 'draft')
    onClose()
  }

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && !rec.recording && onClose()}>
      <div className="modal-box" style={{ maxWidth: 480 }}>
        <button className="modal-close" onClick={() => { rec.cancel(); onClose() }}><X size={16} /></button>
        <h2 className="modal-title">📖 Raconter un souvenir</h2>

        {/* ── IDLE ──────────────────────────────────────────── */}
        {phase === STATES.IDLE && (
          <div style={s.center}>
            {!rec.supported ? (
              <div style={s.warn}>
                L'enregistrement audio n'est pas disponible sur ce navigateur.<br />
                Utilise <strong>Chrome</strong> ou <strong>Edge</strong>.
              </div>
            ) : (
              <>
                <p style={s.intro}>
                  Prends ton temps.<br />
                  Raconte ce dont tu te souviens,<br />
                  même en désordre — c'est pour ça que c'est précieux.
                </p>
                <button style={s.bigMic} onClick={handleStart}>
                  <Mic size={36} />
                </button>
                <p style={s.hint}>Clique pour commencer à raconter</p>
                <p style={s.tip}>🎙 Jusqu'à 20 minutes · pauses autorisées</p>
              </>
            )}
          </div>
        )}

        {/* ── RECORDING ─────────────────────────────────────── */}
        {phase === STATES.RECORDING && (
          <div style={s.center}>
            <p style={s.listening}>Je t'écoute…</p>
            <div style={s.timerWrap}>
              <div style={s.recDot} />
              <span style={s.timer}>{rec.durationFmt}</span>
            </div>
            <div style={s.waves}>
              {[0,1,2,3,4].map(i => (
                <div key={i} style={{ ...s.wave, animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            {rec.duration >= 1140 && (
              <p style={s.warnTime}>⚠️ Encore {Math.ceil((1200 - rec.duration) / 60)} min avant la limite</p>
            )}
            <button style={s.stopBtn} onClick={handleStop}>
              <Square size={18} fill="currentColor" /> Arrêter et transcrire
            </button>
            <button style={s.cancelLink} onClick={handleReset}>Annuler sans sauvegarder</button>
          </div>
        )}

        {/* ── PROCESSING ────────────────────────────────────── */}
        {phase === STATES.PROCESSING && (
          <div style={s.center}>
            <div style={s.spinner} />
            <p style={s.processingText}>Transcription en cours…</p>
            <p style={s.hint}>Whisper transcrit ton enregistrement, ça prend quelques secondes.</p>
          </div>
        )}

        {/* ── DONE ──────────────────────────────────────────── */}
        {phase === STATES.DONE && (
          <>
            <p style={s.doneLabel}>✨ Voilà ce que tu as raconté :</p>
            <textarea
              style={s.textArea}
              value={text}
              onChange={e => setText(e.target.value)}
              spellCheck
              lang="fr"
              placeholder="Transcription…"
            />
            <p style={s.editHint}>Tu peux corriger avant d'insérer.</p>
            <div style={s.actions}>
              <button style={s.btnPrimary} onClick={handleInsertChapter} disabled={!text.trim()}>
                <BookOpen size={15} /> Insérer dans le chapitre
              </button>
              <button style={s.btnSecondary} onClick={handleInsertDraft} disabled={!text.trim()}>
                <FileText size={15} /> Sauvegarder en brouillon
              </button>
            </div>
            <button style={s.restartLink} onClick={handleReset}>
              <RotateCcw size={13} /> Recommencer
            </button>
          </>
        )}

        {/* ── ERROR ─────────────────────────────────────────── */}
        {phase === STATES.ERROR && (
          <div style={s.center}>
            <div style={s.errorBox}>{error}</div>
            <button style={s.btnPrimary} onClick={handleReset}>
              <RotateCcw size={15} /> Réessayer
            </button>
          </div>
        )}
      </div>

      {/* Styles d'animation wave */}
      <style>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(0.4); }
          50%       { transform: scaleY(1); }
        }
        @keyframes recBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}

const s = {
  center:        { display:'flex', flexDirection:'column', alignItems:'center', gap:16, padding:'8px 0 4px' },
  intro:         { fontFamily:"'Lora',serif", fontStyle:'italic', color:'#6B5A4E', textAlign:'center', lineHeight:1.8, fontSize:'.9rem' },
  bigMic:        { width:88, height:88, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#8B6445,#C4956A)', color:'#fff', border:'none', cursor:'pointer', boxShadow:'0 6px 24px rgba(139,100,69,.35)', transition:'transform .15s' },
  hint:          { fontSize:'.78rem', color:'#9C8878', textAlign:'center' },
  tip:           { fontSize:'.72rem', color:'#B0A090', background:'#F7EFE3', padding:'5px 14px', borderRadius:20 },
  warn:          { background:'#FFF3E0', border:'1px solid #FFB74D', borderRadius:10, padding:14, fontSize:'.82rem', color:'#E65100', lineHeight:1.6, textAlign:'center' },
  warnTime:      { fontSize:'.76rem', color:'#C0392B', fontWeight:700 },
  listening:     { fontFamily:"'Lora',serif", fontStyle:'italic', color:'#8B6445', fontSize:'1.05rem' },
  timerWrap:     { display:'flex', alignItems:'center', gap:10 },
  recDot:        { width:10, height:10, borderRadius:'50%', background:'#C0392B', animation:'recBlink 1.2s ease infinite' },
  timer:         { fontFamily:"'Nunito',sans-serif", fontSize:'1.8rem', fontWeight:900, color:'#2A1A0E', letterSpacing:2 },
  waves:         { display:'flex', gap:5, alignItems:'center', height:40 },
  wave:          { width:5, height:32, borderRadius:4, background:'#C4956A', animation:'wave 0.9s ease-in-out infinite', transformOrigin:'center' },
  stopBtn:       { display:'flex', alignItems:'center', gap:8, padding:'11px 22px', background:'#2A1A0E', color:'#fff', border:'none', borderRadius:12, fontSize:'.88rem', fontWeight:700, fontFamily:"'Nunito',sans-serif", cursor:'pointer' },
  cancelLink:    { background:'none', border:'none', color:'#9C8878', fontSize:'.76rem', cursor:'pointer', fontFamily:"'Nunito',sans-serif" },
  spinner:       { width:40, height:40, border:'3px solid #EDE7DE', borderTopColor:'#8B6445', borderRadius:'50%', animation:'spin 0.8s linear infinite' },
  processingText:{ fontFamily:"'Lora',serif", fontStyle:'italic', color:'#8B6445', fontSize:'1rem' },
  doneLabel:     { fontFamily:"'Nunito',sans-serif", fontWeight:700, color:'#6B5A4E', fontSize:'.82rem', marginBottom:6 },
  textArea:      { width:'100%', minHeight:160, maxHeight:280, padding:'12px 14px', fontFamily:"'Lora',serif", fontSize:'.9rem', lineHeight:1.75, color:'#2A1A0E', background:'#FAF7F2', border:'1.5px solid #EDE7DE', borderRadius:10, resize:'vertical', outline:'none', caretColor:'#8B6445', boxSizing:'border-box' },
  editHint:      { fontSize:'.72rem', color:'#9C8878', marginBottom:4 },
  actions:       { display:'flex', gap:8, marginBottom:8 },
  btnPrimary:    { flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 14px', background:'linear-gradient(135deg,#8B6445,#C4956A)', color:'#fff', border:'none', borderRadius:10, fontSize:'.85rem', fontWeight:700, fontFamily:"'Nunito',sans-serif", cursor:'pointer' },
  btnSecondary:  { flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 14px', background:'transparent', color:'#8B6445', border:'1.5px solid #C4956A', borderRadius:10, fontSize:'.85rem', fontWeight:700, fontFamily:"'Nunito',sans-serif", cursor:'pointer' },
  restartLink:   { display:'flex', alignItems:'center', gap:5, background:'none', border:'none', color:'#9C8878', fontSize:'.76rem', cursor:'pointer', fontFamily:"'Nunito',sans-serif", margin:'0 auto' },
  errorBox:      { background:'#FDE8E8', border:'1px solid #E74C3C', borderRadius:10, padding:'12px 16px', fontSize:'.85rem', color:'#C0392B', lineHeight:1.6, textAlign:'center', marginBottom:12 },
}
