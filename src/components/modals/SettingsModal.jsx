import { useState, useRef } from 'react'
import Modal from '../ui/Modal'
import { X, Save, AlertTriangle, RefreshCw, Wifi, Download, Upload, Lock } from 'lucide-react'

const VOICES = [
  { value: 'nova', label: 'Nova — Douce et claire' },
  { value: 'shimmer', label: 'Shimmer — Chaleureuse' },
  { value: 'onyx', label: 'Onyx — Posée et grave' },
  { value: 'alloy', label: 'Alloy — Neutre' },
]

const FONT_SIZES = [
  { value: 's',  label: 'S',  desc: 'Compact' },
  { value: 'm',  label: 'M',  desc: 'Confort' },
  { value: 'l',  label: 'L',  desc: 'Grand' },
  { value: 'xl', label: 'XL', desc: 'Très grand' },
]

const CHAT_SCALES = [
  { value: 1,    label: 'Compact', desc: 'Taille actuelle' },
  { value: 1.15, label: 'Confort', desc: '+15 %' },
  { value: 1.3,  label: 'Grand',   desc: '+30 %' },
]

const THEMES = [
  { value: 'jour', label: '☀️ Jour', desc: 'Fond ivoire clair' },
  { value: 'soir', label: '🌙 Soir', desc: 'Tons dorés apaisés' },
  { value: 'bougie', label: '🕯️ Bougie', desc: 'Ambiance nocturne' },
]
const WIDTHS = [
  { value: 'confort', label: 'Confort', desc: '680 px' },
  { value: 'full', label: 'Pleine page', desc: '100 %' },
]

