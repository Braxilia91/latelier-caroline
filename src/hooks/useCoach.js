import { useState, useCallback, useRef, useMemo } from 'react'
import { askClaude, speakWithOpenAI } from '../lib/claude'
import {
  buildSystemPrompt, buildCorrectionPrompt,
  buildVocabPrompt, buildThreadPrompt,
  buildDoubtPrompt, buildVracInjectPrompt,
  buildDiscoveryPrompt, buildSynonymPrompt,
  buildWordSearchPrompt,
} from '../lib/prompts'

export function useCoach({ apiKey, openAiKey, name, moodToday, currentChapter, leaVoice, addMessage, chatHistory, carolineProfile, leaMemory, updateLeaMemory }) {
  const [loading,    setLoading]    = useState(false)
  const [streaming,  setStreaming]  = useState('')
  const [voiceOn,    setVoiceOn]    = useState(false)
  const audioRef = useRef(null)

  const systemPrompt = useMemo(() => buildSystemPrompt({
    name,
    mood: moodToday,
    currentChapter,
    intention: currentChapter?.intention,
    profile: carolineProfile,
    leaMemory,
  }), [name, moodToday, currentChapter, carolineProfile, leaMemory])

  // ─── Envoyer un message à Léa ──────────────────────────────
  const sendMessage = useCallback(async (userText, { type = 'chat', extraSystem } = {}) => {
    if (!apiKey) return null
    setLoading(true); setStreaming('')

    const userMsg = { role: 'user', content: userText }
    addMessage({ role: 'user', content: userText })

    // Construire l'historique (garder les 20 derniers)
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

      // ─── Mise à jour mémoire Léa ──────────────────────────
      if (updateLeaMemory && full && type === 'chat') {
        updateLeaMemory({
          lastSession: new Date().toISOString(),
          lastChapter: currentChapter?.title || null,
        })
      }

      // TTS si voix activée
      if (voiceOn && full) {
        if (audioRef.current) audioRef.current.pause()
        if (openAiKey) {
          try {
            audioRef.current = await speakWithOpenAI({ openAiKey, text: full, voice: leaVoice })
          } catch (_) {
            // Fallback voix navigateur
            speakBrowser(full)
          }
        } else {
          speakBrowser(full)
        }
      }
    } catch (err) {
      addMessage({ role: 'assistant', content: `❌ ${err.message}` })
    } finally {
      setLoading(false); setStreaming('')
    }
    return full
  }, [apiKey, openAiKey, systemPrompt, chatHistory, voiceOn, leaVoice, addMessage, updateLeaMemory, currentChapter])

  // ─── Correction rapide ─────────────────────────────────────
  const correctText = useCallback(async (text) => {
    return sendMessage(buildCorrectionPrompt(text), { type: 'correction' })
  }, [sendMessage])

  // ─── Définition d'un mot ───────────────────────────────────
  const defineWord = useCallback(async (word) => {
    return sendMessage(buildVocabPrompt(word), { type: 'vocab' })
  }, [sendMessage])

  // ─── Retrouver le fil ──────────────────────────────────────
  const findThread = useCallback(async (chapterText) => {
    return sendMessage(buildThreadPrompt(chapterText), { type: 'thread' })
  }, [sendMessage])

  // ─── Mode "Je doute" ───────────────────────────────────────
  const expressDoubt = useCallback(async (text) => {
    return sendMessage(buildDoubtPrompt(text), { type: 'doubt' })
  }, [sendMessage])

  // ─── Injecter une idée du vrac ─────────────────────────────
  const injectVrac = useCallback(async (idea) => {
    return sendMessage(
      buildVracInjectPrompt({ idea, chapterTitle: currentChapter?.title }),
      { type: 'vrac' }
    )
  }, [sendMessage, currentChapter])

  // ─── Découverte du jour ────────────────────────────────────
  const getDiscovery = useCallback(async () => {
    const recentText = currentChapter?.content || ''
    return sendMessage(buildDiscoveryPrompt(recentText), { type: 'discovery' })
  }, [sendMessage, currentChapter])

  // ─── DicoCaro — Synonymes ──────────────────────────────────
  const getSynonyms = useCallback(async ({ word, sentence, level }) => {
    if (!word?.trim()) return null
    return sendMessage(
      buildSynonymPrompt({ word: word.trim(), sentence: sentence?.trim() || '', level: level || 'mixte' }),
      { type: 'synonyms' }
    )
  }, [sendMessage])

  // ─── DicoCaro — Je cherche mes mots ───────────────────────
  const searchWord = useCallback(async (description) => {
    if (!description?.trim()) return null
    return sendMessage(buildWordSearchPrompt(description.trim()), { type: 'wordSearch' })
  }, [sendMessage])

  // ─── DicoCaro — Akinator littéraire ───────────────────────
  const startAkinator = useCallback(async () => {
    return sendMessage(
      "Je cherche un mot précis mais je n'arrive pas à le formuler. Aide-moi à le trouver en me posant des questions une à une — sur l'émotion, la sensation, le contexte ou la nuance que je veux exprimer. Commence par ta première question.",
      { type: 'akinator' }
    )
  }, [sendMessage])

  // ─── Toggle voix ───────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    if (voiceOn && audioRef.current) {
      audioRef.current.pause()
      window.speechSynthesis?.cancel()
    }
    setVoiceOn(v => !v)
  }, [voiceOn])

  return { loading, streaming, voiceOn, toggleVoice, sendMessage, correctText, defineWord, findThread, expressDoubt, injectVrac, getDiscovery, getSynonyms, searchWord, startAkinator }
}

// ─── Voix navigateur fallback ─────────────────────────────────
function speakBrowser(text) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text.slice(0, 500))
  utt.lang = 'fr-FR'
  utt.rate = 0.92
  window.speechSynthesis.speak(utt)
}
