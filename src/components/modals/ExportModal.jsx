import { useState } from 'react'

import Modal from '../ui/Modal'
import { X, Download, FileText } from 'lucide-react'
// T8.4c — buildLocalBackup v5 inclut traces metadata + blobs base64.
// Remplace exportAllData (v3, sans traces) pour que la sauvegarde
// .json ramène vraiment TOUT — textes et photos.
import { buildLocalBackup } from '../../lib/db'

export default function ExportModal({ chapters, name, onClose }) {
  // T15 — 3 modes : 'full' (tout) | 'written' (contenu non vide) | 'public' (non privé + contenu)
  const [mode, setMode] = useState('full')
  const [exporting, setExporting] = useState(false)

  // T15 — Sélection adaptée au mode courant.
  // Note : le mode 'public' filtre les private=true ET les chapitres vides
  // (intention : version partageable propre à donner à un tiers).
  const selectChapters = () => {
    if (mode === 'public')  return chapters.filter(c => c.private !== true && c.content?.trim())
    if (mode === 'written') return chapters.filter(c => c.content?.trim())
    return chapters
  }

  const exportTXT = () => {
    const lines = []
    lines.push(`MON HISTOIRE — ${name.toUpperCase()}`)
    lines.push(`Exporté le ${new Date().toLocaleDateString('fr', { dateStyle: 'long' })}`)
    lines.push('─'.repeat(50))
    lines.push('')

    const selected = selectChapters()

    selected.forEach((ch, i) => {
      lines.push(`CHAPITRE ${i + 1} — ${ch.title.toUpperCase()}`)
      lines.push('')
      lines.push(ch.content || '(vide)')
      lines.push('')
      lines.push('─'.repeat(50))
      lines.push('')
    })

    const totalWords = selected.reduce((a, c) => a + (c.content?.split(/\s+/).filter(Boolean).length ?? 0), 0)
    lines.push(`Total : ${totalWords.toLocaleString('fr')} mots`)

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    // Nom de fichier suffixé par le mode pour ne pas écraser une autre version
    const suffix = mode === 'public' ? '-public' : (mode === 'written' ? '-ecrits' : '')
    a.href = url; a.download = `mon-histoire${suffix}-${new Date().toISOString().slice(0,10)}.txt`
    a.click(); URL.revokeObjectURL(url)
  }

  // T8.4c — Sauvegarde complète : textes + photos en base64.
  // T15 — NON FILTRÉE par mode private : §9 protection des données, la
  // sauvegarde locale doit toujours contenir l'intégralité pour permettre
  // une restauration fidèle. Le filtre privé est limité au partage TXT.
  const exportBackup = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const data = await buildLocalBackup({ includeBlobs: true })
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `atelier-sauvegarde-${new Date().toISOString().slice(0,10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.warn('[Export] buildLocalBackup failed:', err?.message)
    } finally {
      setExporting(false)
    }
  }

  const totalWords = chapters.reduce((a, c) => a + (c.content?.split(/\s+/).filter(Boolean).length ?? 0), 0)
  const privateCount = chapters.filter(c => c.private === true).length

  return (
    <Modal
      onClose={onClose}
      ariaLabel="Export"
      overlayClassName="modal-bg"
      modalClassName="modal-box"
    >
      <button className="modal-close" onClick={onClose} aria-label="Fermer l'export"><X size={16} /></button>
      <h2 className="modal-title">📥 Exporter mon histoire</h2>

      <div style={styles.stats}>
        <span><strong>{chapters.length}</strong> chapitres</span>
        <span>·</span>
        <span><strong>{totalWords.toLocaleString('fr')}</strong> mots au total</span>
        {privateCount > 0 && (
          <>
            <span>·</span>
            <span><strong>{privateCount}</strong> privé{privateCount > 1 ? 's' : ''}</span>
          </>
        )}
      </div>

      {/* T15 — 3 modes pour TXT */}
      <div style={styles.opts}>
        <label style={{ ...styles.opt, ...(mode === 'full' ? styles.optAct : {}) }}>
          <input type="radio" name="mode" value="full" checked={mode === 'full'} onChange={() => setMode('full')} hidden />
          <span>Tous</span>
        </label>
        <label style={{ ...styles.opt, ...(mode === 'written' ? styles.optAct : {}) }}>
          <input type="radio" name="mode" value="written" checked={mode === 'written'} onChange={() => setMode('written')} hidden />
          <span>Chapitres écrits</span>
        </label>
        <label style={{ ...styles.opt, ...(mode === 'public' ? styles.optAct : {}) }}>
          <input type="radio" name="mode" value="public" checked={mode === 'public'} onChange={() => setMode('public')} hidden />
          <span>🔓 Publics</span>
        </label>
      </div>

      {mode === 'public' && (
        <p style={styles.modeHint}>
          Les chapitres marqués privés (🔒) seront <strong>exclus</strong> de ce fichier — version à partager avec ta famille.
        </p>
      )}

      <button style={styles.btn} onClick={exportTXT}>
        <FileText size={16} /> Exporter en .txt <span style={styles.hint2}>(Word, LibreOffice…)</span>
      </button>

      <div style={styles.sep}>
        <div style={styles.sepLine} />
        Sauvegarde complète
        <div style={styles.sepLine} />
      </div>

      <button
        style={{ ...styles.btnAlt, opacity: exporting ? 0.6 : 1, cursor: exporting ? 'wait' : 'pointer' }}
        onClick={exportBackup}
        disabled={exporting}
        aria-busy={exporting}
      >
        <Download size={16} />
        {exporting ? 'Génération en cours…' : 'Sauvegarder tout (.json)'}
      </button>

      <p style={styles.note}>
        Le fichier .json contient tous tes textes, chapitres, paramètres <strong>et les photos du Tiroir</strong> — y compris les passages privés. Garde-le précieusement — il te permettra de tout restaurer.
      </p>
    </Modal>
  )
}

const styles = {
  stats: {
    display: 'flex', gap: 10, alignItems: 'center',
    background: '#F7EFE3', borderRadius: 10, padding: '10px 14px',
    fontSize: '.85rem', color: '#8B6445', fontWeight: 600, marginBottom: 16,
    flexWrap: 'wrap',
  },
  opts: { display: 'flex', gap: 8, marginBottom: 10 },
  opt: {
    flex: 1, padding: '10px 14px', border: '1.5px solid #DDD5C8',
    borderRadius: 10, cursor: 'pointer', textAlign: 'center',
    fontSize: '.82rem', fontWeight: 600, color: '#6B5A4E',
    transition: 'all .15s',
  },
  optAct: { background: '#F7EFE3', borderColor: '#C4956A', color: '#8B6445' },
  // T15 — Hint actif quand mode 'public' sélectionné
  modeHint: {
    fontSize: '.74rem', color: '#8B6445',
    background: '#F7EFE3', borderRadius: 8,
    padding: '8px 12px',
    margin: '0 0 14px',
    lineHeight: 1.5,
  },
  btn: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '11px 16px',
    background: 'linear-gradient(135deg, #8B6445, #C4956A)',
    color: '#fff', border: 'none',
    borderRadius: 12, fontSize: '.88rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif", cursor: 'pointer',
    marginBottom: 12,
  },
  hint2: { opacity: .75, fontWeight: 400 },
  sep: {
    textAlign: 'center', fontSize: '.7rem', color: '#9C8878',
    textTransform: 'uppercase', letterSpacing: '1px',
    margin: '8px 0',
    display: 'flex', alignItems: 'center', gap: 8,
  },
  sepLine: { flex: 1, height: 1, background: '#EDE7DE' },
  btnAlt: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '10px 16px',
    background: 'transparent', border: '1.5px solid #DDD5C8',
    borderRadius: 12, fontSize: '.88rem', fontWeight: 700,
    fontFamily: "'Nunito', sans-serif", color: '#8B6445', cursor: 'pointer',
    marginBottom: 10,
    transition: 'opacity .15s',
  },
  note: { fontSize: '.73rem', color: '#9C8878', lineHeight: 1.5, textAlign: 'center' },
}
