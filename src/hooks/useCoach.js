import { useState, useCallback, useRef, useMemo } from 'react'
import { askClaude, speakWithOpenAI } from '../lib/claude'
import {
  buildSystemPrompt, buildCorrectionPrompt,
  buildVocabPrompt, buildThreadPrompt,
  buildDoubtPrompt, buildVracInjectPrompt,
  buildDiscoveryPrompt, buildSynonymPrompt,
  buildWordSearchPrompt, buildAkinatorSoftPrompt,
  buildPredictivePrompt,
} from '../lib/prompts'

export function useCoach({ apiKey, openAiKey, name, moodToday, currentChapter, leaVoice, addMessage, chatHistory, carolineProfile, leaMemory, updateLeaMemory }) {
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState('')
  const [voiceOn, setVoiceOn] = useState(false)
  const [ttsState, setTtsState] = useState({
    playing: false,
    paused: false,
    speed: 1.0,
    mode: null,  // 'openai' | 'browser' | null
  })
  const audioRef = useRef(null)
  const utteranceRef = useRef(null)

  const systemPrompt = useMemo(() => buildSystemPrompt({
    name,
    mood: moodToday,
    currentChapter,
    intention: currentChapter?.intention,
    profile: carolineProfile,
    leaMemory,
  }), [name, moodToday, currentChapter, carolineProfile, leaMemory])

  // ─── Player TTS controls — pilote OpenAI HTMLAudio ET browser speechSynthesis ─
  const ttsPlay = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play()
    } else if (window.speechSynthesis?.paused) {
      window.speechSynthesis.resume()
      setTtsState(s => ({ ...s, playing: true, paused: false }))
    }
  }, [])

  const ttsPause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
    } else if (window.speechSynthesis?.speaking) {
      window.speechSynthesis.pause()
      setTtsState(s => ({ ...s, paused: true, playing: false }))
    }
  }, [])

  const ttsStop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    utteranceRef.current = null
    setTtsState(s => ({ ...s, playing: false, paused: false, mode: null }))
  }, [])

  const ttsSetSpeed = useCallback((s) => {
    const speed = Math.max(0.5, Math.min(2.0, s))
    setTtsState(prev => ({ ...prev, speed }))
    // Live-applicable seulement pour HTMLAudio
    if (audioRef.current) audioRef.current.playbackRate = speed
    // speechSynthesis.rate ne change pas mid-speech (limitation API)
    // Sera utilisé pour la prochaine utterance
  }, [])

  const speakBrowser = useCallback((text, speed = 1.0) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text.slice(0, 500))
    utt.lang = 'fr-FR'
    utt.rate = Math.max(0.5, Math.min(2.0, speed * 0.92))
    utt.onstart = () => setTtsState(s => ({ ...s, playing: true, paused: false, mode: 'browser' }))
    utt.onpause = () => setTtsState(s => ({ ...s, paused: true, playing: false }))
    utt.onresume = () => setTtsState(s => ({ ...s, paused: false, playing: true }))
    utt.onend = () => setTtsState(s => ({ ...s, playing: false, paused: false, mode: null }))
    utt.onerror = () => setTtsState(s => ({ ...s, playing: false, paused: false, mode: null }))
    utteranceRef.current = utt
    window.speechSynthesis.speak(utt)
  }, [])

  // ─── Envoyer un message à Léa ──────────────────────────
  const sendMessage = useCallback(async (userText, { type = 'chat', extraSystem } = {}) => {
    if (!apiKey) return null
    setLoading(true); setStreaming('')
    const userMsg = { role: 'user', content: userText }
    addMessage({ role: 'user', content: userText })
    const history = [...chatHistory.slice(-20), userMsg].map(m => ({
      role: m.role,
      content: m.content,
    }))
    let full = ''
    try {
      full = await askClaude({
        apiKey,
        systemPrompt: extraSystem || systemPrompt,
        messages: history,
        maxTokens: 600,
        onChunk: (text) => setStreaming(text),
      })
      addMessage({ role: 'assistant', content: full })
      if (updateLeaMemory && full && type === 'chat') {
        updateLeaMemory({
          lastSession: new Date().toISOString(),
          lastChapter: currentChapter?.title || null,
        })
      }
      if (voiceOn && full) {
        // Stop tout précédent (les 2 pipelines)
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current = null
        }
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel()
        }
        if (openAiKey) {
          try {
            const audio = await speakWithOpenAI({
              openAiKey,
              text: full,
              voice: leaVoice,
              speed: ttsState.speed,
            })
            audio.onplay = () => setTtsState(s => ({ ...s, playing: true, paused: false, mode: 'openai' }))
            audio.onpause = () => setTtsState(s => ({ ...s, paused: !audio.ended, playing: false }))
            audio.onended = () => setTtsState(s => ({ ...s, playing: false, paused: false, mode: null }))
            audioRef.current = audio
          } catch (_) {
            speakBrowser(full, ttsState.speed)
          }
        } else {
          speakBrowser(full, ttsState.speed)
        }
      }
    } catch (err) {
      addMessage({ role: 'assistant', content: mapCoachError(err) })
    } finally {
      setLoading(false); setStreaming('')
    }
    return full
  }, [apiKey, openAiKey, systemPrompt, chatHistory, voiceOn, leaVoice, addMessage, updateLeaMemory, currentChapter, ttsState.speed, speakBrowser])

  const correctText = useCallback(async (text) => sendMessage(buildCorrectionPrompt(text), { type: 'correction' }), [sendMessage])
  const defineWord = useCallback(async (word) => sendMessage(buildVocabPrompt(word), { type: 'vocab' }), [sendMessage])
  const findThread = useCallback(async (chapterText) => sendMessage(buildThreadPrompt(chapterText), { type: 'thread' }), [sendMessage])
  const expressDoubt = useCallback(async (text) => sendMessage(buildDoubtPrompt(text), { type: 'doubt' }), [sendMessage])
  const injectVrac = useCallback(async (idea) => sendMessage(
    buildVracInjectPrompt({ idea, chapterTitle: currentChapter?.title }),
    { type: 'vrac' }
  ), [sendMessage, currentChapter])
  const getDiscovery = useCallback(async () => {
    const recentText = currentChapter?.content || ''
    return sendMessage(buildDiscoveryPrompt(recentText), { type: 'discovery' })
  }, [sendMessage, currentChapter])
  const getSynonyms = useCallback(async ({ word, sentence, level }) => {
    if (!word?.trim()) return null
    return sendMessage(
      buildSynonymPrompt({ word: word.trim(), sentence: sentence?.trim() || '', level: level || 'mixte' }),
      { type: 'synonyms' }
    )
  }, [sendMessage])
  const searchWord = useCallback(async (description) => {
    if (!description?.trim()) return null
    return sendMessage(buildWordSearchPrompt(description.trim()), { type: 'wordSearch' })
  }, [sendMessage])
  const startAkinator = useCallback(async () => sendMessage(
    "Je cherche un mot précis mais je n'arrive pas à le formuler. Aide-moi à le trouver en me posant des questions une à une — sur l'émotion, la sensation, le contexte ou la nuance que je veux exprimer. Commence par ta première question.",
    { type: 'akinator' }
  ), [sendMessage])
  const startAkinatorSoft = useCallback(async (answers) => sendMessage(buildAkinatorSoftPrompt(answers), { type: 'akinatorSoft' }), [sendMessage])
  const getPredictiveWords = useCallback(async () => {
    const content = currentChapter?.content || ''
    if (!content.trim()) return null
    return sendMessage(buildPredictivePrompt(content), { type: 'predictive' })
  }, [sendMessage, currentChapter])

  const toggleVoice = useCallback(() => {
    if (voiceOn) ttsStop()
    setVoiceOn(v => !v)
  }, [voiceOn, ttsStop])

  return {
    loading, streaming, voiceOn, toggleVoice, sendMessage,
    correctText, defineWord, findThread, expressDoubt, injectVrac,
    getDiscovery, getSynonyms, searchWord,
    startAkinator, startAkinatorSoft, getPredictiveWords,
    ttsState, ttsPlay, ttsPause, ttsStop, ttsSetSpeed,
  }
}

function mapCoachError(err) {
  const msg = (err?.message || '').toLowerCase()
  if (!navigator.onLine || msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed')) {
    return "Léa est hors ligne — tu peux continuer à écrire, elle reviendra bientôt 🌿"
  }
  if (msg.includes('401') || msg.includes('invalid') || msg.includes('authentication') || msg.includes('unauthorized') || msg.includes('x-api-key') || msg.includes('mot de passe')) {
    return "Le mot de passe Léa semble incorrect — vérifie tes réglages ⚙️"
  }
  if (msg.includes('429') || msg.includes('rate_limit') || msg.includes('quota') || msg.includes('too many')) {
    return "Léa a besoin d'un petit souffle — réessaie dans quelques instants ⏳"
  }
  if (msg.includes('500') || msg.includes('overloaded') || msg.includes('503') || msg.includes('service unavailable')) {
    return "Le service est momentanément surchargé — réessaie dans un moment 🌿"
  }
  return "Léa n'a pas pu répondre — tu peux continuer à écrire, on réessaiera 🌿"
}
