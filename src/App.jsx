import { useState, useCallback, useEffect } from 'react'
import './styles/globals.css'

import { useAppState }             from './hooks/useDB'
import { useCoach }                from './hooks/useCoach'
import { ToastProvider, useToast } from './components/ui/Toast'
import { getPinHash }              from './lib/db'

import LockScreen       from './components/auth/LockScreen'
import AdminPanel       from './components/auth/AdminPanel'
import Onboarding       from './components/onboarding/Onboarding'
import Header           from './components/layout/Header'
import Sidebar          from './components/layout/Sidebar'
import WritingArea      from './components/writing/WritingArea'
import CoachPanel       from './components/layout/CoachPanel'
import DictationModal   from './components/modals/DictationModal'
import SettingsModal    from './components/modals/SettingsModal'
import InspirationModal from './components/modals/InspirationModal'
import ExportModal      from './components/modals/ExportModal'

function AppInner() {
  const toast = useToast()
  const db    = useAppState()

  const [modal,    setModal]    = useState(null)
  const [moodOpen, setMoodOpen] = useState(false)

  // ── Sécurité PIN + Admin ──────────────────────────────────────
  const [lockMode,   setLockMode]   = useState(null)   // null | 'setup' | 'unlock' | 'change'
  const [adminMode,  setAdminMode]  = useState(false)
  const [lockReady,  setLockReady]  = useState(false)

  useEffect(() => {
    if (!db.ready) return
    async function checkPin() {
      const hash = await getPinHash()
      if (!db.isSetup)       setLockMode(null)
      else if (!hash)        setLockMode('setup')
      else                   setLockMode('unlock')
      setLockReady(true)
    }
    checkPin()
  }, [db.ready, db.isSetup])

  // Verrouiller quand l'app passe en arrière-plan
  useEffect(() => {
    const onVisibility = async () => {
      if (document.hidden) {
        const hash = await getPinHash()
        if (hash) { setLockMode('unlock'); setAdminMode(false) }
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const handleUnlock      = () => { setLockMode(null); setAdminMode(false) }
  const handleAdminUnlock = () => { setLockMode(null); setAdminMode(true) }
  const handleAdminClose  = () => setAdminMode(false)
  const handleResetDone   = () => { setAdminMode(false); window.location.reload() }
  const openPinChange     = () => { setModal(null); setLockMode('change') }

  // ── Coach ─────────────────────────────────────────────────────
  const coach = useCoach({
    password: db.password, openAiKey: db.openAiKey,
    name: db.name, moodToday: db.moodToday,
    currentChapter: db.currentChapter, leaVoice: db.leaVoice,
    addMessage: db.addMessage, chatHistory: db.chatHistory,
  })

  const handleSetupComplete = async ({ name, password }) => {
    await db.setName(name)
    if (password) await db.setPassword(password)
    await db.createChapter()
    toast(`Bienvenue ${name} ! Ton atelier est prêt 🌿`, 'success')
    setLockMode('setup')
  }

  const handleSaveSettings = async ({ name, openAiKey, leaVoice }) => {
    await db.setName(name)
    await db.setOaiKey(openAiKey)
    await db.setVoice(leaVoice)
    toast('Réglages sauvegardés ✓', 'success')
  }

  const handleInsertDictation = useCallback((text) => {
    if (!db.currentChapter) return
    const newContent = (db.currentChapter.content || '') + (db.currentChapter.content ? ' ' : '') + text
    db.updateChapter(db.currentId, { content: newContent })
    toast('Texte inséré ✓', 'success')
  }, [db])

  // ── Rendu ─────────────────────────────────────────────────────
  if (!db.ready || !lockReady) return (
    <div style={{ height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#FAF7F2' }}>
      <div style={{ width:36,height:36,border:'3px solid #EDE7DE',borderTopColor:'#8B6445',borderRadius:'50%',animation:'spin 0.8s linear infinite' }} />
    </div>
  )

  if (lockMode) return (
    <LockScreen mode={lockMode} onUnlock={handleUnlock} onAdminUnlock={handleAdminUnlock} />
  )

  if (adminMode) return (
    <AdminPanel onClose={handleAdminClose} onResetDone={handleResetDone} />
  )

  if (!db.isSetup) return <Onboarding onComplete={handleSetupComplete} />

  return (
    <div style={{ height:'100vh',display:'flex',flexDirection:'column',overflow:'hidden' }}>
      <Header
        name={db.name} moodToday={db.moodToday} setMood={db.setMood}
        streak={db.streak} moodOpen={moodOpen} setMoodOpen={setMoodOpen}
        onDictate={() => setModal('dictation')} onPlan={() => setModal('plan')}
        onExport={() => setModal('export')}     onSettings={() => setModal('settings')}
        onInspir={() => setModal('inspir')}     onVocab={() => setModal('vocab')}
      />
      <div style={{ flex:1,display:'flex',overflow:'hidden' }}>
        <Sidebar
          chapters={db.chapters} currentId={db.currentId} setCurrentId={db.setCurrentId}
          createChapter={db.createChapter} removeChapter={db.removeChapter}
          totalWords={db.totalWords} streak={db.streak}
        />
        <WritingArea
          chapter={db.currentChapter} updateChapter={db.updateChapter}
          recordSession={db.recordSession}
        />
        <CoachPanel
          coach={{ ...coach, clearChat: db.clearChat }}
          hasKey={!!db.password}
          currentChapter={db.currentChapter}
          chatHistory={db.chatHistory}
        />
      </div>

      {modal === 'dictation' && <DictationModal onClose={() => setModal(null)} onInsert={handleInsertDictation} />}
      {modal === 'settings'  && <SettingsModal  state={{ name:db.name, openAiKey:db.openAiKey, leaVoice:db.leaVoice }} onClose={() => setModal(null)} onSave={handleSaveSettings} onReset={db.resetAllData} onChangePin={openPinChange} />}
      {modal === 'inspir'    && <InspirationModal onClose={() => setModal(null)} onSendToCoach={coach.sendMessage} hasKey={!!db.password} />}
      {modal === 'export'    && <ExportModal chapters={db.chapters} name={db.name} onClose={() => setModal(null)} />}
    </div>
  )
}

export default function App() {
  return <ToastProvider><AppInner /></ToastProvider>
}
