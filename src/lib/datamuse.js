// src/lib/datamuse.js
// Client API Datamuse + fallback Wiktionnaire
// Gratuit, sans clé API, latence ~100ms

const DATAMUSE_BASE = 'https://api.datamuse.com'

export async function fetchSuggestions(prefix, max = 15) {
  if (!prefix || prefix.length < 2) return []
  try {
    const res = await fetch(
      `${DATAMUSE_BASE}/s?sp=${encodeURIComponent(prefix)}*&max=${max}&md=f&fr=1000`
    )
    if (!res.ok) throw new Error(`Datamuse ${res.status}`)
    const data = await res.json()
    return Array.isArray(data)
      ? data
          .map(item => ({ word: item.word, score: item.score || 0 }))
          .filter(item => item.word && item.word.length >= prefix.length)
      : []
  } catch (err) {
    console.warn('[Datamuse] suggestions failed:', err)
    return []
  }
}

export async function fetchMeansLike(description, max = 10) {
  if (!description || description.trim().length < 3) return []
  try {
    const res = await fetch(
      `${DATAMUSE_BASE}/words?ml=${encodeURIComponent(description.trim())}&max=${max}&md=f`
    )
    if (!res.ok) throw new Error(`Datamuse ${res.status}`)
    const data = await res.json()
    return Array.isArray(data)
      ? data.map(item => ({ word: item.word, score: item.score || 0 })).filter(i => i.word)
      : []
  } catch (err) {
    console.warn('[Datamuse] meansLike failed:', err)
    return []
  }
}

export async function fetchWiktionnaireSuggestions(prefix, max = 10) {
  if (!prefix || prefix.length < 2) return []
  try {
    const res = await fetch(
      `https://fr.wiktionary.org/w/api.php?action=opensearch&search=${encodeURIComponent(prefix)}&limit=${max}&format=json&origin=*`
    )
    if (!res.ok) throw new Error(`Wiktionnaire ${res.status}`)
    const data = await res.json()
    const words = Array.isArray(data?.[1]) ? data[1] : []
    return words.map((w, i) => ({ word: w, score: (words.length - i) * 100 }))
  } catch (err) {
    console.warn('[Wiktionnaire] suggestions failed:', err)
    return []
  }
}

// Note : pas de fetchSoundsLike — Datamuse sl= est anglais-only et retournait
// du n'importe quoi en francais (tree trunk / army tank pour "ornytorinque").
// La correction phonetique francaise passe via Claude (D-Semantic + D-Detect).
// Perf : Datamuse sp= et Wiktionnaire opensearch lances EN PARALLELE (gain ~150ms
// quand fallback necessaire, cout zero quand Datamuse suffit car Wiktionnaire
// reste en cache navigateur pour les requetes suivantes).
export async function fetchSuggestionsWithFallback(prefix, max = 15) {
  const [datamuse, wiktionnaire] = await Promise.all([
    fetchSuggestions(prefix, max),
    fetchWiktionnaireSuggestions(prefix, max),
  ])
  if (datamuse.length >= 3) return datamuse
  const seen = new Set(datamuse.map(d => d.word.toLowerCase()))
  const merged = [...datamuse]
  for (const item of wiktionnaire) {
    if (!seen.has(item.word.toLowerCase())) {
      merged.push(item)
      seen.add(item.word.toLowerCase())
    }
  }
  return merged.slice(0, max)
}
