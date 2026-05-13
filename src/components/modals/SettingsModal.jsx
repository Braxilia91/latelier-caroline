import { useState, useRef } from 'react'
import Modal from '../ui/Modal'
import { useToast } from '../ui/Toast'
import { X, Save, AlertTriangle, RefreshCw, Wifi, Download, Upload, Lock, Eye, EyeOff, Copy, Check, HardDrive } from 'lucide-react'
import * as googleDrive from '../../lib/googleDrive'

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
          type="button"
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
  const toast = useToast()

  const [sName, setSName] = useState(state.name || '')
  const [apiKey, setApiKey] = useState(state.apiKey || '')
  const [voice, setVoice] = useState(state.leaVoice || 'nova')

  const [editorFont, setEditorFont]   = useState(state.editorFont || 'm')
  const [editorTheme, setEditorTheme] = useState(state.editorTheme || 'jour')
  const [editorWidth, setEditorWidth] = useState(state.editorWidth || 'confort')
  const [chatScale, setChatScale]     = useState(typeof state.chatScale === 'number' && state.chatScale > 0 ? state.chatScale : 1)

  const [syncTok, setSyncTok] = useState(state.syncToken || '')

  // LOT 4F.1.4 — Visibilité afficher/masquer pour les deux champs sensibles
  const [showApiKey, setShowApiKey]     = useState(false)
  const [showSyncTok, setShowSyncTok]   = useState(false)
  const [copiedSync, setCopiedSync]     = useState(false)

  // LOT 4F.1.5 — Verrou réentrance pendant save+sync
  const [syncBusy, setSyncBusy] = useState(false)

  // LOT 4F.2.1 — État Google Drive
  const [googleUser, setGoogleUser] = useState(() => googleDrive.getCurrentUser())
  const [googleBusy, setGoogleBusy] = useState(false)

  // LOT 4F.2.2/4F.2.3 — Verrou réentrance Drive (upload + download).
  const [driveBusy, setDriveBusy] = useState(false)

  const [confirmReset, setConfirmReset] = useState(false)
  const [exportDone, setExportDone] = useState(false)

  const fileInputRef = useRef(null)
  const [importing, setImporting] = useState(false)

  const tokenChanged = state.syncToken && syncTok && syncTok !== state.syncToken
  const tokenValid = syncTok.length === 0 || syncTok.length >= 20

  // LOT 4F.1.6 — useEffect resetSyncStatus retiré : App.jsx ne propage pas
  // encore cette prop. À ré-ajouter quand App.jsx sera patché.

  const handleSave = async (closeAfter = true) => {
    await onSave({
      name: sName,
      apiKey,
      openAiKey: apiKey,
      leaVoice: voice,
      syncToken: syncTok,
      editorFont, editorTheme, editorWidth,
      chatScale,
    })
    if (closeAfter) onClose()
  }

  const handleSyncNow = async () => {
    if (syncBusy) return
    if (syncTok.length > 0 && syncTok.length < 20) return
    setSyncBusy(true)
    try {
      await handleSave(false)
      const result = await state.syncNow?.()
      if (result && typeof result === 'object') {
        toast(result.message, result.ok ? 'success' : 'error')
      }
    } catch (err) {
      toast(err?.message || 'Erreur pendant la sauvegarde', 'error')
    } finally {
      setSyncBusy(false)
    }
  }

  const handleGoogleSignIn = async () => {
    if (googleBusy) return
    setGoogleBusy(true)
    try {
      const user = await googleDrive.signIn()
      setGoogleUser(googleDrive.getCurrentUser())
      toast(
        user.email ? `Connecté à ${user.email} ✓` : 'Connecté à Google Drive ✓',
        'success'
      )
    } catch (err) {
      toast(err?.message || 'Échec de la connexion Google Drive', 'error')
    } finally {
      setGoogleBusy(false)
    }
  }

  // LOT 4F.2.2 — Sauvegarde manuelle vers Drive.
  const handleUploadDrive = async () => {
    if (driveBusy) return
    if (!googleUser) return
    // Refresh opportuniste : si le token a expiré pendant que la modale
    // était ouverte, getCurrentUser() retourne null et on bascule l'UI
    // proprement sans tenter l'appel API.
    const fresh = googleDrive.getCurrentUser()
    if (!fresh) {
      setGoogleUser(null)
      toast('Session Google Drive expirée. Reconnecte-toi.', 'info')
      return
    }
    setDriveBusy(true)
    try {
      if (!buildLocalBackup) throw new Error('Sauvegarde locale indisponible')
      const data = await buildLocalBackup()
      const jsonString = JSON.stringify(data, null, 2)
      const result = await googleDrive.uploadSnapshot(jsonString)
      toast(result.message, result.ok ? 'success' : 'error')
    } catch (err) {
      toast(err?.message || 'Erreur lors de la sauvegarde Drive', 'error')
    } finally {
      setDriveBusy(false)
    }
  }

  // LOT 4F.2.3 — Restauration manuelle depuis Drive.
  const handleRestoreDrive = async () => {
    if (driveBusy || googleBusy) return
    if (!googleUser) return
    // Refresh opportuniste (idem handleUploadDrive)
    const fresh = googleDrive.getCurrentUser()
    if (!fresh) {
      setGoogleUser(null)
      toast('Session Google Drive expirée. Reconnecte-toi.', 'info')
      return
    }

    const confirmed = window.confirm(
      '⚠️ Attention\n\n' +
      'Cela va remplacer TES DONNÉES ACTUELLES par celles de la sauvegarde Drive :\n' +
      '• Chapitres\n' +
      '• Idées vrac\n' +
      '• Historique du chat\n' +
      '• Profil et mémoire de Léa\n\n' +
      'Cette action est irréversible.\n\n' +
      'Astuce : tu peux faire "Exporter une sauvegarde" en bas avant pour avoir un filet de sécurité local.\n\n' +
      'Continuer ?'
    )
    if (!confirmed) return

    setDriveBusy(true)
    try {
      const result = await googleDrive.downloadSnapshot()
      if (!result.ok) {
        const tone = result.message === 'Aucune sauvegarde Drive trouvée' ? 'info' : 'error'
        toast(result.message, tone)
        return
      }
      if (!onImport) {
        toast('Import indisponible', 'error')
        return
      }
      // Feedback intermédiaire avant l'import (1-3 s IndexedDB)
      toast(result.message, 'info')
      const importResult = await onImport(result.file)
      if (importResult?.ok) {
        alert('✓ Sauvegarde Drive restaurée avec succès.\n\nL\'application va redémarrer pour rafraîchir.')
        window.location.reload()
      } else {
        toast(importResult?.message || 'Échec de la restauration', 'error')
      }
    } catch (err) {
      toast(err?.message || 'Erreur lors de la restauration Drive', 'error')
    } finally {
      setDriveBusy(false)
    }
  }

  const handleGoogleSignOut = async () => {
    if (googleBusy || driveBusy) return
    setGoogleBusy(true)
    try {
      await googleDrive.signOut()
      setGoogleUser(null)
      toast('Déconnecté de Google Drive', 'info')
    } catch {
      toast('Déconnexion partielle — état local nettoyé', 'info')
      setGoogleUser(null)
    } finally {
      setGoogleBusy(false)
    }
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

  const handleCopySync = async () => {
    if (!syncTok) return
    try {
      await navigator.clipboard.writeText(syncTok)
      setCopiedSync(true)
      setTimeout(() => setCopiedSync(false), 1500)
    } catch {
      alert('Impossible de copier automatiquement. Sélectionne et copie manuellement le mot secret.')
    }
  }

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
          <button type="button" style={S.closeBtn} onClick={onClose} aria-label="Fermer les réglages"><X size={16} /></button>
        </div>

        <div style={S.body}>

          <Section title="Profil" icon={<span style={S.secIcon}>👤</span>}>
            <div style={S.fg}>
              <label style={S.label}>Ton prénom</label>
              <input style={S.input} value={sName} onChange={e => setSName(e.target.value)} placeholder="Caroline" />
            </div>

            <div style={S.fg}>
              <label style={S.label}>Mot de passe Léa <span style={S.badge}>active le coach</span></label>
              <div style={S.inputWrap}>
                <input
                  style={{ ...S.input, paddingRight: 40 }}
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="Le mot que Mourad t'a donné…"
                  aria-label="Mot de passe Léa"
                />
                <button
                  type="button"
                  style={S.iconBtn}
                  onClick={() => setShowApiKey(s => !s)}
                  aria-label={showApiKey ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  title={showApiKey ? 'Masquer' : 'Afficher'}
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
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
            <div style={S.inputWrap}>
              <input
                style={{
                  ...S.input,
                  paddingRight: 76,
                  borderColor: !tokenValid ? '#E87070' : undefined,
                }}
                type={showSyncTok ? 'text' : 'password'}
                value={syncTok}
                onChange={e => setSyncTok(e.target.value)}
                placeholder="Mon-mot-secret-très-long-2024"
                aria-label="Mot secret de sauvegarde"
              />
              <button
                type="button"
                style={{ ...S.iconBtn, right: 42 }}
                onClick={() => setShowSyncTok(s => !s)}
                aria-label={showSyncTok ? 'Masquer le mot secret' : 'Afficher le mot secret'}
                title={showSyncTok ? 'Masquer' : 'Afficher'}
              >
                {showSyncTok ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                type="button"
                style={{
                  ...S.iconBtn,
                  color: copiedSync ? '#3D6B45' : '#9C8878',
                  opacity: syncTok ? 1 : .35,
                  cursor: syncTok ? 'pointer' : 'not-allowed',
                }}
                onClick={handleCopySync}
                disabled={!syncTok}
                aria-label={copiedSync ? 'Mot secret copié' : 'Copier le mot secret'}
                title={copiedSync ? 'Copié ✓' : 'Copier'}
              >
                {copiedSync ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
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
            <button
              type="button"
              style={{ ...S.syncBtn, opacity: tokenValid && !syncBusy ? 1 : .45 }}
              disabled={syncBusy || !tokenValid}
              onClick={handleSyncNow}
            >
              <RefreshCw size={13} />
              {syncBusy ? 'Sauvegarde…' : 'Sauvegarder maintenant'}
            </button>
          </Section>

          {/* LOT 4F.2.1/4F.2.2/4F.2.3 — Section Google Drive : auth + upload + restore */}
          <Section title="Sauvegarde Google Drive" icon={<HardDrive size={13} color="#8B6445" />}>
            <p style={S.syncTxt}>
              Sauvegarde durable de tes données dans ton Google Drive (dossier invisible,
              ~50 KB). Complémentaire à la sauvegarde en ligne ci-dessus : sert de filet
              de sécurité si tu perds tes données locales ou changes d'appareil.
            </p>
            {googleUser ? (
              <>
                <p style={S.okMsg}>✓ Connecté à : {googleUser.email || 'Google Drive'}</p>
                <button
                  type="button"
                  style={{ ...S.syncBtn, opacity: driveBusy ? 0.5 : 1 }}
                  onClick={handleUploadDrive}
                  disabled={driveBusy || googleBusy}
                >
                  <Upload size={13} />
                  {driveBusy ? 'Opération Drive en cours…' : 'Sauvegarder sur Drive maintenant'}
                </button>
                <button
                  type="button"
                  style={{ ...S.actionBtn, opacity: driveBusy || googleBusy ? 0.5 : 1, marginTop: 8 }}
                  onClick={handleRestoreDrive}
                  disabled={driveBusy || googleBusy}
                >
                  <Download size={13} />
                  {driveBusy ? 'Opération Drive en cours…' : 'Restaurer depuis Drive'}
                </button>
                <button
                  type="button"
                  style={{ ...S.actionBtn, opacity: googleBusy ? 0.5 : 1, marginTop: 8 }}
                  onClick={handleGoogleSignOut}
                  disabled={googleBusy || driveBusy}
                >
                  {googleBusy ? 'Déconnexion…' : 'Déconnecter'}
                </button>
              </>
            ) : (
              <button
                type="button"
                style={{ ...S.syncBtn, opacity: googleBusy ? 0.5 : 1 }}
                onClick={handleGoogleSignIn}
                disabled={googleBusy}
              >
                <HardDrive size={13} />
                {googleBusy ? 'Connexion…' : 'Connecter Google Drive'}
              </button>
            )}
            <p style={{ ...S.hint, marginTop: 8 }}>
              🔒 La connexion reste active jusqu'à la fermeture de l'app. Aucun jeton n'est stocké.
            </p>
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
                type="button"
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
                type="button"
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
              <button type="button" style={{ ...S.actionBtn, ...(exportDone ? S.actionBtnOk : {}) }} onClick={handleExport}>
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
              <button type="button" style={S.dangerBtn} onClick={handleReset}>
                {confirmReset ? '⚠️ Confirmer — effacer tout ?' : 'Supprimer toutes mes données'}
              </button>
            </div>
          </Section>

        </div>

        <div style={S.footer}>
          <button type="button" style={S.cancelBtn} onClick={onClose}>Annuler</button>
          <button type="button" style={S.saveBtn} onClick={() => handleSave(true)}>
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
  inputWrap: { position: 'relative', width: '100%' },
  iconBtn: {
    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
    width: 32, height: 32, padding: 0,
    background: 'transparent', border: 'none', borderRadius: 6,
    color: '#9C8878', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'color .15s, background .15s',
  },
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
