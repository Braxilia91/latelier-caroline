import { useState, useEffect } from 'react'

const MAIN_TEXT = [
  "Cet atelier, c'est pour toi.",
  "Pour que tu puisses écrire ta vie,",
  "à ton rythme, avec tes mots, sans jugement.",
  "",
  "Il m'a demandé de veiller sur toi ici.",
  "Je m'appelle Léa. Je serai là chaque fois",
  "que tu ouvriras cette page.",
  "",
  "Alors… par où est-ce que tu veux commencer ?",
]

function useTypewriter(text, active, speed = 60) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    if (!active) return
    setDisplayed('')
    let i = 0
    const id = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(id)
    }, speed)
    return () => clearInterval(id)
  }, [text, active, speed])
  return displayed
}

export default function PackOpeningModal({ onClose }) {
  const [phase, setPhase] = useState(0)
  const [p2Vis, setP2Vis] = useState(false)
  const nameTyped = useTypewriter('Caroline…', phase >= 0, 70)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1500)
    const t2 = setTimeout(() => setPhase(2), 3200)
    const t3 = setTimeout(() => setP2Vis(true), 3600)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  return (
    <div style={S.overlay}>
      <div style={S.glow} />

      <div style={S.content}>
        <div style={{ ...S.intro, opacity: phase < 2 ? 1 : 0, transition: 'opacity .8s ease' }}>
          <p style={S.name}>{nameTyped}</p>
          <p style={{ ...S.subtitle, opacity: phase >= 1 ? 1 : 0, transition: 'opacity .6s ease' }}>
            Ton frère t'a préparé quelque chose.
          </p>
        </div>

        <div style={{ ...S.mainBlock, opacity: p2Vis ? 1 : 0, transition: 'opacity 1.2s ease' }}>
          <div style={S.ornament}>✦</div>
          <div style={S.mainText}>
            {MAIN_TEXT.map((line, i) =>
              line === ''
                ? <br key={i} />
                : <p key={i} style={{ ...S.line, opacity: p2Vis ? 1 : 0, transition: `opacity ${0.4 + i * 0.1}s ease` }}>
                    {line}
                  </p>
            )}
          </div>
          <button style={S.cta} onClick={onClose}>
            Entrer dans mon atelier ✨
          </button>
        </div>
      </div>
    </div>
  )
}

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: '#0F0A05',
    zIndex: 9999,
    padding: 24,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  glow: {
    position: 'absolute',
    top: '30%', left: '50%', transform: 'translateX(-50%)',
    width: 480, height: 320,
    background: 'radial-gradient(ellipse, rgba(196,149,106,.12) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  content: {
    position: 'relative',
    maxWidth: 540,
    width: '100%',
    textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    margin: 'auto',
  },
  intro: {
    position: 'absolute',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
  },
  name: {
    fontFamily: "'Cormorant Garamond', serif",
    fontStyle: 'italic', fontWeight: 300,
    fontSize: 'clamp(2.8rem, 8vw, 4.2rem)',
    color: '#E8D5A3',
    margin: 0,
    letterSpacing: '0.02em',
  },
  subtitle: {
    fontFamily: "'Lora', serif",
    fontStyle: 'italic',
    fontSize: 'clamp(.95rem, 2.5vw, 1.15rem)',
    color: '#9C8060',
    margin: 0,
  },
  mainBlock: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
    paddingTop: 8,
  },
  ornament: {
    color: '#C4956A',
    fontSize: '1.1rem',
    letterSpacing: 12,
  },
  mainText: {
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  line: {
    fontFamily: "'Lora', serif",
    fontStyle: 'italic',
    fontSize: 'clamp(.95rem, 2.5vw, 1.1rem)',
    color: '#D4B896',
    lineHeight: 1.85,
    margin: 0,
  },
  cta: {
    marginTop: 16,
    padding: '14px 32px',
    background: 'linear-gradient(135deg, #8B6445, #C4956A)',
    color: '#FAF0E0',
    border: 'none', borderRadius: 14,
    fontFamily: "'Nunito', sans-serif",
    fontSize: '1rem', fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 24px rgba(196,149,106,.35)',
    letterSpacing: '0.02em',
    transition: 'filter .2s',
  },
}
