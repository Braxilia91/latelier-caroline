import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react'
import './styles/globals.css'
import { useAppState } from './hooks/useDB'
import { useCoach } from './hooks/useCoach'
import { useMediaQuery } from './hooks/useMediaQuery'
import { ToastProvider, useToast } from './components/ui/Toast'
import { buildWelcomeMessage } from './lib/prompts'
import * as googleDrive from './lib/googleDrive' // LOT 4F.2.4

import Onboarding from './components/onboarding/Onboarding'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import WritingArea from './components/writing/WritingArea'
import CoachPanel from './components/layout/CoachPanel'

const DictationModal = lazy(() => import('./components/modals/DictationModal'))
const SettingsModal = lazy(() => import('./components/modals/SettingsModal'))
const InspirationModal = lazy(() => import('./components/modals/InspirationModal'))
const ExportModal = lazy(() => import('./components/modals/ExportModal'))
const VracModal = lazy(() => import('./components/modals/VracModal'))
const DicoCaroModal = lazy(() => import('./components/modals/DicoCaroModal'))
const PlanModal = lazy(() => import('./components/modals/PlanModal'))
const PackOpeningModal = lazy(() => import('./components/modals/PackOpeningModal'))
const LeaMemoryModal = lazy(() => import('./components/modals/LeaMemoryModal'))

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

  // LOT 4F.2.4 — Auto-sync silencieuse Drive
  const [lastChangeAt,    setLastChangeAt]    = useState(0)
  const [lastDriveError,  setLastDriveError]  = useState(null)
  const hydratedRef = useRef(false)
  const lastChangeAtRef = useRef(0)
  const lastDriveSyncedAtRef = useRef(null)

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
    audio.play().catch(e => console.warn('[Ambiance] lecture bloquée:', e))
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
      toast('Connexion rétablie — Léa est de nouveau disponible 🌿', 'success')
    }
    const goOffline = () => {
      setIsOnline(false)
      toast('Connexion perdue — tu peux continuer à écrire, Léa revient dès que possible.', 'info')
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

  useEffect(() => {
    const v = (typeof db.chatScale === 'number' && db.chatScale > 0) ? db.chatScale : 1
    document.documentElement.style.setProperty('--chat-scale', String(v))
  }, [db.chatScale])

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
    toast(`Bienvenue ${name} ! Ton atelier est prêt 🌿`, 'success')
  }

  const handleSaveSettings = async ({ name, apiKey, openAiKey, leaVoice, syncToken, editorFont, editorTheme, editorWidth, chatScale }) => {
    await db.setName(name)
    await db.setApiKey(apiKey)
    await db.setOaiKey(openAiKey)
    await db.setVoice(leaVoice)
    if (syncToken !== undefined) await db.setSyncToken(syncToken)
    if (editorFont !== undefined) await db.setEditorFont(editorFont)
    if (editorTheme !== undefined) await db.setEditorTheme(editorTheme)
    if (editorWidth !== undefined) await db.setEditorWidth(editorWidth)
    if (chatScale  !== undefined) await db.setChatScale(chatScale)
    toast('Réglages sauvegardés ✓', 'success')
  }

  const handleInsertDictation = useCallback((text) => {
    if (!db.currentChapter) return
    const newContent = (db.currentChapter.content || '') + (db.currentChapter.content ? ' ' : '') + text
    db.updateChapter(db.currentId, { content: newContent })
    toast('Texte inséré ✓', 'success')
  }, [db])

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

  // Sync au boot
  useEffect(() => {
    if (db.ready && db.syncToken && import.meta.env.VITE_SYNC_WORKER_URL) {
      db.syncNow()
    }
  }, [db.ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // LOT 4F.1 — Auto-sync silencieuse toutes les 5 min si token configuré
  useEffect(() => {
    if (!db.ready || !db.syncToken || !import.meta.env.VITE_SYNC_WORKER_URL) return
    const intervalId = setInterval(() => {
      db.syncNow()
    }, 5 * 60 * 1000)
    return () => clearInterval(intervalId)
  }, [db.ready, db.syncToken]) // eslint-disable-line react-hooks/exhaustive-deps

  // LOT 4F.1 — Sync best-effort sur visibilitychange
  useEffect(() => {
    if (!db.ready || !db.syncToken || !import.meta.env.VITE_SYNC_WORKER_URL) return
    const handler = () => {
      if (document.hidden) {
        db.syncNow()
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [db.ready, db.syncToken]) // eslint-disable-line react-hooks/exhaustive-deps

  // LOT 4F.2.4 — Sync refs pour lecture stable dans les setInterval
  useEffect(() => { lastChangeAtRef.current = lastChangeAt }, [lastChangeAt])
  useEffect(() => { lastDriveSyncedAtRef.current = db.lastDriveSyncedAt }, [db.lastDriveSyncedAt])

  // LOT 4F.2.4 — Dirty tracking : bump lastChangeAt à chaque modif data après hydrate
  useEffect(() => {
    if (!db.ready) return
    if (!hydratedRef.current) {
      hydratedRef.current = true
      return
    }
    setLastChangeAt(Date.now())
  }, [db.ready, db.chapters, db.vracIdeas, db.leaMemory, db.carolineProfile, db.chatHistory])

  // LOT 4F.2.4 — Helper : tente un upload Drive auto (lit refs pour valeurs fraîches)
  const tryDriveAutoBackup = useCallback(async (opts = {}) => {
    const { bypassCooldown = false, bypassRecencyDelay = false } = opts
    const user = googleDrive.getCurrentUser()
    if (!user) return // Drive non connecté → skip silencieux
    const lastChange = lastChangeAtRef.current
    const lastSync = lastDriveSyncedAtRef.current ?? 0
    if (lastChange <= lastSync) return // rien à sauver
    const now = Date.now()
    if (!bypassCooldown && now - lastSync < 30 * 60 * 1000) return // cooldown 30 min
    if (!bypassRecencyDelay && now - lastChange < 5 * 60 * 1000) return // délai 5 min après modif
    try {
      const backup = await db.buildLocalBackup()
      const result = await googleDrive.uploadSnapshot(JSON.stringify(backup, null, 2))
      if (result.ok) {
        await db.setLastDriveSyncedAt(now)
        setLastDriveError(null)
      } else {
        setLastDriveError(result.message || 'Erreur Drive auto')
      }
    } catch (err) {
      setLastDriveError(err?.message || 'Erreur Drive auto')
    }
  }, [db.buildLocalBackup, db.setLastDriveSyncedAt])

  // LOT 4F.2.4 — Interval Drive auto-sync : tick toutes les 2 min, conditions strictes
  useEffect(() => {
    if (!db.ready) return
    const intervalId = setInterval(() => {
      tryDriveAutoBackup()
    }, 2 * 60 * 1000)
    return () => clearInterval(intervalId)
  }, [db.ready, tryDriveAutoBackup])

  // LOT 4F.2.4 — Best-effort on hide : bypass cooldown ET délai 5 min si modif non sauvée
  useEffect(() => {
    if (!db.ready) return
    const handler = () => {
      if (!document.hidden) return
      tryDriveAutoBackup({ bypassCooldown: true, bypassRecencyDelay: true })
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [db.ready, tryDriveAutoBackup])

  if (!db.ready) return <AppSkeleton />
  if (!db.isSetup) return <Onboarding onComplete={handleSetupComplete} />

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header
        name={db.name} moodToday={db.moodToday} setMood={db.setMood}
        streak={db.streak} moodOpen={moodOpen} setMoodOpen={setMoodOpen}
        onDictate={() => setModal('dictation')} onPlan={() => setModal('plan')}
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
            resetSyncStatus: db.resetSyncStatus,
            lastDriveSyncedAt: db.lastDriveSyncedAt, setLastDriveSyncedAt: db.setLastDriveSyncedAt,
            lastDriveError,
            editorFont: db.editorFont, editorTheme: db.editorTheme, editorWidth: db.editorWidth,
            chatScale: db.chatScale,
          }}
          chapters={db.chapters} vracIdeas={db.vracIdeas} name={db.name}
          onClose={() => setModal(null)} onSave={handleSaveSettings} onReset={db.resetAllData}
          onOpenMemory={() => setModal('memory')}
          onImport={db.importFromFile}
          buildLocalBackup={db.buildLocalBackup}
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
        {showPack && (
          <PackOpeningModal
            onClose={async () => {
              await db.markFirstLaunchSeen()
              setShowPack(false)
            }}
          />
        )}
      </Suspense>

      {/* LOT 4F.1 — Indicateur permanent de l'état de sauvegarde (desktop only) */}
      {!isMobile && (() => {
        const hasToken = !!db.syncToken
        const lastSync = db.lastSyncedAt ? new Date(db.lastSyncedAt) : null
        const ageMin   = lastSync ? Math.floor((Date.now() - lastSync.getTime()) / 60000) : null

        let state = 'ok'
        let label = ''

        if (!isOnline) {
          state = 'warn'
          label = 'Hors ligne — sauvegardé localement'
        } else if (!hasToken) {
          state = 'warn'
          label = '⚠ Sauvegarde en ligne inactive — Configure dans Réglages'
        } else if (!lastSync) {
          state = 'warn'
          label = '⚠ Première sauvegarde en attente'
        } else if (ageMin < 1) {
          label = '✓ Sauvegardé à l\'instant'
        } else if (ageMin < 60) {
          label = `✓ Sauvegardé il y a ${ageMin} min`
        } else if (ageMin < 60 * 24) {
          const h = Math.floor(ageMin / 60)
          label = `✓ Sauvegardé il y a ${h} h`
        } else {
          const d = Math.floor(ageMin / (60 * 24))
          state = 'warn'
          label = `⚠ Pas de sauvegarde depuis ${d} jour${d > 1 ? 's' : ''}`
        }

        const colors = state === 'ok'
          ? { bg: 'rgba(61,107,69,.12)',  border: '#6B8F71', text: '#3D6B45', dot: '#6B8F71' }
          : { bg: 'rgba(180,83,9,.12)',   border: '#C4956A', text: '#92400E', dot: '#C4956A' }

        const isClickable = isOnline && !hasToken

        return (
          <div
            onClick={isClickable ? () => setModal('settings') : undefined}
            style={{
              position: 'fixed', bottom: 16, right: 'calc(var(--coach-w) + 16px)',
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              borderRadius: 20,
              fontSize: '.68rem', fontWeight: 600, fontFamily: "'Nunito', sans-serif",
              color: colors.text,
              zIndex: 500,
              pointerEvents: isClickable ? 'auto' : 'none',
              cursor: isClickable ? 'pointer' : 'default',
              transition: 'all .4s ease',
              userSelect: 'none',
            }}
            role={isClickable ? 'button' : undefined}
            aria-label={isClickable ? 'Ouvrir les réglages de sauvegarde' : undefined}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: colors.dot, flexShrink: 0,
            }} />
            {label}
          </div>
        )
      })()}
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
