import { useState, useCallback, useEffect } from 'react'
import './styles/globals.css'

import { useAppState }           from './hooks/useDB'
import { useCoach }              from './hooks/useCoach'
import { ToastProvider, useToast } from './components/ui/Toast'

import { buildWelcomeMessage }  from './lib/prompts'

import Onboarding       from './components/onboarding/Onboarding'
import Header           from './components/layout/Header'
import Sidebar          from './components/layout/Sidebar'
import WritingArea      from './components/writing/WritingArea'
import CoachPanel       from './components/layout/CoachPanel'
import DictationModal   from './components/modals/DictationModal'
import SettingsModal    from './components/modals/SettingsModal'
import InspirationModal from './components/modals/InspirationModal'
import ExportModal      from './components/modals/ExportModal'
import VracModal        from './components/modals/VracModal'
import DicoCaroModal      from './components/modals/DicoCaroModal'
import PlanModal          from './components/modals/PlanModal'
import PackOpeningModal   from './components/modals/PackOpeningModal'

function AppInner() {
  const toast = useToast()
  const db    = useAppState()
  const [modal,     setModal]    = useState(null)
  const [moodOpen,  setMoodOpen] = useState(false)
  const [showPack,  setShowPack] = useState(false)
  const [isOnline,  setIsOnline] = useState(navigator.onLine)

  // ── Pack opening : déclenché une seule fois après setup ─────────
  useEffect(() => {
    if (db.ready && db.isSetup && db.firstLaunch) setShowPack(true)
  }, [db.ready, db.isSetup, db.firstLaunch])

  // ── Indicateur connexion ─────────────────────────────────────────
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine)
    window.addEventListener('online',  update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online',  update)
      window.removeEventListener('offline', update)
    }
  }, [])

  // ── Thème global (data-theme sur <html>) ─────────────────────────
  useEffect(() => {
    if (db.editorTheme) document.documentElement.setAttribute('data-theme', db.editorTheme)
  }, [db.editorTheme])

  const coach = useCoach({
    apiKey: db.apiKey, openAiKey: db.openAiKey,
    name: db.name, moodToday: db.moodToday,
    currentChapter: db.currentChapter, leaVoice: db.leaVoice,
    addMessage: db.addMessage, chatHistory: db.chatHistory,
    carolineProfile: db.carolineProfile,
    leaMemory: db.leaMemory,
    updateLeaMemory: db.updateLeaMemory,
  })

  const handleSetupComplete = async ({ name, apiKey, profile }) => {
    await db.setName(name)
    if (apiKey)   await db.setApiKey(apiKey)
    if (profile)  await db.setCarolineProfile(profile)
    await db.createChapter()
    toast(`Bienvenue ${name} ! Ton atelier est prêt 🌿`, 'success')
  }

  const handleSaveSettings = async ({ name, apiKey, openAiKey, leaVoice, syncToken, editorFont, editorTheme, editorWidth }) => {
    await db.setName(name); await db.setApiKey(apiKey)
    await db.setOaiKey(openAiKey); await db.setVoice(leaVoice)
    if (syncToken   !== undefined) await db.setSyncToken(syncToken)
    if (editorFont  !== undefined) await db.setEditorFont(editorFont)
    if (editorTheme !== undefined) await db.setEditorTheme(editorTheme)
    if (editorWidth !== undefined) await db.setEditorWidth(editorWidth)
    toast('Réglages sauvegardés ✓', 'success')
  }

  const handleInsertDictation = useCallback((text) => {
    if (!db.currentChapter) return
    const newContent = (db.currentChapter.content || '') + (db.currentChapter.content ? ' ' : '') + text
    db.updateChapter(db.currentId, { content: newContent })
    toast('Texte inséré ✓', 'success')
  }, [db])

  // ── Auto-sync silencieux au démarrage ─────────────────────────
  useEffect(() => {
    if (db.ready && db.syncToken && import.meta.env.VITE_SYNC_WORKER_URL) {
      db.syncNow()
    }
  }, [db.ready]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!db.ready) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FAF7F2' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #EDE7DE', borderTopColor: '#8B6445', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (!db.isSetup) return <Onboarding onComplete={handleSetupComplete} />

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header
        name={db.name} moodToday={db.moodToday} setMood={db.setMood}
        streak={db.streak} moodOpen={moodOpen} setMoodOpen={setMoodOpen}
        onDictate={() => setModal('dictation')} onPlan={() => setModal('plan')}
        onExport={() => setModal('export')}     onSettings={() => setModal('settings')}
        onInspir={() => setModal('inspir')}     onVocab={() => setModal('vocab')}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar
          chapters={db.chapters} currentId={db.currentId} setCurrentId={db.setCurrentId}
          createChapter={db.createChapter} removeChapter={db.removeChapter}
          totalWords={db.totalWords} streak={db.streak}
        />
        <WritingArea
          chapter={db.currentChapter} updateChapter={db.updateChapter}
          recordSession={db.recordSession}
          editorFont={db.editorFont} editorTheme={db.editorTheme} editorWidth={db.editorWidth}
        />
        <CoachPanel
          coach={{ ...coach, clearChat: db.clearChat }}
          hasKey={!!db.apiKey}
          currentChapter={db.currentChapter}
          chatHistory={db.chatHistory}
          welcomeMsg={buildWelcomeMessage({ name: db.name, leaMemory: db.leaMemory, currentChapter: db.currentChapter })}
          onOpenVrac={() => setModal('vrac')}
        />
      </div>

      {modal === 'plan'      && <PlanModal chapters={db.chapters} updateChapter={db.updateChapter} onClose={() => setModal(null)} />}
      {modal === 'dictation' && <DictationModal onClose={() => setModal(null)} onInsert={handleInsertDictation} />}
      {modal === 'settings'  && <SettingsModal
        state={{
          name: db.name, apiKey: db.apiKey, openAiKey: db.openAiKey, leaVoice: db.leaVoice,
          syncToken: db.syncToken, syncStatus: db.syncStatus, syncMessage: db.syncMessage,
          lastSyncedAt: db.lastSyncedAt, syncNow: db.syncNow,
          editorFont: db.editorFont, editorTheme: db.editorTheme, editorWidth: db.editorWidth,
        }}
        chapters={db.chapters} vracIdeas={db.vracIdeas} name={db.name}
        onClose={() => setModal(null)} onSave={handleSaveSettings} onReset={db.resetAllData}
      />}
      {modal === 'inspir'    && <InspirationModal onClose={() => setModal(null)} onSendToCoach={coach.sendMessage} hasKey={!!db.apiKey} />}
      {modal === 'export'    && <ExportModal chapters={db.chapters} name={db.name} onClose={() => setModal(null)} />}
      {modal === 'vocab'     && (
        <DicoCaroModal
          onClose={() => setModal(null)}
          coach={coach}
          hasKey={!!db.apiKey}
        />
      )}
      {modal === 'vrac'      && (
        <VracModal
          onClose={() => setModal(null)}
          vracIdeas={db.vracIdeas}
          addVracIdea={db.addVracIdea}
          markVracUsed={db.markVracUsed}
          removeVracIdea={db.removeVracIdea}
          currentChapter={db.currentChapter}
          onInjectToLea={coach.injectVrac}
          hasKey={!!db.apiKey}
        />
      )}

      {/* ── Pack opening (une seule fois, premier lancement) ── */}
      {showPack && (
        <PackOpeningModal
          onClose={async () => {
            await db.markFirstLaunchSeen()
            setShowPack(false)
          }}
        />
      )}

      {/* ── Indicateur offline ─────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 16, right: 16,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 12px',
        background: isOnline ? 'rgba(61,107,69,.12)' : 'rgba(180,83,9,.12)',
        border: `1px solid ${isOnline ? '#6B8F71' : '#C4956A'}`,
        borderRadius: 20,
        fontSize: '.68rem', fontWeight: 600,
        fontFamily: "'Nunito', sans-serif",
        color: isOnline ? '#3D6B45' : '#92400E',
        zIndex: 500,
        pointerEvents: 'none',
        transition: 'all .4s ease',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: isOnline ? '#6B8F71' : '#C4956A',
          flexShrink: 0,
        }} />
        {isOnline ? 'En ligne' : 'Hors ligne — sauvegardé localement'}
      </div>

    </div>
  )
}

export default function App() {
  return <ToastProvider><AppInner /></ToastProvider>
}
