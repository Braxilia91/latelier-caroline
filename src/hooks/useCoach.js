import { useState, useCallback, useRef, useMemo } from 'react'
import { askClaude, speakWithOpenAI, cleanForTTS } from '../lib/claude'
import {
  buildSystemPrompt, buildCorrectionPrompt,
  buildVocabPrompt, buildThreadPrompt,
  buildDoubtPrompt, buildVracInjectPrompt,
  buildDiscoveryPrompt, buildSynonymPrompt,
  buildWordSearchPrompt, buildAkinatorSoftPrompt,
  buildPredictivePrompt, buildAkinatorTurnPrompt,
} from '../lib/prompts'

const AKINATOR_SYSTEM_PROMPT = `Tu joues à un jeu de devinette lexicale en français pour aider Caroline à trouver un mot. Tu poses des questions courtes et pertinentes, ou tu proposes des candidats finaux. Tu réponds UNIQUEMENT au format JSON demandé. Aucun markdown, aucun préambule, aucun texte hors du JSON.`

export function useCoach({ apiKey, openAiKey, name, moodToday, currentChapter, leaVoice, addMessage, chatHistory, carolineProfile, leaMemory, updateLeaMemory }) {
  const [loading,    setLoading]    = useState(false)
  const [streaming,  setStreaming]  = useState('')
  const [voiceOn,    setVoiceOn]    = useState(false)
  const [ttsState,   setTtsState]   = useState({ playing: false, paused: false, speed: 1.0, mode: null })

  const audioRef       = useRef(null)
  const browserUttRef  = useRef(null)
  const speedRef       = useRef(1.0)

  const systemPrompt = useMemo(() => buildSystemPrompt({
    name,
    mood: moodToday,
    currentChapter,
    intention: currentChapter?.intention,
    profile: carolineProfile,
    leaMemory,
  }), [name, moodToday, currentChapter, carolineProfile, leaMemory])

  // ── Helpers TTS ────────────────────────────────────────────
  const stopAllTts = useCallback(() => {
    if (audioRef.current) {
      try { audioRef.current.__ttsAbort?.abort() } catch (_) {}
      try { audioRef.current.pause() } catch (_) {}
      try { audioRef.current.currentTime = 0 } catch (_) {}
      audioRef.current = null
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel() } catch (_) {}
    }
    browserUttRef.current = null
    setTtsState(s => ({ playing: false, paused: false, speed: s.speed, mode: null }))
  }, [])

  const speakBrowserManaged = useCallback((text) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    try { window.speechSynthesis.cancel() } catch (_) {}
    const cleaned = cleanForTTS(text || '').slice(0, 500)
    if (!cleaned) return
    const utt = new SpeechSynthesisUtterance(cleaned)
    utt.lang = 'fr-FR'
    utt.rate = speedRef.current
    utt.onstart  = () => setTtsState({ playing: true,  paused: false, speed: speedRef.current, mode: 'browser' })
    utt.onpause  = () => setTtsState(s => ({ ...s, playing: false, paused: true }))
    utt.onresume = () => setTtsState(s => ({ ...s, playing: true,  paused: false }))
    utt.onend    = () => setTtsState({ playing: false, paused: false, speed: speedRef.current, mode: null })
    utt.onerror  = () => setTtsState({ playing: false, paused: false, speed: speedRef.current, mode: null })
    browserUttRef.current = utt
    setTtsState({ playing: true, paused: false, speed: speedRef.current, mode: 'browser' })
    try { window.speechSynthesis.speak(utt) } catch (_) {}
  }, [])

  const ttsPlay = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play().catch(() => {})
      setTtsState(s => ({ ...s, playing: true, paused: false }))
    } else if (typeof window !== 'undefined' && window.speechSynthesis?.paused) {
      try { window.speechSynthesis.resume() } catch (_) {}
      setTtsState(s => ({ ...s, playing: true, paused: false }))
    }
  }, [])

  const ttsPause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      try { audioRef.current.pause() } catch (_) {}
      setTtsState(s => ({ ...s, playing: false, paused: true }))
    } else if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) {
      try { window.speechSynthesis.pause() } catch (_) {}
      setTtsState(s => ({ ...s, playing: false, paused: true }))
    }
  }, [])

  const ttsStop = useCallback(() => stopAllTts(), [stopAllTts])

  const ttsSetSpeed = useCallback((s) => {
    const clamped = Math.max(0.5, Math.min(2.0, Number(s) || 1.0))
    speedRef.current = clamped
    if (audioRef.current) {
      try { audioRef.current.playbackRate = clamped } catch (_) {}
    }
    // Browser : utt.rate ne peut pas changer en live, sera appliqué au prochain message
    setTtsState(state => ({ ...state, speed: clamped }))
  }, [])

  // ── Envoyer un message à Léa ──────────────────────────────
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
        stopAllTts()
        if (openAiKey) {
          try {
            const audio = await speakWithOpenAI({
              openAiKey,
              text: full,
              voice: leaVoice,
              speed: speedRef.current,
            })
            audioRef.current = audio
            try { audio.playbackRate = speedRef.current } catch (_) {}

            // addEventListener + AbortController pour cleanup propre.
            // Plus robuste que onplay/onpause/onended directs : si une nouvelle
            // lecture démarre avant la fin de l'ancienne, le AbortController
            // précédent (stocké sur audio.__ttsAbort) annule les listeners orphelins.
            try { audio.__ttsAbort?.abort() } catch (_) {}
            const ac = new AbortController()
            audio.__ttsAbort = ac
            const opts = { signal: ac.signal }
            audio.addEventListener('play',  () => setTtsState({ playing: true,  paused: false, speed: speedRef.current, mode: 'openai' }), opts)
            audio.addEventListener('pause', () => setTtsState(s => ({ ...s, playing: false, paused: true })), opts)
            audio.addEventListener('ended', () => setTtsState({ playing: false, paused: false, speed: speedRef.current, mode: null }), opts)
            audio.addEventListener('error', () => setTtsState({ playing: false, paused: false, speed: speedRef.current, mode: null }), opts)

            // Set immédiat au cas où l'event 'play' soit déjà fired
            // (audio.play() est appelé dans speakWithOpenAI, donc avant qu'on attache ici).
            setTtsState({ playing: true, paused: false, speed: speedRef.current, mode: 'openai' })
          } catch (_) {
            speakBrowserManaged(full)
          }
        } else {
          speakBrowserManaged(full)
        }
      }
    } catch (err) {
      addMessage({ role: 'assistant', content: mapCoachError(err) })
    } finally {
      setLoading(false); setStreaming('')
    }
    return full
  }, [apiKey, openAiKey, systemPrompt, chatHistory, voiceOn, leaVoice, addMessage, updateLeaMemory, currentChapter, stopAllTts, speakBrowserManaged])

  const correctText = useCallback(async (text) => {
    return sendMessage(buildCorrectionPrompt(text), { type: 'correction' })
  }, [sendMessage])

  const defineWord = useCallback(async (word) => {
    return sendMessage(buildVocabPrompt(word), { type: 'vocab' })
  }, [sendMessage])

  const findThread = useCallback(async (chapterText) => {
    return sendMessage(buildThreadPrompt(chapterText), { type: 'thread' })
  }, [sendMessage])

  const expressDoubt = useCallback(async (text) => {
    return sendMessage(buildDoubtPrompt(text), { type: 'doubt' })
  }, [sendMessage])

  const injectVrac = useCallback(async (idea) => {
    return sendMessage(
      buildVracInjectPrompt({ idea, chapterTitle: currentChapter?.title }),
      { type: 'vrac' }
    )
  }, [sendMessage, currentChapter])

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

  const startAkinator = useCallback(async () => {
    return sendMessage(
      "Je cherche un mot précis mais je n'arrive pas à le formuler. Aide-moi à le trouver en me posant des questions une à une — sur l'émotion, la sensation, le contexte ou la nuance que je veux exprimer. Commence par ta première question.",
      { type: 'akinator' }
    )
  }, [sendMessage])

  // Legacy — conservé pour rollback. Plus appelé depuis l'UI à partir de Livraison 2.
  const startAkinatorSoft = useCallback(async (answers) => {
    return sendMessage(
      buildAkinatorSoftPrompt(answers),
      { type: 'akinatorSoft' }
    )
  }, [sendMessage])

  // Akinator pas-à-pas (Livraison 2) — court-circuite sendMessage : aucune injection dans le chat global.
  const askAkinatorTurn = useCallback(async (history) => {
    if (!apiKey) {
      return { type: 'error', message: 'Mot de passe Léa manquant — configure-le dans les réglages.' }
    }
    try {
      const raw = await askClaude({
        apiKey,
        systemPrompt: AKINATOR_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildAkinatorTurnPrompt({ history: history || [] }) }],
        maxTokens: 800,
      })
      return parseAkinatorResponse(raw)
    } catch (err) {
      return { type: 'error', message: mapCoachError(err) }
    }
  }, [apiKey])

  const getPredictiveWords = useCallback(async () => {
    const content = currentChapter?.content || ''
    if (!content.trim()) return null
    return sendMessage(buildPredictivePrompt(content), { type: 'predictive' })
  }, [sendMessage, currentChapter])

  const toggleVoice = useCallback(() => {
    if (voiceOn) {
      stopAllTts()
    }
    setVoiceOn(v => !v)
  }, [voiceOn, stopAllTts])

  return {
    loading, streaming, voiceOn, toggleVoice, sendMessage,
    correctText, defineWord, findThread, expressDoubt, injectVrac,
    getDiscovery, getSynonyms, searchWord,
    startAkinator, startAkinatorSoft, askAkinatorTurn, getPredictiveWords,
    ttsState, ttsPlay, ttsPause, ttsStop, ttsSetSpeed,
  }
}

