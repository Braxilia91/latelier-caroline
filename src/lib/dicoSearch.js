// src/lib/dicoSearch.js
// Moteur de recherche lexicale DicoCaro — state machine pure

import { fetchSuggestionsWithFallback } from './datamuse'
import { buildDicoGuessPrompt, buildDicoExplainPrompt } from './prompts'

// ── État initial ────────────────────────────────────────────────
export function createInitialState() {
  return {
    phase: 'idle',           // 'idle' | 'suggesting' | 'guessing' | 'confirming' | 'explaining' | 'error'
    query: '',
    suggestions: [],         // { word, score }[]
    guesses: [],             // { word, confidence, why }[]
    activeGuessIndex: 0,
    rejectedWords: [],
    confirmedWord: null,
    explanation: null,       // { definition, trivia }
    isLoading: false,
    error: null,
  }
}

// ── Parsing helpers ─────────────────────────────────────────────
function parseJSON(raw) {
  if (!raw || typeof raw !== 'string') return null
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) return null
  try { return JSON.parse(m[0]) } catch { return null }
}

function parseGuessResponse(raw) {
  const parsed = parseJSON(raw)
  if (!parsed || !Array.isArray(parsed.guesses)) return { guesses: [] }
  return {
    guesses: parsed.guesses
      .filter(g => g && typeof g.word === 'string')
      .map(g => ({
        word: g.word.trim(),
        confidence: Math.max(0, Math.min(1, Number(g.confidence) || 0.5)),
        why: g.why || '',
      }))
      .slice(0, 3),
  }
}

function parseExplainResponse(raw) {
  const parsed = parseJSON(raw)
  if (!parsed) return { definition: raw?.slice(0, 300) || '', trivia: '' }
  return {
    definition: parsed.definition || '',
    trivia: parsed.trivia || '',
  }
}

// ── Transitions ─────────────────────────────────────────────────

/** Caroline tape → suggestions autocomplete */
export async function transitionTyping(state, query) {
  if (!query || query.length < 2) {
    return { ...state, phase: 'idle', query: query || '', suggestions: [] }
  }
  const suggestions = await fetchSuggestionsWithFallback(query, 15)
  return { ...state, phase: 'suggesting', query, suggestions, error: null }
}

/** Caroline valide (Entrée / vocal) → devinage LLM */
export async function transitionGuess(state, callLLM) {
  if (!state.query.trim()) return state
  if (!callLLM) return { ...state, phase: 'error', error: 'Léa non disponible.' }

  const prompt = buildDicoGuessPrompt({
    query: state.query,
    rejectedWords: state.rejectedWords,
  })

  try {
    const raw = await callLLM(prompt)
    const { guesses } = parseGuessResponse(raw)
    if (!guesses.length) {
      return {
        ...state, phase: 'error', isLoading: false,
        error: "Léa n'a trouvé aucun mot. Essaie de reformuler ta description.",
      }
    }
    return { ...state, phase: 'confirming', guesses, activeGuessIndex: 0, isLoading: false, error: null }
  } catch (err) {
    return { ...state, phase: 'error', isLoading: false, error: err.message || 'Erreur réseau.' }
  }
}

/** Caroline clique une suggestion → passe en explaining */
export function transitionSelectSuggestion(state, word) {
  return { ...state, phase: 'explaining', confirmedWord: word, explanation: null }
}

/** "C'est ça !" → explication LLM */
export async function transitionConfirm(state, callLLM) {
  const word = state.guesses[state.activeGuessIndex]?.word
  if (!word || !callLLM) return state

  try {
    // Sonnet 4 pour la définition + trivia : qualité littéraire supérieure
    // (Haiku tend à over-engineer et produire des trivias génériques sur les mots rares).
    // Latence acceptée ~1.5s : Caroline attend volontiers le résultat final.
    const raw = await callLLM(buildDicoExplainPrompt(word), 250, 'claude-sonnet-4-20250514')
    const explanation = parseExplainResponse(raw)
    return { ...state, phase: 'explaining', confirmedWord: word, explanation, isLoading: false, error: null }
  } catch (err) {
    return { ...state, phase: 'error', isLoading: false, error: err.message || 'Erreur explication.' }
  }
}

/** "C'est pas ça" → guess suivant ou relance LLM (hybride) */
export async function transitionReject(state, callLLM) {
  const current = state.guesses[state.activeGuessIndex]
  if (!current) return state

  const newRejected = [...state.rejectedWords, current.word]
  const nextIndex = state.activeGuessIndex + 1

  // Encore des guesses locaux → carousel sans LLM
  if (nextIndex < state.guesses.length) {
    return { ...state, activeGuessIndex: nextIndex, rejectedWords: newRejected }
  }

  // Dernier guess épuisé → relance LLM (max 1 fois)
  if (newRejected.length >= 6) {
    return {
      ...state, phase: 'error', isLoading: false,
      error: "Essaie de reformuler ta description avec d'autres mots. Léa recommence !",
      rejectedWords: newRejected,
    }
  }

  return transitionGuess({ ...state, rejectedWords: newRejected, isLoading: true }, callLLM)
}

/** Reset → idle */
export function transitionReset() {
  return createInitialState()
}
