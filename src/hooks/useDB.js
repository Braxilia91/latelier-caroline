import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getKV, setKV,
  getChapters, saveChapter, deleteChapter, restoreChapter as dbRestoreChapter,
  getChatHistoryRecent, addChatMessage, clearChatHistory, deleteChatMessage,
  getVrac, addVrac, updateVrac, deleteVrac,
  exportAllData, resetAllData, importSnapshot, getStorageEstimate,
  buildLocalBackup,
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
  const chaptersRef = useRef([])
  const [currentId,      setCurrentId]      = useState(null)
  const currentIdRef = useRef(null)
  const [chatHistory,    setChatHistory]    = useState([])
  const [carolineProfile, setProfileState] = useState(null)
  const [leaMemory,      setLeaMemoryState] = useState(null)
  const [syncToken,      setSyncTokenState] = useState('')
  const [syncStatus,     setSyncStatus]     = useState('idle')
  const [syncMessage,    setSyncMessage]    = useState('')
  const [lastSyncedAt,   setLastSyncedAt]   = useState(null)
  const [vracIdeas,      setVracIdeas]      = useState([])
  const [editorFont,     setEditorFontState]  = useState('m')
  const [editorTheme,    setEditorThemeState] = useState('jour')
  const [editorWidth,    setEditorWidthState] = useState('confort')
  const [firstLaunch,    setFirstLaunchState] = useState(false)
  const [chatScale,      setChatScaleState]   = useState(1)
  const [ambientSound,   setAmbientSoundState]  = useState(null)
  const [ambientVolume,  setAmbientVolumeState] = useState(0.28)
  const [storageWarning, setStorageWarning] = useState(null)
  const recordSessionLockRef = useRef(false)
  const lastSessionRef = useRef('')

  useEffect(() => {
    ;(async () => {
      let storagePersisted = false
      if (navigator.storage?.persist) {
        try {
          storagePersisted = await navigator.storage.persist()
        } catch { /* silencieux si refusé */ }
      }
      if (!storagePersisted) {
        console.info('[Storage] Mode non-persistant. Le navigateur peut évincer les données en cas de pression mémoire.')
      }

      const [n, k, oai, lv, st, sess, last, mood, chs, chat, prof, mem, vrac, stok, lsa, ef, et, ew, fls, snd, vol, cs] = await Promise.all([
        getKV('name',             ''),
        getKV('apiKey',           ''),
        getKV('openAiKey',        ''),
        getKV('leaVoice',         'nova'),
        getKV('streak',           0),
        getKV('sessions',         0),
        getKV('lastSession',      ''),
        getKV('moodToday',        ''),
        getChapters(),
        getChatHistoryRecent(200),
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
        getKV('chatScale',        1),
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
      setFirstLaunchState(!fls)
      setAmbientSoundState(snd)
      setAmbientVolumeState(vol)
      setChatScaleState(typeof cs === 'number' && cs > 0 ? cs : 1)
      setReady(true)

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

  useEffect(() => { chaptersRef.current  = chapters  }, [chapters])
  useEffect(() => { currentIdRef.current = currentId }, [currentId])
  useEffect(() => { lastSessionRef.current = lastSession }, [lastSession])

  const setName   = useCallback(async (v) => { setNameState(v);   await setKV('name',      v) }, [])
  const setApiKey = useCallback(async (v) => { setApiKeyState(v); await setKV('apiKey',     v) }, [])
  const setOaiKey = useCallback(async (v) => { setOAIKey(v);      await setKV('openAiKey',  v) }, [])
  const setVoice  = useCallback(async (v) => { setLeaVoice(v);    await setKV('leaVoice',   v) }, [])

  const setEditorFont  = useCallback(async (v) => { setEditorFontState(v);  await setKV('editorFont',  v) }, [])
  const setEditorTheme = useCallback(async (v) => { setEditorThemeState(v); await setKV('editorTheme', v) }, [])
  const setEditorWidth = useCallback(async (v) => { setEditorWidthState(v); await setKV('editorWidth', v) }, [])
  const setChatScale   = useCallback(async (v) => {
    const safe = typeof v === 'number' && v > 0 ? v : 1
    setChatScaleState(safe)
    await setKV('chatScale', safe)
  }, [])

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

  const setSyncToken = useCallback(async (v) => {
    setSyncTokenState(v)
    await setKV('syncToken', v)
  }, [])

  const syncNow = useCallback(async () => {
    const token = await getKV('syncToken', '')
    if (!token) { setSyncMessage('Configure un token dans Réglages'); setSyncStatus('error'); return }

    setSyncStatus('syncing'); setSyncMessage('')
    try {
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
        getChatHistoryRecent(500),
      ])
      const local = { ...buildSnapshot({ chapters, vrac, kvData }), chat }

      const remote = await pullSnapshot({ token })

      const winner = whoWins(local.syncedAt, remote.syncedAt)

      if (winner === 'remote' && !remote.empty) {
        const ok = await importSnapshot(remote)
        if (!ok) {
          setSyncStatus('error')
          setSyncMessage('Snapshot distant corrompu — import annulé, données locales préservées')
          return
        }
        const [chs, v, ch] = await Promise.all([getChapters(), getVrac(), getChatHistoryRecent(200)])
        setChapters(chs)
        if (chs.length > 0) setCurrentId(chs[0].id)
        setVracIdeas(v)
        setChatHistory(ch)
        setLastSyncedAt(remote.syncedAt)
        setSyncStatus('ok'); setSyncMessage(`Données mises à jour depuis le cloud ✓`)
      } else if (winner === 'local' || remote.empty) {
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

  const setCarolineProfile = useCallback(async (profile) => {
    setProfileState(profile)
    await setKV('caroline_profile', profile)
  }, [])

  const updateLeaMemory = useCallback(async (fieldsOrFn) => {
    setLeaMemoryState(prev => {
      const patch = typeof fieldsOrFn === 'function' ? fieldsOrFn(prev) : fieldsOrFn
      if (!patch || typeof patch !== 'object') return prev
      const next = { ...(prev || {}), ...patch, lastUpdated: new Date().toISOString() }
      setKV('lea_memory', next)
      return next
    })
  }, [])

  const resetLeaMemory = useCallback(async () => {
    setLeaMemoryState(null)
    await setKV('lea_memory', null)
  }, [])

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

  const restoreChapter = useCallback(async (chapter) => {
    if (!chapter?.id) return false
    const ok = await dbRestoreChapter(chapter)
    if (!ok) return false
    setChapters(prev => {
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

  const CHAT_RAM_CAP = 200
  const addMessage = useCallback(async (msg) => {
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

  const removeMessage = useCallback(async (id) => {
    if (id == null) return
    await deleteChatMessage(id)
    setChatHistory(prev => prev.filter(m => m.id !== id))
  }, [])

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

  // LOT 4F.1 — Import d'une sauvegarde depuis fichier JSON
  const importFromFile = useCallback(async (file) => {
    if (!file) return { ok: false, message: 'Aucun fichier sélectionné' }
    try {
      const text = await file.text()
      let parsed
      try { parsed = JSON.parse(text) }
      catch { return { ok: false, message: 'Fichier JSON invalide' } }

      const ok = await importSnapshot(parsed)
      if (!ok) return { ok: false, message: 'Format de sauvegarde non reconnu ou corrompu' }

      const [chs, v, ch, prof, mem, lsa] = await Promise.all([
        getChapters(),
        getVrac(),
        getChatHistoryRecent(200),
        getKV('caroline_profile', null),
        getKV('lea_memory',       null),
        getKV('lastSyncedAt',     null),
      ])
      setChapters(chs)
      if (chs.length > 0) setCurrentId(chs[0].id)
      setVracIdeas(v)
      setChatHistory(ch)
      setProfileState(prof)
      setLeaMemoryState(mem)
      setLastSyncedAt(lsa)

      return { ok: true, message: 'Sauvegarde importée avec succès' }
    } catch (err) {
      return { ok: false, message: err.message || 'Erreur lors de l\'import' }
    }
  }, [])

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
    firstLaunch, markFirstLaunchSeen,
    ambientSound, setAmbientSound, ambientVolume, setAmbientVolume,
    storageWarning, dismissStorageWarning: () => setStorageWarning(null),
    exportAllData, resetAllData, importSnapshot,
    importFromFile, buildLocalBackup,
  }
}
