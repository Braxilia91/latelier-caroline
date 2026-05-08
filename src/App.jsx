import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react'
import './styles/globals.css'
import { useAppState }             from './hooks/useDB'
import { useCoach }                from './hooks/useCoach'
import { useMediaQuery }           from './hooks/useMediaQuery'
import { ToastProvider, useToast } from './components/ui/Toast'
import { buildWelcomeMessage } from './lib/prompts'

// ── Imports critiques (chemin de rendu initial) ──────────────────
import Onboarding  from './components/onboarding/Onboarding'
import Header      from './components/layout/Header'
import Sidebar     from './components/layout/Sidebar'
import WritingArea from './components/writing/WritingArea'
import CoachPanel  from './components/layout/CoachPanel'

// ── Modaux : chargés à la demande uniquement ─────────────────────
const DictationModal   = lazy(() => import('./components/modals/DictationModal'))
const SettingsModal    = lazy(() => import('./components/modals/SettingsModal'))
const InspirationModal = lazy(() => import('./components/modals/InspirationModal'))
const ExportModal      = lazy(() => import('./components/modals/ExportModal'))
const VracModal        = lazy(() => import('./components/modals/VracModal'))
const DicoCaroModal    = lazy(() => import('./components/modals/DicoCaroModal'))
const PlanModal        = lazy(() => import('./components/modals/PlanModal'))
const PackOpeningModal = lazy(() => import('./components/modals/PackOpeningModal'))

