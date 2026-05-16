import { useRef, useEffect } from 'react'
import { Feather, Mic, BookOpen, Download, Settings, Lightbulb, Search, Music, Menu, Leaf, Archive, CalendarDays } from 'lucide-react'
import useClickAway from '../../hooks/useClickAway'

const MOODS = [
  { value: 'joyeuse',     emoji: '☀️', label: 'Belle humeur' },
  { value: 'pensive',     emoji: '🌧️', label: 'Pensive'      },
  { value: 'courageuse',  emoji: '💪', label: 'Courageuse'   },
  { value: 'nostalgique', emoji: '🍂', label: 'Nostalgique'  },
  { value: 'fatiguée',    emoji: '🌙', label: 'Fatiguée'     },
  { value: 'créative',    emoji: '✨', label: 'Créative'     },
]

const SOUNDS = [
  { value: null,    emoji: '🔇', label: 'Silence'      },
  { value: 'pluie', emoji: '🌧', label: 'Pluie douce'  },
  { value: 'cafe',  emoji: '☕', label: 'Café feutré'  },
  { value: 'feu',   emoji: '🔥', label: 'Feu calme'    },
  { value: 'foret', emoji: '🌿', label: 'Forêt légère' },
]

export default function Header({
  name, moodToday, setMood, streak,
  onDictate, onPlan, onExport, onSettings, onInspir, onVocab, onTiroir,
  onProgress,                                            // T11b — ouvre ProgressModal
  moodOpen, setMoodOpen,
  // ── Ambiance ──
  ambientSound, ambientPlaying, onAmbientChange,
  ambientVolume, onVolumeChange,
  ambientOpen, setAmbientOpen,
  // ── Mobile drawers ──
  isMobile, onMenuClick, onCoachClick,
}) {
  const currentMood = MOODS.find(m => m.value === moodToday)

  // ── Refs pour clickaway ──────────────────────────────────────
  const moodContainerRef    = useRef(null)
  const ambientContainerRef = useRef(null)

  useClickAway(moodContainerRef,    () => setMoodOpen(false))
  useClickAway(ambientContainerRef, () => setAmbientOpen(false))

  // ── Escape global ────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== 'Escape') return
      if (moodOpen)    setMoodOpen(false)
      if (ambientOpen) setAmbientOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [moodOpen, ambientOpen, setMoodOpen, setAmbientOpen])

  return (
    <header style={isMobile ? { ...styles.hdr, ...styles.hdrMobile } : styles.hdr}>

      {/* Bouton hamburger mobile (Sidebar) */}
      {isMobile && (
        <button
          style={styles.menuBtn}
          onClick={onMenuClick}
          title="Chapitres"
          aria-label="Ouvrir la liste des chapitres"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Logo */}
      <div style={styles.logo}>
        <Feather size={18} color="var(--gold)" />
        {!isMobile && <span style={styles.logoText}>L'Atelier</span>}
      </div>

      {/* Centre — humeur + streak (caché sur mobile) */}
      {!isMobile && (
        <div style={styles.center}>
          <div ref={moodContainerRef} style={{ position: 'relative' }}>
            <button
              style={styles.moodBtn}
              onClick={() => { setMoodOpen(o => !o); setAmbientOpen(false) }}
              title="Mon humeur du jour"
            >
              {currentMood
                ? <>{currentMood.emoji} <span style={styles.moodLabel}>{currentMood.label}</span></>
                : <><span style={{ opacity: .6 }}>☁️</span> <span style={styles.moodLabel}>Comment tu te sens ?</span></>
              }
            </button>

            {moodOpen && (
              <div style={styles.moodDrop}>
                {MOODS.map(m => (
                  <button
                    key={m.value}
                    style={{
                      ...styles.moodOpt,
                      ...(moodToday === m.value ? styles.moodOptAct : {}),
                    }}
                    onClick={() => { setMood(m.value); setMoodOpen(false) }}
                  >
                    {m.emoji} {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {streak > 0 && (
            <div style={styles.streak} title={`${streak} jour${streak > 1 ? 's' : ''} consécutifs`}>
              🔥 {streak}
            </div>
          )}
        </div>
      )}

      {/* Actions droite */}
      <div style={styles.actions}>
        <BtnH icon={<Lightbulb    size={16} />} label="Inspiration"  onClick={onInspir}   isMobile={isMobile} />
        <BtnH icon={<Search       size={16} />} label="Vocabulaire"  onClick={onVocab}    isMobile={isMobile} />
        <BtnH icon={<Mic          size={16} />} label="Dicter"       onClick={onDictate}  isMobile={isMobile} />
        <BtnH icon={<BookOpen     size={16} />} label="Plan"         onClick={onPlan}     isMobile={isMobile} />
        {/* T11b — Régularité : visible desktop + mobile */}
        <BtnH icon={<CalendarDays size={16} />} label="Régularité"   onClick={onProgress} isMobile={isMobile} />
        {/* Le Tiroir — accessible mobile + desktop */}
        <BtnH icon={<Archive      size={16} />} label="Le tiroir"    onClick={onTiroir}   isMobile={isMobile} />
        {/* Exporter — desktop uniquement */}
        {!isMobile && (
          <BtnH icon={<Download size={16} />} label="Exporter" onClick={onExport} isMobile={false} />
        )}
        <BtnH icon={<Settings size={16} />} label="Réglages"    onClick={onSettings} isMobile={isMobile} />

        {/* Ambiance sonore — desktop uniquement */}
        {!isMobile && (
          <div ref={ambientContainerRef} style={{ position: 'relative' }}>
            <button
              style={{
                ...styles.hdrBtn,
                ...(ambientPlaying ? styles.hdrBtnPlaying : {}),
              }}
              onClick={() => { setAmbientOpen(o => !o); setMoodOpen(false) }}
              title="Ambiance sonore"
              aria-label="Ambiance sonore"
            >
              <Music size={16} />
              <span style={styles.hdrBtnLbl}>Ambiance</span>
              {ambientPlaying && <span style={styles.playDot} aria-hidden="true" />}
            </button>

            {ambientOpen && (
              <div style={styles.ambientDrop}>
                <div style={styles.ambientTitle}>Ambiance d'écriture</div>

                <div style={styles.soundList}>
                  {SOUNDS.map(s => (
                    <button
                      key={String(s.value)}
                      style={{
                        ...styles.soundBtn,
                        ...(ambientSound === s.value ? styles.soundBtnAct : {}),
                      }}
                      onClick={() => onAmbientChange(s.value)}
                    >
                      <span style={styles.soundEmoji}>{s.emoji}</span>
                      <span style={styles.soundLabel}>{s.label}</span>
                      {ambientSound === s.value && ambientPlaying && s.value !== null && (
                        <span style={styles.soundPlaying}>▶</span>
                      )}
                    </button>
                  ))}
                </div>

                <div style={styles.volRow}>
                  <span style={styles.volLbl}>Volume</span>
                  <input
                    type="range"
                    min={0} max={1} step={0.01}
                    value={ambientVolume}
                    onChange={e => onVolumeChange(parseFloat(e.target.value))}
                    style={styles.volSlider}
                    aria-label="Volume de l'ambiance"
                  />
                  <span style={styles.volVal}>{Math.round(ambientVolume * 100)}%</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bouton Léa mobile (CoachPanel) */}
      {isMobile && (
        <button
          style={styles.coachBtn}
          onClick={onCoachClick}
          title="Léa"
          aria-label="Ouvrir le panneau de Léa"
        >
          <Leaf size={20} />
        </button>
      )}
    </header>
  )
}

function BtnH({ icon, label, onClick, isMobile }) {
  return (
    <button
      style={isMobile ? { ...styles.hdrBtn, ...styles.hdrBtnMobile } : styles.hdrBtn}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {icon}
      {!isMobile && <span style={styles.hdrBtnLbl}>{label}</span>}
    </button>
  )
}

const styles = {
  hdr: {
    height: 52,
    display: 'flex', alignItems: 'center',
    padding: '0 14px',
    background: 'var(--paper)',
    borderBottom: '1px solid var(--border-l)',
    gap: 12, flexShrink: 0,
    position: 'relative', zIndex: 10,
  },
  // Mobile compact — réduit gap + padding pour que coachBtn (Léa) reste
  // visible à droite sur écran ≤ 412px. Sans ce reset, actions+coachBtn
  // dépassaient la largeur viewport et Léa se retrouvait hors écran.
  hdrMobile: {
    padding: '0 8px',
    gap: 6,
  },
  menuBtn: {
    width: 36, height: 36,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent',
    border: '1.5px solid var(--border-l)',
    borderRadius: 8,
    color: 'var(--ink)',
    cursor: 'pointer',
    transition: 'all .15s',
    flexShrink: 0,
  },
  coachBtn: {
    width: 36, height: 36,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'transparent',
    border: '1.5px solid var(--sage-l)',
    borderRadius: 8,
    color: 'var(--sage)',
    cursor: 'pointer',
    transition: 'all .15s',
    flexShrink: 0,
    marginLeft: 'auto',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 },
  logoText: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '1.1rem', fontWeight: 600,
    color: 'var(--brown)',
    letterSpacing: '.04em',
  },
  center: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 },
  moodBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: 'calc(5px * var(--layout-scale, 1)) calc(14px * var(--layout-scale, 1))',
    background: 'var(--cream)',
    border: '1.5px solid var(--border-l)',
    borderRadius: 20,
    fontSize: 'calc(.8rem * var(--layout-scale, 1))', fontWeight: 600,
    fontFamily: "'Nunito', sans-serif",
    color: 'var(--ink)', cursor: 'pointer',
    transition: 'all .18s',
  },
  moodLabel: { fontSize: 'calc(.78rem * var(--layout-scale, 1))' },
  moodDrop: {
    position: 'absolute', top: '110%', left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--paper)',
    border: '1px solid var(--border-l)',
    borderRadius: 14,
    boxShadow: '0 8px 28px rgba(42,26,14,.14)',
    padding: '6px',
    zIndex: 50,
    display: 'flex', flexWrap: 'wrap', gap: 4,
    width: 220,
    animation: 'slideUp .18s ease',
  },
  moodOpt: {
    flex: '1 1 calc(50% - 4px)',
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 10px',
    background: 'transparent',
    border: '1.5px solid transparent',
    borderRadius: 10,
    fontSize: '.78rem', fontWeight: 600,
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer',
    transition: 'all .15s',
    color: 'var(--ink)',
  },
  moodOptAct: {
    background: 'var(--gold-ll)',
    borderColor: 'var(--gold-l)',
    color: 'var(--brown)',
  },
  streak: {
    padding: 'calc(4px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1))',
    background: '#FFF3E0',
    borderRadius: 16,
    fontSize: 'calc(.78rem * var(--layout-scale, 1))', fontWeight: 700,
    color: '#E65100',
  },
  actions: { display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' },
  hdrBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: 'calc(5px * var(--layout-scale, 1)) calc(10px * var(--layout-scale, 1))',
    background: 'transparent',
    border: '1.5px solid transparent',
    borderRadius: 8,
    fontSize: 'calc(.75rem * var(--layout-scale, 1))', fontWeight: 600,
    fontFamily: "'Nunito', sans-serif",
    color: 'var(--ink-l)', cursor: 'pointer',
    transition: 'all .15s',
    whiteSpace: 'nowrap',
    position: 'relative',
  },
  // Mobile compact — padding horizontal réduit pour gagner ~70 px sur la
  // topbar et garantir que coachBtn (Léa) reste visible à droite.
  // Tap target reste acceptable (icône 16 + 2×5 = 26 px d'écart entre icônes).
  hdrBtnMobile: {
    padding: '6px 5px',
  },
  hdrBtnPlaying: {
    background: 'var(--gold-ll)',
    borderColor: 'var(--gold-l)',
    color: 'var(--brown)',
  },
  hdrBtnLbl: {},
  playDot: {
    position: 'absolute',
    top: 3, right: 3,
    width: 6, height: 6,
    borderRadius: '50%',
    background: '#6B8F71',
    display: 'inline-block',
  },
  ambientDrop: {
    position: 'absolute', top: '110%', right: 0,
    background: 'var(--paper)',
    border: '1px solid var(--border-l)',
    borderRadius: 14,
    boxShadow: '0 8px 28px rgba(42,26,14,.16)',
    padding: '10px',
    zIndex: 50,
    width: 210,
    animation: 'slideUp .18s ease',
  },
  ambientTitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '.82rem', fontWeight: 600,
    color: 'var(--brown)',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottom: '1px solid var(--border-l)',
  },
  soundList: {
    display: 'flex', flexDirection: 'column', gap: 2,
    marginBottom: 10,
  },
  soundBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 9px',
    background: 'transparent',
    border: '1.5px solid transparent',
    borderRadius: 9,
    fontSize: '.78rem', fontWeight: 600,
    fontFamily: "'Nunito', sans-serif",
    color: 'var(--ink)', cursor: 'pointer',
    transition: 'all .13s',
    textAlign: 'left', width: '100%',
  },
  soundBtnAct: {
    background: 'var(--gold-ll)',
    borderColor: 'var(--gold-l)',
    color: 'var(--brown)',
  },
  soundEmoji: { fontSize: '.95rem', width: 20, textAlign: 'center', flexShrink: 0 },
  soundLabel: { flex: 1 },
  soundPlaying: { fontSize: '.6rem', color: '#6B8F71', fontWeight: 800 },
  volRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 0 0',
    borderTop: '1px solid var(--border-l)',
  },
  volLbl: {
    fontSize: '.68rem', fontWeight: 700,
    color: 'var(--ink-ll)',
    fontFamily: "'Nunito', sans-serif",
    flexShrink: 0,
  },
  volSlider: {
    flex: 1,
    accentColor: 'var(--brown)',
    cursor: 'pointer',
  },
  volVal: {
    fontSize: '.68rem', fontWeight: 700,
    color: 'var(--ink-ll)',
    fontFamily: "'Nunito', sans-serif",
    flexShrink: 0, width: 30, textAlign: 'right',
  },
}
