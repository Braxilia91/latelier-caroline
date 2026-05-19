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

// D-Spell — Datamuse "sounds-like" : correction phonétique pour fautes de frappe
// ex : "ornytorinque" -> ornithorynque, "mélocolie" -> mélancolie.
// Latence ~80ms, gratuit, sans clé.
export async function fetchSoundsLike(word, max = 5) {
  if (!word || word.length < 3) return []
  try {
    const res = await fetch(
      `${DATAMUSE_BASE}/words?sl=${encodeURIComponent(word)}&max=${max}&md=f`
    )
    if (!res.ok) throw new Error(`Datamuse sl ${res.status}`)
    const data = await res.json()
    return Array.isArray(data)
      ? data.map(item => ({ word: item.word, score: item.score || 0 })).filter(i => i.word)
      : []
  } catch (err) {
    console.warn('[Datamuse] soundsLike failed:', err)
    return []
  }
}

export async function fetchSuggestionsWithFallback(prefix, max = 15) {
  // 1) Préfixe exact (autocomplete classique)
  const datamuse = await fetchSuggestions(prefix, max)
  if (datamuse.length >= 3) return datamuse

  // 2) Si peu de résultats préfixe ET le query ressemble à un mot entier (>= 4 chars),
  //    essayer phonétique en parallèle de Wiktionnaire. Mélange les 3 sources.
  const tasks = [fetchWiktionnaireSuggestions(prefix, max)]
  if (prefix.length >= 4 && datamuse.length === 0) {
    tasks.push(fetchSoundsLike(prefix, Math.min(max, 5)))
  }
  const extras = await Promise.all(tasks)

  const seen = new Set(datamuse.map(d => d.word.toLowerCase()))
  const merged = [...datamuse]
  for (const list of extras) {
    for (const item of list) {
      if (!seen.has(item.word.toLowerCase())) {
        merged.push(item)
        seen.add(item.word.toLowerCase())
      }
    }
  }
  return merged.slice(0, max)
}
