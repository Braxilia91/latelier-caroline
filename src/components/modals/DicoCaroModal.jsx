import { useState, useRef, useEffect, useCallback } from 'react'
import Modal from '../ui/Modal'
import { X, BookOpen, Search, Lightbulb, Globe, Wand2, Mic, MicOff } from 'lucide-react'
import { useDicoSearch } from '../../hooks/useDicoSearch'
import { VoiceSearchButton } from '../../lib/voiceSearch'

const TABS = [
  { id: 'synonymes', label: 'Synonymes',   icon: <BookOpen size={13} /> },
  { id: 'cherche',   label: 'Je cherche…', icon: <Search size={13} /> },
  { id: 'wiki',      label: 'Définition',  icon: <Globe size={13} /> },
  { id: 'predictif', label: 'Prédictif',   icon: <Wand2 size={13} /> },
  { id: 'conseil',   label: 'Conseil',     icon: <Lightbulb size={13} /> },
]

const TODAY = new Date().toDateString()

export default function DicoCaroModal({ onClose, coach, hasKey, currentChapter }) {
  const [tab, setTab] = useState('synonymes')

  const tabsRef = useRef(null)
  const tabRefs = useRef({})
  const [canScrollLeft,  setCanScrollLeft]  = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const [result,      setResult]      = useState(null)
  const [word,        setWord]        = useState('')
  const [sentence,    setSentence]    = useState('')
  const [level,       setLevel]       = useState('mixte')
  const [copiedWord,  setCopiedWord]  = useState(null)

  const [wikiQuery,       setWikiQuery]       = useState('')
  const [wikiResult,      setWikiResult]      = useState(null)
  const [wikiLoading,     setWikiLoading]     = useState(false)
  const [wikiError,       setWikiError]       = useState('')
  const [wikiSuggestions, setWikiSuggestions] = useState([])

  const [councilDone, setCouncilDone] = useState(
    () => localStorage.getItem('dicoCaroConseil') === TODAY
  )

  // ─ Hook recherche lexicale (onglet "Je cherche")
  const dicoSearch = useDicoSearch({ apiKey: coach?.apiKey, openAiKey: null })

  const { loading, getSynonyms, searchWord: legacySearchWord, defineWord, getPredictiveWords, getDiscovery } = coach
  const hasChapterContent = !!(currentChapter?.content?.trim())
  const wikiUrl = wikiResult?.content_urls?.desktop?.page

  // ─ Scroll tabs
  const updateScrollState = () => {
    const el = tabsRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }
  useEffect(() => {
    const t = setTimeout(updateScrollState, 50)
    window.addEventListener('resize', updateScrollState)
    return () => { clearTimeout(t); window.removeEventListener('resize', updateScrollState) }
  }, [])
  useEffect(() => {
    const btn = tabRefs.current[tab]
    if (btn && typeof btn.scrollIntoView === 'function') {
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
    const t = setTimeout(updateScrollState, 350)
    return () => clearTimeout(t)
  }, [tab])

  const switchTab = (id) => { setTab(id); setResult(null) }

  // ─ Wiki
  const handleWikiSearch = async (overrideTerm) => {
    const isStringTerm = typeof overrideTerm === 'string'
    const term = (isStringTerm ? overrideTerm : wikiQuery).trim()
    if (!term) return
    if (isStringTerm) setWikiQuery(overrideTerm)
    setWikiLoading(true)
    setWikiResult(null)
    setWikiError('')
    setWikiSuggestions([])
    try {
      const res = await fetch(`https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`)
      if (!res.ok) throw new Error('not_found')
      setWikiResult(await res.json())
    } catch {
      try {
        const sugRes = await fetch(`https://fr.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(term)}&limit=6&namespace=0&format=json&origin=*`)
        if (sugRes.ok) {
          const sugData = await sugRes.json()
          const suggestions = Array.isArray(sugData?.[1]) ? sugData[1].filter(Boolean) : []
          if (suggestions.length > 0) setWikiSuggestions(suggestions)
          else setWikiError('Aucun résultat. Essaie avec un autre terme ou une autre orthographe.')
        } else {
          setWikiError('Aucun résultat. Essaie avec un autre terme ou une autre orthographe.')
        }
      } catch {
        setWikiError('Aucun résultat. Essaie avec un autre terme ou une autre orthographe.')
      }
    } finally {
      setWikiLoading(false)
    }
  }

  // ─ Copier un mot
  const copyWord = useCallback(async (rawWord) => {
    const w = String(rawWord || '').trim()
    if (!w) return
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(w)
      else {
        const ta = document.createElement('textarea')
        ta.value = w; ta.style.position = 'fixed'; ta.style.left = '-9999px'
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
      }
      setCopiedWord(w)
      setTimeout(() => setCopiedWord(p => p === w ? null : p), 1500)
    } catch (_) {
      setCopiedWord('échec — copie manuelle')
      setTimeout(() => setCopiedWord(null), 2500)
    }
  }, [])

  // ─ Explication dans le chat
  const handleExplain = async (w) => {
    if (!defineWord) return
    await defineWord(w)
    onClose()
  }

  // ─ handleSend (onglets synonymes, predictif, conseil)
  const handleSend = async () => {
    if (loading) return
    setResult(null)
    let text = null
    if (tab === 'synonymes') {
      if (!word.trim()) return
      text = await getSynonyms({ word, sentence, level })
    } else if (tab === 'predictif') {
      if (!hasChapterContent) return
      text = await getPredictiveWords()
    } else if (tab === 'conseil') {
      text = await getDiscovery()
      localStorage.setItem('dicoCaroConseil', TODAY)
      setCouncilDone(true)
    }
    if (text) setResult(text)
    else onClose()
  }

  const resetForm = () => setResult(null)

  const canSend = hasKey && !loading && !result && (
    (tab === 'synonymes' && word.trim().length > 0)   ||
    (tab === 'predictif' && hasChapterContent)         ||
    (tab === 'conseil'   && !councilDone)
  )

  const showFooter = hasKey
    && tab !== 'wiki'
    && tab !== 'cherche'
    && !(tab === 'conseil' && councilDone && !result)

  // ─ Phase label pour l'onglet "Je cherche"
  const phaseLabel = {
    idle:       null,
    suggesting: 'Suggestions',
    guessing:   'Léa devine…',
    confirming: 'Est-ce le bon mot ?',
    explaining: 'Mot trouvé !',
    error:      'Erreur',
  }[dicoSearch.state.phase]

  return (
    <Modal onClose={onClose} ariaLabel="Dictionnaire DicoCaro" overlayStyle={S.overlay} modalStyle={S.modal}>

      {/* ─ Header */}
      <div style={S.hdr}>
        <div style={S.hdrLeft}>
          <span style={S.hdrIcon}>📖</span>
          <div>
            <div style={S.hdrTitle}>DicoCaro</div>
            <div style={S.hdrSub}>Ton dictionnaire personnel avec Léa</div>
          </div>
        </div>
        <button style={S.closeBtn} onClick={onClose} aria-label="Fermer le dictionnaire"><X size={18} /></button>
      </div>

      {/* ─ Tabs */}
      <div style={S.tabsWrap}>
        <div style={S.tabs} ref={tabsRef} onScroll={updateScrollState}>
          {TABS.map(t => (
            <button
              key={t.id}
              ref={el => (tabRefs.current[t.id] = el)}
              style={{ ...S.tab, ...(tab === t.id ? S.tabActive : {}) }}
              onClick={() => switchTab(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        {canScrollLeft  && <div style={S.fadeLeft}  aria-hidden="true" />}
        {canScrollRight && <div style={S.fadeRight} aria-hidden="true" />}
      </div>

      {/* ─ Body */}
      <div style={S.body}>

        {/* Résultat Léa (onglets synonymes/predictif/conseil) */}
        {result && (
          <div style={S.resultWrap}>
            <div style={S.resultHdr}>
              <span style={S.resultLea}>🌿 Léa</span>
              <button style={S.resultNew} onClick={resetForm}>Nouvelle recherche</button>
            </div>
            <div style={S.resultText}>{result}</div>
          </div>
        )}

        {/* ─ Onglet Synonymes */}
        {!result && tab === 'synonymes' && (
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

        {/* ─ Onglet Je cherche — nouvelle UX */}
        {tab === 'cherche' && (
          <div style={S.form}>

            {/* Phase idle */}
            {dicoSearch.state.phase === 'idle' && (
              <>
                <label style={S.label}>Décris ce que tu veux dire — Léa trouve le mot</label>
                <div style={S.hint}>
                  Tu peux décrire une émotion, un adjectif, un synonyme, une sensation…
                  Par exemple : <em>"la tristesse douce qu'on ressent devant quelque chose de beau qui va disparaître"</em>
                </div>
                <div style={S.searchRow}>
                  <input
                    style={{ ...S.input, flex: 1 }}
                    value={dicoSearch.state.query}
                    onChange={e => dicoSearch.setQuery(e.target.value)}
                    placeholder="Décris l'émotion, l'image, la nuance…"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter' && dicoSearch.state.query.trim().length >= 2) {
                        dicoSearch.submitQuery()
                      }
                    }}
                  />
                  {hasKey && (
                    <VoiceSearchButton
                      onTranscript={text => dicoSearch.setQuery(text)}
                      openAiKey={coach?.openAiKey}
                      maxDuration={10000}
                    />
                  )}
                </div>
                {!hasKey && (
                  <p style={S.noKey}>Configure ta clé API Anthropic dans les réglages pour activer Léa.</p>
                )}
                {hasKey && dicoSearch.state.query.trim().length >= 2 && (
                  <button
                    style={{ ...S.sendBtn, marginTop: 4 }}
                    onClick={() => dicoSearch.submitQuery()}
                    disabled={dicoSearch.state.isLoading}
                  >
                    {dicoSearch.state.isLoading ? '…' : 'Demander à Léa →'}
                  </button>
                )}
              </>
            )}

            {/* Suggestions autocomplete */}
            {dicoSearch.state.phase === 'suggesting' && dicoSearch.state.suggestions.length > 0 && (
              <div style={S.suggestWrap}>
                <div style={S.hint}>Clique sur un mot pour voir sa définition directement :</div>
                <div style={S.suggestList}>
                  {dicoSearch.state.suggestions.map(s => (
                    <button
                      key={s.word}
                      style={S.suggestChip}
                      onClick={() => dicoSearch.selectSuggestion(s.word)}
                    >
                      {s.word}
                    </button>
                  ))}
                </div>
                <div style={S.akinFooterActions}>
                  <button style={S.akinSecondary} onClick={() => dicoSearch.submitQuery()}>
                    Ou lancer la recherche complète avec Léa →
                  </button>
                </div>
              </div>
            )}

            {/* Phase guessing — Léa devine */}
            {(dicoSearch.state.phase === 'guessing' || dicoSearch.state.phase === 'confirming') && (() => {
              const guess = dicoSearch.state.guesses[dicoSearch.state.activeGuessIndex]
              return guess ? (
                <div style={S.form}>
                  <div style={S.akinatorCard}>
                    <div style={S.guessBadge}>Proposition {dicoSearch.state.activeGuessIndex + 1} / {dicoSearch.state.guesses.length}</div>
                    <div style={S.guessWord}>{guess.word}</div>
                    {guess.why && <div style={S.guessWhy}>{guess.why}</div>}
                    <div style={S.guessConf}>Confiance : {Math.round((guess.confidence || 0) * 100)} %</div>
                    <div style={S.guessActions}>
                      <button
                        style={S.guessReject}
                        onClick={() => dicoSearch.rejectGuess()}
                        disabled={dicoSearch.state.isLoading}
                      >
                        ❌ C'est pas ça
                      </button>
                      <button
                        style={S.guessConfirm}
                        onClick={() => dicoSearch.confirmGuess()}
                        disabled={dicoSearch.state.isLoading}
                      >
                        ✅ C'est ça !
                      </button>
                    </div>
                  </div>
                  {dicoSearch.state.rejectedWords.length > 0 && (
                    <div style={S.hint}>Déjà rejeté : {dicoSearch.state.rejectedWords.join(', ')}</div>
                  )}
                  <div style={S.akinFooterActions}>
                    <button style={S.akinSecondary} onClick={() => dicoSearch.reset()}>Recommencer</button>
                  </div>
                </div>
              ) : null
            })()}

            {/* Phase isLoading */}
            {dicoSearch.state.isLoading && (
              <div style={S.akinatorCard}>
                <div style={S.akinatorIcon}>💭</div>
                <p style={S.akinatorText}>Léa cherche…</p>
              </div>
            )}

            {/* Phase explaining — mot trouvé */}
            {dicoSearch.state.phase === 'explaining' && dicoSearch.state.confirmedWord && (
              <div style={S.form}>
                <div style={S.explainCard}>
                  <div style={S.explainTitle}>{dicoSearch.state.confirmedWord}</div>
                  {dicoSearch.state.explanation?.definition && (
                    <div style={S.explainDef}>{dicoSearch.state.explanation.definition}</div>
                  )}
                  {dicoSearch.state.explanation?.trivia && (
                    <div style={S.explainTrivia}>
                      <span style={S.explainTriviaIcon}>💡</span>
                      {dicoSearch.state.explanation.trivia}
                    </div>
                  )}
                  <div style={S.explainActions}>
                    <button
                      style={{ ...S.akinAction, ...(copiedWord === dicoSearch.state.confirmedWord ? S.akinActionDone : {}) }}
                      onClick={() => copyWord(dicoSearch.state.confirmedWord)}
                    >
                      {copiedWord === dicoSearch.state.confirmedWord ? '✓ Copié' : '📋 Copier'}
                    </button>
                    <button style={S.akinAction} onClick={() => handleExplain(dicoSearch.state.confirmedWord)}>
                      📖 Définition complète
                    </button>
                    <button style={S.akinSecondary} onClick={() => dicoSearch.reset()}>🔄 Nouvelle recherche</button>
                  </div>
                </div>
              </div>
            )}

            {/* Phase error */}
            {dicoSearch.state.phase === 'error' && (
              <div style={S.akinatorCard}>
                <div style={S.akinatorIcon}>⚠️</div>
                <p style={S.akinatorText}>{dicoSearch.state.error || 'Une erreur est survenue.'}</p>
                <button style={S.startBtn} onClick={() => dicoSearch.reset()}>Réessayer</button>
              </div>
            )}

          </div>
        )}

        {/* ─ Onglet Wiki */}
        {tab === 'wiki' && (
          <div style={S.form}>
            <label style={S.label}>Recherche une définition dans Wikipedia</label>
            <div style={S.hint}>Sans clé API — résultat instantané depuis l'encyclopédie francophone.</div>
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
                style={{ ...S.sendBtn, opacity: wikiQuery.trim() && !wikiLoading ? 1 : .45, cursor: wikiQuery.trim() && !wikiLoading ? 'pointer' : 'not-allowed', flexShrink: 0 }}
                onClick={() => handleWikiSearch()}
                disabled={!wikiQuery.trim() || wikiLoading}
              >
                {wikiLoading ? '…' : 'Chercher'}
              </button>
            </div>
            {wikiError && <div style={S.wikiError}>{wikiError}</div>}
            {wikiSuggestions.length > 0 && !wikiResult && (
              <div style={S.wikiSugWrap}>
                <div style={S.wikiSugLabel}>Voulais-tu dire ?</div>
                <div style={S.wikiSugList}>
                  {wikiSuggestions.map(s => (
                    <button key={s} style={S.wikiSugChip} onClick={() => handleWikiSearch(s)} disabled={wikiLoading}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {wikiResult && (
              <div style={S.wikiCard}>
                {wikiResult.thumbnail?.source && (
                  <img src={wikiResult.thumbnail.source} alt={wikiResult.title} style={S.wikiThumb} />
                )}
                <div style={S.wikiTitle}>{wikiResult.title}</div>
                {wikiResult.description && <div style={S.wikiDesc}>{wikiResult.description}</div>}
                {wikiResult.extract && (
                  <div style={S.wikiExtract}>
                    {wikiResult.extract.slice(0, 400)}{wikiResult.extract.length > 400 ? '…' : ''}
                  </div>
                )}
                {wikiUrl && <a href={wikiUrl} target="_blank" rel="noopener noreferrer" style={S.wikiLink}>Lire sur Wikipedia →</a>}
              </div>
            )}
          </div>
        )}

        {/* ─ Onglet Prédictif */}
        {!result && tab === 'predictif' && (
          <div style={S.form}>
            <div style={S.akinatorCard}>
              <div style={S.akinatorIcon}>🔮</div>
              <p style={S.akinatorText}>Anticiper tes prochains mots</p>
              <p style={S.akinatorSub}>
                Léa analyse ce que tu es en train d'écrire et prédit les mots dont tu pourrais avoir besoin dans les prochains paragraphes.
              </p>
              {!hasChapterContent && (
                <p style={{ ...S.akinatorSub, color: '#C4956A', fontStyle: 'italic' }}>
                  Commence à écrire dans ton chapitre pour activer ce mode.
                </p>
              )}
              {hasChapterContent && (
                <p style={{ ...S.akinatorSub, color: '#6B8F71', fontStyle: 'italic' }}>
                  Ton chapitre est prêt — Léa va analyser ton style et anticiper les prochains mots dont tu pourrais avoir besoin.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ─ Onglet Conseil */}
        {!result && tab === 'conseil' && (
          <div style={S.form}>
            <div style={S.akinatorCard}>
              <div style={S.akinatorIcon}>💡</div>
              <p style={S.akinatorText}>Découverte du jour</p>
              <p style={S.akinatorSub}>
                Léa choisit un mot rare, une tournure stylistique ou une figure de style que tu pourrais intégrer dans ton écriture autobiographique.
              </p>
              {councilDone && !result && (
                <p style={{ ...S.akinatorSub, color: '#6B8F71', fontStyle: 'italic' }}>
                  Tu as déjà reçu ton conseil du jour — reviens demain pour un nouveau mot ✨
                </p>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ─ Footer */}
      {showFooter && (
        <div style={S.footer}>
          {!hasKey && <p style={S.noKey}>Configure ta clé API Anthropic dans les réglages pour activer Léa.</p>}
          {hasKey && result && <button style={S.sendBtn} onClick={onClose}>Fermer</button>}
          {hasKey && !result && (
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
    </Modal>
  )
}

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
  tabsWrap: { position: 'relative', flexShrink: 0, borderBottom: '1px solid #EDE7DE' },
  tabs: { display: 'flex', gap: 4, padding: '10px 16px 0', flexWrap: 'wrap' },
  tab: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '6px 12px', borderRadius: '8px 8px 0 0',
    border: 'none', background: 'none', cursor: 'pointer',
    fontSize: '.75rem', fontWeight: 600, color: '#8B7355',
    fontFamily: "'Nunito', sans-serif", whiteSpace: 'nowrap',
    transition: 'all .15s ease', flexShrink: 0,
  },
  tabActive: { background: '#F0E8DC', color: '#5C4A32' },
  fadeLeft: {
    position: 'absolute', top: 0, bottom: 1, left: 0, width: 28,
    pointerEvents: 'none',
    background: 'linear-gradient(to right, #FAF7F2 0%, rgba(250,247,242,0) 100%)',
  },
  fadeRight: {
    position: 'absolute', top: 0, bottom: 1, right: 0, width: 28,
    pointerEvents: 'none',
    background: 'linear-gradient(to left, #FAF7F2 0%, rgba(250,247,242,0) 100%)',
  },
  body:  { flex: 1, overflowY: 'auto', padding: '18px 20px' },
  form:  { display: 'flex', flexDirection: 'column', gap: 12 },
  label: { fontSize: '.78rem', fontWeight: 700, color: '#5C4A32', fontFamily: "'Nunito', sans-serif" },
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
  noKey: { fontSize: '.76rem', color: '#A09070', fontStyle: 'italic', fontFamily: "'Nunito', sans-serif" },
  sendBtn: {
    background: '#C4956A', color: '#fff', border: 'none',
    borderRadius: 8, padding: '9px 20px',
    fontSize: '.82rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif", cursor: 'pointer',
  },
  startBtn: {
    background: '#C4956A', color: '#fff', border: 'none',
    borderRadius: 8, padding: '10px 22px',
    fontSize: '.84rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif", cursor: 'pointer', marginTop: 4,
  },
  // Résultat (synonymes/predictif/conseil)
  resultWrap: { display: 'flex', flexDirection: 'column', gap: 12 },
  resultHdr:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  resultLea:  { fontSize: '.8rem', fontWeight: 700, color: '#6B8F71', fontFamily: "'Nunito', sans-serif" },
  resultNew:  {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: '.74rem', color: '#8B7355', fontWeight: 600,
    fontFamily: "'Nunito', sans-serif", textDecoration: 'underline', padding: 0,
  },
  resultText: {
    background: '#F5F0E8', borderRadius: 10, padding: '14px 16px',
    fontSize: '.84rem', color: '#2D261E', lineHeight: 1.65,
    fontFamily: "'Nunito', sans-serif", whiteSpace: 'pre-wrap',
  },
  // Onglet cherche — recherche row
  searchRow: { display: 'flex', gap: 8, alignItems: 'center' },
  // Suggestions autocomplete
  suggestWrap: { display: 'flex', flexDirection: 'column', gap: 8 },
  suggestList: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  suggestChip: {
    background: '#FFFDF9', border: '1.5px solid #D4C4A8',
    borderRadius: 16, padding: '4px 12px',
    fontSize: '.74rem', fontWeight: 600, color: '#5C4A32',
    fontFamily: "'Nunito', sans-serif", cursor: 'pointer',
    transition: 'all .15s',
  },
  // Guess card
  akinatorCard: {
    background: '#F5F0E8', borderRadius: 12, padding: '20px',
    textAlign: 'center', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 10,
  },
  akinatorIcon: { fontSize: 36 },
  akinatorText: { fontSize: '.88rem', fontWeight: 700, color: '#2D261E', fontFamily: "'Nunito', sans-serif", margin: 0 },
  akinatorSub:  { fontSize: '.78rem', color: '#8B7355', fontFamily: "'Nunito', sans-serif", lineHeight: 1.5, margin: 0, maxWidth: 380 },
  guessBadge: {
    fontSize: '.7rem', fontWeight: 700, color: '#C4956A',
    fontFamily: "'Nunito', sans-serif", letterSpacing: '.04em', textTransform: 'uppercase',
  },
  guessWord: {
    fontSize: '1.6rem', fontWeight: 800, color: '#2D261E',
    fontFamily: "'Nunito', sans-serif", letterSpacing: '.01em',
  },
  guessWhy: {
    fontSize: '.8rem', color: '#5C4A32', lineHeight: 1.5,
    fontFamily: "'Nunito', sans-serif", fontStyle: 'italic',
    maxWidth: 360,
  },
  guessConf: {
    fontSize: '.7rem', color: '#A09070',
    fontFamily: "'Nunito', sans-serif",
  },
  guessActions: { display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' },
  guessReject: {
    background: '#FFFDF9', border: '1.5px solid #D4C4A8',
    borderRadius: 8, padding: '8px 18px',
    fontSize: '.82rem', fontWeight: 700, color: '#8B7355',
    fontFamily: "'Nunito', sans-serif", cursor: 'pointer',
  },
  guessConfirm: {
    background: '#6B8F71', color: '#fff', border: 'none',
    borderRadius: 8, padding: '8px 18px',
    fontSize: '.82rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif", cursor: 'pointer',
  },
  // Explain card
  explainCard: {
    background: '#F5F0E8', borderRadius: 12, padding: 20,
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  explainTitle: {
    fontSize: '1.4rem', fontWeight: 800, color: '#2D261E',
    fontFamily: "'Nunito', sans-serif",
  },
  explainDef: {
    fontSize: '.84rem', color: '#2D261E', lineHeight: 1.65,
    fontFamily: "'Nunito', sans-serif",
  },
  explainTrivia: {
    display: 'flex', gap: 8, alignItems: 'flex-start',
    background: '#EDE7DE', borderRadius: 8, padding: '10px 12px',
    fontSize: '.78rem', color: '#5C4A32', lineHeight: 1.5,
    fontFamily: "'Nunito', sans-serif",
  },
  explainTriviaIcon: { flexShrink: 0, fontSize: '1rem', marginTop: 1 },
  explainActions: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  // Actions shared
  akinFooterActions: { display: 'flex', justifyContent: 'flex-end', marginTop: 4 },
  akinSecondary: {
    background: 'none', border: 'none',
    color: '#8B7355', fontSize: '.76rem', fontWeight: 600,
    fontFamily: "'Nunito', sans-serif", cursor: 'pointer',
    textDecoration: 'underline', padding: 0,
  },
  akinAction: {
    background: '#FFFDF9', border: '1.5px solid #D4C4A8',
    borderRadius: 6, padding: '5px 14px',
    fontSize: '.74rem', fontWeight: 700, color: '#5C4A32',
    fontFamily: "'Nunito', sans-serif", cursor: 'pointer',
  },
  akinActionDone: { background: '#E8DDC9', borderColor: '#C4956A', color: '#5C4A32' },
  // Wiki
  wikiCard: { background: '#F5F0E8', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 },
  wikiThumb: { width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 7 },
  wikiTitle: { fontSize: '.9rem', fontWeight: 700, color: '#2D261E', fontFamily: "'Nunito', sans-serif" },
  wikiDesc:  { fontSize: '.76rem', color: '#8B7355', fontStyle: 'italic', fontFamily: "'Nunito', sans-serif" },
  wikiExtract: { fontSize: '.8rem', color: '#5C4A32', lineHeight: 1.6, fontFamily: "'Nunito', sans-serif" },
  wikiLink:  { fontSize: '.76rem', color: '#C4956A', fontWeight: 600, fontFamily: "'Nunito', sans-serif" },
  wikiError: { fontSize: '.76rem', color: '#C4956A', fontStyle: 'italic', fontFamily: "'Nunito', sans-serif", padding: '8px 12px', background: '#FFF3E8', borderRadius: 8 },
  wikiSugWrap:  { background: '#F5F0E8', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 },
  wikiSugLabel: { fontSize: '.76rem', fontWeight: 700, color: '#5C4A32', fontFamily: "'Nunito', sans-serif" },
  wikiSugList:  { display: 'flex', flexWrap: 'wrap', gap: 6 },
  wikiSugChip:  {
    background: '#FFFDF9', border: '1.5px solid #D4C4A8',
    borderRadius: 16, padding: '4px 12px',
    fontSize: '.74rem', fontWeight: 600, color: '#5C4A32',
    fontFamily: "'Nunito', sans-serif", cursor: 'pointer', transition: 'all .15s',
  },
}
