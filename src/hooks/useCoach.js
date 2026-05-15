import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { askClaude, speakWithOpenAI, normalizeForNarrationFR } from '../lib/claude'
import {
  buildSystemPrompt, buildCorrectionPrompt,
  buildVocabPrompt, buildThreadPrompt,
  buildDoubtPrompt, buildVracInjectPrompt,
  buildDiscoveryPrompt, buildSynonymPrompt,
  buildWordSearchPrompt, buildAkinatorSoftPrompt,
  buildPredictivePrompt, buildAkinatorTurnPrompt,
  buildMemoryExtractPrompt,
} from '../lib/prompts'

const AKINATOR_SYSTEM_PROMPT = `Tu joues à un jeu de devinette lexicale en français pour aider Caroline à trouver un mot. Tu poses des questions courtes et pertinentes, ou tu proposes des candidats finaux. Tu réponds UNIQUEMENT au format JSON demandé. Aucun markdown, aucun préambule, aucun texte hors du JSON.`

const MEMORY_SYSTEM_PROMPT = `Tu es chargée d'extraire UN fait notable d'un échange entre Caroline et Léa, pour la mémoire long-terme de Léa. Tu réponds par 1 phrase courte (max 18 mots) qui résume un fait personnel concret, une émotion partagée, un souvenir évoqué, ou une décision narrative — PAS un compliment générique ni une métaphore. Si rien de notable, réponds exactement "RIEN".`

// LOT 2.3 — Segmentation des longs messages pour TTS.
// Bénéfices : mute plus réactif (max ~MAX_SEGMENT_CHARS), dépassement
// éventuel de la limite OpenAI 4096 chars, respiration naturelle entre
// segments. Anti-régression : si message tient dans 1 segment, on
// garde le path single-audio existant (commit 2.2).
const MAX_SEGMENT_CHARS = 500

function splitIntoSegments(text) {
  if (!text) return []
  const trimmed = String(text).trim()
  if (!trimmed) return []
  if (trimmed.length <= MAX_SEGMENT_CHARS) return [trimmed]

  const parts = trimmed.split(/(?<=[.!?…])\s+/).filter(Boolean)
  const segments = []
  let current = ''

  for (const part of parts) {
    if (part.length > MAX_SEGMENT_CHARS) {
      // Phrase démesurément longue : split brutal par mots
      if (current) { segments.push(current); current = '' }
      const words = part.split(/\s+/)
      let chunk = ''
      for (const w of words) {
        if (chunk.length + w.length + 1 <= MAX_SEGMENT_CHARS) {
          chunk = chunk ? `${chunk} ${w}` : w
        } else {
          if (chunk) segments.push(chunk)
          chunk = w
        }
      }
      if (chunk) segments.push(chunk)
      continue
    }
    if (current.length + part.length + 1 <= MAX_SEGMENT_CHARS) {
      current = current ? `${current} ${part}` : part
    } else {
      segments.push(current)
      current = part
    }
  }
  if (current) segments.push(current)
  return segments
}

// TTS/Phase 0 — Horloge monotone si dispo, fallback Date.now().
function ttsNow() {
  return (typeof performance !== 'undefined' && performance.now)
    ? performance.now()
    : Date.now()
}

