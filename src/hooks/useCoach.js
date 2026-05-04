import { useState, useCallback, useRef } from 'react'
import { askClaude, speakWithOpenAI } from '../lib/claude'
import {
  buildSystemPrompt, buildCorrectionPrompt,
  buildVocabPrompt, buildThreadPrompt,
} from '../lib/prompts'

export function useCoach({ apiKey, openAiKey, name, moodToday, currentChapter, leaVoice, addMessage, chatHistory }) {
  const [loading,    setLoading]    = useState(false)
  const [streaming,  setStreaming]  = useState('')
  const [voiceOn,    setVoiceOn]    = useState(false)
  const audioRef = useRef(null)

  const systemPrompt = buildSystemPrompt({
    name,
    mood: moodToday,
    currentChapter,
    intention: currentChapter?.intention,
  })

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
  }, [apiKey, openAiKey, systemPrompt, chatHistory, voiceOn, leaVoice, addMessage])

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

  // ─── Toggle voix ───────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    if (voiceOn && audioRef.current) {
      audioRef.current.pause()
      window.speechSynthesis?.cancel()
    }
    setVoiceOn(v => !v)
  }, [voiceOn])

  return { loading, streaming, voiceOn, toggleVoice, sendMessage, correctText, defineWord, findThread }
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
