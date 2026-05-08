import { Feather, Mic, BookOpen, Download, Settings, Lightbulb, Search, Music, Menu } from 'lucide-react'

const MOODS = [
  { value: 'joyeuse',     emoji: '☀️', label: 'Belle humeur' },
  { value: 'pensive',     emoji: '🌧️', label: 'Pensive' },
  { value: 'courageuse',  emoji: '💪', label: 'Courageuse' },
  { value: 'nostalgique', emoji: '🍂', label: 'Nostalgique' },
  { value: 'fatiguée',    emoji: '🌙', label: 'Fatiguée' },
  { value: 'créative',    emoji: '✨', label: 'Créative' },
]

const SOUNDS = [
  { value: null,    emoji: '🔇', label: 'Silence' },
  { value: 'pluie', emoji: '🌧', label: 'Pluie douce' },
  { value: 'cafe',  emoji: '☕', label: 'Café feutré' },
  { value: 'feu',   emoji: '🔥', label: 'Feu calme' },
  { value: 'foret', emoji: '🌿', label: 'Forêt légère' },
]

export default function Header({
  name, moodToday, setMood, streak,
  onDictate, onPlan, onExport, onSettings, onInspir, onVocab,
  moodOpen, setMoodOpen,
  // ── Ambiance ──
  ambientSound, ambientPlaying, onAmbientChange,
  ambientVolume, onVolumeChange,
  ambientOpen, setAmbientOpen,
  // ── Mobile drawer ──
  isMobile, onMenuClick,
}) {

  const currentMood = MOODS.find(m => m.value === moodToday)

  return (
    <header style={styles.hdr}>

      {/* Bouton hamburger mobile */}
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
        <span style={styles.logoText}>L'Atelier</span>
      </div>

      {/* Centre — humeur + streak */}
      <div style={styles.center}>
        <div style={{ position: 'relative' }}>
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

      {/* Actions droite */}
      <div style={styles.actions}>
        <BtnH icon={<Lightbulb size={16} />} label="Inspiration" onClick={onInspir} />
        <BtnH icon={<Search size={16} />}     label="Vocabulaire" onClick={onVocab} />
        <BtnH icon={<Mic size={16} />}        label="Dicter"      onClick={onDictate} />
        <BtnH icon={<BookOpen size={16} />}   label="Plan"        onClick={onPlan} />
        <BtnH icon={<Download size={16} />}   label="Exporter"    onClick={onExport} />
        <BtnH icon={<Settings size={16} />}   label="Réglages"    onClick={onSettings} />

        {/* ── Ambiance sonore ── */}
        <div style={{ position: 'relative' }}>
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
      </div>
    </header>
  )
}

function BtnH({ icon, label, onClick }) {
  return (
    <button
      style={styles.hdrBtn}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {icon}
      <span style={styles.hdrBtnLbl}>{label}</span>
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
    padding: '5px 14px',
    background: 'var(--cream)',
    border: '1.5px solid var(--border-l)',
    borderRadius: 20,
    fontSize: '.8rem', fontWeight: 600,
    fontFamily: "'Nunito', sans-serif",
    color: 'var(--ink)', cursor: 'pointer',
    transition: 'all .18s',
  },
  moodLabel: { fontSize: '.78rem' },
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
    padding: '4px 10px',
    background: '#FFF3E0',
    borderRadius: 16,
    fontSize: '.78rem', fontWeight: 700,
    color: '#E65100',
  },
  actions: { display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' },
  hdrBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '5px 10px',
    background: 'transparent',
    border: '1.5px solid transparent',
    borderRadius: 8,
    fontSize: '.75rem', fontWeight: 600,
    fontFamily: "'Nunito', sans-serif",
    color: 'var(--ink-l)', cursor: 'pointer',
    transition: 'all .15s',
    whiteSpace: 'nowrap',
    position: 'relative',
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
  // ── Ambient dropdown ────────────────────────────────────────
  ambientDrop: {
    position: 'absolute', top: '110%', right: 0,
    background: 'var(--paper)',
    border: '1px solid var(--border-l)',
    borderRadius: 14,
    boxShadow: '0 8px 28px rgba(42,26,14,.16)',
    padding: '10px',
    zIndex: 50,
    width: 210
