import { useState } from 'react'
import { X, BookOpen, Search, HelpCircle, Lightbulb } from 'lucide-react'

const TABS = [
  { id: 'synonymes',  label: 'Synonymes',         icon: <BookOpen size={13} /> },
  { id: 'cherche',    label: 'Je cherche…',        icon: <Search size={13} /> },
  { id: 'akinator',   label: 'Akinator',           icon: <HelpCircle size={13} /> },
  { id: 'conseil',    label: 'Conseil du jour',    icon: <Lightbulb size={13} /> },
]

const TODAY = new Date().toDateString()

export default function DicoCaroModal({ onClose, coach, hasKey }) {
  const [tab,         setTab]         = useState('synonymes')
  // Synonymes
  const [word,        setWord]        = useState('')
  const [sentence,    setSentence]    = useState('')
  const [level,       setLevel]       = useState('mixte')
  // Cherche mes mots
  const [description, setDescription] = useState('')
  // Conseil du jour
  const [councilDone, setCouncilDone] = useState(
    () => localStorage.getItem('dicoCaroConseil') === TODAY
  )

  const { loading, getSynonyms, searchWord, startAkinator, getDiscovery } = coach

  const handleSend = async () => {
    if (loading) return
    if (tab === 'synonymes') {
      if (!word.trim()) return
      await getSynonyms({ word, sentence, level })
      onClose()
    } else if (tab === 'cherche') {
      if (!description.trim()) return
      await searchWord(description)
      onClose()
    } else if (tab === 'akinator') {
      await startAkinator()
      onClose()
    } else if (tab === 'conseil') {
      await getDiscovery()
      localStorage.setItem('dicoCaroConseil', TODAY)
      setCouncilDone(true)
      onClose()
    }
  }

  const canSend = hasKey && !loading && (
    (tab === 'synonymes'  && word.trim().length > 0) ||
    (tab === 'cherche'    && description.trim().length > 0) ||
    (tab === 'akinator') ||
    (tab === 'conseil'    && !councilDone)
  )

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>

        {/* Header */}
        <div style={S.hdr}>
          <div style={S.hdrLeft}>
            <span style={S.hdrIcon}>📖</span>
            <div>
              <div style={S.hdrTitle}>DicoCaro</div>
              <div style={S.hdrSub}>Ton dictionnaire personnel avec Léa</div>
            </div>
          </div>
          <button style={S.closeBtn} onClick={onClose}><X size={18} /></button>
        </div>

        {/* Onglets */}
        <div style={S.tabs}>
          {TABS.map(t => (
            <button
              key={t.id}
              style={{ ...S.tab, ...(tab === t.id ? S.tabActive : {}) }}
              onClick={() => setTab(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Corps */}
        <div style={S.body}>

          {/* ── Mode Synonymes ── */}
          {tab === 'synonymes' && (
            <div style={S.form}>
              <label style={S.label}>Le mot dont tu cherches des alternatives</label>
              <input
                style={S.input}
                value={word}
                onChange={e => setWord(e.target.value)}
                placeholder="ex : tristesse, marcher, grand…"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && canSend && handleSend()}
              />
              <label style={S.label}>La phrase où tu l'utilises <span style={S.optional}>(optionnel — aide Léa à trouver le bon registre)</span></label>
              <textarea
                style={{ ...S.input, ...S.textarea }}
                value={sentence}
                onChange={e => setSentence(e.target.value)}
                placeholder="ex : Je marchais lentement dans la rue déserte…"
                rows={3}
              />
              <label style={S.label}>Niveau de vocabulaire souhaité</label>
              <div style={S.levels}>
                {[['simple', 'Simple & courant'], ['mixte', 'Mixte (recommandé)'], ['littéraire', 'Littéraire']].map(([v, l]) => (
                  <button
                    key={v}
                    style={{ ...S.levelBtn, ...(level === v ? S.levelActive : {}) }}
                    onClick={() => setLevel(v)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Mode Je cherche mes mots ── */}
          {tab === 'cherche' && (
            <div style={S.form}>
              <label style={S.label}>Décris ce que tu veux dire — Léa trouve le mot</label>
              <div style={S.hint}>
                Exemple : "c'est la tristesse qu'on ressent en regardant quelque chose de beau qui va bientôt disparaître"
              </div>
              <textarea
                style={{ ...S.input, ...S.textarea }}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Décris l'émotion, la sensation, l'image que tu veux exprimer…"
                rows={5}
                autoFocus
              />
            </div>
          )}

          {/* ── Mode Akinator littéraire ── */}
          {tab === 'akinator' && (
            <div style={S.form}>
              <div style={S.akinatorCard}>
                <div style={S.akinatorIcon}>🎭</div>
                <p style={S.akinatorText}>
                  Tu as un mot sur le bout de la langue mais tu ne sais pas le formuler ?
                </p>
                <p style={S.akinatorSub}>
                  Léa va te poser des questions sur l'émotion, la nuance ou le contexte
                  que tu veux exprimer — et deviner le mot que tu cherches.
                </p>
                <p style={S.akinatorSub}>
                  La conversation se poursuit dans le panneau Léa à droite.
                </p>
              </div>
            </div>
          )}

          {/* ── Mode Conseil du jour ── */}
          {tab === 'conseil' && (
            <div style={S.form}>
              {councilDone ? (
                <div style={S.councilDone}>
                  <div style={S.councilDoneIcon}>✨</div>
                  <p style={S.councilDoneText}>
                    Tu as déjà reçu ton conseil du jour !<br />
                    Reviens demain pour une nouvelle découverte.
                  </p>
                  <button
                    style={{ ...S.sendBtn, background: '#EDE7DE', color: '#8B6445' }}
                    onClick={() => {
                      localStorage.removeItem('dicoCaroConseil')
                      setCouncilDone(false)
                    }}
                  >
                    Voir quand même un nouveau conseil
                  </button>
                </div>
              ) : (
                <div style={S.akinatorCard}>
                  <div style={S.akinatorIcon}>💡</div>
                  <p style={S.akinatorText}>
                    Découverte du jour
                  </p>
                  <p style={S.akinatorSub}>
                    Léa va t'offrir une micro-découverte littéraire adaptée
                    à ce que tu écris — un mot rare, une figure de style,
                    une règle de grammaire ou un conseil d'écriture.
                  </p>
                  <p style={{ ...S.akinatorSub, color: '#C4956A', fontStyle: 'italic' }}>
                    Une seule par jour — pour que ça reste une vraie découverte.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!hasKey && (
          <div style={S.noKey}>
            Ajoute ta clé API dans <strong>Réglages</strong> pour activer DicoCaro.
          </div>
        )}

        {hasKey && !(tab === 'conseil' && councilDone) && (
          <div style={S.footer}>
            <button style={S.cancelBtn} onClick={onClose}>Annuler</button>
            <button
              style={{ ...S.sendBtn, opacity: canSend ? 1 : .45, cursor: canSend ? 'pointer' : 'not-allowed' }}
              onClick={handleSend}
              disabled={!canSend}
            >
              {loading ? 'Léa réfléchit…' : (
                tab === 'synonymes'  ? 'Trouver des synonymes' :
                tab === 'cherche'    ? 'Trouver mon mot' :
                tab === 'akinator'   ? 'Démarrer avec Léa →' :
                'Recevoir mon conseil'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(42,26,14,.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: '#FFFEFB',
    borderRadius: 18,
    width: '100%', maxWidth: 520,
    maxHeight: '88vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 60px rgba(42,26,14,.25)',
    overflow: 'hidden',
  },
  hdr: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '16px 20px 14px',
    borderBottom: '1px solid #EDE7DE',
    background: '#FAF7F2',
  },
  hdrLeft: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  hdrIcon: { fontSize: '1.4rem', marginTop: 2 },
  hdrTitle: { fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', fontWeight: 700, color: '#2A1A0E' },
  hdrSub:   { fontSize: '.72rem', color: '#9C8878', marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    background: 'transparent', border: '1.5px solid #EDE7DE',
    color: '#9C8878', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #EDE7DE',
    background: '#FAF7F2',
    overflowX: 'auto',
  },
  tab: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '10px 14px',
    background: 'transparent', border: 'none',
    borderBottom: '2px solid transparent',
    fontSize: '.75rem', fontWeight: 600,
    fontFamily: "'Nunito', sans-serif",
    color: '#9C8878', cursor: 'pointer',
    whiteSpace: 'nowrap', transition: 'all .15s',
  },
  tabActive: {
    color: '#8B6445',
    borderBottom: '2px solid #C4956A',
    background: '#FFFEFB',
  },
  body: {
    flex: 1, overflowY: 'auto',
    padding: '20px',
  },
  form: {
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  label: {
    fontSize: '.75rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif", color: '#6B5A4E',
  },
  optional: {
    fontWeight: 400, color: '#9C8878', marginLeft: 4,
  },
  hint: {
    fontFamily: "'Lora', serif", fontStyle: 'italic',
    fontSize: '.78rem', color: '#9C8878', lineHeight: 1.6,
    background: '#F7EFE3', borderRadius: 8,
    padding: '8px 12px',
  },
  input: {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 13px',
    border: '1.5px solid #EDE7DE', borderRadius: 10,
    fontFamily: "'Nunito', sans-serif", fontSize: '.85rem',
    background: '#FAF7F2', color: '#2A1A0E',
    outline: 'none', caretColor: '#8B6445',
  },
  textarea: {
    fontFamily: "'Lora', serif",
    fontSize: '.85rem', lineHeight: 1.6,
    resize: 'none',
  },
  levels: {
    display: 'flex', gap: 8, flexWrap: 'wrap',
  },
  levelBtn: {
    padding: '6px 14px',
    border: '1.5px solid #EDE7DE', borderRadius: 20,
    background: '#FAF7F2',
    fontSize: '.72rem', fontWeight: 600,
    fontFamily: "'Nunito', sans-serif", color: '#9C8878',
    cursor: 'pointer', transition: 'all .15s',
  },
  levelActive: {
    background: '#F7EFE3', border: '1.5px solid #C4956A', color: '#8B6445',
  },
  akinatorCard: {
    background: '#F7EFE3', borderRadius: 14,
    padding: '24px 20px', textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
  },
  akinatorIcon: { fontSize: '2rem' },
  akinatorText: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '1.05rem', fontWeight: 600, color: '#2A1A0E',
    margin: 0,
  },
  akinatorSub: {
    fontFamily: "'Lora', serif", fontStyle: 'italic',
    fontSize: '.82rem', color: '#6B5A4E', lineHeight: 1.6,
    margin: 0,
  },
  councilDone: {
    background: '#EEF4EC', borderRadius: 14,
    padding: '24px 20px', textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
  },
  councilDoneIcon: { fontSize: '2rem' },
  councilDoneText: {
    fontFamily: "'Lora', serif", fontStyle: 'italic',
    fontSize: '.85rem', color: '#3D6B45', lineHeight: 1.7, margin: 0,
  },
  footer: {
    display: 'flex', gap: 10, justifyContent: 'flex-end',
    padding: '14px 20px',
    borderTop: '1px solid #EDE7DE',
    background: '#FAF7F2',
  },
  cancelBtn: {
    padding: '9px 18px',
    background: 'transparent', border: '1.5px solid #EDE7DE',
    borderRadius: 10, fontSize: '.82rem', fontWeight: 600,
    fontFamily: "'Nunito', sans-serif", color: '#9C8878',
    cursor: 'pointer',
  },
  sendBtn: {
    padding: '9px 20px',
    background: 'linear-gradient(135deg, #8B6445, #C4956A)',
    color: '#fff', border: 'none', borderRadius: 10,
    fontSize: '.82rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer', transition: 'filter .15s',
  },
  noKey: {
    padding: '12px 20px',
    borderTop: '1px solid #EDE7DE',
    background: '#F7EFE3',
    fontSize: '.78rem', color: '#8B6445',
    textAlign: 'center',
    fontFamily: "'Nunito', sans-serif",
  },
}
