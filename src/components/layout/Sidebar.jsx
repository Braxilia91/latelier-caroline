import { useState } from 'react'
import { Plus, BookOpen, Trash2, GripVertical } from 'lucide-react'

export default function Sidebar({
  chapters, currentId, setCurrentId,
  createChapter, removeChapter,
  totalWords, streak,
  isMobile, isOpen, onClose,
}) {

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

  const handleSelectChapter = (id) => {
    setCurrentId(id)
    if (isMobile && isOpen) onClose()
  }

  const handleCreateChapter = () => {
    createChapter()
    if (isMobile && isOpen) onClose()
  }

  const wordCount = (text) => text?.split(/\s+/).filter(Boolean).length ?? 0

  const computedStyle = isMobile
    ? {
        ...styles.sbBase,
        ...styles.sbMobile,
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
      }
    : {
        ...styles.sbBase,
        ...styles.sbDesktop,
      }

  return (
    <aside style={computedStyle}>
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
        <button style={styles.addBtn} onClick={handleCreateChapter} title="Nouveau chapitre" aria-label="Nouveau chapitre">
          <Plus size={16} />
        </button>
      </div>

      {/* Liste */}
      <div style={styles.list}>
        {chapters.length === 0 && (
          <div style={styles.empty}>
            <BookOpen size={28} color="var(--border)" />
            <p>Commence ton premier chapitre</p>
            <button style={styles.firstBtn} onClick={handleCreateChapter}>
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
            onClick={() => handleSelectChapter(ch.id)}
          >
            <GripVertical size={14} color="var(--border)" style={{ flexShrink: 0 }} />
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
              aria-label={confirmDel === ch.id ? 'Confirmer la suppression du chapitre' : 'Supprimer le chapitre'}
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
  sbBase: {
    background: 'var(--paper)',
    borderRight: '1px solid var(--border-l)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sbDesktop: {
    width: 'var(--sidebar-w, 220px)',
    flexShrink: 0,
  },
  sbMobile: {
    position: 'fixed',
    top: 52,
    bottom: 0,
    left: 0,
    width: 280,
    zIndex: 100,
    transition: 'transform 0.25s ease-out',
    boxShadow: '4px 0 16px rgba(0,0,0,0.1)',
  },
  stats: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: 'calc(12px * var(--layout-scale, 1)) 8px',
    borderBottom: '1px solid var(--border-l)',
    background: 'var(--cream)',
  },
  stat:    { textAlign: 'center' },
  statNum: { display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 'calc(1.15rem * var(--layout-scale, 1))', fontWeight: 600, color: 'var(--brown)' },
  statLbl: { fontSize: 'calc(.65rem * var(--layout-scale, 1))', color: 'var(--ink-ll)', textTransform: 'uppercase', letterSpacing: '.5px' },
  statDiv: { width: 1, height: 28, background: 'var(--border-l)' },
  hdr: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 12px 6px',
  },
  hdrTitle: { fontSize: '.72rem', fontWeight: 800, color: 'var(--ink-ll)', textTransform: 'uppercase', letterSpacing: '1px' },
  addBtn: {
    width: 'calc(28px * var(--layout-scale, 1))', height: 'calc(28px * var(--layout-scale, 1))',
    borderRadius: 8,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, var(--brown), var(--gold))',
    color: '#fff',
    border: 'none', cursor: 'pointer',
    transition: 'filter .15s',
  },
  list: { flex: 1, overflowY: 'auto', padding: '4px 8px 12px' },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 10, padding: '32px 16px', textAlign: 'center',
    color: 'var(--ink-ll)', fontSize: '.82rem',
  },
  firstBtn: {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, var(--brown), var(--gold))',
    color: '#fff',
    border: 'none', borderRadius: 10,
    fontSize: '.8rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    cursor: 'pointer',
    marginTop: 4,
  },
  item: {
    display: 'flex', alignItems: 'flex-start', gap: 6,
    padding: 'calc(9px * var(--layout-scale, 1)) 8px',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'background .15s',
    marginBottom: 2,
  },
  itemActive: {
    background: 'var(--gold-ll)',
    outline: '1.5px solid var(--gold-l)',
  },
  itemBody: { flex: 1, minWidth: 0 },
  itemTitle: {
    fontFamily: "'Lora', serif",
    fontSize: 'calc(.85rem * var(--layout-scale, 1))', fontWeight: 500,
    color: 'var(--ink)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  itemMeta: { fontSize: '.67rem', color: 'var(--ink-ll)', marginTop: 2 },
  delBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--border)', padding: 3,
    transition: 'color .15s',
    flexShrink: 0,
  },
}
