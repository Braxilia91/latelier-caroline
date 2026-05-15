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

// LOT 2.3 — Garde-fou taille max segment (limite OpenAI = 4096 chars, on plafonne à 500
//   pour respiration naturelle + mute réactif). Préservé en V1.
const MAX_SEGMENT_CHARS = 500

// TTS/V1 — Seuil min pour qu'une phrase "stable" déclenche le TTS pendant le stream.
//   Trop court (ex: "D'accord.") → accumulé avec la suivante.
const V1_MIN_CHARS = 30

// TTS/Phase 0 — Horloge monotone si dispo, fallback Date.now().
function ttsNow() {
  return (typeof performance !== 'undefined' && performance.now)
    ? performance.now()
    : Date.now()
}

export function useCoach({ apiKey, openAiKey, name, moodToday, currentChapter, leaVoice, addMessage, chatHistory, carolineProfile, leaMemory, updateLeaMemory }) {
  const [loading,    setLoading]    = useState(false)
  const [streaming,  setStreaming]  = useState('')
  // LOT 2.2 — HP ON par défaut. Mute dynamique inchangé.
  const [voiceOn,    setVoiceOn]    = useState(true)
  const [ttsState,   setTtsState]   = useState({ playing: false, paused: false, speed: 1.0, mode: null })

  const audioRef       = useRef(null)
  const browserUttRef  = useRef(null)
  const speedRef       = useRef(1.0)
  // Suivi voiceOn pour les callbacks (évite stale closure)
  const voiceOnRef     = useRef(true)
  // Symbol identifiant la chaîne TTS courante (annulation propre)
  const ttsChainRef    = useRef(null)

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
    // Invalide toute chaîne en cours : v1Consume et v1EnqueueFrom early-exit
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

    // ── TTS/Phase 0 — Instrumentation latence ────────────────────
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

    // ── TTS/V1.1 — État de la queue de phrases (closure locale) ──
    // Architecture : v1EnqueueFrom() pousse dans queue ; v1MaybeConsume() lance
    // un consumer (single promise chain) qui boucle tant qu'il y a du contenu.
    // Le verrou `consuming` empêche tout consumer parallèle. Pas de re-entry
    // via callbacks d'événements — c'est UNE promise chain qui pilote tout.
    const v1Active = voiceOn && !!openAiKey
    const v1ChainId = v1Active ? Symbol('v1-chain') : null
    const v1State = {
      queue: [],            // phrases prêtes à TTS
      buffer: '',           // phrases courtes accumulées en attente d'atteindre V1_MIN_CHARS
      vocalizedUpTo: 0,     // offset déjà consommé dans le texte cumulé
      consuming: false,     // verrou : un consumer tourne (ou est en train de démarrer)
      phraseCounter: 0,     // segmentIdx pour logs
      finalized: false,     // garde-fou : v1EnqueueFrom(_, true) ne doit s'exécuter qu'une fois
    }
    if (v1Active) {
      stopAllTts()                        // coupe net le TTS du message précédent
      ttsChainRef.current = v1ChainId
    }

    // Joue une phrase et retourne une Promise qui résoud à 'ended' ou rejette à 'error'.
    // ⚠️ Listeners (play, ended, error) attachés AVANT audio.play() — anti-race condition.
    const v1PlayPhrase = async (phrase, segmentIdx) => {
      ttsLog('tts_request', { segmentIdx, segmentLen: phrase.length, queueRemaining: v1State.queue.length })

      const audio = await speakWithOpenAI({
        openAiKey,
        text: phrase,
        voice: leaVoice,
        speed: speedRef.current,
        autoPlay: false,   // ← critique : on attache nos listeners AVANT de jouer
        onLatencyLog: (event, extras) => ttsLog(event, { segmentIdx, ...extras }),
      })

      if (ttsChainRef.current !== v1ChainId) {
        // Annulé pendant l'await : on ne joue pas
        try { audio.pause() } catch (_) {}
        return
      }

      ttsLog('tts_audio_ready', { segmentIdx })
      audioRef.current = audio
      try { audio.playbackRate = speedRef.current } catch (_) {}

      try { audio.__ttsAbort?.abort() } catch (_) {}
      const ac = new AbortController()
      audio.__ttsAbort = ac
      const opts = { signal: ac.signal }

      return new Promise((resolve, reject) => {
        // 'play' — pour le log + état UI
        audio.addEventListener('play', () => {
          ttsLog('audio_play_start', { segmentIdx })
          setTtsState({ playing: true, paused: false, speed: speedRef.current, mode: 'openai' })
        }, opts)
        // 'pause' — état UI seulement
        audio.addEventListener('pause', () => {
          setTtsState(s => ({ ...s, playing: false, paused: true }))
        }, opts)
        // 'ended' — fin propre de la phrase, on passe à la suivante
        audio.addEventListener('ended', () => resolve(), opts)
        // 'error' — échec lecture
        audio.addEventListener('error', () => reject(new Error('audio playback error')), opts)

        // Maintenant on peut jouer en toute sécurité (tous les listeners sont attachés)
        audio.play().catch(reject)
      })
    }

    // Consumer : boucle séquentielle. UNE SEULE instance tourne à la fois grâce à v1State.consuming.
    const v1Consume = async () => {
      try {
        while (
          ttsChainRef.current === v1ChainId &&
          voiceOnRef.current &&
          v1State.queue.length > 0
        ) {
          const phrase = v1State.queue.shift()
          const segmentIdx = v1State.phraseCounter++
          try {
            await v1PlayPhrase(phrase, segmentIdx)
          } catch (err) {
            if (ttsChainRef.current !== v1ChainId) return  // déjà annulé, sortie silencieuse
            console.warn('[TTS V1] phrase OpenAI échec, fallback navigateur', {
              status: err?.status ?? null,
              message: err?.message || String(err),
              body: err?.body || null,
              segmentIdx,
            })
            // Politique de fallback : on lit la phrase courante via navigateur
            // et on abandonne la queue restante (le browser ne chaîne pas proprement
            // les utterances OpenAI suivantes).
            speakBrowserManaged(phrase)
            ttsChainRef.current = null
            return
          }
        }
      } finally {
        v1State.consuming = false
        // État final propre selon raison de sortie
        if (ttsChainRef.current !== v1ChainId || !voiceOnRef.current) {
          // Annulé ou voix coupée
          setTtsState(s => ({ ...s, playing: false, paused: false, mode: s.mode === 'openai' ? null : s.mode }))
        } else if (v1State.queue.length === 0) {
          // Queue vide pour l'instant — peut être réalimentée par v1EnqueueFrom
          setTtsState({ playing: false, paused: false, speed: speedRef.current, mode: 'openai' })
        }
      }
    }

    const v1MaybeConsume = () => {
      if (v1State.consuming) return
      if (ttsChainRef.current !== v1ChainId) return
      if (!voiceOnRef.current) return
      if (v1State.queue.length === 0) return
      v1State.consuming = true
      // Démarre la promise chain ; on n'await pas ici, c'est volontaire (fire-and-forget)
      v1Consume()
    }

    // Extrait les phrases complètes (.!?…) du cumulativeText à partir de vocalizedUpTo.
    // - isFinalize=false : push uniquement les buffers qui atteignent V1_MIN_CHARS
    // - isFinalize=true (à text_done, une seule fois) : push tail non ponctué + buffer résiduel
    const v1EnqueueFrom = (cumulativeText, isFinalize = false) => {
      if (!v1Active) return
      if (ttsChainRef.current !== v1ChainId) return
      if (!voiceOnRef.current) return
      // Garde-fou anti-doublon : finalize ne peut s'exécuter qu'une fois
      if (isFinalize && v1State.finalized) return

      const remaining = cumulativeText.slice(v1State.vocalizedUpTo)
      const sentenceRegex = /[\s\S]*?[.!?…]+(?:\s+|$)/g
      let lastEnd = 0
      let m
      while ((m = sentenceRegex.exec(remaining)) !== null) {
        const phrase = m[0].trim()
        const matchEnd = m.index + m[0].length
        if (!phrase) continue

        // Concat avec buffer, respect MAX_SEGMENT_CHARS
        const candidate = v1State.buffer ? `${v1State.buffer} ${phrase}` : phrase
        if (candidate.length > MAX_SEGMENT_CHARS && v1State.buffer) {
          // Le buffer + cette phrase dépasse → push le buffer seul d'abord
          v1State.queue.push(v1State.buffer)
          v1State.buffer = phrase
        } else {
          v1State.buffer = candidate
        }
        lastEnd = matchEnd

        if (v1State.buffer.length >= V1_MIN_CHARS) {
          v1State.queue.push(v1State.buffer)
          v1State.buffer = ''
        }
      }

      if (isFinalize) {
        // Tail non terminé par ponctuation
        const tail = remaining.slice(lastEnd).trim()
        if (tail) {
          v1State.buffer = v1State.buffer ? `${v1State.buffer} ${tail}` : tail
          lastEnd = remaining.length
        }
        if (v1State.buffer) {
          v1State.queue.push(v1State.buffer)
          v1State.buffer = ''
        }
        v1State.finalized = true
      }

      if (lastEnd > 0) {
        v1State.vocalizedUpTo += lastEnd
      }

      if (v1State.queue.length > 0) {
        v1MaybeConsume()
      }
    }

    // ── Construction historique + appel Claude streaming ─────────
    const history = hideUserMessage
      ? [...chatHistory.map(({ role, content }) => ({ role, content })), { role: 'user', content: userText }]
      : [...chatHistory.map(({ role, content }) => ({ role, content })), { role: 'user', content: userText }]

    if (!hideUserMessage) {
      addMessage({ role: 'user', content: uiMessage })
    }

    let full = ''
    let firstChunkLogged = false

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
          // TTS/V1 — enqueue les phrases stables détectées au fil du stream
          v1EnqueueFrom(text, false)
        },
      })
      ttsLog('text_done', { textLen: full.length })
      addMessage({ role: 'assistant', content: full })
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

      // ── Finalisation TTS ─────────────────────────────────────
      if (voiceOn && full) {
        if (v1Active && ttsChainRef.current === v1ChainId) {
          // Push le tail non ponctué + buffer résiduel (appel unique, garde-fou finalized)
          v1EnqueueFrom(full, true)
        } else if (!openAiKey) {
          // Pas de clé OpenAI → fallback navigateur classique sur le texte complet
          speakBrowserManaged(full)
        }
        // Si voiceOn était ON au début mais l'utilisatrice a stoppé entre temps,
        // ttsChainRef.current sera null et on ne fait rien (cohérent).
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
