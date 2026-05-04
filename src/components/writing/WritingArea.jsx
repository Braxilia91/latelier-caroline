import { useRef, useCallback } from 'react'
import { useAutoSave } from '../../hooks/useAutoSave'
import { Save } from 'lucide-react'

// ── Curseur plume SVG ─────────────────────────────────────────────
// Plume orientée diagonal haut-droite → bas-gauche, pointe = hotspot (3, 27)
const _quillSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <path d="M28 2 C26 4 22 8 16 16 C12 22 8 26 4 30" stroke="#C4956A" stroke-width="3.5" stroke-linecap="round" fill="none"/>
  <path d="M28 2 C30 6 28 12 22 18 C17 23 11 27 5 30" stroke="#E8D5B8" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.8"/>
  <line x1="28" y1="2" x2="4" y2="30" stroke="#8B6445" stroke-width="1.2"/>
  <path d="M4 30 L1 33 L6 29 Z" fill="#2A1A0E"/>
  <circle cx="2.5" cy="31.5" r="1.2" fill="#2A1A0E"/>
</svg>`
const QUILL_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(_quillSvg)}") 3 30, text`

export default function WritingArea({ chapter, updateChapter, recordSession, onDictateInline }) {

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

  const wordCount = chapter.content?.split(/\s+/).filter(Boolean).length ?? 0
  const charCount = chapter.content?.length ?? 0

  return (
    <div style={styles.wrap}>
      {/* Titre du chapitre */}
      <div style={styles.titleWrap}>
        <input
          style={styles.titleInput}
          value={chapter.title}
          onChange={e => updateChapter(chapter.id, { title: e.target.value })}
          placeholder="Titre du chapitre…"
          maxLength={100}
        />
        <input
          style={styles.intentInput}
          value={chapter.intention || ''}
          onChange={e => updateChapter(chapter.id, { intention: e.target.value })}
          placeholder="Mon intention pour ce chapitre… (aide Léa à te guider)"
        />
      </div>

      {/* Zone d'écriture — curseur plume sur toute la zone */}
      <div style={styles.taWrap}>
        <textarea
          style={styles.ta}
          value={chapter.content || ''}
          onChange={e => updateChapter(chapter.id, { content: e.target.value })}
          placeholder="Commence à écrire ici… Prends ton temps. Tes mots comptent."
          spellCheck
          lang="fr"
        />
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <span style={styles.counts}>
          {wordCount.toLocaleString('fr')} mots · {charCount.toLocaleString('fr')} caractères
        </span>
        <span ref={savedRef} style={styles.saved}>
          <Save size={12} /> Sauvegardé
        </span>
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
    cursor: QUILL_CURSOR,
  },
  titleInput: {
    width: '100%',
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '1.6rem', fontWeight: 600,
    color: '#2A1A0E',
    border: 'none', outline: 'none', background: 'transparent',
    caretColor: '#8B6445',
    cursor: QUILL_CURSOR,
    marginBottom: 8,
  },
  intentInput: {
    width: '100%',
    fontFamily: "'Lora', serif", fontStyle: 'italic',
    fontSize: '.82rem', color: '#9C8878',
    border: 'none', outline: 'none', background: 'transparent',
    borderBottom: '1px dashed transparent',
    paddingBottom: 10, caretColor: '#8B6445',
    cursor: QUILL_CURSOR,
    transition: 'border-color .2s',
  },
  // wrapper qui force le curseur sur toute la surface
  taWrap: {
    flex: 1, display: 'flex', flexDirection: 'column',
    cursor: QUILL_CURSOR,
    overflow: 'hidden',
  },
  ta: {
    flex: 1,
    padding: '24px 32px',
    fontFamily: "'Lora', serif",
    fontSize: '1.05rem', lineHeight: 1.95,
    color: '#2A1A0E',
    background: 'transparent',
    border: 'none', resize: 'none', outline: 'none',
    caretColor: '#8B6445',
    cursor: QUILL_CURSOR,
  },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 32px',
    borderTop: '1px solid #EDE7DE',
    background: '#FFFEFB',
  },
  counts: { fontSize: '.72rem', color: '#9C8878', fontFamily: "'Nunito', sans-serif" },
  saved: {
    display: 'flex', alignItems: 'center', gap: 5,
    fontSize: '.72rem', color: '#6B8F71',
    fontFamily: "'Nunito', sans-serif",
    opacity: 0, transition: 'opacity .3s',
  },
}
