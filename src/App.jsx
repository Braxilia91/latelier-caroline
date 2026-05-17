import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react'
import './styles/globals.css'
import { useAppState } from './hooks/useDB'
import { useCoach } from './hooks/useCoach'
import { useMediaQuery } from './hooks/useMediaQuery'
import { ToastProvider, useToast } from './components/ui/Toast'
import { buildWelcomeMessage } from './lib/prompts'
import { putTraceBlob } from './lib/db'
// T11/#4 — Surveillance expiration token Drive
// Lot B    — signInSilent : reconnexion sans interaction au boot
import { onTokenExpiring, onTokenExpired, signInSilent, getCurrentUser } from './lib/googleDrive'

// ── Imports critiques (chemin de rendu initial) ──────────────────
import Onboarding from './components/onboarding/Onboarding'
import Header from './components/layout/Header'
import Sidebar from './components/layout/Sidebar'
import WritingArea from './components/writing/WritingArea'
import CoachPanel from './components/layout/CoachPanel'

// ── Modaux : chargés à la demande uniquement ─────────────────────
const DictationModal  = lazy(() => import('./components/modals/DictationModal'))
const SettingsModal   = lazy(() => import('./components/modals/SettingsModal'))
const InspirationModal= lazy(() => import('./components/modals/InspirationModal'))
const ExportModal     = lazy(() => import('./components/modals/ExportModal'))
const VracModal       = lazy(() => import('./components/modals/VracModal'))
const DicoCaroModal   = lazy(() => import('./components/modals/DicoCaroModal'))
const PlanModal       = lazy(() => import('./components/modals/PlanModal'))
const PackOpeningModal= lazy(() => import('./components/modals/PackOpeningModal'))
const LeaMemoryModal  = lazy(() => import('./components/modals/LeaMemoryModal'))
const TiroirModal     = lazy(() => import('./components/modals/TiroirModal'))
const AddTraceFlow    = lazy(() => import('./components/modals/AddTraceFlow'))
const TraceDetailModal= lazy(() => import('./components/modals/TraceDetailModal'))
// T11b — Heatmap régularité
const ProgressModal   = lazy(() => import('./components/modals/ProgressModal'))

// ── Durée idle avant auto-sync (ms) ─────────────────────────────
const IDLE_SYNC_DELAY = 30_000

