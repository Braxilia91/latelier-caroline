// ─── IndexedDB wrapper v4 ──────────────────────────────────────
const DB_NAME    = 'atelier_v3' // nom historique conservé — ne pas renommer, casserait les bases existantes
const DB_VERSION = 4            // v4 : ajout stores 'traces' et 'traceBlobs' (tiroir)

let _db = null

async function openDB() {
  if (_db) return _db
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db  = e.target.result
      const old = e.oldVersion

      if (old < 1) {
        db.createObjectStore('kv',       { keyPath: 'key' })
        db.createObjectStore('chapters', { keyPath: 'id'  })
        db.createObjectStore('chat',     { keyPath: 'id', autoIncrement: true })
      }
      if (old < 2) {
        if (!db.objectStoreNames.contains('vrac'))
          db.createObjectStore('vrac', { keyPath: 'id' })
      }
      if (old < 3) {
        if (!db.objectStoreNames.contains('fragments'))
          db.createObjectStore('fragments', { keyPath: 'id' })
      }
      if (old < 4) {
        if (!db.objectStoreNames.contains('traces'))
          db.createObjectStore('traces', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('traceBlobs'))
          db.createObjectStore('traceBlobs', { keyPath: 'traceId' })
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

export async function restoreChapter(chapter) {
  if (!chapter || typeof chapter.id !== 'string' || !chapter.id) return false
  await openDB()
  return new Promise((resolve, reject) => {
    const req = tx('chapters', 'readwrite').put({
      ...chapter,
      restoredAt: new Date().toISOString(),
    })
    req.onsuccess = () => resolve(true)
    req.onerror   = (e) => reject(e.target.error)
  })
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

export async function getChatHistoryRecent(limit = 50) {
  await openDB()
  return new Promise((resolve) => {
    const results = []
    const req     = tx('chat').openCursor(null, 'prev')
    req.onsuccess = (e) => {
      const cursor = e.target.result
      if (cursor && results.length < limit) {
        results.unshift(cursor.value)
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
    req.onsuccess = (e) => resolve(e.target.result)
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

export async function deleteChatMessage(id) {
  if (id == null) return
  await openDB()
  return new Promise((resolve, reject) => {
    const req = tx('chat', 'readwrite').delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
}

// ─── Vrac ──────────────────────────────────────────────────────
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
    tag:       idea.tag       || 'idée',
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

// ─── Fragments ─────────────────────────────────────────────────
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

// ─── Traces — tiroir mémoire photo ─────────────────────────────
// Schéma trace    : { id, createdAt, updatedAt, ...metadata }
// Schéma traceBlob: { key: traceId, blob, mimeType }
//   keyPath réel en prod = 'key' (migration pré-T1 conservée, idempotente)

export async function getTraces() {
  await openDB()
  return new Promise((resolve) => {
    const req = tx('traces').getAll()
    req.onsuccess = () => resolve(
      (req.result || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    )
    req.onerror = () => resolve([])
  })
}

/**
 * Crée une nouvelle trace — id toujours auto-généré (jamais hérité de l'appelant).
 * Spreade l'intégralité du payload metadata (whyNow, status, mimeType, etc.)
 * avant de fixer les champs système (id, createdAt, updatedAt).
 */
export async function addTrace(trace) {
  await openDB()
  const item = {
    title:     trace?.title || '',
    date:      trace?.date  || new Date().toISOString().split('T')[0],
    ...trace,                                 // préserve tous les champs metadata
    id:        `tr_${Date.now()}`,            // toujours auto-généré — écrase tout id entrant
    createdAt: new Date().toISOString(),      // toujours serveur
    updatedAt: new Date().toISOString(),      // toujours serveur
  }
  return new Promise((resolve, reject) => {
    const req = tx('traces', 'readwrite').add(item)
    req.onsuccess = () => resolve(item)
    req.onerror   = (e) => reject(e.target.error)
  })
}

/** Met à jour une trace existante par merge de champs. */
export async function updateTrace(id, fields) {
  await openDB()
  return new Promise((resolve, reject) => {
    const getReq = tx('traces').get(id)
    getReq.onsuccess = () => {
      const item = getReq.result
      if (!item) return reject(new Error('Trace not found'))
      const putReq = tx('traces', 'readwrite').put({
        ...item, ...fields, updatedAt: new Date().toISOString(),
      })
      putReq.onsuccess = () => resolve()
      putReq.onerror   = (e) => reject(e.target.error)
    }
    getReq.onerror = (e) => reject(e.target.error)
  })
}

/** Upsert direct d'une trace (restore/import). */
export async function saveTrace(trace) {
  await openDB()
  return new Promise((resolve, reject) => {
    const req = tx('traces', 'readwrite').put({
      ...trace,
      updatedAt: new Date().toISOString(),
    })
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
}

export async function deleteTrace(id) {
  await openDB()
  return new Promise((resolve, reject) => {
    const req = tx('traces', 'readwrite').delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
}

/** Lecture blob — keyPath réel en prod = 'key', .get(traceId) cherche key === traceId. */
export async function getTraceBlob(traceId) {
  await openDB()
  return new Promise((resolve) => {
    const req = tx('traceBlobs').get(traceId)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror   = () => resolve(null)
  })
}

/** Alias de getTraceBlob (compatibilité interne). */
export async function loadTraceBlob(traceId) {
  return getTraceBlob(traceId)
}

/**
 * Sauvegarde un blob de trace.
 * keyPath du store en prod = 'key' (migration pré-T1 idempotente).
 * On passe { key: traceId, blob, mimeType } pour satisfaire ce keyPath.
 */
export async function saveTraceBlob(traceId, blob, mimeType) {
  await openDB()
  return new Promise((resolve, reject) => {
    const req = tx('traceBlobs', 'readwrite').put({ key: traceId, blob, mimeType })
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
}

/** Alias de saveTraceBlob — nom attendu par App.jsx. */
export async function putTraceBlob(traceId, blob, mimeType) {
  return saveTraceBlob(traceId, blob, mimeType)
}

export async function deleteTraceBlob(traceId) {
  await openDB()
  return new Promise((resolve, reject) => {
    const req = tx('traceBlobs', 'readwrite').delete(traceId)
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
}

// ─── Import snapshot (sync inter-appareils) ────────────────────
const KV_KEYS_SYNC = ['name','leaVoice','streak','sessions','lastSession','moodToday','moodValue','caroline_profile','lea_memory']

export function isValidSnapshot(data) {
  if (!data || typeof data !== 'object')              return false
  if (typeof data.version !== 'number')               return false
  if (!Array.isArray(data.chapters))                  return false
  if (!Array.isArray(data.vrac))                      return false
  if (data.chat != null && !Array.isArray(data.chat)) return false
  if (typeof data.kv !== 'object' || !data.kv)        return false
  if (data.syncedAt != null && (!data.syncedAt || isNaN(Date.parse(data.syncedAt)))) return false
  for (const ch of data.chapters) {
    if (typeof ch.id !== 'string' || !ch.id)          return false
  }
  return true
}

export async function importSnapshot(snapshot) {
  if (!isValidSnapshot(snapshot)) {
    console.error('[Sync] Snapshot invalide — import annulé', snapshot)
    return false
  }
  await openDB()

  await new Promise((resolve, reject) => {
    const req = tx('chapters', 'readwrite').clear()
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
  for (const ch of (snapshot.chapters || [])) {
    await saveChapter(ch)
  }

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

  for (const idea of (snapshot.vrac || [])) {
    await new Promise((resolve, reject) => {
      const req = tx('vrac', 'readwrite').put(idea)
      req.onsuccess = () => resolve()
      req.onerror   = (e) => reject(e.target.error)
    })
  }

  if (Array.isArray(snapshot.chat)) {
    await new Promise((resolve, reject) => {
      const req = tx('chat', 'readwrite').clear()
      req.onsuccess = () => resolve()
      req.onerror   = (e) => reject(e.target.error)
    })
    for (const msg of snapshot.chat.slice(-500)) {
      await new Promise((resolve, reject) => {
        const { id, ...rest } = msg
        const req = tx('chat', 'readwrite').add(rest)
        req.onsuccess = () => resolve()
        req.onerror   = (e) => reject(e.target.error)
      })
    }
  }

  await setKV('lastSyncedAt', snapshot.syncedAt || new Date().toISOString())
  return true
}

// ─── Export complet (modal export) ─────────────────────────────
export async function exportAllData() {
  const [chapters, name, streak, sessions, profile, vrac, chat, leaMemory] = await Promise.all([
    getChapters(),
    getKV('name',             ''),
    getKV('streak',           0),
    getKV('sessions',         0),
    getKV('caroline_profile', null),
    getVrac(),
    getChatHistoryRecent(500),
    getKV('lea_memory',       null),
  ])
  return {
    name, chapters, streak, sessions, profile, vrac,
    chat, leaMemory,
    exportedAt: new Date().toISOString(),
    version: 3,
  }
}

// ─── Backup local complet v4 (inclut traces) ───────────────────
export async function buildLocalBackup() {
  const [chapters, name, streak, sessions, profile, vrac, chat, leaMemory, traces] = await Promise.all([
    getChapters(),
    getKV('name',             ''),
    getKV('streak',           0),
    getKV('sessions',         0),
    getKV('caroline_profile', null),
    getVrac(),
    getChatHistoryRecent(500),
    getKV('lea_memory',       null),
    getTraces(),
  ])
  return {
    name, chapters, streak, sessions, profile, vrac,
    chat, leaMemory, traces,
    backedUpAt: new Date().toISOString(),
    version: 4,
  }
}

// ─── Estimation du stockage ─────────────────────────────────────
export async function getStorageEstimate() {
  if (!navigator.storage?.estimate) return null
  try {
    const e = await navigator.storage.estimate()
    return {
      usage: e.usage || 0,
      quota: e.quota || 0,
      ratio: e.quota ? (e.usage / e.quota) : 0,
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