export function useCoach({ apiKey, openAiKey, name, moodToday, currentChapter, leaVoice, addMessage, chatHistory, carolineProfile, leaMemory, updateLeaMemory }) {
  const [loading,    setLoading]    = useState(false)
  const [streaming,  setStreaming]  = useState('')
  // LOT 2.2 — HP ON par défaut. Mute dynamique inchangé : toggleVoice
  // appelle stopAllTts() quand on bascule à false (déjà géré).
  const [voiceOn,    setVoiceOn]    = useState(true)
  const [ttsState,   setTtsState]   = useState({ playing: false, paused: false, speed: 1.0, mode: null })

  const audioRef       = useRef(null)
  const browserUttRef  = useRef(null)
  const speedRef       = useRef(1.0)
  // LOT 2.3 — refs pour la queue de segments
  const voiceOnRef     = useRef(true)   // suivi du voiceOn pour les callbacks
  const ttsChainRef    = useRef(null)   // id de la chaîne courante (Symbol unique)

  // LOT 2.3 — synchronise voiceOnRef avec voiceOn (utilisé dans listeners 'ended'
  // pour décider si on enchaîne le segment suivant).
  useEffect(() => {
    voiceOnRef.current = voiceOn
  }, [voiceOn])

  const systemPrompt = useMemo(() => buildSystemPrompt({
    name,
    mood: moodToday,
    currentChapter,
    intention: currentChapter?.intention,
    profile: carolineProfile,
    leaMemory,
  }), [name, moodToday, currentChapter, carolineProfile, leaMemory])

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
    // LOT 2.3 — abort la chaîne de segments en cours
    ttsChainRef.current = null
    setTtsState(s => ({ playing: false, paused: false, speed: s.speed, mode: null }))
  }, [])

  const speakBrowserManaged = useCallback((text) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    try { window.speechSynthesis.cancel() } catch (_) {}
    const cleaned = normalizeForNarrationFR(text || '').slice(0, 500)
    if (!cleaned) return
    const utt = new SpeechSynthesisUtterance(cleaned)
    utt.lang = 'fr-FR'
    utt.rate = speedRef.current
    utt.onstart  = () => setTtsState({ playing: true,  paused: false, speed: speedRef.current, mode: 'browser' })
    utt.onend    = () => setTtsState({ playing: false, paused: false, speed: speedRef.current, mode: null })
    utt.onerror  = () => setTtsState({ playing: false, paused: false, speed: speedRef.current, mode: null })
    utt.onpause  = () => setTtsState(s => ({ ...s, playing: false, paused: true }))
    utt.onresume = () => setTtsState(s => ({ ...s, playing: true,  paused: false }))
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
    setTtsState(state => ({ ...state, speed: clamped }))
  }, [])

  // ── Envoyer un message à Léa ──────────────────────────────
  const sendMessage = useCallback(async (
    userText,
    { type = 'chat', extraSystem, uiMessage = userText, hideUserMessage = false } = {}
  ) => {
    if (!apiKey) return null

    // TTS/Phase 0 — Instrumentation latence (préservée pour mesurer V2 plus tard).
    const ttsRunId = 'lat_' + Math.random().toString(36).slice(2, 9)
    const ttsT0 = ttsNow()
    const ttsLog = (event, extras = {}) => {
      try {
        console.info('[TTS/lat]', {
          runId: ttsRunId,
          event,
          elapsedMs: Math.round(ttsNow() - ttsT0),
          ...extras,
        })
      } catch (_) { /* tolérant */ }
    }
    ttsLog('user_send', { type, userTextLen: (userText || '').length })

    setLoading(true); setStreaming('')

    // Construction historique pour Claude
    const history = hideUserMessage
      ? [...chatHistory.map(({ role, content }) => ({ role, content })), { role: 'user', content: userText }]
      : [...chatHistory.map(({ role, content }) => ({ role, content })), { role: 'user', content: userText }]

    if (!hideUserMessage) {
      addMessage({ role: 'user', content: uiMessage })
    }

    let full = ''
    let firstChunkLogged = false   // TTS/Phase 0 — flag pour ne logger qu'au 1er delta

    try {
      full = await askClaude({
        apiKey,
        systemPrompt: extraSystem || systemPrompt,
        messages: history,
        maxTokens: 600,
        onChunk: (text) => {
          setStreaming(text)
          if (!firstChunkLogged) {
            firstChunkLogged = true
            ttsLog('text_first_chunk', { partialLen: text.length })
          }
        },
      })
      ttsLog('text_done', { textLen: full.length })
      addMessage({ role: 'assistant', content: full })
      // LOT 3.6 — Reset immédiat pour éviter coexistence bulle finale + bulle streaming
      // pendant que la branche TTS tourne (peut prendre plusieurs secondes).
      // Le finally reste comme safety net.
      setStreaming('')
      setLoading(false)

      if (updateLeaMemory && full && type === 'chat') {
        updateLeaMemory({
          lastSession: new Date().toISOString(),
          lastChapter: currentChapter?.title || null,
        })
        extractKeyPointInBackground({
          apiKey,
          userText,
          assistantText: full,
          updateLeaMemory,
        })
      }

      if (voiceOn && full) {
        stopAllTts()
        if (openAiKey) {
          // LOT 2.3 — segmentation (architecture baseline restaurée après rollback V1.1)
          // Une seule synthèse OpenAI par segment, préserve la prosodie et la langue.
          // Le path multi-segments n'apparaît que pour les très longs messages (>500 chars).
          const segments = splitIntoSegments(full)

          if (segments.length <= 1) {
            // Path court (anti-régression) : single audio + listeners directs
            const segmentIdx = 0
            try {
              ttsLog('tts_request', { segmentIdx, segmentsTotal: 1, segmentLen: (segments[0] || full).length })
              const audio = await speakWithOpenAI({
                openAiKey,
                text: segments[0] || full,
                voice: leaVoice,
                speed: speedRef.current,
                onLatencyLog: (event, extras) => ttsLog(event, { segmentIdx, ...extras }),
              })
              ttsLog('tts_audio_ready', { segmentIdx })
              audioRef.current = audio
              try { audio.playbackRate = speedRef.current } catch (_) {}

              try { audio.__ttsAbort?.abort() } catch (_) {}
              const ac = new AbortController()
              audio.__ttsAbort = ac
              const opts = { signal: ac.signal }
              audio.addEventListener('play',  () => { ttsLog('audio_play_start', { segmentIdx }); setTtsState({ playing: true,  paused: false, speed: speedRef.current, mode: 'openai' }) }, opts)
              audio.addEventListener('pause', () => setTtsState(s => ({ ...s, playing: false, paused: true })), opts)
              audio.addEventListener('ended', () => setTtsState({ playing: false, paused: false, speed: speedRef.current, mode: null }), opts)
              audio.addEventListener('error', () => setTtsState({ playing: false, paused: false, speed: speedRef.current, mode: null }), opts)

              setTtsState({ playing: true, paused: false, speed: speedRef.current, mode: 'openai' })
            } catch (ttsErr) {
              console.warn('[TTS] OpenAI échec, fallback navigateur', {
                status: ttsErr?.status ?? null,
                message: ttsErr?.message || String(ttsErr),
                body: ttsErr?.body || null,
              })
              speakBrowserManaged(full)
            }
          } else {
            // Path long : queue de segments. Une nouvelle chaîne invalide
            // toute chaîne précédente (chainId via Symbol).
            const chainId = Symbol('tts-chain')
            ttsChainRef.current = chainId
            let i = 0

            const playNext = async () => {
              if (ttsChainRef.current !== chainId || !voiceOnRef.current || i >= segments.length) {
                // Fin de chaîne (terminée ou abortée)
                setTtsState(s => s.mode === 'openai'
                  ? { playing: false, paused: false, speed: s.speed, mode: null }
                  : s)
                return
              }
              const segmentIdx = i
              const segment = segments[i++]

              let audio
              try {
                ttsLog('tts_request', { segmentIdx, segmentsTotal: segments.length, segmentLen: segment.length })
                audio = await speakWithOpenAI({
                  openAiKey,
                  text: segment,
                  voice: leaVoice,
                  speed: speedRef.current,
                  onLatencyLog: (event, extras) => ttsLog(event, { segmentIdx, ...extras }),
                })
                ttsLog('tts_audio_ready', { segmentIdx })
              } catch (ttsErr) {
                if (ttsChainRef.current !== chainId) return
                console.warn('[TTS] segment OpenAI échec, fallback navigateur', {
                  status: ttsErr?.status ?? null,
                  message: ttsErr?.message || String(ttsErr),
                  body: ttsErr?.body || null,
                  segmentIndex: i - 1,
                  segmentsTotal: segments.length,
                })
                // Fallback navigateur sur le segment courant ; on stoppe la chaîne
                // (le navigateur ne supporte pas un chaînage propre ici).
                speakBrowserManaged(segment)
                ttsChainRef.current = null
                return
              }

              // Si chaîne abortée pendant l'await, ne pas démarrer cet audio
              if (ttsChainRef.current !== chainId) {
                try { audio.pause() } catch (_) {}
                return
              }

              audioRef.current = audio
              try { audio.playbackRate = speedRef.current } catch (_) {}

              try { audio.__ttsAbort?.abort() } catch (_) {}
              const ac = new AbortController()
              audio.__ttsAbort = ac
              const opts = { signal: ac.signal }
              audio.addEventListener('play',  () => { ttsLog('audio_play_start', { segmentIdx }); setTtsState({ playing: true,  paused: false, speed: speedRef.current, mode: 'openai' }) }, opts)
              audio.addEventListener('pause', () => setTtsState(s => ({ ...s, playing: false, paused: true })), opts)
              audio.addEventListener('error', () => {
                ttsChainRef.current = null
                setTtsState({ playing: false, paused: false, speed: speedRef.current, mode: null })
              }, opts)
              audio.addEventListener('ended', () => {
                if (ttsChainRef.current === chainId && voiceOnRef.current) {
                  playNext()
                } else {
                  setTtsState({ playing: false, paused: false, speed: speedRef.current, mode: null })
                }
              }, opts)

              setTtsState({ playing: true, paused: false, speed: speedRef.current, mode: 'openai' })
            }

            playNext()
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
    const safeText = (idea?.text || '').trim()
    const shortLabel = safeText
      ? `J’aimerais partir de cette idée : « ${safeText} ».`
      : "J’aimerais partir d’une idée de ma boîte à idées."

    return sendMessage(
      buildVracInjectPrompt({ idea, chapterTitle: currentChapter?.title }),
      {
        type: 'vrac',
        uiMessage: shortLabel,
      }
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

  const startAkinatorSoft = useCallback(async (answers) => {
    return sendMessage(
      buildAkinatorSoftPrompt(answers),
      { type: 'akinatorSoft' }
    )
  }, [sendMessage])

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

// ─── Extraction de keyPoint en arrière-plan (mémoire Léa) ──
async function extractKeyPointInBackground({ apiKey, userText, assistantText, updateLeaMemory }) {
  if (!apiKey) return
  try {
    const summary = await askClaude({
      apiKey,
      systemPrompt: MEMORY_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: buildMemoryExtractPrompt({ userText, assistantText }),
      }],
      maxTokens: 80,
    })
    const point = (summary || '').trim()
    if (!point || point === 'RIEN' || point.length < 6 || point.length > 200) return

    updateLeaMemory((prev) => {
      const existing = (prev?.keyPoints || []).filter(p => p !== point)
      return {
        keyPoints: [...existing, point].slice(-10),
      }
    })
  } catch (_) { /* silencieux — la mémoire n'est pas critique */ }
}

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