function Section({ title, icon, children }) {
  return (
    <div style={S.section}>
      <div style={S.secHdr}>
        {icon}
        <span style={S.secTitle}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function ToggleGroup({ options, value, onChange }) {
  return (
    <div style={S.toggleGroup}>
      {options.map(o => (
        <button
          key={o.value}
          style={{ ...S.toggleBtn, ...(value === o.value ? S.toggleBtnActive : {}) }}
          onClick={() => onChange(o.value)}
          title={o.desc}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function SettingsModal({
  state, chapters = [], vracIdeas = [], name = '',
  onClose, onSave, onReset, onOpenMemory,
  onImport, buildLocalBackup,
}) {
  const [sName, setSName] = useState(state.name || '')
  const [apiKey, setApiKey] = useState(state.apiKey || '')
  const [voice, setVoice] = useState(state.leaVoice || 'nova')

  const [editorFont, setEditorFont]   = useState(state.editorFont || 'm')
  const [editorTheme, setEditorTheme] = useState(state.editorTheme || 'jour')
  const [editorWidth, setEditorWidth] = useState(state.editorWidth || 'confort')
  const [chatScale, setChatScale]     = useState(typeof state.chatScale === 'number' && state.chatScale > 0 ? state.chatScale : 1)

  const [syncTok, setSyncTok] = useState(state.syncToken || '')

  const [confirmReset, setConfirmReset] = useState(false)
  const [exportDone, setExportDone] = useState(false)

  const fileInputRef = useRef(null)
  const [importing, setImporting] = useState(false)

  const tokenChanged = state.syncToken && syncTok && syncTok !== state.syncToken
  const tokenValid = syncTok.length === 0 || syncTok.length >= 20

  const handleSave = () => {
    onSave({
      name: sName,
      apiKey,
      openAiKey: apiKey,
      leaVoice: voice,
      syncToken: syncTok,
      editorFont, editorTheme, editorWidth,
      chatScale,
    })
    onClose()
  }

  const handleReset = async () => {
    if (confirmReset) {
      await onReset()
      window.location.reload()
    } else {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset(false), 5000)
    }
  }

  // LOT 4F.1 — Export JSON (format complet importable)
  const handleExport = async () => {
    try {
      const data = buildLocalBackup
        ? await buildLocalBackup()
        : {
            exportedAt: new Date().toISOString(),
            name: name || sName,
            chapters: (chapters || []).map(({ id, title, content, createdAt, updatedAt }) =>
              ({ id, title, content, createdAt, updatedAt })),
            vracIdeas: (vracIdeas || []).map(({ id, text, createdAt }) => ({ id, text, createdAt })),
          }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const date = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `atelier-caroline-backup-${date}.json`
      a.click()
      URL.revokeObjectURL(url)
      setExportDone(true)
      setTimeout(() => setExportDone(false), 3000)
    } catch (err) {
      alert('Échec de l\'export : ' + (err.message || 'erreur inconnue'))
    }
  }

  // LOT 4F.1 — Import depuis fichier JSON
  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const confirmed = window.confirm(
      '⚠️ Attention\n\n' +
      'Cela va remplacer TES DONNÉES ACTUELLES par celles du fichier :\n' +
      '• Chapitres\n' +
      '• Idées vrac\n' +
      '• Historique du chat\n' +
      '• Profil et mémoire de Léa\n\n' +
      'Cette action est irréversible. Continuer ?'
    )
    if (!confirmed) return

    setImporting(true)
    try {
      const result = await onImport?.(file)
      if (result?.ok) {
        alert('✓ Sauvegarde restaurée avec succès.\n\nL\'application va redémarrer pour rafraîchir.')
        window.location.reload()
      } else {
        alert('✗ Échec de l\'import : ' + (result?.message || 'erreur inconnue'))
      }
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal
      onClose={onClose}
      ariaLabel="Réglages"
      overlayStyle={S.overlay}
      modalStyle={S.modal}
    >
        <div style={S.hdr}>
          <span style={S.hdrTitle}>Réglages</span>
          <button style={S.closeBtn} onClick={onClose} aria-label="Fermer les réglages"><X size={16} /></button>
        </div>

        <div style={S.body}>

          <Section title="Profil" icon={<span style={S.secIcon}>👤</span>}>
            <div style={S.fg}>
              <label style={S.label}>Ton prénom</label>
              <input style={S.input} value={sName} onChange={e => setSName(e.target.value)} placeholder="Caroline" />
            </div>

            <div style={S.fg}>
              <label style={S.label}>Mot de passe Léa <span style={S.badge}>active le coach</span></label>
              <input style={S.input} type="password" value={apiKey}
                onChange={e => setApiKey(e.target.value)} placeholder="Le mot que Mourad t'a donné…" />
              <p style={S.hint}>🔒 Stocké sur cet appareil uniquement. Ce mot de passe active les réponses de Léa et sa voix via un serveur sécurisé — les vraies clés API ne transitent jamais sur ton appareil.</p>
            </div>

            {apiKey && (
              <div style={S.fg}>
                <label style={S.label}>Voix de Léa</label>
                <select style={S.select} value={voice} onChange={e => setVoice(e.target.value)}>
                  {VOICES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
              </div>
            )}
          </Section>

          <Section title="Écriture" icon={<span style={S.secIcon}>✍️</span>}>
            <div style={S.row}>
              <div style={S.fg}>
                <label style={S.label}>Taille du texte</label>
                <ToggleGroup options={FONT_SIZES} value={editorFont} onChange={setEditorFont} />
              </div>
              <div style={S.fg}>
                <label style={S.label}>Largeur de l'éditeur</label>
                <ToggleGroup options={WIDTHS} value={editorWidth} onChange={setEditorWidth} />
              </div>
            </div>
            <div style={S.fg}>
              <label style={S.label}>Thème visuel</label>
              <ToggleGroup options={THEMES} value={editorTheme} onChange={setEditorTheme} />
            </div>
            <div style={S.fg}>
              <label style={S.label}>Taille du chat avec Léa</label>
              <ToggleGroup options={CHAT_SCALES} value={chatScale} onChange={setChatScale} />
            </div>
          </Section>

          <Section title="Sauvegarde en ligne" icon={<Wifi size={13} color="#8B6445" />}>
            <p style={S.syncTxt}>
              Tes données sont enregistrées dans le cloud et restaurables si tu changes d'appareil ou
              si ton navigateur est nettoyé. Choisis un mot secret <strong>(20+ caractères)</strong> —
              le même sur tous tes appareils. Ne le partage pas.
            </p>
            <input
              style={{ ...S.input, borderColor: !tokenValid ? '#E87070' : undefined }}
              type="password" value={syncTok}
              onChange={e => setSyncTok(e.target.value)}
              placeholder="Mon-mot-secret-très-long-2024"
            />
            {syncTok.length > 0 && syncTok.length < 20 && (
              <p style={S.errMsg}>⚠ Minimum 20 caractères ({syncTok.length}/20)</p>
            )}
            {tokenChanged && (
              <div style={S.warnBox}>
                ⚠️ Changer le mot secret déconnecte la sauvegarde existante. Tes données locales sont conservées,
                mais la sauvegarde en ligne repartira de zéro avec le nouveau mot secret.
              </div>
            )}
            {state.syncStatus === 'ok' && state.lastSyncedAt && (
              <p style={S.okMsg}>✓ Dernière sauvegarde : {new Date(state.lastSyncedAt).toLocaleString('fr-FR')}</p>
            )}
            {state.syncStatus === 'error' && state.syncMessage && (
              <p style={S.errMsg}>⚠ {state.syncMessage}</p>
            )}
            <button
              style={{ ...S.syncBtn, opacity: tokenValid ? 1 : .45 }}
              disabled={syncTok.length > 0 && syncTok.length < 20}
              onClick={() => { handleSave(); state.syncNow?.() }}
            >
              <RefreshCw size={13} />
              {state.syncStatus === 'syncing' ? 'Sauvegarde…' : 'Sauvegarder maintenant'}
            </button>
          </Section>

          <Section title="Mémoire de Léa" icon={<span style={S.secIcon}>🧠</span>}>
            <div style={S.actionRow}>
              <div>
                <div style={S.actionTitle}>Ce que Léa se rappelle</div>
                <div style={S.actionDesc}>
                  Voir, supprimer ou effacer les souvenirs que Léa retient de vos échanges.
                </div>
              </div>
              <button
                style={S.actionBtn}
                onClick={() => {
                  if (!onOpenMemory) return
                  onClose()
                  setTimeout(onOpenMemory, 50)
                }}
              >
                Ouvrir
              </button>
            </div>
          </Section>

          <Section title="Sécurité & données" icon={<Lock size={13} color="#8B6445" />}>

            <div style={S.actionRow}>
              <div>
                <div style={S.actionTitle}>Importer une sauvegarde</div>
                <div style={S.actionDesc}>
                  Restaure tes données depuis un fichier JSON exporté précédemment.
                  Remplace les données actuelles.
                </div>
              </div>
              <button
                style={S.actionBtn}
                onClick={handleImportClick}
                disabled={importing || !onImport}
              >
                <Upload size={13} />
                {importing ? 'Import…' : 'Importer'}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelected}
              style={{ display: 'none' }}
              aria-hidden="true"
            />

            <div style={S.actionRow}>
              <div>
                <div style={S.actionTitle}>Exporter une sauvegarde</div>
                <div style={S.actionDesc}>
                  Télécharge tes chapitres, idées, chat et profil en JSON horodaté.
                </div>
              </div>
              <button style={{ ...S.actionBtn, ...(exportDone ? S.actionBtnOk : {}) }} onClick={handleExport}>
                <Download size={13} />
                {exportDone ? 'Téléchargé ✓' : 'Exporter'}
              </button>
            </div>

            <div style={S.dangerZone}>
              <div style={S.dangerHdr}>
                <AlertTriangle size={13} color="#C0392B" />
                <span style={S.dangerTitle}>Zone dangereuse</span>
              </div>
              <p style={S.dangerTxt}>
                Supprimer toutes les données efface définitivement tous tes chapitres et paramètres.
              </p>
              <button style={S.dangerBtn} onClick={handleReset}>
                {confirmReset ? '⚠️ Confirmer — effacer tout ?' : 'Supprimer toutes mes données'}
              </button>
            </div>
          </Section>

        </div>

        <div style={S.footer}>
          <button style={S.cancelBtn} onClick={onClose}>Annuler</button>
          <button style={S.saveBtn} onClick={handleSave}>
            <Save size={14} /> Enregistrer
          </button>
        </div>
    </Modal>
  )
}
const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(42,26,14,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 },
  modal: { background: '#FFFEFB', borderRadius: 18, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(42,26,14,.25)', overflow: 'hidden' },
  hdr: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #EDE7DE', background: '#FAF7F2', flexShrink: 0 },
  hdrTitle: { fontFamily: "'Cormorant Garamond', serif", fontSize: '1.15rem', fontWeight: 700, color: '#2A1A0E' },
  closeBtn: { width: 32, height: 32, borderRadius: 10, background: 'transparent', border: '1.5px solid #EDE7DE', color: '#9C8878', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, overflowY: 'auto', padding: '12px 20px 8px', display: 'flex', flexDirection: 'column', gap: 4 },
  section: { background: '#FAF7F2', border: '1px solid #EDE7DE', borderRadius: 12, padding: '14px 16px', marginBottom: 10 },
  secHdr: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 },
  secIcon: { fontSize: '1rem' },
  secTitle: { fontSize: '.72rem', fontWeight: 800, fontFamily: "'Nunito', sans-serif", color: '#8B6445', textTransform: 'uppercase', letterSpacing: '.8px' },
  fg: { marginBottom: 10 },
  row: { display: 'flex', gap: 12, marginBottom: 0 },
  label: { display: 'block', fontSize: '.75rem', fontWeight: 700, fontFamily: "'Nunito', sans-serif", color: '#6B5A4E', marginBottom: 5 },
  badge: { display: 'inline-block', background: '#F7EFE3', border: '1px solid #E8D5B8', borderRadius: 10, fontSize: '.65rem', fontWeight: 700, color: '#8B6445', padding: '1px 7px', marginLeft: 6 },
  badgeOpt: { fontSize: '.7rem', fontWeight: 400, color: '#9C8878', marginLeft: 4 },
  input: { width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1.5px solid #DDD5C8', borderRadius: 8, fontFamily: "'Nunito', sans-serif", fontSize: '.85rem', background: '#FFFEFB', color: '#2A1A0E', outline: 'none', caretColor: '#8B6445' },
  hint: { fontSize: '.72rem', color: '#9C8878', fontFamily: "'Nunito', sans-serif", lineHeight: 1.5, marginTop: 4 },
  select: { width: '100%', padding: '9px 12px', border: '1.5px solid #DDD5C8', borderRadius: 8, fontFamily: "'Nunito', sans-serif", fontSize: '.85rem', background: '#FFFEFB', color: '#2A1A0E', outline: 'none' },
  toggleGroup: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  toggleBtn: { padding: '7px 14px', border: '1.5px solid #DDD5C8', borderRadius: 20, background: '#FFFEFB', fontSize: '.78rem', fontWeight: 600, fontFamily: "'Nunito', sans-serif", color: '#9C8878', cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap' },
  toggleBtnActive: { background: '#F7EFE3', border: '1.5px solid #C4956A', color: '#8B6445' },
  syncTxt: { fontSize: '.78rem', color: '#6B5A4E', lineHeight: 1.5, fontFamily: "'Nunito', sans-serif", marginBottom: 10 },
  syncBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'linear-gradient(135deg,#8B6445,#C4956A)', color: '#fff', border: 'none', borderRadius: 8, fontSize: '.78rem', fontWeight: 700, fontFamily: "'Nunito', sans-serif", cursor: 'pointer', marginTop: 8 },
  okMsg: { fontSize: '.72rem', color: '#3D6B45', margin: '4px 0 0', fontFamily: "'Nunito', sans-serif" },
  errMsg: { fontSize: '.72rem', color: '#C0392B', margin: '4px 0 0', fontFamily: "'Nunito', sans-serif" },
  warnBox: { fontSize: '.72rem', color: '#92400E', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '8px 10px', marginTop: 6, lineHeight: 1.5, fontFamily: "'Nunito', sans-serif" },
  actionRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, padding: '10px 12px', background: '#FFFEFB', border: '1px solid #EDE7DE', borderRadius: 10 },
  actionTitle: { fontSize: '.82rem', fontWeight: 700, color: '#2A1A0E', fontFamily: "'Nunito', sans-serif" },
  actionDesc: { fontSize: '.72rem', color: '#9C8878', fontFamily: "'Nunito', sans-serif", marginTop: 2 },
  actionBtn: { display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, padding: '7px 14px', background: '#F7EFE3', border: '1.5px solid #E8D5B8', borderRadius: 8, fontSize: '.78rem', fontWeight: 700, fontFamily: "'Nunito', sans-serif", color: '#8B6445', cursor: 'pointer', transition: 'all .2s' },
  actionBtnOk: { background: '#EEF4EC', border: '1.5px solid #A3C4A8', color: '#3D6B45' },
  dangerZone: { background: '#FFF5F5', border: '1.5px solid #FECACA', borderRadius: 10, padding: '12px 14px' },
  dangerHdr: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 },
  dangerTitle: { fontSize: '.72rem', fontWeight: 800, color: '#C0392B', textTransform: 'uppercase', letterSpacing: '.5px', fontFamily: "'Nunito', sans-serif" },
  dangerTxt: { fontSize: '.78rem', color: '#7F1D1D', lineHeight: 1.5, fontFamily: "'Nunito', sans-serif", marginBottom: 10 },
  dangerBtn: { padding: '8px 14px', background: '#C0392B', color: '#fff', border: 'none', borderRadius: 8, fontSize: '.78rem', fontWeight: 700, fontFamily: "'Nunito', sans-serif", cursor: 'pointer' },
  footer: { display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid #EDE7DE', background: '#FAF7F2', flexShrink: 0 },
  cancelBtn: { padding: '9px 18px', background: 'transparent', border: '1.5px solid #EDE7DE', borderRadius: 10, fontSize: '.82rem', fontWeight: 600, fontFamily: "'Nunito', sans-serif", color: '#9C8878', cursor: 'pointer' },
  saveBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', background: 'linear-gradient(135deg, #8B6445, #C4956A)', color: '#fff', border: 'none', borderRadius: 10, fontSize: '.82rem', fontWeight: 700, fontFamily: "'Nunito', sans-serif", cursor: 'pointer' },
}
