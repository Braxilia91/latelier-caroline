import { useState } from 'react'
import { ArrowRight, Feather, Key } from 'lucide-react'

const LEA_REACTIONS = {
  topic: {
    'Enfance & famille':   "La famille, les origines... c'est là que tout commence pour la plupart d'entre nous. Tu as sûrement des choses précieuses à raconter.",
    'Amour & relations':   "Les histoires d'amour sont les plus universelles — et les plus intimes à la fois. Belle matière.",
    'Parcours de vie':     "Un parcours de vie, c'est riche et complexe. On va trouver ensemble le fil qui tient tout.",
    'Tout ça à la fois':   "Parfait. Ça veut dire que tu as beaucoup à dire. On fera le tri ensemble, sans pression.",
    '_libre':              "C'est bien — ton histoire ne rentre pas dans une case. C'est exactement ce qui la rend unique.",
  },
  fear: {
    'La page blanche':          "La page blanche, c'est juste un miroir vide. On va l'apprivoiser ensemble, mot par mot.",
    'Ne pas être intéressante': "Ta vie a de l'intérêt parce que c'est la tienne. Personne d'autre n'a vécu exactement ça.",
    'La grammaire':             "La grammaire, c'est mon rayon. Je t'aide avec ça, doucement — jamais en te pointant du doigt.",
    'Être jugée':               "Je ne te jugerai jamais. Je suis là pour que tu aies confiance en ta voix avant de la partager.",
    "Rien, j'ai hâte !":       "J'adore ça ! Cette énergie, on va en faire quelque chose de beau.",
    '_libre':                   "Cette hésitation est normale — elle dit que tu prends ça au sérieux.",
  },
  when: {
    'Le matin':        "Les matins d'écriture ont quelque chose de spécial — l'esprit est encore frais et ouvert.",
    "L'après-midi":    "Entre deux choses, une petite fenêtre de tranquillité. Je m'adapte à ton rythme.",
    'Le soir':         "Le soir, les souvenirs remontent souvent plus facilement. C'est un bon moment pour ça.",
    'La nuit':         "La nuit a ses secrets. Je serai là en mode doux si tu veux.",
    "N'importe quand": "À la demande. J'aime ça — ça veut dire que l'envie peut surgir à tout moment.",
    '_libre':          "Je serai là quand tu seras prête, quelle que soit l'heure.",
  },
  humor:   "Retenu. Je saurai quand faire une blague et quand me taire.",
  feeling: "Ce mot dit beaucoup. Je vais m'en souvenir.",
}

function getReaction(category, value) {
  const map = LEA_REACTIONS[category]
  if (typeof map === 'string') return map
  return map?.[value] || map?.['_libre'] || "Merci de me l'avoir dit."
}

const Q1_OPTIONS = ['Enfance & famille', 'Amour & relations', 'Parcours de vie', 'Tout ça à la fois', 'Autre chose…']
const Q2_OPTIONS = ['La page blanche', 'Ne pas être intéressante', 'La grammaire', 'Être jugée', "Rien, j'ai hâte !"]
const Q3_OPTIONS = ['Le matin', "L'après-midi", 'Le soir', 'La nuit', "N'importe quand"]

