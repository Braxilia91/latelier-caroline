// ─── IndexedDB wrapper v3 ──────────────────────────────────────
const DB_NAME    = 'atelier_v3'
const DB_VERSION = 3          // v3 : ajout store 'fragments' (texte uniquement)

let _db = null

async function openDB() {
  if (_db) return _db
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db  = e.target.result
      const old = e.oldVersion

      // ── Installation fraîche ──────────────────────────────
      if (old < 1) {
        db.createObjectStore('kv',       { keyPath: 'key' })
        db.createObjectStore('chapters', { keyPath: 'id'  })
        db.createObjectStore('chat',     { keyPath: 'id', autoIncrement: true })
      }
      // ── Migration v1 → v2 ────────────────────────────────
      if (old < 2) {
        if (!db.objectStoreNames.contains('vrac'))
          db.createObjectStore('vrac', { keyPath: 'id' })
      }
      // ── Migration v2 → v3 ────────────────────────────────
      if (old < 3) {
        if (!db.objectStoreNames.contains('fragments'))
          db.createObjectStore('fragments', { keyPath: 'id' })
      }
    }

    req.onsuccess  = (e) => { _db = e.target.result; resolve(_db) }
    req.onerror    = (e) => reject(e.target.error)
    req.onblocked  = ()  => reject(new Error('DB blocked'))
  })
}

function tx(storeName, mode = 'readonly') {
  return _db.transaction([storeName], mode).objectStore(storeName)
}

// ─── KV store ─────────────────────────────────────────────────
export async function getKV(key, fallback = null) {
  await openDB()
  return new Promise((resolve) => {
    const req = tx('kv').get(key)
    req.onsuccess = () => resolve(req.result?.value ?? fallback)
    req.onerror   = () => resolve(fallback)
  })
}