// FEAT-B — Share Target : cache key partagé avec sw.js
const SHARE_CACHE = 'share-target-v1'

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
  const [selectedTrace, setSelectedTrace] = useState(null)
  // FEAT-B — Share Target : fichier partagé depuis une autre app (galerie, scanner…)
  const [sharedFile, setSharedFile] = useState(null)

  const isMobile = useMediaQuery('(max-width: 767px)')

  // T9 — ref pour le timer idle auto-sync
  const idleSyncTimerRef = useRef(null)
  const syncReadyRef     = useRef(false)
  // Lot A+B — Ne tenter la reconnexion Drive silencieuse qu'une fois par
  // chargement de page (sinon retrigger à chaque maj de db.traces).
  const driveSilentTriedRef = useRef(false)

  const openSidebar = () => { setSidebarOpen(true); setCoachOpen(false) }
  const openCoach   = () => { setCoachOpen(true);   setSidebarOpen(false) }

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

  useEffect(() => {
    if (db.ready && db.isSetup && db.firstLaunch) setShowPack(true)
  }, [db.ready, db.isSetup, db.firstLaunch])

  // ── Online / offline ─────────────────────────────────────────
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true)
      toast('Connexion rétablie — Léa est de nouveau disponible 🌿', 'success')
      if (syncReadyRef.current) db.syncNow()
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
  }, [db.syncNow]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── T11/#4 — Surveillance expiration token Drive ─────────────
  useEffect(() => {
    const unsubExpiring = onTokenExpiring(() => {
      toast(
        'Ta connexion Drive expire dans 5 minutes — reconnecte-toi depuis Réglages pour continuer à sauvegarder.',
        'info',
        10000,
      )
    })
    const unsubExpired = onTokenExpired(() => {
      toast(
        'Connexion Drive expirée. Tes données restent enregistrées localement — reconnecte-toi depuis Réglages.',
        'error',
        12000,
      )
    })
    return () => { unsubExpiring(); unsubExpired() }
  }, [toast])

  // ── T8.4b — Toast quand l'import inbound apporte des traces sans Drive ──
  useEffect(() => {
    if (!db.pendingBlobsMessage) return
    toast(db.pendingBlobsMessage, 'info', 10000)
    db.dismissPendingBlobsMessage()
  }, [db.pendingBlobsMessage, db.dismissPendingBlobsMessage, toast])

  // ── T11b.c — Toast aux franchissements de seuils de streak ───
  useEffect(() => {
    if (!db.streakMilestone) return
    toast(db.streakMilestone.message, 'success', 10000)
    db.dismissStreakMilestone()
  }, [db.streakMilestone, db.dismissStreakMilestone, toast])

  // ── Lot A + B — Reconnexion Drive silencieuse au boot ────────
  useEffect(() => {
    if (!db.ready || !db.isSetup) return
    if (driveSilentTriedRef.current) return
    driveSilentTriedRef.current = true
    let cancelled = false
    ;(async () => {
      let user = null
      try {
        user = await signInSilent()
      } catch (_) { /* tolérant — signInSilent ne devrait jamais throw */ }
      if (cancelled) return
      if (!user && Array.isArray(db.traces) && db.traces.length > 0) {
        toast(
          'Drive n\'est pas connecté. Reconnecte-toi depuis Réglages pour que tes photos soient sauvegardées dans le cloud.',
          'info',
          12000,
        )
      }
    })()
    return () => { cancelled = true }
  }, [db.ready, db.isSetup, db.traces, toast])

  // ── Rappel Drive 5 min ────────────────────────────────────────
  useEffect(() => {
    if (!db.ready || !db.isSetup) return
    if (!Array.isArray(db.traces) || db.traces.length === 0) return

    const FIVE_MIN = 5 * 60 * 1000
    const tick = () => {
      if (getCurrentUser()) return
      if (!Array.isArray(db.traces) || db.traces.length === 0) return
      toast(
        'Drive n\'est pas connecté. Tes photos sont en sécurité ici, mais pas encore sauvegardées dans le cloud.',
        'info',
        10000,
        { label: 'Réglages', fn: () => setModal('settings') },
      )
    }
    const intervalId = setInterval(tick, FIVE_MIN)
    return () => clearInterval(intervalId)
  }, [db.ready, db.isSetup, db.traces, toast])

  // ── Thème ────────────────────────────────────────────────────
  useEffect(() => {
    if (db.editorTheme) document.documentElement.setAttribute('data-theme', db.editorTheme)
  }, [db.editorTheme])

  // ── CSS vars ─────────────────────────────────────────────────
  useEffect(() => {
    const v = (typeof db.chatScale === 'number' && db.chatScale > 0) ? db.chatScale : 1
    document.documentElement.style.setProperty('--chat-scale', String(v))
  }, [db.chatScale])

  useEffect(() => {
    const v = (typeof db.uiScale === 'number' && db.uiScale > 0) ? db.uiScale : 1
    document.documentElement.style.setProperty('--ui-scale', String(v))
  }, [db.uiScale])

  useEffect(() => {
    const v = (typeof db.layoutScale === 'number' && db.layoutScale > 0) ? db.layoutScale : 1
    document.documentElement.style.setProperty('--layout-scale', String(v))
  }, [db.layoutScale])

  useEffect(() => {
    const v = (typeof db.sidebarWidth === 'number' && db.sidebarWidth >= 160) ? db.sidebarWidth : 220
    document.documentElement.style.setProperty('--sidebar-w', v + 'px')
  }, [db.sidebarWidth])

  // T10 #10 — coachWidth appliqué en CSS var
  useEffect(() => {
    const v = (typeof db.coachWidth === 'number' && db.coachWidth >= 220) ? db.coachWidth : 270
    document.documentElement.style.setProperty('--coach-w', v + 'px')
  }, [db.coachWidth])

  useEffect(() => {
    if (!isMobile) { setSidebarOpen(false); setCoachOpen(false) }
  }, [isMobile])

  useEffect(() => {
    if (!sidebarOpen && !coachOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') { setSidebarOpen(false); setCoachOpen(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sidebarOpen, coachOpen])

  // ── FEAT-B — Share Target : détection au montage ─────────────
  // Si l'OS a partagé une image vers L'Atelier (menu "Partager" iOS/Android),
  // le SW a intercepté le POST /share-target, stocké le blob en Cache API,
  // et redirigé vers /?share=pending.
  // On lit ici le blob, on ouvre AddTraceFlow avec l'image pré-chargée.
  useEffect(() => {
    if (!window.location.search.includes('share=pending')) return
    // Nettoyer le param URL immédiatement (sans rerender)
    window.history.replaceState({}, '', '/')
    ;(async () => {
      try {
        const cache = await caches.open(SHARE_CACHE)
        const resp = await cache.match('/share-pending')
        if (!resp) return
        const blob = await resp.blob()
        const filename = resp.headers.get('X-Share-Filename') || 'photo.jpg'
        await cache.delete('/share-pending')
        const file = new File([blob], filename, { type: blob.type || 'image/jpeg' })
        setSharedFile(file)
        setModal('addTrace')
      } catch (err) {
        console.warn('[share-target] échec lecture cache:', err)
      }
    })()
  }, [])

  // ── Coach ────────────────────────────────────────────────────
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
    if (isMobile && coach.loading && !coachOpen) { setCoachOpen(true); setSidebarOpen(false) }
  }, [coach.loading, isMobile, coachOpen])

  // ── Sync au boot ─────────────────────────────────────────────
  useEffect(() => {
    if (db.ready && db.syncToken && import.meta.env.VITE_SYNC_WORKER_URL) {
      db.syncNow()
      syncReadyRef.current = true
    }
  }, [db.ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── T9 — Auto-sync idle (30s sans frappe) ────────────────────
  useEffect(() => {
    if (!db.ready) return
    const canSync = () => syncReadyRef.current && db.syncToken && import.meta.env.VITE_SYNC_WORKER_URL && navigator.onLine

    const resetTimer = () => {
      clearTimeout(idleSyncTimerRef.current)
      if (!canSync()) return
      idleSyncTimerRef.current = setTimeout(() => {
        db.syncNow()
      }, IDLE_SYNC_DELAY)
    }

    const onPageHide = () => {
      clearTimeout(idleSyncTimerRef.current)
      if (canSync()) db.syncNow()
    }

    window.addEventListener('keydown',   resetTimer, { passive: true })
    window.addEventListener('pointerup', resetTimer, { passive: true })
    window.addEventListener('pagehide',  onPageHide)

    return () => {
      clearTimeout(idleSyncTimerRef.current)
      window.removeEventListener('keydown',   resetTimer)
      window.removeEventListener('pointerup', resetTimer)
      window.removeEventListener('pagehide',  onPageHide)
    }
  }, [db.ready, db.syncToken, db.syncNow])

  // ── Handlers ─────────────────────────────────────────────────
  const handleSetupComplete = async ({ name, apiKey, profile }) => {
    await db.setName(name)
    if (apiKey) {
      await db.setApiKey(apiKey)
      await db.setOaiKey(apiKey)
      await db.setVoice('nova')
    }
    if (profile) await db.setCarolineProfile(profile)
    await db.createChapter()
    toast(`Bienvenue ${name} ! Ton atelier est prêt 🌿`, 'success')
  }

  const handleImportBackup = async (file) => {
    if (!file) return { ok: false, message: 'Aucun fichier sélectionné' }
    try {
      const raw = await file.text()
      const data = JSON.parse(raw)
      const snapshot = data?.kv
        ? data
        : {
            version: data?.version || 5,
            syncedAt: data?.syncedAt || data?.backedUpAt || data?.exportedAt || new Date().toISOString(),
            chapters: Array.isArray(data?.chapters) ? data.chapters : [],
            vrac: Array.isArray(data?.vrac) ? data.vrac : (Array.isArray(data?.vracIdeas) ? data.vracIdeas : []),
            chat: Array.isArray(data?.chat) ? data.chat : [],
            traces: Array.isArray(data?.traces) ? data.traces : [],
            traceBlobs: Array.isArray(data?.traceBlobs) ? data.traceBlobs : [],
            kv: {
              name: data?.name || '',
              streak: data?.streak || 0,
              sessions: data?.sessions || 0,
              caroline_profile: data?.profile || null,
              lea_memory: data?.leaMemory || null,
            },
          }
      const ok = await db.importSnapshot(snapshot)
      return ok
        ? { ok: true, message: 'Sauvegarde restaurée' }
        : { ok: false, message: 'Fichier de sauvegarde invalide' }
    } catch (err) {
      return { ok: false, message: err?.message || 'Impossible de lire cette sauvegarde' }
    }
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
    if (chatScale    !== undefined) await db.setChatScale(chatScale)
    if (uiScale      !== undefined) await db.setUiScale(uiScale)
    if (layoutScale !== undefined) await db.setLayoutScale(layoutScale)
    if (sidebarWidth !== undefined) await db.setSidebarWidth(sidebarWidth)
    if (coachWidth   !== undefined) await db.setCoachWidth(coachWidth)
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
    if (!chapter) { db.removeChapter(id); return }
    db.removeChapter(id)
    toast(`Chapitre "${chapter.title || 'sans titre'}" supprimé`, 'info', 9000, {
      label: 'Annuler',
      fn: () => {
        db.restoreChapter(chapter)
        toast('Chapitre restauré ✓', 'success')
      },
    })
  }, [db, toast])

  if (!db.ready) return <AppSkeleton />
  if (!db.isSetup) return <Onboarding onComplete={handleSetupComplete} onImportBackup={handleImportBackup} />

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header
        name={db.name} moodToday={db.moodToday} setMood={db.setMood}
        streak={db.streak} moodOpen={moodOpen} setMoodOpen={setMoodOpen}
        onDictate={() => setModal('dictation')} onPlan={() => setModal('plan')}
        onExport={() => setModal('export')} onSettings={() => setModal('settings')}
        onInspir={() => setModal('inspir')} onVocab={() => setModal('vocab')}
        onTiroir={() => setModal('tiroir')}
        onProgress={() => setModal('progress')}   /* T11b */
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

      {/* T10 #9 — Alerte stockage > 85 % */}
      {db.storageWarning && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 16px', gap: 8, flexShrink: 0,
          background: 'rgba(180,83,9,.1)', borderBottom: '1px solid #C4956A',
          fontSize: '.75rem', fontWeight: 600, color: '#92400E',
        }}>
          <span>
            ⚠️ Stockage presque plein ({db.storageWarning.usageMB} MB sur {db.storageWarning.quotaMB} MB utilisés).
            {' '}Exporte une sauvegarde pour ne rien perdre.
          </span>
          <button
            onClick={db.dismissStorageWarning}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '.85rem', color: '#92400E', padding: '2px 6px' }}
            aria-label="Fermer l'alerte stockage"
          >✕</button>
        </div>
      )}

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
        {/* T13b — reorderChapters branché sur PlanModal pour drag&drop natif */}
        {modal === 'plan' && <PlanModal chapters={db.chapters} updateChapter={db.updateChapter} reorderChapters={db.reorderChapters} onClose={() => setModal(null)} />}
        {modal === 'dictation' && <DictationModal onClose={() => setModal(null)} onInsert={handleInsertDictation} />}
        {modal === 'settings' && <SettingsModal
          state={{
            name: db.name, apiKey: db.apiKey, openAiKey: db.openAiKey, leaVoice: db.leaVoice,
            syncToken: db.syncToken, syncStatus: db.syncStatus, syncMessage: db.syncMessage,
            lastSyncedAt: db.lastSyncedAt, syncNow: db.syncNow,
            editorFont: db.editorFont, editorTheme: db.editorTheme, editorWidth: db.editorWidth,
            chatScale: db.chatScale, uiScale: db.uiScale,
            layoutScale: db.layoutScale, sidebarWidth: db.sidebarWidth, coachWidth: db.coachWidth,
          }}
          chapters={db.chapters} vracIdeas={db.vracIdeas} name={db.name}
          onClose={() => setModal(null)} onSave={handleSaveSettings} onReset={db.resetAllData}
          onImport={handleImportBackup} buildLocalBackup={db.buildLocalBackup}
          onOpenMemory={() => setModal('memory')}
          isMobile={isMobile}
        />}
        {modal === 'memory' && <LeaMemoryModal
          leaMemory={db.leaMemory}
          updateLeaMemory={db.updateLeaMemory}
          resetLeaMemory={db.resetLeaMemory}
          onClose={() => setModal(null)}
        />}
        {modal === 'inspir' && <InspirationModal onClose={() => setModal(null)} onSendToCoach={coach.sendMessage} hasKey={!!db.apiKey} />}
        {/* T12 — traces + loadTraceBlob pour la section Souvenirs du PDF */}
        {modal === 'export' && (
          <ExportModal
            chapters={db.chapters}
            name={db.name}
            traces={db.traces}
            loadTraceBlob={db.loadTraceBlob}
            onClose={() => setModal(null)}
          />
        )}
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
            onClose={() => setModal(null)}
            traces={db.traces}
            onAddTrace={() => setModal('addTrace')}
            onSelectTrace={(t) => { setSelectedTrace(t); setModal('traceDetail') }}
            loadTraceBlob={db.loadTraceBlob}
          />
        )}
        {modal === 'addTrace' && (
          <AddTraceFlow
            onClose={() => { setModal('tiroir'); setSharedFile(null) }}
            initialFile={sharedFile}
            apiKey={db.apiKey}
            onCreateTrace={async ({ metadata, blob }) => {
              const trace = await db.createTrace(metadata)
              await putTraceBlob(trace.id, blob, metadata.mimeType)
              return trace
            }}
          />
        )}
        {modal === 'traceDetail' && selectedTrace && (
          <TraceDetailModal
            trace={selectedTrace}
            onClose={() => { setModal('tiroir'); setSelectedTrace(null) }}
            editTrace={db.editTrace}
            onDelete={async (t) => {
              await db.removeTrace(t.id)
              setSelectedTrace(null)
              setModal('tiroir')
            }}
            isMobile={isMobile}
            loadTraceBlob={db.loadTraceBlob}
            chapters={db.chapters}
            currentChapter={db.currentChapter}
            apiKey={db.apiKey}
            onContinueWithLea={(briefText, uiMessage) => {
              // Fire-and-forget : on ne wait pas la réponse de Léa pour fermer la modale.
              // Sinon Caroline voit la modale rester ouverte pendant que Léa streame sa
              // réponse, et peut être tentée de re-cliquer sur "En route…".
              // Les erreurs sont déjà gérées dans useCoach via mapCoachError.
              coach.sendMessage(briefText, { uiMessage, type: 'trace' })
              setSelectedTrace(null)
              setModal('tiroir')
            }}
          />
        )}
        {/* T11b — ProgressModal (heatmap régularité) */}
        {modal === 'progress' && (
          <ProgressModal
            sessionDates={db.sessionDates}
            streak={db.streak}
            sessions={db.sessions}
            name={db.name}
            onClose={() => setModal(null)}
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

      {/* T10 #8 — Indicateur online/offline */}
      <div style={{
        position: 'fixed',
        bottom: 16,
        right: isMobile ? 12 : 'calc(var(--coach-w, 270px) + 16px)',
        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
        background: isOnline ? 'rgba(61,107,69,.12)' : 'rgba(180,83,9,.12)',
        border: `1px solid ${isOnline ? '#6B8F71' : '#C4956A'}`,
        borderRadius: 20,
        fontSize: '.68rem', fontWeight: 600, fontFamily: "'Nunito', sans-serif",
        color: isOnline ? '#3D6B45' : '#92400E',
        zIndex: 500, pointerEvents: 'none', transition: 'all .4s ease',
        opacity: isMobile && isOnline ? 0 : 1,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: isOnline ? '#6B8F71' : '#C4956A', flexShrink: 0,
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
