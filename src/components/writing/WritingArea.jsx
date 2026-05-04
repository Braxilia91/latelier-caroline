import { useRef, useCallback } from 'react'
import { useAutoSave } from '../../hooks/useAutoSave'
import { Save } from 'lucide-react'

export default function WritingArea({ chapter, updateChapter, recordSession, onDictateInline }) {

  const savedRef = useRef(null)

  // Auto-save content
  const saveContent = useCallback((val) => {
    if (chapter) {
      updateChapter(chapter.id, { content: val })
      recordSession()
      // Flash saved indicator
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

      {/* Zone d'écriture */}
      <textarea
        style={styles.ta}
        value={chapter.content || ''}
        onChange={e => updateChapter(chapter.id, { content: e.target.value })}
        placeholder="Commence à écrire ici… Prends ton temps. Tes mots comptent."
        spellCheck
        lang="fr"
      />

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
  },
  titleInput: {
    width: '100%',
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: '1.6rem', fontWeight: 600,
    color: '#2A1A0E',
    border: 'none', outline: 'none', background: 'transparent',
    caretColor: '#8B6445',
    marginBottom: 8,
  },
  intentInput: {
    width: '100%',
    fontFamily: "'Lora', serif", fontStyle: 'italic',
    fontSize: '.82rem', color: '#9C8878',
    border: 'none', outline: 'none', background: 'transparent',
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
    border: 'none', resize: 'none', outline: 'none',
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