export async function setKV(key, value) {
  await openDB()
  return new Promise((resolve, reject) => {
    const req = tx('kv', 'readwrite').put({ key, value })
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
}

// ─── Chapters ──────────────────────────────────────────────────
export async function getChapters() {
  await openDB()
  return new Promise((resolve) => {
    const req = tx('chapters').getAll()
    req.onsuccess = () => resolve(
      (req.result || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    )
    req.onerror = () => resolve([])
  })
}

export async function saveChapter(chapter) {
  await openDB()
  return new Promise((resolve, reject) => {
    const req = tx('chapters', 'readwrite').put({
      ...chapter,
      updatedAt: new Date().toISOString(),
    })
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
}

export async function deleteChapter(id) {
  await openDB()
  return new Promise((resolve, reject) => {
    const req = tx('chapters', 'readwrite').delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
}

/** Restaure un chapitre supprimé (pour le toast "Annuler"). */
export async function restoreChapter(chapter) {
  return saveChapter(chapter)
}

// ─── Chat history ──────────────────────────────────────────────
export async function getChatHistory() {
  await openDB()
  return new Promise((resolve) => {
    const req = tx('chat').getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror   = () => resolve([])
  })
}

/** Charge uniquement les N derniers messages (curseur inverse — O(limit) not O(n)) */
export async function getChatHistoryRecent(limit = 50) {
  await openDB()
  return new Promise((resolve) => {
    const results = []
    const req     = tx('chat').openCursor(null, 'prev')
    req.onsuccess = (e) => {
      const cursor = e.target.result
      if (cursor && results.length < limit) {
        results.unshift(cursor.value)   // unshift → ordre chronologique
        cursor.continue()
      } else {
        resolve(results)
      }
    }
    req.onerror = () => resolve([])
  })
}

export async function addChatMessage(msg) {
  await openDB()
  return new Promise((resolve, reject) => {
    const req = tx('chat', 'readwrite').add({
      ...msg,
      timestamp: new Date().toISOString(),
    })
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
}

export async function clearChatHistory() {
  await openDB()
  return new Promise((resolve, reject) => {
    const req = tx('chat', 'readwrite').clear()
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
}

// ─── Vrac — boîte à idées pêle-mêle ───────────────────────────
export async function getVrac() {
  await openDB()
  return new Promise((resolve) => {
    const req = tx('vrac').getAll()
    req.onsuccess = () => resolve(
      (req.result || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    )
    req.onerror = () => resolve([])
  })
}

export async function addVrac(idea) {
  await openDB()
  const item = {
    id:        `vrac_${Date.now()}`,
    text:      idea.text      || '',
    tag:       idea.tag       || 'idée',   // idée | scène | souvenir | émotion | dialogue | titre
    chapterId: idea.chapterId || null,
    used:      false,
    createdAt: new Date().toISOString(),
  }
  return new Promise((resolve, reject) => {
    const req = tx('vrac', 'readwrite').add(item)
    req.onsuccess = () => resolve(item)
    req.onerror   = (e) => reject(e.target.error)
  })
}

export async function updateVrac(id, fields) {
  await openDB()
  return new Promise((resolve, reject) => {
    const getReq = tx('vrac').get(id)
    getReq.onsuccess = () => {
      const item = getReq.result
      if (!item) return reject(new Error('Vrac item not found'))
      const putReq = tx('vrac', 'readwrite').put({ ...item, ...fields })
      putReq.onsuccess = () => resolve()
      putReq.onerror   = (e) => reject(e.target.error)
    }
    getReq.onerror = (e) => reject(e.target.error)
  })
}

export async function deleteVrac(id) {
  await openDB()
  return new Promise((resolve, reject) => {
    const req = tx('vrac', 'readwrite').delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
}

// ─── Fragments — boîte de réception (texte uniquement en LOT 1) ──
// Schéma minimal v1 :
// {
//   id, text, tags [], chapterId, source ('manual'),
//   status ('inbox'|'used'), createdAt, updatedAt
// }
// (audio / image / OCR : reportés à un lot ultérieur, hors LOT 1)

export async function getFragments() {
  await openDB()
  return new Promise((resolve) => {
    const req = tx('fragments').getAll()
    req.onsuccess = () => resolve(
      (req.result || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    )
    req.onerror = () => resolve([])
  })
}

export async function saveFragment(fragment) {
  await openDB()
  return new Promise((resolve, reject) => {
    const req = tx('fragments', 'readwrite').put({
      ...fragment,
      updatedAt: new Date().toISOString(),
    })
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
}

export async function updateFragment(id, fields) {
  await openDB()
  return new Promise((resolve, reject) => {
    const getReq = tx('fragments').get(id)
    getReq.onsuccess = () => {
      const item = getReq.result
      if (!item) return reject(new Error('Fragment not found'))
      const putReq = tx('fragments', 'readwrite').put({
        ...item, ...fields, updatedAt: new Date().toISOString(),
      })
      putReq.onsuccess = () => resolve()
      putReq.onerror   = (e) => reject(e.target.error)
    }
    getReq.onerror = (e) => reject(e.target.error)
  })
}

export async function deleteFragment(id) {
  await openDB()
  return new Promise((resolve, reject) => {
    const req = tx('fragments', 'readwrite').delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
}

// ─── Import snapshot (sync inter-appareils) ───────────────────────
const KV_KEYS_SYNC = ['name','leaVoice','streak','sessions','lastSession','moodToday','moodValue','caroline_profile','lea_memory']

/**
 * Valide la structure minimale d'un snapshot avant import.
 * Protège contre la corruption KV ou les migrations ratées.
 */
export function isValidSnapshot(data) {
  if (!data || typeof data !== 'object')              return false
  if (typeof data.version !== 'number')               return false
  if (!Array.isArray(data.chapters))                  return false
  if (!Array.isArray(data.vrac))                      return false
  if (typeof data.kv !== 'object' || !data.kv)        return false
  // Guard syncedAt — doit être une date ISO 8601 parseable (rejette '' et les strings invalides)
  if (data.syncedAt != null && (!data.syncedAt || isNaN(Date.parse(data.syncedAt)))) return false
  // Chaque chapitre doit avoir un id string non vide
  for (const ch of data.chapters) {
    if (typeof ch.id !== 'string' || !ch.id)          return false
  }
  return true
}

/**
 * Écrase les données locales avec un snapshot distant.
 * Retourne false si le snapshot est invalide — jamais de corruption silencieuse.
 * Les clés sensibles (apiKey, openAiKey) ne sont jamais remplacées.
 * NB : le store 'fragments' n'est pas inclus dans le snapshot pour l'instant
 * (sera ajouté dans une livraison ultérieure quand le format sera stabilisé).
 */
export async function importSnapshot(snapshot) {
  if (!isValidSnapshot(snapshot)) {
    console.error('[Sync] Snapshot invalide — import annulé', snapshot)
    return false
  }
  await openDB()

  // ── Chapitres ────────────────────────────────────────────────
  await new Promise((resolve, reject) => {
    const req = tx('chapters', 'readwrite').clear()
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
  for (const ch of (snapshot.chapters || [])) {
    await saveChapter(ch)
  }

  // ── Vrac ─────────────────────────────────────────────────────
  await new Promise((resolve, reject) => {
    const req = tx('vrac', 'readwrite').clear()
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
  const kv = snapshot.kv || {}
  for (const [key, value] of Object.entries(kv)) {
    if (KV_KEYS_SYNC.includes(key) && value !== undefined) {
      await setKV(key, value)
    }
  }

  // ── Vrac items ───────────────────────────────────────────────
  for (const idea of (snapshot.vrac || [])) {
    await new Promise((resolve, reject) => {
      const req = tx('vrac', 'readwrite').put(idea)
      req.onsuccess = () => resolve()
      req.onerror   = (e) => reject(e.target.error)
    })
  }

  // Marquer le moment du dernier import
  await setKV('lastSyncedAt', snapshot.syncedAt || new Date().toISOString())
  return true
}

// ─── Export complet ─────────────────────────────────────────────
export async function exportAllData() {
  const [chapters, name, streak, sessions, profile, vrac] = await Promise.all([
    getChapters(),
    getKV('name',             ''),
    getKV('streak',           0),
    getKV('sessions',         0),
    getKV('caroline_profile', null),
    getVrac(),
  ])
  return { name, chapters, streak, sessions, profile, vrac, exportedAt: new Date().toISOString() }
}

// ─── Estimation du stockage ─────────────────────────────────────
export async function getStorageEstimate() {
  if (!navigator.storage?.estimate) return null
  try {
    const est = await navigator.storage.estimate()
    return {
      used:    est.usage  ?? 0,
      quota:   est.quota  ?? 0,
      percent: est.quota  ? Math.round((est.usage / est.quota) * 100) : 0,
    }
  } catch {
    return null
  }
}

// ─── Reset total ────────────────────────────────────────────────
export async function resetAllData() {
  if (_db) { _db.close(); _db = null }
  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
}
