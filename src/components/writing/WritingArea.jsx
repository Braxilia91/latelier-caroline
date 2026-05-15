import { useRef, useCallback } from 'react'
import { useAutoSave } from '../../hooks/useAutoSave'
import { Save } from 'lucide-react'

// ── Thèmes visuels ───────────────────────────────────────────────────────────────
const THEMES = {
  jour:   { bg: '#FAF7F2', areaBg: '#FAF7F2', text: '#2A1A0E', caret: '#8B6445' },
  soir:   { bg: '#F5EDD8', areaBg: '#EFE4C8', text: '#2A1A0E', caret: '#A0793D' },
  bougie: { bg: '#1C1208', areaBg: '#140D04', text: '#E8D5B8', caret: '#C4956A' },
}
const FONT_SIZES = { s: '0.9rem', m: '1.05rem', l: '1.25rem', xl: '1.5rem' }
const WIDTHS     = { confort: '680px', full: '100%' }

const TITLE_MAX = 100
const TITLE_WARN = 80

export default function WritingArea({ chapter, updateChapter, recordSession,
                                       editorFont = 'm', editorTheme = 'jour', editorWidth = 'confort' }) {

  const savedRef = useRef(null)

  const saveContent = useCallback((val) => {
    if (chapter) {
      updateChapter(chapter.id, { content: val })
      recordSession()
      if (savedRef.current) {
        savedRef.current.style.opacity = '1'
        setTimeout(() => { if (savedRef.current) savedRef.current.style.opacity = '0' }, 1800)
      }
    }
  }, [chapter, updateChapter, recordSession])

  useAutoSave(chapter?.content ?? '', saveContent)

  if (!chapter) return (
    <div style={styles.empty}>
      <p style={styles.emptyText}>
        Choisis un chapitre dans le panneau de gauche,<br />
        ou crée-en un nouveau pour commencer ✍️
      </p>
    </div>
  )

  const wordCount  = chapter.content?.split(/\s+/).filter(Boolean).length ?? 0
  const charCount  = chapter.content?.length ?? 0
  const titleLen   = chapter.title?.length ?? 0
  const titleNear  = titleLen >= TITLE_WARN
  const titleAtMax = titleLen >= TITLE_MAX

  const theme = THEMES[editorTheme] || THEMES.jour
  const fSize = FONT_SIZES[editorFont] || FONT_SIZES.m
  const maxW  = WIDTHS[editorWidth]    || WIDTHS.confort

  const titleCountColor = titleAtMax
    ? '#C0392B'
    : titleNear
      ? '#E67E22'
      : (editorTheme === 'bougie' ? '#8B7355' : '#9C8878')

  return (
    <div style={{ ...styles.wrap, background: theme.bg }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: maxW, width: '100%', margin: '0 auto' }}>

        {/* Titre du chapitre */}
        <div style={{ ...styles.titleWrap, background: theme.bg, borderBottomColor: editorTheme === 'bougie' ? '#3A2A14' : '#E8D5B8' }}>
          <input
            style={{ ...styles.titleInput, color: theme.text, caretColor: theme.caret }}
            value={chapter.title}
            onChange={e => updateChapter(chapter.id, { title: e.target.value })}
            placeholder="Titre du chapitre…"
            maxLength={TITLE_MAX}
            aria-label="Titre du chapitre"
          />
          {/* #15 — Compteur visible dès 80 chars, rouge à 100 */}
          {titleNear && (
            <p style={{ ...styles.titleCounter, color: titleCountColor }}>
              {titleLen}/{TITLE_MAX} caractères{titleAtMax ? ' — limite atteinte' : ''}
            </p>
          )}
          <input
            style={{ ...styles.intentInput, color: editorTheme === 'bougie' ? '#8B7355' : '#9C8878', caretColor: theme.caret }}
            value={chapter.intention || ''}
            onChange={e => updateChapter(chapter.id, { intention: e.target.value })}
            placeholder="Mon intention pour ce chapitre… (aide Léa à te guider)"
          />
        </div>

        {/* Zone d'écriture */}
        <textarea
          style={{ ...styles.ta, background: theme.areaBg, color: theme.text, caretColor: theme.caret, fontSize: fSize }}
          value={chapter.content || ''}
          onChange={e => updateChapter(chapter.id, { content: e.target.value })}
          placeholder="Commence à écrire ici… Prends ton temps. Tes mots comptent."
          spellCheck
          lang="fr"
        />

        {/* Footer */}
        <div style={{ ...styles.footer, background: theme.bg, borderTopColor: editorTheme === 'bougie' ? '#3A2A14' : '#EDE7DE' }}>
          <span style={{ ...styles.counts, color: editorTheme === 'bougie' ? '#6B5A3E' : '#9C8878' }}>
            {wordCount.toLocaleString('fr')} mots · {charCount.toLocaleString('fr')} caractères
          </span>
          <span ref={savedRef} style={styles.saved}>
            <Save size={12} /> Sauvegardé
          </span>
        </div>

      </div>
    </div>
  )
}

const styles = {
  wrap: {
    flex: 1, display: 'flex', flexDirection: 'column',
    background: '#FAF7F2', overflow: 'hidden',
  },
  empty: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#FAF7F2',
  },
  emptyText: {
    fontFamily: "'Lora', serif", fontStyle: 'italic',
    color: '#9C8878', textAlign: 'center', lineHeight: 2, fontSize: '.95rem',
  },
  titleWrap: {
    padding: '20px 32px 0',
    borderBottom: '1px dashed #E8D5B8',
    background: '#FFFEFB',
  },
  titleInput: {
    width: '100%',
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '1.6rem', fontWeight: 600,
    color: '#2A1A0E',
    border: 'none', background: 'transparent',
    caretColor: '#8B6445',
    marginBottom: 4,
  },
  // #15 — compteur discret sous le titre
  titleCounter: {
    fontSize: '.7rem',
    fontFamily: "'Nunito', sans-serif",
    margin: '0 0 6px',
    transition: 'color .2s',
  },
  intentInput: {
    width: '100%',
    fontFamily: "'Lora', serif", fontStyle: 'italic',
    fontSize: '.82rem', color: '#9C8878',
    border: 'none', background: 'transparent',
    borderBottom: '1px dashed transparent',
    paddingBottom: 10, caretColor: '#8B6445',
    transition: 'border-color .2s',
  },
  ta: {
    flex: 1,
    padding: '24px 32px',
    fontFamily: "'Lora', serif",
    fontSize: '1.05rem', lineHeight: 1.95,
    color: '#2A1A0E',
    background: '#FAF7F2',
    border: 'none', resize: 'none',
    caretColor: '#8B6445',
  },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 32px',
    borderTop: '1px solid #EDE7DE',
    background: '#FFFEFB',
  },
  counts: { fontSize: '.72rem', color: '#9C8878', fontFamily: "'Nunito', sans-serif" },
  saved:  {
    display: 'flex', alignItems: 'center', gap: 5,
    fontSize: '.72rem', color: '#6B8F71',
    fontFamily: "'Nunito', sans-serif",
    opacity: 0, transition: 'opacity .3s',
  },
}
