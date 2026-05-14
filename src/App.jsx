import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react'
import './styles/globals.css'
import { useAppState } from './hooks/useDB'
import { useCoach } from './hooks/useCoach'
import { useMediaQuery } from './hooks/useMediaQuery'
import { ToastProvider, useToast } from './components/ui/Toast'
import { buildWelcomeMessage } from './lib/prompts'

// ── Imports critiques (chemin de rendu initial) ──────────────────
import Onboarding from './components/onboarding/Onboarding'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import WritingArea from './components/writing/WritingArea'
import CoachPanel from './components/layout/CoachPanel'

// ── Modaux : chargés à la demande uniquement ─────────────────────
const DictationModal = lazy(() => import('./components/modals/DictationModal'))
const SettingsModal = lazy(() => import('./components/modals/SettingsModal'))
const InspirationModal = lazy(() => import('./components/modals/InspirationModal'))
const ExportModal = lazy(() => import('./components/modals/ExportModal'))
const VracModal = lazy(() => import('./components/modals/VracModal'))
const DicoCaroModal = lazy(() => import('./components/modals/DicoCaroModal'))
const PlanModal = lazy(() => import('./components/modals/PlanModal'))
const PackOpeningModal = lazy(() => import('./components/modals/PackOpeningModal'))
// LOT 4C.3 — Mémoire de Léa : modale dédiée pour visibilité + contrôle utilisateur
const LeaMemoryModal = lazy(() => import('./components/modals/LeaMemoryModal'))
// LOT 2B.1 — Le tiroir : routing inert (bouton câblé au commit 2B.2 dans Header.jsx)
const TiroirModal = lazy(() => import('./components/modals/TiroirModal'))
const TraceDetailModal = lazy(() => import('./components/modals/TraceDetailModal'))

