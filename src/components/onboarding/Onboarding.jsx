import { useState } from 'react'
import { BookOpen, Key, ArrowRight, Feather } from 'lucide-react'

export default function Onboarding({ onComplete }) {
  const [step,    setStep]    = useState(0)
  const [name,    setName]    = useState('')
  const [apiKey,  setApiKey]  = useState('')
  const [loading, setLoading] = useState(false)

  const handleStart = async () => {
    if (!name.trim()) return
    setLoading(true)
    await onComplete({ name: name.trim(), apiKey: apiKey.trim() })
    setLoading(false)
  }

  return (
    <div style={styles.bg}>
      <div style={styles.card}>
        {/* En-tête */}
        <div style={styles.header}>
          <div style={styles.featherWrap}>
            <Feather size={32} color="#C4956A" />
          </div>
          <p style={styles.ornament}>✦ · ✦ · ✦</p>
          <h1 style={styles.title}>L'Atelier</h1>
          <p style={styles.subtitle}>Mon Histoire</p>
          <p style={styles.tagline}>
            Un espace rien qu'à toi pour écrire ta vie,<br />
            à ton rythme, avec tes mots.
          </p>
        </div>

        {step === 0 && (
          <div style={styles.body}>
            <div style={styles.fg}>
              <label style={styles.label}>Ton prénom</label>
              <input
                style={styles.input}
                type="text"
                placeholder="Caroline…"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && name.trim() && setStep(1)}
                autoFocus
              />
              <p style={styles.hint}>C'est tout ce dont on a besoin pour commencer 🌿</p>
            </div>

            <button
              style={{ ...styles.btn, opacity: name.trim() ? 1 : .5 }}
              disabled={!name.trim()}
              onClick={() => setStep(1)}
            >
              Continuer <ArrowRight size={16} />
            </button>
          </div>
        )}

        {step === 1 && (
          <div style={styles.body}>
            <div style={styles.fg}>
              <label style={styles.label}>
                <Key size={13} style={{ marginRight: 5, verticalAlign: -2 }} />
                Clé API Anthropic <span style={styles.optional}>(optionnel)</span>
              </label>
              <input
                style={styles.input}
                type="password"
                placeholder="sk-ant-api03-…"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                autoFocus
              />
              <p style={styles.hint}>
                Elle sert à activer <strong>Léa</strong>, ton coach d'écriture IA.{' '}
                Sans elle, tu peux écrire librement — Léa sera juste silencieuse.
                <br />Tu pourras l'ajouter plus tard dans les réglages.
              </p>
            </div>

            <div style={styles.skipBox}>
              <BookOpen size={14} color="#8B6445" />
              <p style={styles.skipText}>
                Toutes tes écritures restent sur ton appareil, jamais envoyées ailleurs.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button style={styles.btnGhost} onClick={() => setStep(0)}>← Retour</button>
              <button
                style={{ ...styles.btn, flex: 1 }}
                onClick={handleStart}
                disabled={loading}
              >
                {loading ? 'Ouverture…' : 'Ouvrir mon atelier →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  bg: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #2D1B0E 0%, #5C3D1E 40%, #8B6445 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    fontFamily: "'Nunito', sans-serif",
  },
  card: {
    background: '#FFFEFB',
    borderRadius: 24,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    boxShadow: '0 24px 60px rgba(0,0,0,.35)',
  },
  header: {
    background: 'linear-gradient(135deg, #2D1B0E, #8B6445)',
    padding: '40px 32px 28px',
    textAlign: 'center',
    color: '#fff',
  },
  featherWrap: {
    width: 60, height: 60,
    borderRadius: '50%',
    background: 'rgba(255,255,255,.12)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  ornament: { fontSize: '.75rem', letterSpacing: 8, opacity: .5, marginBottom: 6 },
  title: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '2rem', fontWeight: 400,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: "'Cormorant Garamond', serif",
    fontStyle: 'italic', fontSize: '1rem',
    opacity: .75, marginBottom: 14,
  },
  tagline: {
    fontSize: '.82rem', opacity: .8,
    lineHeight: 1.6,
  },
  body: { padding: '28px 28px 32px' },
  fg:  { marginBottom: 18 },
  label: {
    display: 'block',
    fontSize: '.72rem', fontWeight: 700,
    color: '#6B5A4E',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: 6,
  },
  optional: { fontWeight: 400, textTransform: 'none', opacity: .7 },
  input: {
    width: '100%',
    padding: '11px 14px',
    border: '1.5px solid #DDD5C8',
    borderRadius: 10,
    fontSize: '.95rem',
    fontFamily: "'Nunito', sans-serif",
    background: '#FAF7F2',
    color: '#2A1A0E',
    outline: 'none',
  },
  hint: { fontSize: '.74rem', color: '#9C8878', marginTop: 6, lineHeight: 1.5 },
  skipBox: {
    display: 'flex', gap: 8, alignItems: 'flex-start',
    background: '#F7EFE3', border: '1px solid #E8D5B8',
    borderRadius: 10, padding: '10px 14px',
    marginBottom: 16,
  },
  skipText: { fontSize: '.76rem', color: '#8B6445', lineHeight: 1.5, flex: 1 },
  btn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%',
    padding: '12px 20px',
    background: 'linear-gradient(135deg, #8B6445, #C4956A)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: '.9rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer',
    transition: 'filter .18s',
  },
  btnGhost: {
    padding: '12px 16px',
    background: 'transparent',
    color: '#8B6445',
    border: '1.5px solid #DDD5C8',
    borderRadius: 12,
    fontSize: '.9rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer',
  },
}