// ── Skeleton affiché pendant l'init IndexedDB ────────────────────
function AppSkeleton() {
  const pulse = { background: 'linear-gradient(90deg,#EDE7DE 25%,#E5DDD4 50%,#EDE7DE 75%)', backgroundSize: '200% 100%', animation: 'skeletonPulse 1.4s ease infinite', borderRadius: 4 }
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#FAF7F2' }}>
      <style>{`@keyframes skeletonPulse{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      {/* Header */}
      <div style={{ height: 52, borderBottom: '1px solid #EDE7DE', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, flexShrink: 0 }}>
        <div style={{ ...pulse, width: 28, height: 28, borderRadius: 6 }} />
        <div style={{ ...pulse, width: 110, height: 16 }} />
        <div style={{ flex: 1 }} />
        <div style={{ ...pulse, width: 28, height: 28, borderRadius: 6 }} />
        <div style={{ ...pulse, width: 28, height: 28, borderRadius: 6 }} />
        <div style={{ ...pulse, width: 28, height: 28, borderRadius: 6 }} />
        <div style={{ ...pulse, width: 28, height: 28, borderRadius: '50%' }} />
      </div>
      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ width: 200, borderRight: '1px solid #EDE7DE', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ ...pulse, height: 13, width: '55%' }} />
          <div style={{ ...pulse, height: 32, borderRadius: 6 }} />
          <div style={{ ...pulse, height: 32, borderRadius: 6, opacity: .6 }} />
          <div style={{ ...pulse, height: 32, borderRadius: 6, opacity: .4 }} />
        </div>
        {/* WritingArea */}
        <div style={{ flex: 1, padding: '48px 60px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ ...pulse, height: 22, width: '35%' }} />
          <div style={{ ...pulse, height: 14, width: '92%' }} />
          <div style={{ ...pulse, height: 14, width: '78%' }} />
          <div style={{ ...pulse, height: 14, width: '85%' }} />
          <div style={{ ...pulse, height: 14, width: '60%' }} />
        </div>
        {/* CoachPanel */}
        <div style={{ width: 280, borderLeft: '1px solid #EDE7DE', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ ...pulse, height: 13, width: '45%' }} />
          <div style={{ ...pulse, height: 60, borderRadius: 8 }} />
        </div>
      </div>
    </div>
  )
}

function AppInner() {
  const toast = useToast()
  const db    = useAppState()

  const [modal,        setModal]       = useState(null)
  const [moodOpen,     setMoodOpen]    = useState(false)
  const [ambientOpen,  setAmbientOpen] = useState(false)
  const [showPack,     setShowPack]    = useState(false)
  const [isOnline,     setIsOnline]    = useState(navigator.onLine)
  const [sidebarOpen,  setSidebarOpen] = useState(false)

  const isMobile = useMediaQuery('(max-width: 767px)')

  // ── Ambiance sonore ─────────────────────────────────────────────
  const audioRef        = useRef(null)
  const [ambientPlaying, setAmbientPlaying] = useState(false)

  const startAmbient = useCallback((sound, volume) => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    if (!sound) return
    const audio      = new Audio(`/sounds/${sound}.mp3`)
    audio.loop       = true
    audio.volume     = Math.max(0, Math.min(1, volume ?? 0.28))
    audio.play().catch(e => console.warn('[Ambiance] lecture bloquée:', e))
    audioRef.current = audio
  }, [])

  const handleAmbientChange = useCallback((sound) => {
    db.setAmbientSound(sound)
    if (sound === null) {
      audioRef.current?.pause()
      if (audioRef.current) { audioRef.current.src = ''; audioRef.current = null }
      setAmbientPlaying(false)
    } else {
      startAmbient(sound, db.ambientVolume)
      setAmbientPlaying(true)
    }
  }, [db.setAmbientSound, db.ambientVolume, startAmbient])

  const handleVolumeChange = useCallback((v) => {
    db.setAmbientVolume(v)
    if (audioRef.current) audioRef.current.volume = Math.max(0, Math.min(1, v))
  }, [db.setAmbientVolume])

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      if (audioRef.current) audioRef.current.src = ''
    }
  }, [])

  // ── Pack opening : déclenché une seule fois après setup ─────────
  useEffect(() => {
    if (db.ready && db.isSetup && db.firstLaunch) setShowPack(true)
  }, [db.ready, db.isSetup, db.firstLaunch])

  // ── Indicateur connexion + toast transitions réseau ─────────────
  useEffect(() => {
    const goOnline  = () => {
      setIsOnline(true)
      toast('Connexion rétablie — Léa est de nouveau disponible 🌿', 'success')
    }
    const goOffline = () => {
      setIsOnline(false)
      toast('Connexion perdue — tu peux continuer à écrire, Léa revient dès que possible.', 'info')
    }
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, []) // toast est stable (useCallback []) — pas de re-registration

  // ── Thème global (data-theme sur <html>) ─────────────────────────
  useEffect(() => {
    if (db.editorTheme) document.documentElement.setAttribute('data-theme', db.editorTheme)
  }, [db.editorTheme])

  // ── Reset drawer mobile au resize desktop ───────────────────────
  useEffect(() => {
    if (!isMobile) setSidebarOpen(false)
  }, [isMobile])

  // ── Escape ferme le drawer mobile ───────────────────────────────
  useEffect(() => {
    if (!sidebarOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sidebarOpen])

  // ── Coach Léa ────────────────────────────────────────────────────
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

  // ── Undo suppression de chapitre via toast ──────────────────────
  const handleRemoveChapter = useCallback((id) => {
    const chapter = db.chapters.find(c => c.id === id)
    if (!chapter) {
      db.removeChapter(id)
      return
    }
    db.removeChapter(id)
    toast(`Chapitre "${chapter.title || 'sans titre'}" supprimé`, 'info', 4000, {
      label: 'Annuler',
      fn: () => {
        db.restoreChapter(chapter)
        toast('Chapitre restauré ✓', 'success')
      },
    })
  }, [db, toast])

  // ── Auto-sync silencieux au démarrage ─────────────────────────
  useEffect(() => {
    if (db.ready && db.syncToken && import.meta.env.VITE_SYNC_WORKER_URL) {
      db.syncNow()
    }
  }, [db.ready]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!db.ready) return <AppSkeleton />
  if (!db.isSetup) return <Onboarding onComplete={handleSetupComplete} />

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header
        name={db.name} moodToday={db.moodToday} setMood={db.setMood}
        streak={db.streak} moodOpen={moodOpen} setMoodOpen={setMoodOpen}
        onDictate={() => setModal('dictation')} onPlan={() => setModal('plan')}
        onExport={() => setModal('export')}     onSettings={() => setModal('settings')}
        onInspir={() => setModal('inspir')}     onVocab={() => setModal('vocab')}
        ambientSound={db.ambientSound}
        ambientPlaying={ambientPlaying}
        onAmbientChange={handleAmbientChange}
        ambientVolume={db.ambientVolume}
        onVolumeChange={handleVolumeChange}
        ambientOpen={ambientOpen}
        setAmbientOpen={setAmbientOpen}
        isMobile={isMobile}
        onMenuClick={() => setSidebarOpen(true)}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar
          chapters={db.chapters} currentId={db.currentId} setCurrentId={db.setCurrentId}
          createChapter={db.createChapter} removeChapter={handleRemoveChapter}
          totalWords={db.totalWords} streak={db.streak}
          isMobile={isMobile}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <WritingArea
          chapter={db.currentChapter} updateChapter={db.updateChapter}
          recordSession={db.recordSession}
          editorFont={db.editorFont} editorTheme={db.editorTheme} editorWidth={db.editorWidth}
        />
        <CoachPanel
          coach={{ ...coach, clearChat: db.clearChat }}
          hasKey={!!db.apiKey}
          isOnline={isOnline}
          currentChapter={db.currentChapter}
          chatHistory={db.chatHistory}
          welcomeMsg={buildWelcomeMessage({ name: db.name, leaMemory: db.leaMemory, currentChapter: db.currentChapter })}
          onOpenVrac={() => setModal('vrac')}
        />
      </div>

      {/* ── Backdrop drawer mobile ─────────────────────────────── */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 52, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 99,
            transition: 'opacity .25s',
          }}
          aria-label="Fermer le panneau"
          role="button"
        />
      )}

      {/* ── Modaux lazy — chargés uniquement à la première ouverture ── */}
      <Suspense fallback={null}>
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
        {modal === 'vocab'     && <DicoCaroModal onClose={() => setModal(null)} coach={coach} hasKey={!!db.apiKey} currentChapter={db.currentChapter} />}
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
        {showPack && (
          <PackOpeningModal
            onClose={async () => {
              await db.markFirstLaunchSeen()
              setShowPack(false)
            }}
          />
        )}
      </Suspense>

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
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  )
}