// ─── Parser tolérant Akinator ─────────────────────────────────
function parseAkinatorResponse(raw) {
  if (!raw || typeof raw !== 'string') {
    return { type: 'error', message: "Léa n'a rien renvoyé — réessaie." }
  }

  let cleaned = raw.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()

  const tryParse = (txt) => {
    try {
      const obj = JSON.parse(txt)
      if (obj?.type === 'question' && typeof obj.question === 'string' && Array.isArray(obj.choices) && obj.choices.length > 0) {
        return {
          type: 'question',
          question: obj.question.trim(),
          choices: obj.choices.map(c => String(c).trim()).filter(Boolean).slice(0, 6),
        }
      }
      if (obj?.type === 'candidates' && Array.isArray(obj.candidates) && obj.candidates.length > 0) {
        return {
          type: 'candidates',
          candidates: obj.candidates
            .filter(c => c && typeof c.word === 'string')
            .map(c => ({
              word:      String(c.word).trim(),
              rationale: typeof c.rationale === 'string' ? c.rationale.trim() : '',
              example:   typeof c.example   === 'string' ? c.example.trim()   : '',
            }))
            .slice(0, 6),
        }
      }
    } catch (_) { /* fall through */ }
    return null
  }

  const direct = tryParse(cleaned)
  if (direct) return direct

  const match = cleaned.match(/\{[\s\S]*\}/)
  if (match) {
    const fallback = tryParse(match[0])
    if (fallback) return fallback
  }

  return { type: 'error', message: "Léa a répondu dans un format inattendu — réessaie." }
}

// ─── Humanisation des erreurs Léa ────────────────────────────
function mapCoachError(err) {
  const msg = (err?.message || '').toLowerCase()
  if (!navigator.onLine || msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed')) {
    return "Léa est hors ligne — tu peux continuer à écrire, elle reviendra bientôt 🌿"
  }
  if (msg.includes('401') || msg.includes('invalid') || msg.includes('authentication') || msg.includes('unauthorized') || msg.includes('x-api-key')) {
    return "La clé API semble incorrecte — vérifie tes réglages ⚙️"
  }
  if (msg.includes('429') || msg.includes('rate_limit') || msg.includes('quota') || msg.includes('too many')) {
    return "Léa a besoin d'un petit souffle — réessaie dans quelques instants ⏳"
  }
  if (msg.includes('500') || msg.includes('overloaded') || msg.includes('503') || msg.includes('service unavailable')) {
    return "Le service est momentanément surchargé — réessaie dans un moment 🌿"
  }
  return "Léa n'a pas pu répondre — tu peux continuer à écrire, on réessaiera 🌿"
}
