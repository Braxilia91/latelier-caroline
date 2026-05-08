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
  const [coachOpen,    setCoachOpen]   = useState(false)

  const isMobile = useMediaQuery('(max-width: 767px)')

  // ── Mutual exclusion drawers mobile ─────────────────────────────
  const openSidebar = () => { setSidebarOpen(true); setCoachOpen(false) }
  const openCoach   = () => { setCoachOpen(true); setSidebarOpen(false) }

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

  // ── Reset drawers mobile au resize desktop ──────────────────────
  useEffect(() => {
    if (!isMobile) {
      setSidebarOpen(false)
      setCoachOpen(false)
    }
  }, [isMobile])

  // ── Escape ferme les drawers mobile ─────────────────────────────
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
    if (editorWidth 