export default function Onboarding({ onComplete }) {
  const [step,     setStep]    = useState('welcome')
  const [reaction, setReact]   = useState('')
  const [name,     setName]    = useState('')
  const [q1,       setQ1]      = useState('')
  const [q1libre,  setQ1libre] = useState('')
  const [q2,       setQ2]      = useState('')
  const [q3,       setQ3]      = useState('')
  const [q4,       setQ4]      = useState('')
  const [q5,       setQ5]      = useState('')
  const [apiKey,   setApiKey]  = useState('')
  const [loading,  setLoading] = useState(false)

  const react = (category, value, next) => {
    setReact(getReaction(category, value))
    setTimeout(() => { setReact(''); setStep(next) }, 1900)
  }

  const handleQ1 = (opt) => {
    setQ1(opt)
    if (opt === 'Autre chose…') { setStep('q1libre'); return }
    react('topic', opt, 'q2')
  }

  const handleComplete = async () => {
    if (!name.trim()) return
    setLoading(true)
    const profile = {
      topic:   q1 === 'Autre chose…' ? q1libre : q1,
      fear:    q2,
      when:    q3,
      humor:   q4,
      feeling: q5,
      completedAt: new Date().toISOString(),
    }
    await onComplete({ name: name.trim(), apiKey: apiKey.trim(), profile })
    setLoading(false)
  }

  return (
    <div style={S.bg}>
      <div style={S.card}>
        <div style={S.header}>
          <div style={S.featherWrap}><Feather size={28} color="#C4956A" /></div>
          <p style={S.ornament}>✦ · ✦ · ✦</p>
          <h1 style={S.title}>L'Atelier</h1>
          <p style={S.subtitle}>Mon Histoire</p>
        </div>

        {reaction && (
          <div style={S.leaReact}>
            <div style={S.avatar}>L</div>
            <p style={S.leaItalic}>{reaction}</p>
          </div>
        )}

        {!reaction && step === 'welcome' && (
          <div style={S.body}>
            <p style={S.bigMsg}>Bonjour. Je m'appelle <strong>Léa</strong>.</p>
            <p style={S.subMsg}>Avant qu'on commence à écrire ensemble, j'aimerais mieux te connaître. On prend 5 minutes ?</p>
            <button style={S.btn} onClick={() => setStep('name')}>Allons-y <ArrowRight size={15} /></button>
            <button style={S.link} onClick={() => setStep('apikey')}>Je préfère commencer directement →</button>
          </div>
        )}

        {!reaction && step === 'name' && (
          <div style={S.body}>
            <div style={S.leaQ}><div style={S.avatar}>L</div><p style={S.leaItalic}>Comment tu t'appelles ?</p></div>
            <input style={S.input} type="text" placeholder="Ton prénom…" value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && name.trim() && react('topic', name, 'q1')}
              autoFocus />
            <button style={{ ...S.btn, opacity: name.trim() ? 1 : .45 }} disabled={!name.trim()}
              onClick={() => react('topic', name, 'q1')}>
              C'est mon prénom <ArrowRight size={15} />
            </button>
          </div>
        )}

        {!reaction && step === 'q1' && (
          <div style={S.body}>
            <div style={S.leaQ}>
              <div style={S.avatar}>L</div>
              <p style={S.leaItalic}>{name ? `${name}, ravie de te rencontrer. ` : ''}De quoi tu veux parler dans ce livre ?</p>
            </div>
            <div style={S.choices}>{Q1_OPTIONS.map(o => <button key={o} style={S.choice} onClick={() => handleQ1(o)}>{o}</button>)}</div>
          </div>
        )}

        {!reaction && step === 'q1libre' && (
          <div style={S.body}>
            <div style={S.leaQ}><div style={S.avatar}>L</div><p style={S.leaItalic}>Dis-moi en quelques mots ce que tu veux raconter.</p></div>
            <input style={S.input} type="text" placeholder="Ce que je veux écrire…" value={q1libre}
              onChange={e => setQ1libre(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && q1libre.trim()) { setQ1(q1libre); react('topic', '_libre', 'q2') } }}
              autoFocus />
            <button style={{ ...S.btn, opacity: q1libre.trim() ? 1 : .45 }} disabled={!q1libre.trim()}
              onClick={() => { setQ1(q1libre); react('topic', '_libre', 'q2') }}>
              Voilà <ArrowRight size={15} />
            </button>
          </div>
        )}

        {!reaction && step === 'q2' && (
          <div style={S.body}>
            <div style={S.leaQ}><div style={S.avatar}>L</div><p style={S.leaItalic}>Qu'est-ce qui te fait peur dans l'idée d'écrire ?</p></div>
            <div style={S.choices}>{Q2_OPTIONS.map(o => <button key={o} style={S.choice} onClick={() => { setQ2(o); react('fear', o, 'q3') }}>{o}</button>)}</div>
          </div>
        )}

        {!reaction && step === 'q3' && (
          <div style={S.body}>
            <div style={S.leaQ}><div style={S.avatar}>L</div><p style={S.leaItalic}>Quand est-ce que tu préfères écrire ?</p></div>
            <div style={S.choices}>{Q3_OPTIONS.map(o => <button key={o} style={S.choice} onClick={() => { setQ3(o); react('when', o, 'q4') }}>{o}</button>)}</div>
          </div>
        )}

        {!reaction && step === 'q4' && (
          <div style={S.body}>
            <div style={S.leaQ}><div style={S.avatar}>L</div><p style={S.leaItalic}>Qu'est-ce qui te fait rire ? (en quelques mots)</p></div>
            <input style={S.input} type="text" placeholder="Ce qui me fait rire…" value={q4}
              onChange={e => setQ4(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && q4.trim()) react('humor', q4, 'q5') }}
              autoFocus />
            <button style={{ ...S.btn, opacity: q4.trim() ? 1 : .45 }} disabled={!q4.trim()}
              onClick={() => react('humor', q4, 'q5')}>Voilà <ArrowRight size={15} /></button>
          </div>
        )}

        {!reaction && step === 'q5' && (
          <div style={S.body}>
            <div style={S.leaQ}><div style={S.avatar}>L</div><p style={S.leaItalic}>Un seul mot pour décrire comment tu te sens par rapport à ce livre.</p></div>
            <input style={S.input} type="text" placeholder="Un mot…" value={q5}
              onChange={e => setQ5(e.target.value)} maxLength={30}
              onKeyDown={e => { if (e.key === 'Enter' && q5.trim()) react('feeling', q5, 'lea') }}
              autoFocus />
            <button style={{ ...S.btn, opacity: q5.trim() ? 1 : .45 }} disabled={!q5.trim()}
              onClick={() => react('feeling', q5, 'lea')}>Ce mot, c'est lui <ArrowRight size={15} /></button>
          </div>
        )}

        {!reaction && step === 'lea' && (
          <div style={S.body}>
            <div style={S.leaCard}>
              <div style={S.avatarLg}>L</div>
              <p style={S.leaCardTitle}>Maintenant, je me présente.</p>
              <p style={S.leaCardText}>Je suis curieuse, un peu bavarde, et j'ai un sens de l'humour que j'essaie de doser. Si je rate une blague, dis-le moi.</p>
              <p style={S.leaCardText}>Je suis là pour t'aider à trouver <em>tes</em> mots — jamais pour écrire à ta place. Je connais la grammaire, le vocabulaire, la structure d'un récit. Mais surtout, je t'écoute.</p>
              <p style={S.leaCardText}>Ce que tu m'écris m'appartient pas — ça t'appartient. Toujours.</p>
            </div>
            <button style={S.btn} onClick={() => setStep('apikey')}>Je suis prête <ArrowRight size={15} /></button>
          </div>
        )}

        {!reaction && step === 'apikey' && (
          <div style={S.body}>
            {!name.trim() && (
              <>
                <p style={S.label}>Ton prénom</p>
                <input style={S.input} type="text" placeholder="Ton prénom…" value={name}
                  onChange={e => setName(e.target.value)} autoFocus />
              </>
            )}
            <p style={S.label}>
              <Key size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
              Mot de passe Léa
            </p>
            <input style={S.input} type="password" placeholder="Le mot que Mourad t'a donné…"
              value={apiKey} onChange={e => setApiKey(e.target.value)} />
            <p style={S.hint}>Ce mot active Léa. Sans lui, tu peux écrire mais Léa restera silencieuse.</p>
            <div style={S.privacyBox}><p style={S.privacyTxt}>🔒 Tes textes restent sur ton appareil. Léa répond via un serveur sécurisé.</p></div>
            <button style={{ ...S.btn, opacity: name.trim() ? 1 : .45 }}
              disabled={!name.trim() || loading} onClick={handleComplete}>
              {loading ? "Ouverture de l'atelier…" : 'Ouvrir mon atelier →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  bg: {
    position: 'fixed',
    inset: 0,
    background: 'linear-gradient(160deg, #2D1B0E 0%, #5C3D1E 40%, #8B6445 100%)',
    padding: 20,
    fontFamily: "'Nunito', sans-serif",
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  card: {
    background: '#FFFEFB',
    borderRadius: 24,
    width: '100%',
    maxWidth: 420,
    overflow: 'hidden',
    boxShadow: '0 24px 60px rgba(0,0,0,.35)',
    margin: 'auto',
  },
  header: { background: 'linear-gradient(135deg, #2D1B0E, #8B6445)', padding: '30px 32px 20px', textAlign: 'center', color: '#fff' },
  featherWrap: { width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  ornament: { fontSize: '.68rem', letterSpacing: 8, opacity: .45, marginBottom: 4 },
  title:    { fontFamily: "'Cormorant Garamond', serif", fontSize: '1.75rem', fontWeight: 400, marginBottom: 2 },
  subtitle: { fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: '.88rem', opacity: .7 },
  body: { padding: '22px 22px 26px' },
  leaReact: { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '18px 22px 22px', background: '#F7EFE3', borderTop: '1px solid #EDE7DE' },
  leaQ:     { display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14, background: '#FAF7F2', borderRadius: 12, padding: '12px 13px', border: '1px solid #EDE7DE' },
  avatar: { width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #6B8F71, #8B6445)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant Garamond', serif", fontSize: '.9rem', fontWeight: 600 },
  avatarLg: { width: 46, height: 46, borderRadius: '50%', background: 'linear-gradient(135deg, #6B8F71, #8B6445)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', fontWeight: 600, margin: '0 auto 12px' },
  leaItalic: { fontFamily: "'Lora', serif", fontStyle: 'italic', fontSize: '.85rem', color: '#2A1A0E', lineHeight: 1.65, flex: 1, margin: 0 },
  bigMsg:   { fontSize: '1rem', color: '#2A1A0E', textAlign: 'center', marginBottom: 8, fontWeight: 600 },
  subMsg:   { fontFamily: "'Lora', serif", fontStyle: 'italic', fontSize: '.86rem', color: '#6B5A4E', textAlign: 'center', lineHeight: 1.7, marginBottom: 20 },
  leaCard: { background: '#FAF7F2', borderRadius: 14, padding: '18px', border: '1px solid #EDE7DE', textAlign: 'center', marginBottom: 16 },
  leaCardTitle: { fontFamily: "'Cormorant Garamond', serif", fontSize: '1.05rem', fontWeight: 600, color: '#8B6445', marginBottom: 12 },
  leaCardText:  { fontFamily: "'Lora', serif", fontStyle: 'italic', fontSize: '.82rem', color: '#4A3728', lineHeight: 1.65, margin: '0 0 8px' },
  choices: { display: 'flex', flexDirection: 'column', gap: 7 },
  choice:  { padding: '10px 14px', background: '#FAF7F2', border: '1.5px solid #DDD5C8', borderRadius: 10, fontSize: '.87rem', fontFamily: "'Nunito', sans-serif", color: '#2A1A0E', cursor: 'pointer', textAlign: 'left', transition: 'background .12s' },
  input: { width: '100%', padding: '11px 13px', border: '1.5px solid #DDD5C8', borderRadius: 10, fontSize: '.94rem', fontFamily: "'Nunito', sans-serif", background: '#FAF7F2', color: '#2A1A0E', outline: 'none', marginBottom: 12, boxSizing: 'border-box' },
  label:    { display: 'block', fontSize: '.72rem', fontWeight: 700, color: '#6B5A4E', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 },
  optional: { fontWeight: 400, textTransform: 'none', opacity: .7 },
  hint:     { fontSize: '.73rem', color: '#9C8878', lineHeight: 1.5, marginBottom: 10, marginTop: -4 },
  privacyBox: { background: '#F7EFE3', border: '1px solid #E8D5B8', borderRadius: 10, padding: '9px 13px', marginBottom: 12 },
  privacyTxt: { fontSize: '.75rem', color: '#8B6445', margin: 0 },
  btn:  { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '12px 20px', background: 'linear-gradient(135deg, #8B6445, #C4956A)', color: '#fff', border: 'none', borderRadius: 12, fontSize: '.9rem', fontWeight: 700, fontFamily: "'Nunito', sans-serif", cursor: 'pointer', marginTop: 4 },
  link: { display: 'block', width: '100%', marginTop: 8, background: 'transparent', border: 'none', color: '#9C8878', fontSize: '.77rem', fontFamily: "'Nunito', sans-serif", cursor: 'pointer', padding: '5px 0', textAlign: 'center' },
}
