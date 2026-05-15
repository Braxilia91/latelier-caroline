import { useState } from 'react'

import Modal from '../ui/Modal'
import { X, Download, FileText } from 'lucide-react'
import { buildLocalBackup } from '../../lib/db'

export default function ExportModal({ chapters, name, onClose }) {
const [mode, setMode] = useState('full')

const exportTXT = () => {
const lines = []
lines.push(`MON HISTOIRE — ${name.toUpperCase()}`)
lines.push(`Exporté le ${new Date().toLocaleDateString('fr', { dateStyle: 'long' })}`)
lines.push('─'.repeat(50))
lines.push('')

const selected = mode === 'full' ? chapters : chapters.filter(c => c.content?.trim())

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
a.href = url; a.download = `mon-histoire-${new Date().toISOString().slice(0,10)}.txt`
a.click(); URL.revokeObjectURL(url)
}

const exportJSON = async () => {
const data = await buildLocalBackup()
const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url; a.download = `atelier-backup-v5-${new Date().toISOString().slice(0,10)}.json`
a.click(); URL.revokeObjectURL(url)
}

const totalWords = chapters.reduce((a, c) => a + (c.content?.split(/\s+/).filter(Boolean).length ?? 0), 0)

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
</div>

<div style={styles.opts}>
<label style={{ ...styles.opt, ...(mode === 'full' ? styles.optAct : {}) }}>
<input type="radio" name="mode" value="full" checked={mode === 'full'} onChange={() => setMode('full')} hidden />
<span>Tous les chapitres</span>
</label>
<label style={{ ...styles.opt, ...(mode === 'written' ? styles.optAct : {}) }}>
<input type="radio" name="mode" value="written" checked={mode === 'written'} onChange={() => setMode('written')} hidden />
<span>Chapitres écrits seulement</span>
</label>
</div>

<button style={styles.btn} onClick={exportTXT}>
<FileText size={16} /> Exporter en .txt <span style={styles.hint2}>(Word, LibreOffice…)</span>
</button>

<div style={styles.sep}>
<div style={styles.sepLine} />
Sauvegarde complète
<div style={styles.sepLine} />
</div>

<button style={styles.btnAlt} onClick={exportJSON}>
<Download size={16} /> Sauvegarder tout (.json)
</button>

<p style={styles.note}>
Le fichier .json contient tous tes textes, chapitres, photos du Tiroir et paramètres. Garde-le précieusement — il te permettra de tout restaurer.
</p>
</Modal>
)
}
const styles = {
stats: {
display: 'flex', gap: 10, alignItems: 'center',
background: '#F7EFE3', borderRadius: 10, padding: '10px 14px',
fontSize: '.85rem', color: '#8B6445', fontWeight: 600, marginBottom: 16,
},
opts: { display: 'flex', gap: 8, marginBottom: 16 },
opt: {
flex: 1, padding: '10px 14px', border: '1.5px solid #DDD5C8',
borderRadius: 10, cursor: 'pointer', textAlign: 'center',
fontSize: '.82rem', fontWeight: 600, color: '#6B5A4E',
transition: 'all .15s',
},
optAct: { background: '#F7EFE3', borderColor: '#C4956A', color: '#8B6445' },
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
},
note: { fontSize: '.73rem', color: '#9C8878', lineHeight: 1.5, textAlign: 'center' },
}