function AppSkeleton() {
  const pulse = {
    background: 'linear-gradient(90deg,#EDE7DE 25%,#E5DDD4 50%,#EDE7DE 75%)',
    backgroundSize: '200% 100%',
    animation: 'skeletonPulse 1.4s ease infinite',
    borderRadius: 4,
  }
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#FAF7F2' }}>
      <style>{`@keyframes skeletonPulse{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div style={{ height: 52, borderBottom: '1px solid #EDE7DE', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, flexShrink: 0 }}>
        <div style={{ ...pulse, width: 28, height: 28, borderRadius: 6 }} />
        <div style={{ ...pulse, width: 110, height: 16 }} />
        <div style={{ flex: 1 }} />
        <div style={{ ...pulse, width: 28, height: 28, borderRadius: 6 }} />
        <div style={{ ...pulse, width: 28, height: 28, borderRadius: 6 }} />
        <div style={{ ...pulse, width: 28, height: 28, borderRadius: 6 }} />
        <div style={{ ...pulse, width: 28, height: 28, borderRadius: '50%' }} />
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: 200, borderRight: '1px solid #EDE7DE', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ ...pulse, height: 13, width: '55%' }} />
          <div style={{ ...pulse, height: 32, borderRadius: 6 }} />
          <div style={{ ...pulse, height: 32, borderRadius: 6, opacity: .6 }} />
          <div style={{ ...pulse, height: 32, borderRadius: 6, opacity: .4 }} />
        </div>
        <div style={{ flex: 1, padding: '48px 60px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ ...pulse, height: 22, width: '35%' }} />
          <div style={{ ...pulse, height: 14, width: '92%' }} />
          <div style={{ ...pulse, height: 14, width: '78%' }} />
          <div style={{ ...pulse, height: 14, width: '85%' }} />
          <div style={{ ...pulse, height: 14, width: '60%' }} />
        </div>
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
  const db = useAppState()

  const [modal, setModal] = useState(null)
  const [moodOpen, setMoodOpen] = useState(false)
  const [ambientOpen, setAmbientOpen] = useState(false)
  const [showPack, setShowPack] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [coachOpen, setCoachOpen] = useState(false)
  // LOT 2B.1 — Trace sélectionnée pour TraceDetailModal (null = pas de fiche ouverte)
  const [selectedTrace, setSelectedTrace] = useState(null)

  const isMobile = useMediaQuery('(max-width: 767px)')

  const openSidebar = () => { setSidebarOpen(true); setCoachOpen(false) }
  const openCoach = () => { setCoachOpen(true); setSidebarOpen(false) }

  const audioRef = useRef(null)
  const [ambientPlaying, setAmbientPlaying] = useState(false)

  const startAmbient = useCallback((sound, volume) => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    if (!sound) return
    const audio = new Audio(`/sounds/${sound}.mp3`)
    audio.loop = true
    audio.volume = Math.max(0, Math.min(1, volume ?? 0.28))
    audio.play().catch(e => console.warn('[Ambiance] lecture bloquee:', e))
    audioRef.current = audio
  }, [])

  const handleAmbientChange = useCallback((sound) => {
    db.setAmbientSound(sound)
    if (sound === null) {
      audioRef.current?.pause()
      if (audioRef.current) {
        audioRef.current.src = ''
        audioRef.current = null
      }
      setAmbientPlaying(false)
    } else {
      startAmbient(sound, db.ambientVolume)
      setAmbientPlaying(true)
    }
  }, [db.setAmbientSound, db.ambientVolume, startAmbient])

  const handleVolumeChange = useCallback((v) => {
    db.setAmbientVolume(v)
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, v))
    }
  }, [db.setAmbientVolume])

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      if (audioRef.current) {
        audioRef.current.src = ''
      }
    }
  }, [])

  useEffect(() => {
    if (db.ready && db.isSetup && db.firstLaunch) {
      setShowPack(true)
    }
  }, [db.ready, db.isSetup, db.firstLaunch])

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true)
      toast('Connexion retablie — Lea est de nouveau disponible', 'success')
    }
    const goOffline = () => {
      setIsOnline(false)
      toast('Connexion perdue — tu peux continuer a ecrire, Lea revient des que possible.', 'info')
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  useEffect(() => {
    if (db.editorTheme) {
      document.documentElement.setAttribute('data-theme', db.editorTheme)
    }
  }, [db.editorTheme])

  // LOT 3.5 — Applique l'echelle du chat Lea sur la racine HTML
  // Les elements du coach panel utilisent calc(... * var(--chat-scale))
  useEffect(() => {
    const v = (typeof db.chatScale === 'number' && db.chatScale > 0) ? db.chatScale : 1
    document.documentElement.style.setProperty('--chat-scale', String(v))
  }, [db.chatScale])

  // LOT 4E.1 — Applique l'echelle UI globale sur la racine HTML
  useEffect(() => {
    const v = (typeof db.uiScale === 'number' && db.uiScale > 0) ? db.uiScale : 1
    document.documentElement.style.setProperty('--ui-scale', String(v))
  }, [db.uiScale])

  // LOT 4E.2 — Echelle mise en page desktop (sidebar + header actions)
  useEffect(() => {
    const v = (typeof db.layoutScale === 'number' && db.layoutScale > 0) ? db.layoutScale : 1
    document.documentElement.style.setProperty('--layout-scale', String(v))
  }, [db.layoutScale])

  // LOT 4E.2 — Largeur de la colonne chapitres (desktop uniquement)
  useEffect(() => {
    const v = (typeof db.sidebarWidth === 'number' && db.sidebarWidth >= 160) ? db.sidebarWidth : 220
    document.documentElement.style.setProperty('--sidebar-w', v + 'px')
  }, [db.sidebarWidth])

  // LOT 4E.2 bis — Largeur du panneau Lea (desktop uniquement)
  // Mobile : globals.css force --coach-w: 0px via @media (max-width: 768px)
  useEffect(() => {
    const v = (typeof db.coachWidth === 'number' && db.coachWidth >= 220) ? db.coachWidth : 270
    document.documentElement.style.setProperty('--coach-w', v + 'px')
  }, [db.coachWidth])

  useEffect(() => {
    if (!isMobile) {
      setSidebarOpen(false)
      setCoachOpen(false)
    }
  }, [isMobile])

  useEffect(() => {
    if (!sidebarOpen && !coachOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false)
        setCoachOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sidebarOpen, coachOpen])

  const coach = useCoach({
    apiKey: db.apiKey,
    openAiKey: db.openAiKey,
    name: db.name,
    moodToday: db.moodToday,
    currentChapter: db.currentChapter,
    leaVoice: db.leaVoice,
    addMessage: db.addMessage,
    chatHistory: db.chatHistory,
    carolineProfile: db.carolineProfile,
    leaMemory: db.leaMemory,
    updateLeaMemory: db.updateLeaMemory,
  })

  // ── Auto-ouvre le drawer CoachPanel sur mobile quand Lea repond ──
  useEffect(() => {
    if (isMobile && coach.loading && !coachOpen) {
      setCoachOpen(true)
      setSidebarOpen(false)
    }
  }, [coach.loading, isMobile, coachOpen])

  const handleSetupComplete = async ({ name, apiKey, profile }) => {
    await db.setName(name)
    if (apiKey) await db.setApiKey(apiKey)
    if (profile) await db.setCarolineProfile(profile)
    await db.createChapter()
    toast(`Bienvenue ${name} ! Ton atelier est pret`, 'success')
  }

  const handleSaveSettings = async ({ name, apiKey, openAiKey, leaVoice, syncToken, editorFont, editorTheme, editorWidth, chatScale, uiScale, layoutScale, sidebarWidth, coachWidth }) => {
    await db.setName(name)
    await db.setApiKey(apiKey)
    await db.setOaiKey(openAiKey)
    await db.setVoice(leaVoice)
    if (syncToken    !== undefined) await db.setSyncToken(syncToken)
    if (editorFont   !== undefined) await db.setEditorFont(editorFont)
    if (editorTheme  !== undefined) await db.setEditorTheme(editorTheme)
    if (editorWidth  !== undefined) await db.setEditorWidth(editorWidth)
    if (chatScale    !== undefined) await db.setChatScale(chatScale)    // LOT 3.5
    if (uiScale      !== undefined) await db.setUiScale(uiScale)        // LOT 4E.1
    if (layoutScale  !== undefined) await db.setLayoutScale(layoutScale)  // LOT 4E.2
    if (sidebarWidth !== undefined) await db.setSidebarWidth(sidebarWidth) // LOT 4E.2
    if (coachWidth   !== undefined) await db.setCoachWidth(coachWidth)     // LOT 4E.2 bis
    toast('Reglages sauvegardes', 'success')
  }

  // LOT 4F.2.6 — Wrapper d'import depuis un File DOM (utilise par SettingsModal
  // pour les deux flux : import fichier local + restauration depuis Drive).
  // SettingsModal s'occupe du window.location.reload() apres succes,
  // donc on ne rafraichit pas le state React ici.
  const handleImportFromBackup = async (file) => {
    if (!file) return { ok: false, message: 'Aucun fichier fourni' }
    try {
      const text = await file.text()
      const snapshot = JSON.parse(text)
      const ok = await db.importSnapshot(snapshot)
      return ok
        ? { ok: true, message: 'Sauvegarde restauree' }
        : { ok: false, message: 'Snapshot invalide ou corrompu' }
    } catch (err) {
      return { ok: false, message: err?.message || 'Erreur de lecture du fichier' }
    }
  }

  const handleInsertDictation = useCallback((text) => {
    if (!db.currentChapter) return
    const newContent = (db.currentChapter.content || '') + (db.currentChapter.content ? ' ' : '') + text
    db.updateChapter(db.currentId, { content: newContent })
    toast('Texte insere', 'success')
  }, [db])

  const handleRemoveChapter = useCallback((id) => {
    const chapter = db.chapters.find(c => c.id === id)
    if (!chapter) {
      db.removeChapter(id)
      return
    }
    db.removeChapter(id)
    toast(`Chapitre "${chapter.title || 'sans titre'}" supprime`, 'info', 4000, {
      label: 'Annuler',
      fn: () => {
        db.restoreChapter(chapter)
        toast('Chapitre restaure', 'success')
      },
    })
  }, [db, toast])

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
        onTiroir={() => setModal('tiroir')}
        onExport={() => setModal('export')} onSettings={() => setModal('settings')}
        onInspir={() => setModal('inspir')} onVocab={() => setModal('vocab')}
        ambientSound={db.ambientSound}
        ambientPlaying={ambientPlaying}
        onAmbientChange={handleAmbientChange}
        ambientVolume={db.ambientVolume}
        onVolumeChange={handleVolumeChange}
        ambientOpen={ambientOpen}
        setAmbientOpen={setAmbientOpen}
        isMobile={isMobile}
        onMenuClick={openSidebar}
        onCoachClick={openCoach}
      />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar
          chapters={db.chapters} currentId={db.currentId} setCurrentId={db.setCurrentId}
          createChapter={db.createChapter} removeChapter={handleRemoveChapter}
          totalWords={db.totalWords} streak={db.streak}
          isMobile={isMobile} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}
        />
        <WritingArea
          chapter={db.currentChapter} updateChapter={db.updateChapter}
          recordSession={db.recordSession}
          editorFont={db.editorFont} editorTheme={db.editorTheme} editorWidth={db.editorWidth}
        />
        <CoachPanel
          coach={{ ...coach, clearChat: db.clearChat, removeMessage: db.removeMessage }}
          hasKey={!!db.apiKey}
          isOnline={isOnline}
          currentChapter={db.currentChapter}
          chatHistory={db.chatHistory}
          welcomeMsg={buildWelcomeMessage({
            name: db.name, leaMemory: db.leaMemory, currentChapter: db.currentChapter,
          })}
          onOpenVrac={() => setModal('vrac')}
          isMobile={isMobile} isOpen={coachOpen} onClose={() => setCoachOpen(false)}
        />
      </div>

      {isMobile && (sidebarOpen || coachOpen) && (
        <div
          onClick={() => { setSidebarOpen(false); setCoachOpen(false) }}
          style={{
            position: 'fixed', top: 52, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)', zIndex: 99, transition: 'opacity .25s',
          }}
          aria-label="Fermer le panneau"
          role="button"
        />
      )}

      <Suspense fallback={null}>
        {modal === 'plan' && <PlanModal chapters={db.chapters} updateChapter={db.updateChapter} onClose={() => setModal(null)} />}
        {modal === 'dictation' && <DictationModal onClose={() => setModal(null)} onInsert={handleInsertDictation} />}
        {modal === 'settings' && <SettingsModal
          state={{
            name: db.name, apiKey: db.apiKey, openAiKey: db.openAiKey, leaVoice: db.leaVoice,
            syncToken: db.syncToken, syncStatus: db.syncStatus, syncMessage: db.syncMessage,
            lastSyncedAt: db.lastSyncedAt, syncNow: db.syncNow,
            editorFont: db.editorFont, editorTheme: db.editorTheme, editorWidth: db.editorWidth,
            chatScale: db.chatScale, uiScale: db.uiScale,
            layoutScale: db.layoutScale, sidebarWidth: db.sidebarWidth,
            coachWidth: db.coachWidth,
            lastDriveSyncedAt: db.lastDriveSyncedAt,
            setLastDriveSyncedAt: db.setLastDriveSyncedAt,
          }}
          chapters={db.chapters} vracIdeas={db.vracIdeas} name={db.name}
          onClose={() => setModal(null)} onSave={handleSaveSettings} onReset={db.resetAllData}
          onOpenMemory={() => setModal('memory')}
          buildLocalBackup={db.buildLocalBackup}
          onImport={handleImportFromBackup}
          isMobile={isMobile}
        />}
        {modal === 'memory' && <LeaMemoryModal
          leaMemory={db.leaMemory}
          updateLeaMemory={db.updateLeaMemory}
          resetLeaMemory={db.resetLeaMemory}
          onClose={() => setModal(null)}
        />}
        {modal === 'inspir' && <InspirationModal onClose={() => setModal(null)} onSendToCoach={coach.sendMessage} hasKey={!!db.apiKey} />}
        {modal === 'export' && <ExportModal chapters={db.chapters} name={db.name} onClose={() => setModal(null)} />}
        {modal === 'vocab' && <DicoCaroModal onClose={() => setModal(null)} coach={coach} hasKey={!!db.apiKey} currentChapter={db.currentChapter} />}
        {modal === 'vrac' && (
          <VracModal
            onClose={() => setModal(null)} vracIdeas={db.vracIdeas}
            addVracIdea={db.addVracIdea} markVracUsed={db.markVracUsed} removeVracIdea={db.removeVracIdea}
            currentChapter={db.currentChapter} onInjectToLea={coach.injectVrac} hasKey={!!db.apiKey}
          />
        )}
        {modal === 'tiroir' && (
          <TiroirModal
            traces={db.traces}
            onClose={() => setModal(null)}
            onAddTrace={() => { /* LOT 3 : ouvrira AddTraceFlow */ }}
            onOpenTrace={(trace) => { setSelectedTrace(trace); setModal('traceDetail') }}
            isMobile={isMobile}
          />
        )}
        {modal === 'traceDetail' && (
          <TraceDetailModal
            trace={selectedTrace}
            onClose={() => { setSelectedTrace(null); setModal('tiroir') }}
            onEdit={() => { /* LOT futur : ouvrira AddTraceFlow en mode édition */ }}
            onDelete={() => { /* LOT futur : confirm + db.removeTrace */ }}
            isMobile={isMobile}
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

      {!isMobile && (
        <div style={{
          position: 'fixed', bottom: 16, right: 'calc(var(--coach-w) + 16px)',
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
          background: isOnline ? 'rgba(61,107,69,.12)' : 'rgba(180,83,9,.12)',
          border: `1px solid ${isOnline ? '#6B8F71' : '#C4956A'}`,
          borderRadius: 20,
          fontSize: '.68rem', fontWeight: 600, fontFamily: "'Nunito', sans-serif",
          color: isOnline ? '#3D6B45' : '#92400E',
          zIndex: 500, pointerEvents: 'none', transition: 'all .4s ease',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: isOnline ? '#6B8F71' : '#C4956A', flexShrink: 0,
          }} />
          {isOnline ? 'En ligne' : 'Hors ligne — sauvegarde localement'}
        </div>
      )}
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
