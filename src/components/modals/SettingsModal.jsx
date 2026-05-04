import { useState } from 'react'
import { X, Save, AlertTriangle } from 'lucide-react'

const VOICES = [
  { value: 'nova',    label: 'Nova — Douce et claire' },
  { value: 'shimmer', label: 'Shimmer — Chaleureuse' },
  { value: 'onyx',    label: 'Onyx — Posée et grave' },
  { value: 'alloy',   label: 'Alloy — Neutre' },
]

export default function SettingsModal({ state, onClose, onSave, onReset }) {
  const [name,      setName]      = useState(state.name)
  const [apiKey,    setApiKey]    = useState(state.apiKey)
  const [openAiKey, setOpenAiKey] = useState(state.openAiKey)
  const [voice,     setVoice]     = useState(state.leaVoice)
  const [confirmReset, setConfirmReset] = useState(false)

  const handleSave = () => {
    onSave({ name, apiKey, openAiKey, leaVoice: voice })
    onClose()
  }

  const handleReset = async () => {
    if (confirmReset) {
      await onReset()
      window.location.reload()
    } else {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset(false), 5000)
    }
  }

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box wide">
        <button className="modal-close" onClick={onClose}><X size={16} /></button>
        <h2 className="modal-title">⚙️ Réglages</h2>

        <div className="fg">
          <label>Ton prénom</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Caroline" />
        </div>

        <div className="fg">
          <label>Clé API Anthropic (Coach Léa)</label>
          <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-ant-api03-…" />
          <p className="hint">🔒 Stockée sur ton appareil uniquement. Obtiens-la sur console.anthropic.com → API Keys</p>
        </div>

        <div className="fg">
          <label>Clé API OpenAI <span style={{ fontWeight: 400, opacity: .7 }}>(optionnel — voix naturelle)</span></label>
          <input type="password" value={openAiKey} onChange={e => setOpenAiKey(e.target.value)} placeholder="sk-…" />
          <p className="hint">Pour les voix IA naturelles (nova, shimmer…). Sans cette clé, la voix du navigateur est utilisée.</p>
        </div>

        {openAiKey && (
          <div className="fg">
            <label>Voix de Léa</label>
            <select
              style={selStyle}
              value={voice}
              onChange={e => setVoice(e.target.value)}
            >
              {VOICES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>
        )}

        <button className="btn btn-primary" style={{ width: '100%', marginBottom: 12, justifyContent: 'center' }} onClick={handleSave}>
          <Save size={15} /> Enregistrer
        </button>

        {/* Zone danger */}
        <div style={dangerStyles.zone}>
          <div style={dangerStyles.hdr}>
            <AlertTriangle size={14} color="#C0392B" />
            <span style={dangerStyles.ttl}>Zone dangereuse</span>
          </div>
          <p style={dangerStyles.txt}>
            Supprimer toutes les données efface définitivement tous tes chapitres et paramètres.
          </p>
          <button style={dangerStyles.btn} onClick={handleReset}>
            {confirmReset ? '⚠️ Confirmer — effacer tout ?' : 'Supprimer toutes mes données'}
          </button>
        </div>
      </div>
    </div>
  )
}

const selStyle = {
  width: '100%', padding: '10px 13px',
  border: '1.5px solid #DDD5C8', borderRadius: 8,
  fontFamily: "'Nunito', sans-serif", fontSize: '.9rem',
  background: '#FAF7F2', color: '#2A1A0E', outline: 'none',
}
const dangerStyles = {
  zone: { background: '#FFF5F5', border: '1.5px solid #FECACA', borderRadius: 12, padding: '14px 16px', marginTop: 4 },
  hdr:  { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 },
  ttl:  { fontSize: '.78rem', fontWeight: 800, color: '#C0392B', textTransform: 'uppercase', letterSpacing: '.5px' },
  txt:  { fontSize: '.78rem', color: '#7F1D1D', lineHeight: 1.5, marginBottom: 10 },
  btn:  {
    padding: '8px 14px',
    background: '#C0392B', color: '#fff', border: 'none',
    borderRadius: 8, fontSize: '.78rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif", cursor: 'pointer',
  },
}
