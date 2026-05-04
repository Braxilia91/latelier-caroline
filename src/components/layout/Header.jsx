import { Feather, Mic, BookOpen, Download, Settings, Lightbulb, Search, LogOut, Radio } from 'lucide-react'

const MOODS = [
  { value: 'joyeuse',     emoji: '☀️', label: 'Belle humeur' },
  { value: 'pensive',     emoji: '🌧️', label: 'Pensive' },
  { value: 'courageuse',  emoji: '💪', label: 'Courageuse' },
  { value: 'nostalgique', emoji: '🍂', label: 'Nostalgique' },
  { value: 'fatiguée',    emoji: '🌙', label: 'Fatiguée' },
  { value: 'créative',    emoji: '✨', label: 'Créative' },
]

export default function Header({ name, moodToday, setMood, streak, onDictate, onRecit, onPlan, onExport, onSettings, onInspir, onVocab, moodOpen, setMoodOpen, onLock }) {

  const currentMood = MOODS.find(m => m.value === moodToday)

  return (
    <header style={styles.hdr}>
      {/* Logo */}
      <div style={styles.logo}>
        <Feather size={18} color="#C4956A" />
        <span style={styles.logoText}>L'Atelier</span>
      </div>

      {/* Centre — humeur + streak */}
      <div style={styles.center}>
        <div style={{ position: 'relative' }}>
          <button
            style={styles.moodBtn}
            onClick={() => setMoodOpen(o => !o)}
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
        <BtnH icon={<Mic size={16} />}        label="Dicter vite" onClick={onDictate} />
        <BtnH icon={<Radio size={16} />}       label="Raconter"    onClick={onRecit} />
        <BtnH icon={<BookOpen size={16} />}   label="Plan"        onClick={onPlan} />
        <BtnH icon={<Download size={16} />}   label="Exporter"    onClick={onExport} />
        <BtnH icon={<Settings size={16} />}   label="Réglages"    onClick={onSettings} />
        {onLock && <BtnH icon={<LogOut size={16} />} label="Fermer la session" onClick={onLock} danger />}
      </div>
    </header>
  )
}

function BtnH({ icon, label, onClick, danger }) {
  return (
    <button
      style={{ ...styles.hdrBtn, ...(danger ? styles.hdrBtnDanger : {}) }}
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
    background: '#FFFEFB',
    borderBottom: '1px solid #EDE7DE',
    gap: 12, flexShrink: 0,
    position: 'relative', zIndex: 10,
  },
  logo: { display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 },
  logoText: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '1.1rem', fontWeight: 600,
    color: '#8B6445',
    letterSpacing: '.04em',
  },
  center: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 },
  moodBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '5px 14px',
    background: '#FAF7F2',
    border: '1.5px solid #EDE7DE',
    borderRadius: 20,
    fontSize: '.8rem', fontWeight: 600,
    fontFamily: "'Nunito', sans-serif",
    color: '#2A1A0E', cursor: 'pointer',
    transition: 'all .18s',
  },
  moodLabel: { fontSize: '.78rem' },
  moodDrop: {
    position: 'absolute', top: '110%', left: '50%',
    transform: 'translateX(-50%)',
    background: '#FFFEFB',
    border: '1px solid #EDE7DE',
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
    color: '#2A1A0E',
  },
  moodOptAct: {
    background: '#F7EFE3',
    borderColor: '#E8D5B8',
    color: '#8B6445',
  },
  streak: {
    padding: '4px 10px',
    background: '#FFF3E0',
    borderRadius: 16,
    fontSize: '.78rem', fontWeight: 700,
    color: '#E65100',
  },
  actions: { display: 'flex', gap: 4, flexShrink: 0 },
  hdrBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '5px 10px',
    background: 'transparent',
    border: '1.5px solid transparent',
    borderRadius: 8,
    fontSize: '.75rem', fontWeight: 600,
    fontFamily: "'Nunito', sans-serif",
    color: '#6B5A4E', cursor: 'pointer',
    transition: 'all .15s',
    whiteSpace: 'nowrap',
  },
  hdrBtnLbl: { '@media(maxWidth:1024px)': { display: 'none' } },
  hdrBtnDanger: { color: '#9C5A4E' },
}
