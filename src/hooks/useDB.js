import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getKV, setKV,
  getChapters, saveChapter, deleteChapter, restoreChapter as dbRestoreChapter,
  getChatHistoryRecent, addChatMessage, clearChatHistory, deleteChatMessage,
  getVrac, addVrac, updateVrac, deleteVrac,
  exportAllData, resetAllData, importSnapshot, getStorageEstimate,
} from '../lib/db'
import { pushSnapshot, pullSnapshot, buildSnapshot, whoWins } from '../lib/sync'

export function useAppState() {
  const [ready,          setReady]          = useState(false)
  const [name,           setNameState]      = useState('')
  const [apiKey,         setApiKeyState]    = useState('')
  const [openAiKey,      setOAIKey]         = useState('')
  const [leaVoice,       setLeaVoice]       = useState('nova')
  const [streak,         setStreakState]    = useState(0)
  const [sessions,       setSessionsState]  = useState(0)
  const [lastSession,    setLastSession]    = useState('')
  const [moodToday,      setMoodTodayState] = useState('')
  const [chapters,       setChapters]       = useState([])
  const chaptersRef = useRef([])   // ref miroir — pour les callbacks stables
  const [currentId,      setCurrentId]      = useState(null)
  const currentIdRef = useRef(null) // idem pour currentId
  const [chatHistory,    setChatHistory]    = useState([])
  const [carolineProfile, setProfileState] = useState(null)   // profil onboarding
  const [leaMemory,      setLeaMemoryState] = useState(null)  // mémoire session Léa
  // ── Sync inter-appareils ─────────────────────────────────────
  const [syncToken,      setSyncTokenState] = useState('')
  const [syncStatus,     setSyncStatus]     = useState('idle') // idle | syncing | ok | error
  const [syncMessage,    setSyncMessage]    = useState('')
  const [lastSyncedAt,   setLastSyncedAt]   = useState(null)
  const [vracIdeas,      setVracIdeas]      = useState([])    // boîte à idées
  // ── Préférences d'affichage ──────────────────────────────────
  const [editorFont,     setEditorFontState]  = useState('m')       // s | m | l | xl
  const [editorTheme,    setEditorThemeState] = useState('jour')     // jour | soir | bougie
  const [editorWidth,    setEditorWidthState] = useState('confort')  // confort | full
  const [firstLaunch,    setFirstLaunchState] = useState(false)      // true = scène pack opening à afficher
  // LOT 3.5 — Échelle du chat Léa (multiplicateur appliqué via CSS var --chat-scale)
  const [chatScale,      setChatScaleState]   = useState(1)          // 1 (Compact) | 1.15 (Confort) | 1.3 (Grand)
  // LOT 4E.1 — Échelle UI globale (multiplicateur appliqué via CSS var --ui-scale)
  const [uiScale,        setUiScaleState]     = useState(1)          // 0.9 | 1 | 1.15
  // LOT 4E.2 — Échelle mise en page desktop (sidebar + header actions)
  const [layoutScale,    setLayoutScaleState]  = useState(1)         // 0.9–1.5
  const [sidebarWidth,   setSidebarWidthState] = useState(220)       // 160–480 px
  // LOT 4E.2 bis — Largeur du panneau Léa (desktop uniquement)
  const [coachWidth,     setCoachWidthState]   = useState(270)       // 220–480 px
  // LOT 4F.2.6 — Timestamp de la dernière sauvegarde Drive réussie
  const [lastDriveSyncedAt, setLastDriveSyncedAtState] = useState(null) // ms epoch | null
  // ── Ambiance sonore ─────────────────────────────────────────
  const [ambientSound,   setAmbientSoundState]  = useState(null)    // null | 'pluie'|'cafe'|'feu'|'foret'
  const [ambientVolume,  setAmbientVolumeState] = useState(0.28)    // 0–1
  // ── Alerte stockage (>85% du quota) ─────────────────────────
  const [storageWarning, setStorageWarning] = useState(null)        // null | { ratio, usageMB, quotaMB }
  // ── Lock anti-race recordSession ────────────────────────────
  const recordSessionLockRef = useRef(false)
  const lastSessionRef = useRef('')

  // ─── Chargement initial ──────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      // Demander au navigateur de ne pas évincer le stockage de l'app
      let storagePersisted = false
      if (navigator.storage?.persist) {
        try {
          storagePersisted = await navigator.storage.persist()
        } catch { /* silencieux si refusé */ }
      }
      if (!storagePersisted) {
        // Pas critique au boot — sera signalé via storageWarning si quota élevé
        console.info('[Storage] Mode non-persistant. Le navigateur peut évincer les données en cas de pression mémoire.')
      }

      const [n, k, oai, lv, st, sess, last, mood, chs, chat, prof, mem, vrac, stok, lsa, ef, et, ew, fls, snd, vol, cs, us, ls, sw, cw, lda] = await Promise.all([
        getKV('name',             ''),
        getKV('apiKey',           ''),
        getKV('openAiKey',        ''),
        getKV('leaVoice',         'nova'),
        getKV('streak',           0),
        getKV('sessions',         0),
        getKV('lastSession',      ''),
        getKV('moodToday',        ''),
        getChapters(),
        getChatHistoryRecent(200),  // ← 200 derniers (cap RAM, persistance complète en DB)
        getKV('caroline_profile', null),
        getKV('lea_memory',       null),
        getVrac(),
        getKV('syncToken',        ''),
        getKV('lastSyncedAt',     null),
        getKV('editorFont',       'm'),
        getKV('editorTheme',      'jour'),
        getKV('editorWidth',      'confort'),
        getKV('firstLaunchSeen',  false),
        getKV('ambientSound',     null),
        getKV('ambientVolume',    0.28),
        getKV('chatScale',        1),     // LOT 3.5
        getKV('uiScale',          1),     // LOT 4E.1
        getKV('layoutScale',      1),     // LOT 4E.2
        getKV('sidebarWidth',     220),   // LOT 4E.2
        getKV('coachWidth',       270),   // LOT 4E.2 bis
        getKV('lastDriveSyncedAt', null), // LOT 4F.2.6
      ])

      setNameState(n); setApiKeyState(k); setOAIKey(oai); setLeaVoice(lv)
      setStreakState(st); setSessionsState(sess); setLastSession(last)

      const today = new Date().toDateString()
      setMoodTodayState(mood === today ? await getKV('moodValue', '') : '')

      setChapters(chs)
      if (chs.length > 0) setCurrentId(chs[0].id)
      setChatHistory(chat)
      setProfileState(prof)
      setLeaMemoryState(mem)
      setVracIdeas(vrac)
      setSyncTokenState(stok)
      setLastSyncedAt(lsa)
      setEditorFontState(ef)
      setEditorThemeState(et)
      setEditorWidthState(ew)
      setFirstLaunchState(!fls)   // firstLaunch = true si jamais vu
      setAmbientSoundState(snd)
      setAmbientVolumeState(vol)
      setChatScaleState(typeof cs === 'number' && cs > 0 ? cs : 1)   // LOT 3.5 — fallback safe
      setUiScaleState(typeof us === 'number' && us > 0 ? us : 1)    // LOT 4E.1 — fallback safe
      setLayoutScaleState(typeof ls === 'number' && ls > 0 ? ls : 1)          // LOT 4E.2
      setSidebarWidthState(typeof sw === 'number' && sw >= 160 ? sw : 220)    // LOT 4E.2
      setCoachWidthState(typeof cw === 'number' && cw >= 220 ? cw : 270)      // LOT 4E.2 bis
      setLastDriveSyncedAtState(typeof lda === 'number' && lda > 0 ? lda : null) // LOT 4F.2.6
      setReady(true)

      // Quota check en arrière-plan — non bloquant
      try {
        const est = await getStorageEstimate()
        if (est && est.ratio > 0.85) {
          setStorageWarning({
            ratio: est.ratio,
            usageMB: Math.round(est.usage / 1024 / 1024),
            quotaMB: Math.round(est.quota / 1024 / 1024),
          })
        }
      } catch { /* tolérant */ }
    })()
  }, [])

  // ─── Sync refs (pour callbacks stables sans dépendances instables) ──
  useEffect(() => { chaptersRef.current  = chapters  }, [chapters])
  useEffect(() => { currentIdRef.current = currentId }, [currentId])
  useEffect(() => { lastSessionRef.current = lastSession }, [lastSession])

  // ─── Helpers persist ─────────────────────────────────────────
  const setName   = useCallback(async (v) => { setNameState(v);   await setKV('name',      v) }, [])
  const setApiKey = useCallback(async (v) => { setApiKeyState(v); await setKV('apiKey',     v) }, [])
  const setOaiKey = useCallback(async (v) => { setOAIKey(v);      await setKV('openAiKey',  v) }, [])
  const setVoice  = useCallback(async (v) => { setLeaVoice(v);    await setKV('leaVoice',   v) }, [])

  // ── Préférences d'affichage ──────────────────────────────────
  const setEditorFont  = useCallback(async (v) => { setEditorFontState(v);  await setKV('editorFont',  v) }, [])
  const setEditorTheme = useCallback(async (v) => { setEditorThemeState(v); await setKV('editorTheme', v) }, [])
  const setEditorWidth = useCallback(async (v) => { setEditorWidthState(v); await setKV('editorWidth', v) }, [])
  // LOT 3.5 — Échelle du chat Léa
  const setChatScale   = useCallback(async (v) => {
    const safe = typeof v === 'number' && v > 0 ? v : 1
    setChatScaleState(safe)
    await setKV('chatScale', safe)
  }, [])
  // LOT 4E.1 — Échelle UI globale
  const setUiScale     = useCallback(async (v) => {
    const safe = typeof v === 'number' && v > 0 ? v : 1
    setUiScaleState(safe)
    await setKV('uiScale', safe)
  }, [])
  // LOT 4E.2 — Échelle mise en page desktop
  const setLayoutScale  = useCallback(async (v) => {
    const safe = typeof v === 'number' && v > 0 ? v : 1
    setLayoutScaleState(safe)
    await setKV('layoutScale', safe)
  }, [])
  const setSidebarWidth = useCallback(async (v) => {
    const safe = typeof v === 'number' && v >= 160 ? v : 220
    setSidebarWidthState(safe)
    await setKV('sidebarWidth', safe)
  }, [])
  // LOT 4E.2 bis — Largeur du panneau Léa (desktop uniquement)
  const setCoachWidth = useCallback(async (v) => {
    const safe = typeof v === 'number' && v >= 220 ? v : 270
    setCoachWidthState(safe)
    await setKV('coachWidth', safe)
  }, [])
  // LOT 4F.2.6 — Timestamp de la dernière sauvegarde Drive réussie
  const setLastDriveSyncedAt = useCallback(async (v) => {
    const safe = typeof v === 'number' && v > 0 ? v : null
    setLastDriveSyncedAtState(safe)
    await setKV('lastDriveSyncedAt', safe)
  }, [])

  // ── Ambiance sonore ──────────────────────────────────────────
  const setAmbientSound  = useCallback(async (v) => { setAmbientSoundState(v);  await setKV('ambientSound',  v) }, [])
  const setAmbientVolume = useCallback(async (v) => { setAmbientVolumeState(v); await setKV('ambientVolume', v) }, [])
  const markFirstLaunchSeen = useCallback(async () => {
    setFirstLaunchState(false)
    await setKV('firstLaunchSeen', true)
  }, [])

  const setMood = useCallback(async (v) => {
    setMoodTodayState(v)
    await setKV('moodValue', v)
    await setKV('moodToday', new Date().toDateString())
  }, [])

  // ─── Token de synchronisation ────────────────────────────────
  const setSyncToken = useCallback(async (v) => {
    setSyncTokenState(v)
    await setKV('syncToken', v)
  }, [])

  // ─── Sync inter-appareils (last-write-wins) ──────────────────
  const syncNow = useCallback(async () => {
    const token = await getKV('syncToken', '')
    if (!token) { setSyncMessage('Configure un token dans Réglages'); setSyncStatus('error'); return }

    setSyncStatus('syncing'); setSyncMessage('')
    try {
      // 1. Construire snapshot local
      const kvData = {
        name:              await getKV('name',             ''),
        leaVoice:          await getKV('leaVoice',         'nova'),
        streak:            await getKV('streak',           0),
        sessions:          await getKV('sessions',         0),
        lastSession:       await getKV('lastSession',      ''),
        moodToday:         await getKV('moodToday',        ''),
        moodValue:         await getKV('moodValue',        ''),
        caroline_profile:  await getKV('caroline_profile', null),
        lea_memory:        await getKV('lea_memory',       null),
        lastSyncedAt:      await getKV('lastSyncedAt',     null),
      }
      const [chapters, vrac, chat] = await Promise.all([
        getChapters(),
        getVrac(),
        getChatHistoryRecent(500),  // ← Inclut désormais l'historique de conversation
      ])
      // Annoter le snapshot avec chat (extension v3 du schema)
      const local = { ...buildSnapshot({ chapters, vrac, kvData }), chat }

      // 2. Tirer le snapshot distant
      const remote = await pullSnapshot({ token })

      // 3. Comparer les timestamps
      const winner = whoWins(local.syncedAt, remote.syncedAt)

      if (winner === 'remote' && !remote.empty) {
        // Le distant est plus récent → valider et importer
        const ok = await importSnapshot(remote)
        if (!ok) {
          setSyncStatus('error')
          setSyncMessage('Snapshot distant corrompu — import annulé, données locales préservées')
          return
        }
        // Rafraîchir l'état React depuis IndexedDB
        const [chs, v, ch] = await Promise.all([getChapters(), getVrac(), getChatHistoryRecent(200)])
        setChapters(chs)
        if (chs.length > 0) setCurrentId(chs[0].id)
        setVracIdeas(v)
        setChatHistory(ch)
        setLastSyncedAt(remote.syncedAt)
        setSyncStatus('ok'); setSyncMessage(`Données mises à jour depuis le cloud ✓`)
      } else if (winner === 'local' || remote.empty) {
        // Le local est plus récent → pousser
        await pushSnapshot({ token, snapshot: local })
        await setKV('lastSyncedAt', local.syncedAt)
        setLastSyncedAt(local.syncedAt)
        setSyncStatus('ok'); setSyncMessage(`Sauvegardé dans le cloud ✓`)
      } else {
        setSyncStatus('ok'); setSyncMessage(`Déjà synchronisé ✓`)
      }
    } catch (err) {
      setSyncStatus('error')
      setSyncMessage(err.message || 'Erreur de synchronisation')
    }
  }, [])

  // ─── Profil Caroline (onboarding) ────────────────────────────
  const setCarolineProfile = useCallback(async (profile) => {
    setProfileState(profile)
    await setKV('caroline_profile', profile)
  }, [])

  // ─── Mémoire Léa ─────────────────────────────────────────────
  // Accepte soit un objet de patch ({ key: value, ... }),
  // soit une fonction updater (prev) => patchObject — utile pour des updates
  // dépendants de l'état précédent (ex. push dans keyPoints sans race).
  const updateLeaMemory = useCallback(async (fieldsOrFn) => {
    setLeaMemoryState(prev => {
      const patch = typeof fieldsOrFn === 'function' ? fieldsOrFn(prev) : fieldsOrFn
      if (!patch || typeof patch !== 'object') return prev
      const next = { ...(prev || {}), ...patch, lastUpdated: new Date().toISOString() }
      setKV('lea_memory', next)
      return next
    })
  }, [])

  // LOT 4C.3 — Reset complet de la mémoire de Léa.
  // updateLeaMemory ignore les valeurs null (garde-fou anti corruption),
  // donc on a besoin d'une fonction dédiée pour le reset utilisateur.
  const resetLeaMemory = useCallback(async () => {
    setLeaMemoryState(null)
    await setKV('lea_memory', null)
  }, [])

  // ─── Streak / sessions ───────────────────────────────────────
  // Lock anti-race : si recordSession est appelé plusieurs fois en parallèle
  // (par ex. via useAutoSave → updateChapter → recordSession), un seul exécute.
  const recordSession = useCallback(async () => {
    if (recordSessionLockRef.current) return
    const today = new Date().toDateString()
    if (lastSessionRef.current === today) return
    recordSessionLockRef.current = true
    try {
      const yesterday = new Date(Date.now() - 86400000).toDateString()
      const newStreak   = (lastSessionRef.current === yesterday) ? streak + 1 : 1
      const newSessions = sessions + 1
      lastSessionRef.current = today
      setStreakState(newStreak); setSessionsState(newSessions); setLastSession(today)
      await Promise.all([
        setKV('streak',      newStreak),
        setKV('sessions',    newSessions),
        setKV('lastSession', today),
      ])
    } finally {
      recordSessionLockRef.current = false
    }
  }, [streak, sessions])

  // ─── Chapitres ────────────────────────────────────────────────
  // Callbacks stables — lisent chaptersRef/currentIdRef pour éviter
  // de se recréer à chaque update de chapters/currentId.
  const createChapter = useCallback(async () => {
    const id  = `ch_${Date.now()}`
    const ch  = {
      id, title: 'Nouveau chapitre', content: '', order: chaptersRef.current.length,
      intention: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    await saveChapter(ch)
    setChapters(prev => [...prev, ch])
    setCurrentId(id)
    return id
  }, [])

  const updateChapter = useCallback(async (id, fields) => {
    setChapters(prev => prev.map(c => c.id === id ? { ...c, ...fields } : c))
    const ch = chaptersRef.current.find(c => c.id === id)
    if (ch) await saveChapter({ ...ch, ...fields })
  }, [])

  const removeChapter = useCallback(async (id) => {
    await deleteChapter(id)
    setChapters(prev => {
      const next = prev.filter(c => c.id !== id)
      if (currentIdRef.current === id) setCurrentId(next[0]?.id ?? null)
      return next
    })
  }, [])

  /**
   * Restaure un chapitre supprimé — utilisé par le toast undo dans App.jsx.
   * Réinsère le chapitre dans IndexedDB + state React + le sélectionne comme courant.
   */
  const restoreChapter = useCallback(async (chapter) => {
    if (!chapter?.id) return false
    const ok = await dbRestoreChapter(chapter)
    if (!ok) return false
    setChapters(prev => {
      // Ne pas dupliquer si déjà présent (race avec un autre flow)
      if (prev.some(c => c.id === chapter.id)) return prev
      return [...prev, chapter].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    })
    setCurrentId(chapter.id)
    return true
  }, [])

  const reorderChapters = useCallback(async (newOrder) => {
    const reordered = newOrder.map((ch, i) => ({ ...ch, order: i }))
    setChapters(reordered)
    await Promise.all(reordered.map(saveChapter))
  }, [])

  // ─── Chat ─────────────────────────────────────────────────────
  // Borne le state React à 200 derniers messages (la DB IndexedDB conserve tout).
  // Évite la croissance unbounded de la RAM sur sessions longues.
  const CHAT_RAM_CAP = 200
  const addMessage = useCallback(async (msg) => {
    // LOT 4C.2 — capture l'id auto-incrémenté retourné par IndexedDB
    // pour permettre la suppression unitaire des messages ajoutés en session.
    const id = await addChatMessage(msg)
    setChatHistory(prev => {
      const next = [...prev, { ...msg, id }]
      return next.length > CHAT_RAM_CAP ? next.slice(-CHAT_RAM_CAP) : next
    })
    return id
  }, [])

  const clearChat = useCallback(async () => {
    await clearChatHistory()
    setChatHistory([])
  }, [])

  // LOT 4C.2 — Suppression unitaire d'un message du chat (DB + state miroir)
  const removeMessage = useCallback(async (id) => {
    if (id == null) return
    await deleteChatMessage(id)
    setChatHistory(prev => prev.filter(m => m.id !== id))
  }, [])

  // ─── Vrac — boîte à idées ────────────────────────────────────
  const addVracIdea = useCallback(async (idea) => {
    const item = await addVrac(idea)
    setVracIdeas(prev => [item, ...prev])
    return item
  }, [])

  const markVracUsed = useCallback(async (id) => {
    await updateVrac(id, { used: true })
    setVracIdeas(prev => prev.map(v => v.id === id ? { ...v, used: true } : v))
  }, [])

  const removeVracIdea = useCallback(async (id) => {
    await deleteVrac(id)
    setVracIdeas(prev => prev.filter(v => v.id !== id))
  }, [])

  // ─── Dérivés ──────────────────────────────────────────────────
  const currentChapter = chapters.find(c => c.id === currentId) ?? null
  const isSetup        = name.trim().length > 0
  const totalWords     = chapters.reduce(
    (acc, c) => acc + (c.content?.split(/\s+/).filter(Boolean).length ?? 0), 0
  )
  const unusedVrac = vracIdeas.filter(v => !v.used)

  return {
    ready, isSetup,
    name,    setName,
    apiKey,  setApiKey,
    openAiKey, setOaiKey,
    leaVoice, setVoice,
    streak, sessions, recordSession,
    moodToday, setMood,
    chapters, currentId, setCurrentId,
    currentChapter, totalWords,
    createChapter, updateChapter, removeChapter, restoreChapter, reorderChapters,
    chatHistory, addMessage, clearChat, removeMessage,
    carolineProfile, setCarolineProfile,
    leaMemory, updateLeaMemory, resetLeaMemory,
    vracIdeas, unusedVrac, addVracIdea, markVracUsed, removeVracIdea,
    syncToken, setSyncToken, syncStatus, syncMessage, lastSyncedAt, syncNow,
    editorFont, setEditorFont, editorTheme, setEditorTheme, editorWidth, setEditorWidth,
    chatScale, setChatScale,
    uiScale, setUiScale,
    layoutScale, setLayoutScale,
    sidebarWidth, setSidebarWidth,
    coachWidth, setCoachWidth,
    lastDriveSyncedAt, setLastDriveSyncedAt,
    firstLaunch, markFirstLaunchSeen,
    ambientSound, setAmbientSound, ambientVolume, setAmbientVolume,
    storageWarning, dismissStorageWarning: () => setStorageWarning(null),
    exportAllData, resetAllData, importSnapshot,
  }
}
