import { useState, useRef, useEffect } from 'react'
import { X, BookOpen, Search, HelpCircle, Lightbulb, Globe, Wand2 } from 'lucide-react'

const TABS = [
  { id: 'synonymes', label: 'Synonymes',   icon: <BookOpen size={13} /> },
  { id: 'cherche',   label: 'Je cherche…', icon: <Search size={13} /> },
  { id: 'akinator',  label: 'Akinator',    icon: <HelpCircle size={13} /> },
  { id: 'wiki',      label: 'Définition',  icon: <Globe size={13} /> },
  { id: 'predictif', label: 'Prédictif',   icon: <Wand2 size={13} /> },
  { id: 'conseil',   label: 'Conseil',     icon: <Lightbulb size={13} /> },
]

const TODAY = new Date().toDateString()

export default function DicoCaroModal({ onClose, coach, hasKey, currentChapter }) {
  const [tab, setTab] = useState('synonymes')

  // ── Scroll affordance onglets ──────────────────────────────
  const tabsRef = useRef(null)
  const tabRefs = useRef({})
  const [canScrollLeft,  setCanScrollLeft]  = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = () => {
    const el = tabsRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  // Init + resize
  useEffect(() => {
    const t = setTimeout(updateScrollState, 50) // attendre que la modale soit mesurée
    window.addEventListener('resize', updateScrollState)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [])

  // Auto-scroll vers l'onglet actif
  useEffect(() => {
    const btn = tabRefs.current[tab]
    if (btn && typeof btn.scrollIntoView === 'function') {
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
    const t = setTimeout(updateScrollState, 350) // après l'anim de scroll
    return () => clearTimeout(t)
  }, [tab])

  // ── Synonymes ──────────────────────────────────────────────
  const [word,        setWord]        = useState('')
  const [sentence,    setSentence]    = useState('')
  const [level,       setLevel]       = useState('mixte')

  // ── Je cherche mes mots ────────────────────────────────────
  const [description, setDescription] = useState('')

  // ── Akinator Soft ──────────────────────────────────────────
  const [akinNature,    setAkinNature]    = useState('')
  const [akinMouvement, setAkinMouvement] = useState('')
  const [akinRegistre,  setAkinRegistre]  = useState('courant')
  const [akinContexte,  setAkinContexte]  = useState('')

  // ── Wikipedia ──────────────────────────────────────────────
  const [wikiQuery,   setWikiQuery]   = useState('')
  const [wikiResult,  setWikiResult]  = useState(null)
  const [wikiLoading, setWikiLoading] = useState(false)
  const [wikiError,   setWikiError]   = useState('')

  // ── Conseil du jour ────────────────────────────────────────
  const [councilDone, setCouncilDone] = useState(
    () => localStorage.getItem('dicoCaroConseil') === TODAY
  )

  const { loading, getSynonyms, searchWord, startAkinatorSoft, getPredictiveWords, getDiscovery } = coach
  const hasChapterContent = !!(currentChapter?.content?.trim())

  // ── Recherche Wikipedia ────────────────────────────────────
  const handleWikiSearch = async () => {
    if (!wikiQuery.trim()) return
    setWikiLoading(true)
    setWikiResult(null)
    setWikiError('')
    try {
      const res = await fetch(
        `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiQuery.trim())}`
      )
      if (!res.ok) throw new Error('not_found')
      const data = await res.json()
      setWikiResult(data)
    } catch {
      setWikiError('Aucun résultat. Essaie avec un autre terme ou une autre orthographe.')
    } finally {
      setWikiLoading(false)
    }
  }

  // ── Envoi Claude ───────────────────────────────────────────
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
      if (!akinNature) return
      await startAkinatorSoft({
        nature:    akinNature,
        mouvement: akinMouvement || 'non précisé',
        registre:  akinRegistre,
        contexte:  akinContexte,
      })
      onClose()
    } else if (tab === 'predictif') {
      if (!hasChapterContent) return
      await getPredictiveWords()
      onClose()
    } else if (tab === 'conseil') {
      await getDiscovery()
      localStorage.setItem('dicoCaroConseil', TODAY)
      setCouncilDone(true)
      onClose()
    }
  }

  const canSend = hasKey && !loading && (
    (tab === 'synonymes' && word.trim().length > 0)           ||
    (tab === 'cherche'   && description.trim().length > 0)    ||
    (tab === 'akinator'  && akinNature !== '')                 ||
    (tab === 'predictif' && hasChapterContent)                 ||
    (tab === 'conseil'   && !councilDone)
  )

  const showFooter = hasKey && tab !== 'wiki' && !(tab === 'conseil' && councilDone)

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>

        {/* ── Header ── */}
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

        {/* ── Onglets (avec scroll affordance) ── */}
        <div style={S.tabsWrap}>
          <div
            style={S.tabs}
            ref={tabsRef}
            onScroll={updateScrollState}
          >
            {TABS.map(t => (
              <button
                key={t.id}
                ref={el => { tabRefs.current[t.id] = el }}
                style={{ ...S.tab, ...(tab === t.id ? S.tabActive : {}) }}
                onClick={() => setTab(t.id)}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          {canScrollLeft  && <div style={S.fadeLeft}  aria-hidden="true" />}
          {canScrollRight && <div style={S.fadeRight} aria-hidden="true" />}
        </div>

        {/* ── Corps ── */}
        <div style={S.body}>

          {/* Synonymes */}
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
              <label style={S.label}>
                La phrase où tu l'utilises
                <span style={S.optional}> (optionnel — aide Léa à trouver le bon registre)</span>
              </label>
              <textarea
                style={{ ...S.input, ...S.textarea }}
                value={sentence}
                onChange={e => setSentence(e.target.value)}
                placeholder="ex : Je marchais lentement dans la rue déserte…"
                rows={3}
              />
              <label style={S.label}>Niveau de vocabulaire souhaité</label>
              <div style={S.pills}>
                {[['simple', 'Simple & courant'], ['mixte', 'Mixte (recommandé)'], ['littéraire', 'Littéraire']].map(([v, l]) => (
                  <button key={v} style={{ ...S.pill, ...(level === v ? S.pillActive : {}) }} onClick={() => setLevel(v)}>{l}</button>
                ))}
              </div>
            </div>
          )}

          {/* Je cherche mes mots */}
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

          {/* Akinator Soft */}
          {tab === 'akinator' && (
            <div style={S.form}>
              <div style={S.hint}>
                Réponds à ces 3 questions — Léa trouve ton mot sans te poser de questions une à une.
              </div>

              <label style={S.label}>1. C'est plutôt…</label>
              <div style={S.pills}>
                {[
                  ['une émotion ou un sentiment', 'Émotion'],
                  ['une sensation physique',       'Sensation'],
                  ['une action ou un mouvement',   'Action'],
                  ['un concept ou une idée',       'Concept'],
                ].map(([v, l]) => (
                  <button key={v} style={{ ...S.pill, ...(akinNature === v ? S.pillActive : {}) }} onClick={() => setAkinNature(v)}>{l}</button>
                ))}
              </div>

              <label style={S.label}>2. Est-ce que ça implique du mouvement ?</label>
              <div style={S.pills}>
                {[['oui', 'Oui'], ['non', 'Non'], ['un peu', 'Un peu']].map(([v, l]) => (
                  <button key={v} style={{ ...S.pill, ...(akinMouvement === v ? S.pillActive : {}) }} onClick={() => setAkinMouvement(v)}>{l}</button>
                ))}
              </div>

              <label style={S.label}>3. Registre souhaité</label>
              <div style={S.pills}>
                {[['courant', 'Courant'], ['littéraire', 'Littéraire'], ['familier', 'Familier']].map(([v, l]) => (
                  <button key={v} style={{ ...S.pill, ...(akinRegistre === v ? S.pillActive : {}) }} onClick={() => setAkinRegistre(v)}>{l}</button>
                ))}
              </div>

              <label style={S.label}>
                Contexte ou phrase
                <span style={S.optional}> (optionnel)</span>
              </label>
              <textarea
                style={{ ...S.input, ...S.textarea }}
                value={akinContexte}
                onChange={e => setAkinContexte(e.target.value)}
                placeholder="ex : je veux décrire comment je me sentais dans la cuisine de ma mère…"
                rows={2}
              />
            </div>
          )}

          {/* Définition Wikipedia */}
          {tab === 'wiki' && (
            <div style={S.form}>
              <label style={S.label}>Recherche une définition dans Wikipedia</label>
              <div style={S.hint}>
                Sans clé API — résultat instantané depuis l'encyclopédie francophone.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ ...S.input, flex: 1 }}
                  value={wikiQuery}
                  onChange={e => setWikiQuery(e.target.value)}
                  placeholder="ex : mélancolie, exil, résilience…"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleWikiSearch()}
                />
                <button
                  style={{
                    ...S.sendBtn,
                    opacity: wikiQuery.trim() && !wikiLoading ? 1 : .45,
                    cursor:  wikiQuery.trim() && !wikiLoading ? 'pointer' : 'not-allowed',
                    flexShrink: 0,
                  }}
                  onClick={handleWikiSearch}
                  disabled={!wikiQuery.trim() || wikiLoading}
                >
                  {wikiLoading ? '…' : 'Chercher'}
                </button>
              </div>

              {wikiError && (
                <div style={S.wikiError}>{wikiError}</div>
              )}

              {wikiResult && (
                <div style={S.wikiCard}>
                  {wikiResult.thumbnail?.source && (
                    <img
                      src={wikiResult.thumbnail.source}
                      alt={wikiResult.title}
                      style={S.wikiThumb}
                    />
                  )}
                  <div style={S.wikiTitle}>{wikiResult.title}</div>
                  {wikiResult.description && (
                    <div style={S.wikiDesc}>{wikiResult.description}</div>
                  )}
                  {wikiResult.extract && (
                    <div style={S.wikiExtract}>{wikiResult.extract.slice(0, 400)}{wikiResult.extract.length > 400 ? '…' : ''}</div>
                  )}
                  {wikiResult.content_urls?.desktop?.page && (
                    
                      href={wikiResult.content_urls.desktop.page}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={S.wikiLink}
                    >
                      Lire sur Wikipedia →
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Prédictif */}
          {tab === 'predictif' && (
            <div style={S.form}>
              <div style={S.akinatorCard}>
                <div style={S.akinatorIcon}>🔮</div>
                <p style={S.akinatorText}>
                  Anticiper tes prochains mots
                </p>
                <p style={S.akinatorSub}>
                  Léa analyse ce que tu es en train d'écrire et prédit les mots
                  dont tu pourrais avoir besoin dans les prochains paragraphes.
                </p>
                {!hasChapterContent && (
                  <p style={{ ...S.akinatorSub, color: '#C4956A', fontStyle: 'italic' }}>
                    Commence à écrire dans ton chapitre pour activer ce mode.
                  </p>
                )}
                {hasChapterContent && (
                  <p style={{ ...S.akinatorSub, color: '#6B8F71', fontStyle: 'italic' }}>
                    Ton chapitre est prêt — Léa va analyser ton style et anticiper
                    les prochains mots dont tu pourrais avoir besoin.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Conseil du jour */}
          {tab === 'conseil' && (
            <div style={S.form}>
              <div style={S.akinatorCard}>
                <div style={S.akinatorIcon}>💡</div>
                <p style={S.akinatorText}>
                  Découverte du jour
                </p>
                <p style={S.akinatorSub}>
                  Léa choisit un mot rare, une tournure stylistique ou une figure
                  de style que tu pourrais intégrer dans ton écriture autobiographique.
                </p>
                {councilDone && (
                  <p style={{ ...S.akinatorSub, color: '#6B8F71', fontStyle: 'italic' }}>
                    Tu as déjà reçu ton conseil du jour — reviens demain pour un nouveau mot ✨
                  </p>
                )}
              </div>
            </div>
          )}

        </div>{/* fin body */}

        {/* ── Footer ── */}
        {showFooter && (
          <div style={S.footer}>
            {!hasKey && (
              <p style={S.noKey}>Configure ta clé API Anthropic dans les réglages pour activer Léa.</p>
            )}
            {hasKey && (
              <button
                style={{ ...S.sendBtn, opacity: canSend ? 1 : .45, cursor: canSend ? 'pointer' : 'not-allowed' }}
                onClick={handleSend}
                disabled={!canSend}
              >
                {loading ? '…' : 'Demander à Léa →'}
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────
const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(45,38,30,.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: '#FAF7F2', borderRadius: 14,
    width: '100%', maxWidth: 560, maxHeight: '88vh',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(45,38,30,.22)',
  },
  hdr: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 18px', borderBottom: '1px solid #EDE7DE', flexShrink: 0,
  },
  hdrLeft:  { display: 'flex', alignItems: 'center', gap: 10 },
  hdrIcon:  { fontSize: 22 },
  hdrTitle: { fontSize: '.92rem', fontWeight: 700, color: '#2D261E', fontFamily: "'Nunito', sans-serif" },
  hdrSub:   { fontSize: '.72rem', color: '#8B7355', fontFamily: "'Nunito', sans-serif" },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer', color: '#8B7355',
    padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center',
  },
  tabsWrap: {
    position: 'relative',
    flexShrink: 0,
    borderBottom: '1px solid #EDE7DE',
  },
  tabs: {
    display: 'flex', gap: 4, padding: '10px 16px 0',
    overflowX: 'auto',
    scrollSnapType: 'x proximity',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    WebkitOverflowScrolling: 'touch',
  },
  tab: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '6px 12px', borderRadius: '8px 8px 0 0',
    border: 'none', background: 'none', cursor: 'pointer',
    fontSize: '.75rem', fontWeight: 600, color: '#8B7355',
    fontFamily: "'Nunito', sans-serif", whiteSpace: 'nowrap',
    transition: 'all .15s ease', flexShrink: 0,
    scrollSnapAlign: 'center',
  },
  tabActive: { background: '#F0E8DC', color: '#5C4A32' },
  fadeLeft: {
    position: 'absolute',
    top: 0, bottom: 1, left: 0, width: 28,
    pointerEvents: 'none',
    background: 'linear-gradient(to right, #FAF7F2 0%, rgba(250,247,242,0) 100%)',
  },
  fadeRight: {
    position: 'absolute',
    top: 0, bottom: 1, right: 0, width: 28,
    pointerEvents: 'none',
    background: 'linear-gradient(to left, #FAF7F2 0%, rgba(250,247,242,0) 100%)',
  },
  body:  { flex: 1, overflowY: 'auto', padding: '18px 20px' },
  form:  { display: 'flex', flexDirection: 'column', gap: 12 },
  label: {
    fontSize: '.78rem', fontWeight: 700, color: '#5C4A32',
    fontFamily: "'Nunito', sans-serif",
  },
  optional: { fontWeight: 400, color: '#A09070', fontSize: '.75rem' },
  hint: {
    fontSize: '.74rem', color: '#A09070', fontStyle: 'italic',
    background: '#F5F0E8', borderRadius: 8, padding: '8px 12px',
    fontFamily: "'Nunito', sans-serif", lineHeight: 1.5,
  },
  input: {
    border: '1.5px solid #D4C4A8', borderRadius: 8,
    padding: '9px 12px', fontSize: '.84rem', color: '#2D261E',
    background: '#FFFDF9', outline: 'none', width: '100%',
    fontFamily: "'Nunito', sans-serif", boxSizing: 'border-box',
  },
  textarea: { resize: 'vertical', lineHeight: 1.55 },
  pills:    { display: 'flex', gap: 6, flexWrap: 'wrap' },
  pill: {
    padding: '5px 12px', borderRadius: 20,
    border: '1.5px solid #D4C4A8', background: '#FFFDF9',
    cursor: 'pointer', fontSize: '.76rem', fontWeight: 600,
    color: '#8B7355', fontFamily: "'Nunito', sans-serif",
    transition: 'all .15s ease',
  },
  pillActive: { background: '#C4956A', borderColor: '#C4956A', color: '#fff' },
  footer: {
    padding: '12px 20px', borderTop: '1px solid #EDE7DE',
    display: 'flex', justifyContent: 'flex-end', flexShrink: 0,
  },
  noKey: {
    fontSize: '.76rem', color: '#A09070', fontStyle: 'italic',
    fontFamily: "'Nunito', sans-serif",
  },
  sendBtn: {
    background: '#C4956A', color: '#fff', border: 'none',
    borderRadius: 8, padding: '9px 20px',
    fontSize: '.82rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif", cursor: 'pointer',
  },
  akinatorCard: {
    background: '#F5F0E8', borderRadius: 12, padding: '20px',
    textAlign: 'center', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 10,
  },
  akinatorIcon: { fontSize: 36 },
  akinatorText: {
    fontSize: '.88rem', fontWeight: 700, color: '#2D261E',
    fontFamily: "'Nunito', sans-serif", margin: 0,
  },
  akinatorSub: {
    fontSize: '.78rem', color: '#8B7355',
    fontFamily: "'Nunito', sans-serif", lineHeight: 1.5,
    margin: 0, maxWidth: 380,
  },
  wikiCard: {
    background: '#F5F0E8', borderRadius: 10, padding: 16,
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  wikiThumb: {
    width: '100%', maxHeight: 140, objectFit: 'cover',
    borderRadius: 7,
  },
  wikiTitle: {
    fontSize: '.9rem', fontWeight: 700, color: '#2D261E',
    fontFamily: "'Nunito', sans-serif",
  },
  wikiDesc: {
    fontSize: '.76rem', color: '#8B7355', fontStyle: 'italic',
    fontFamily: "'Nunito', sans-serif",
  },
  wikiExtract: {
    fontSize: '.8rem', color: '#5C4A32', lineHeight: 1.6,
    fontFamily: "'Nunito', sans-serif",
  },
  wikiLink: {
    fontSize: '.76rem', color: '#C4956A', fontWeight: 600,
    fontFamily: "'Nunito', sans-serif",
  },
  wikiError: {
    fontSize: '.76rem', color: '#C4956A', fontStyle: 'italic',
    fontFamily: "'Nunito', sans-serif", padding: '8px 12px',
    background: '#FFF3E8', borderRadius: 8,
  },
}
