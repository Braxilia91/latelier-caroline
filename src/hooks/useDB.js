import { useState, useEffect, useCallback } from 'react'
import {
  getKV, setKV,
  getChapters, saveChapter, deleteChapter,
  getChatHistory, addChatMessage, clearChatHistory,
  exportAllData, resetAllData,
} from '../lib/db'

export function useAppState() {
  const [ready,       setReady]       = useState(false)
  const [name,        setNameState]   = useState('')
  const [password,      setPasswordState] = useState('')
  const [openAiKey,   setOAIKey]      = useState('')
  const [leaVoice,    setLeaVoice]    = useState('nova')
  const [streak,      setStreakState]  = useState(0)
  const [sessions,    setSessionsState]= useState(0)
  const [lastSession, setLastSession]  = useState('')
  const [moodToday,   setMoodTodayState]= useState('')
  const [chapters,    setChapters]    = useState([])
  const [currentId,   setCurrentId]   = useState(null)
  const [chatHistory, setChatHistory] = useState([])

  // ─── Load all from IndexedDB ─────────────────────────────────
  useEffect(() => {
    ;(async () => {
      const [n, k, oai, lv, st, sess, last, mood, chs, chat] = await Promise.all([
        getKV('name', ''),
        getKV('password', ''),
        getKV('openAiKey', ''),
        getKV('leaVoice', 'nova'),
        getKV('streak', 0),
        getKV('sessions', 0),
        getKV('lastSession', ''),
        getKV('moodToday', ''),
        getChapters(),
        getChatHistory(),
      ])
      setNameState(n); setPasswordState(k); setOAIKey(oai); setLeaVoice(lv)
      setStreakState(st); setSessionsState(sess); setLastSession(last)
      const today = new Date().toDateString()
      setMoodTodayState(mood === today ? await getKV('moodValue', '') : '')
      setChapters(chs)
      if (chs.length > 0) setCurrentId(chs[0].id)
      setChatHistory(chat)
      setReady(true)
    })()
  }, [])

  // ─── Persist helpers ─────────────────────────────────────────
  const setName    = useCallback(async (v) => { setNameState(v);   await setKV('name', v) }, [])
  const setPassword  = useCallback(async (v) => { setPasswordState(v); await setKV('password', v) }, [])
  const setOaiKey  = useCallback(async (v) => { setOAIKey(v);      await setKV('openAiKey', v) }, [])
  const setVoice   = useCallback(async (v) => { setLeaVoice(v);    await setKV('leaVoice', v) }, [])

  const setMood = useCallback(async (v) => {
    setMoodTodayState(v)
    await setKV('moodValue', v)
    await setKV('moodToday', new Date().toDateString())
  }, [])

  const recordSession = useCallback(async () => {
    const today = new Date().toDateString()
    if (lastSession === today) return
    const newStreak = (lastSession === new Date(Date.now() - 86400000).toDateString())
      ? streak + 1 : 1
    const newSessions = sessions + 1
    setStreakState(newStreak); setSessionsState(newSessions); setLastSession(today)
    await Promise.all([
      setKV('streak', newStreak),
      setKV('sessions', newSessions),
      setKV('lastSession', today),
    ])
  }, [lastSession, streak, sessions])

  // ─── Chapters ─────────────────────────────────────────────────
  const createChapter = useCallback(async () => {
    const id    = `ch_${Date.now()}`
    const order = chapters.length
    const ch    = { id, title: 'Nouveau chapitre', content: '', order, intention: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    await saveChapter(ch)
    setChapters(prev => [...prev, ch])
    setCurrentId(id)
    return id
  }, [chapters])

  const updateChapter = useCallback(async (id, fields) => {
    setChapters(prev => prev.map(c => c.id === id ? { ...c, ...fields } : c))
    const ch = chapters.find(c => c.id === id)
    if (ch) await saveChapter({ ...ch, ...fields })
  }, [chapters])

  const removeChapter = useCallback(async (id) => {
    await deleteChapter(id)
    setChapters(prev => {
      const next = prev.filter(c => c.id !== id)
      if (currentId === id) setCurrentId(next[0]?.id ?? null)
      return next
    })
  }, [currentId])

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

  // ─── Derived ──────────────────────────────────────────────────
  const currentChapter = chapters.find(c => c.id === currentId) ?? null
  const isSetup = !!(name)
  const totalWords = chapters.reduce((acc, c) => acc + (c.content?.split(/\s+/).filter(Boolean).length ?? 0), 0)

  return {
    ready, isSetup,
    name, setName,
    password, setPassword,
    openAiKey, setOaiKey,
    leaVoice, setVoice,
    streak, sessions, recordSession,
    moodToday, setMood,
    chapters, currentId, setCurrentId,
    currentChapter, totalWords,
    createChapter, updateChapter, removeChapter, reorderChapters,
    chatHistory, addMessage, clearChat,
    exportAllData, resetAllData,
  }
}
