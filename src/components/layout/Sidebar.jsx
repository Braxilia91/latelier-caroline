import { useState } from 'react'
import { Plus, BookOpen, Trash2, GripVertical } from 'lucide-react'

export default function Sidebar({ chapters, currentId, setCurrentId, createChapter, removeChapter, totalWords, streak }) {

  const [confirmDel, setConfirmDel] = useState(null)

  const handleDelete = async (id) => {
    if (confirmDel === id) {
      await removeChapter(id)
      setConfirmDel(null)
    } else {
      setConfirmDel(id)
      setTimeout(() => setConfirmDel(null), 3000)
    }
  }

  const wordCount = (text) => text?.split(/\s+/).filter(Boolean).length ?? 0

  return (
    <aside style={styles.sb}>
      {/* Stats */}
      <div style={styles.stats}>
        <div style={styles.stat}>
          <span style={styles.statNum}>{totalWords.toLocaleString('fr')}</span>
          <span style={styles.statLbl}>mots</span>
        </div>
        <div style={styles.statDiv} />
        <div style={styles.stat}>
          <span style={styles.statNum}>{chapters.length}</span>
          <span style={styles.statLbl}>chapitres</span>
        </div>
        <div style={styles.statDiv} />
        <div style={styles.stat}>
          <span style={styles.statNum}>{streak}</span>
          <span style={styles.statLbl}>🔥 jours</span>
        </div>
      </div>

      {/* Header */}
      <div style={styles.hdr}>
        <span style={styles.hdrTitle}>Mes chapitres</span>
        <button style={styles.addBtn} onClick={createChapter} title="Nouveau chapitre">
          <Plus size={16} />
        </button>
      </div>

      {/* Liste */}
      <div style={styles.list}>
        {chapters.length === 0 && (
          <div style={styles.empty}>
            <BookOpen size={28} color="#DDD5C8" />
            <p>Commence ton premier chapitre</p>
            <button style={styles.firstBtn} onClick={createChapter}>
              + Nouveau chapitre
            </button>
          </div>
        )}

        {chapters.map(ch => (
          <div
            key={ch.id}
            style={{
              ...styles.item,
              ...(ch.id === currentId ? styles.itemActive : {}),
            }}
            onClick={() => setCurrentId(ch.id)}
          >
            <GripVertical size={14} color="#DDD5C8" style={{ flexShrink: 0 }} />
            <div style={styles.itemBody}>
              <div style={styles.itemTitle}>{ch.title || 'Sans titre'}</div>
              <div style={styles.itemMeta}>
                {wordCount(ch.content).toLocaleString('fr')} mots
                {ch.updatedAt && ` · ${new Date(ch.updatedAt).toLocaleDateString('fr', { day: 'numeric', month: 'short' })}`}
              </div>
            </div>
            <button
              style={{
                ...styles.delBtn,
                color: confirmDel === ch.id ? '#C0392B' : undefined,
              }}
              onClick={e => { e.stopPropagation(); handleDelete(ch.id) }}
              title={confirmDel === ch.id ? 'Confirmer la suppression' : 'Supprimer'}
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </aside>
  )
}

const styles = {
  sb: {
    width: 220,
    flexShrink: 0,
    background: '#FFFEFB',
    borderRight: '1px solid #EDE7DE',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  stats: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: '12px 8px',
    borderBottom: '1px solid #EDE7DE',
    background: '#FAF7F2',
  },
  stat:    { textAlign: 'center' },
  statNum: { display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', fontWeight: 600, color: '#8B6445' },
  statLbl: { fontSize: '.65rem', color: '#9C8878', textTransform: 'uppercase', letterSpacing: '.5px' },
  statDiv: { width: 1, height: 28, background: '#EDE7DE' },
  hdr: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 12px 6px',
  },
  hdrTitle: { fontSize: '.72rem', fontWeight: 800, color: '#9C8878', textTransform: 'uppercase', letterSpacing: '1px' },
  addBtn: {
    width: 28, height: 28,
    borderRadius: 8,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #8B6445, #C4956A)',
    color: '#fff',
    border: 'none', cursor: 'pointer',
    transition: 'filter .15s',
  },
  list: { flex: 1, overflowY: 'auto', padding: '4px 8px 12px' },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 10, padding: '32px 16px', textAlign: 'center',
    color: '#9C8878', fontSize: '.82rem',
  },
  firstBtn: {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #8B6445, #C4956A)',
    color: '#fff',
    border: 'none', borderRadius: 10,
    fontSize: '.8rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer',
    marginTop: 4,
  },
  item: {
    display: 'flex', alignItems: 'flex-start', gap: 6,
    padding: '9px 8px',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'background .15s',
    marginBottom: 2,
  },
  itemActive: {
    background: '#F7EFE3',
    outline: '1.5px solid #E8D5B8',
  },
  itemBody: { flex: 1, minWidth: 0 },
  itemTitle: {
    fontFamily: "'Lora', serif",
    fontSize: '.85rem', fontWeight: 500,
    color: '#2A1A0E',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  itemMeta: { fontSize: '.67rem', color: '#9C8878', marginTop: 2 },
  delBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#DDD5C8', padding: 3,
    transition: 'color .15s',
    flexShrink: 0,
  },
}
