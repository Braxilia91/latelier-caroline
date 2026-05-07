import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getKV, setKV,
  getChapters, saveChapter, deleteChapter,
  getChatHistoryRecent, addChatMessage, clearChatHistory,
  getVrac, addVrac, updateVrac, deleteVrac,
  exportAllData, resetAllData, importSnapshot,
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
  const [editorFont,     setEditorFontState]  = useState('m')       // s | m | l
  const [editorTheme,    setEditorThemeState] = useState('jour')     // jour | soir | bougie
  const [editorWidth,    setEditorWidthState] = useState('confort')  // confort | full
  const [firstLaunch,    setFirstLaunchState] = useState(false)      // true = scène pack opening à afficher

  // ─── Chargement initial ──────────────────────────────────────
  useEffect(() => {
    // Demander au navigateur de ne pas évincer le stockage de l'app
    if (navigator.storage?.persist) {
      navigator.storage.persist().catch(() => {/* silencieux si refusé */})
    }
    ;(async () => {
      const [n, k, oai, lv, st, sess, last, mood, chs, chat, prof, mem, vrac, stok, lsa, ef, et, ew, fls] = await Promise.all([
        getKV('name',             ''),
        getKV('apiKey',           ''),
        getKV('openAiKey',        ''),
        getKV('leaVoice',         'nova'),
        getKV('streak',           0),
        getKV('sessions',         0),
        getKV('lastSession',      ''),
        getKV('moodToday',        ''),
        getChapters(),
        getChatHistoryRecent(50),   // ← 50 derniers seulement (perf)
        getKV('caroline_profile', null),
        getKV('lea_memory',       null),
        getVrac(),
        getKV('syncToken',        ''),
        getKV('lastSyncedAt',     null),
        getKV('editorFont',       'm'),
        getKV('editorTheme',      'jour'),
        getKV('editorWidth',      'confort'),
        getKV('firstLaunchSeen',  false),
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
      setReady(true)
    })()
  }, [])

  // ─── Sync refs (pour callbacks stables sans dépendances instables) ──
  useEffect(() => { chaptersRef.current  = chapters  }, [chapters])
  useEffect(() => { currentIdRef.current = currentId }, [currentId])

  // ─── Helpers persist ─────────────────────────────────────────
  const setName   = useCallback(async (v) => { setNameState(v);   await setKV('name',      v) }, [])
  const setApiKey = useCallback(async (v) => { setApiKeyState(v); await setKV('apiKey',     v) }, [])
  const setOaiKey = useCallback(async (v) => { setOAIKey(v);      await setKV('openAiKey',  v) }, [])
  const setVoice  = useCallback(async (v) => { setLeaVoice(v);    await setKV('leaVoice',   v) }, [])

  // ── Préférences d'affichage ──────────────────────────────────
  const setEditorFont  = useCallback(async (v) => { setEditorFontState(v);  await setKV('editorFont',  v) }, [])
  const setEditorTheme = useCallback(async (v) => { setEditorThemeState(v); await setKV('editorTheme', v) }, [])
  const setEditorWidth = useCallback(async (v) => { setEditorWidthState(v); await setKV('editorWidth', v) }, [])
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
      const [chapters, vrac] = await Promise.all([getChapters(), getVrac()])
      const local = buildSnapshot({ chapters, vrac, kvData })

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
        const [chs, v] = await Promise.all([getChapters(), getVrac()])
        setChapters(chs)
        if (chs.length > 0) setCurrentId(chs[0].id)
        setVracIdeas(v)
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
  const updateLeaMemory = useCallback(async (fields) => {
    setLeaMemoryState(prev => {
      const next = { ...(prev || {}), ...fields, lastUpdated: new Date().toISOString() }
      setKV('lea_memory', next)
      return next
    })
  }, [])

  // ─── Streak / sessions ───────────────────────────────────────
  const recordSession = useCallback(async () => {
    const today = new Date().toDateString()
    if (lastSession === today) return
    const newStreak   = (lastSession === new Date(Date.now() - 86400000).toDateString()) ? streak + 1 : 1
    const newSessions = sessions + 1
    setStreakState(newStreak); setSessionsState(newSessions); setLastSession(today)
    await Promise.all([
      setKV('streak',      newStreak),
      setKV('sessions',    newSessions),
      setKV('lastSession', today),
    ])
  }, [lastSession, streak, sessions])

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

  const reorderChapters = useCallback(async (newOrder) => {
    const reordered = newOrder.map((ch, i) => ({ ...ch, order: i }))
    setChapters(reordered)
    await Promise.all(reordered.map(saveChapter))
  }, [])

  // ─── Chat ─────────────────────────────────────────────────────
  const addMessage = useCallback(async (msg) => {
    await addChatMessage(msg)
    setChatHistory(prev => [...prev, msg])
  }, [])

  const clearChat = useCallback(async () => {
    await clearChatHistory()
    setChatHistory([])
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
    createChapter, updateChapter, removeChapter, reorderChapters,
    chatHistory, addMessage, clearChat,
    carolineProfile, setCarolineProfile,
    leaMemory, updateLeaMemory,
    vracIdeas, unusedVrac, addVracIdea, markVracUsed, removeVracIdea,
    syncToken, setSyncToken, syncStatus, syncMessage, lastSyncedAt, syncNow,
    editorFont, setEditorFont, editorTheme, setEditorTheme, editorWidth, setEditorWidth,
    firstLaunch, markFirstLaunchSeen,
    exportAllData, resetAllData,
  }
}
