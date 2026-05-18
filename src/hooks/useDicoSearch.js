// src/hooks/useDicoSearch.js
// Hook React pour la recherche lexicale DicoCaro

import { useState, useCallback, useRef } from 'react'
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
 * @param {Object} opts
 * @param {Function} opts.callLLM — (prompt: string, maxTokens: number) => Promise<string>
 */
export function useDicoSearch({ callLLM }) {
  const [state, setState] = useState(createInitialState)
  const stateRef = useRef(state)
  stateRef.current = state

  const debounceRef = useRef(null)

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
