// src/hooks/useDicoSearch.js
// Hook React pour la recherche lexicale DicoCaro
// Accepte { apiKey, openAiKey } (même interface que DicoCaroModal)

import { useState, useCallback, useRef } from 'react'
import { askClaude } from '../lib/claude'
import {
  createInitialState,
  transitionTyping,
  transitionGuess,
  transitionSelectSuggestion,
  transitionConfirm,
  transitionReject,
  transitionReset,
} from '../lib/dicoSearch'

/**
 * @param {Object}   opts
 * @param {string}   opts.apiKey     — clé Anthropic
 * @param {string}  [opts.openAiKey] — non utilisé ici (réservé vocal)
 */
export function useDicoSearch({ apiKey, openAiKey }) {
  const [state, setState] = useState(createInitialState)
  const stateRef   = useRef(state)
  stateRef.current = state

  const debounceRef = useRef(null)

  // Wrapper LLM interne — buildé à partir de apiKey
  const callLLM = useCallback(async (prompt, maxTokens = 600) => {
    if (!apiKey) throw new Error('Clé API Anthropic manquante.')
    return askClaude({
      apiKey,
      systemPrompt:
        "Tu es Léa, assistante d'écriture de Caroline. Tu réponds UNIQUEMENT en JSON strict sans texte avant ni après.",
      messages: [{ role: 'user', content: prompt }],
      maxTokens,
    })
  }, [apiKey])

  const setQuery = useCallback((query) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query || query.length < 2) {
      setState(s => ({ ...s, phase: 'idle', query: query || '', suggestions: [] }))
      return
    }

    setState(s => ({ ...s, query }))

    debounceRef.current = setTimeout(async () => {
      const newState = await transitionTyping(stateRef.current, query)
      setState(newState)
    }, 280)
  }, [])

  const submitQuery = useCallback(async () => {
    const s = stateRef.current
    if (!s.query.trim()) return
    setState(prev => ({ ...prev, isLoading: true, phase: 'guessing' }))
    const newState = await transitionGuess(s, callLLM)
    setState(newState)
  }, [callLLM])

  const selectSuggestion = useCallback((word) => {
    setState(transitionSelectSuggestion(stateRef.current, word))
  }, [])

  const confirmGuess = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }))
    const newState = await transitionConfirm(stateRef.current, callLLM)
    setState(newState)
  }, [callLLM])

  const rejectGuess = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }))
    const newState = await transitionReject(stateRef.current, callLLM)
    setState(newState)
  }, [callLLM])

  const reset = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setState(transitionReset())
  }, [])

  return { state, setQuery, submitQuery, selectSuggestion, confirmGuess, rejectGuess, reset }
}
