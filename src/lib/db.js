// ─── IndexedDB wrapper v5 ──────────────────────────────────────
const DB_NAME    = 'atelier_v3' // nom historique conservé — ne pas renommer, casserait les bases existantes
const DB_VERSION = 5            // v5 : fix keyPath traceBlobs + deleteTrace cascade atomique

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
        // Store fragments conservé en DB pour compatibilité des bases existantes
        // mais les fonctions JS sont supprimées (feature abandonnée).
        if (!db.objectStoreNames.contains('fragments'))
          db.createObjectStore('fragments', { keyPath: 'id' })
      }
      if (old < 4) {
        if (!db.objectStoreNames.contains('traces'))
          db.createObjectStore('traces', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('traceBlobs'))
          db.createObjectStore('traceBlobs', { keyPath: 'traceId' })
      }
      if (old < 5) {
        // Corrige le keyPath traceBlobs : 'traceId' (v4 nouvelles installs) → 'key' (prod)
        // En prod le store a déjà keyPath='key' → on ne touche pas, blobs préservés.
        // Sur nouvelles installs (keyPath='traceId') → recréation propre (aucun blob à perdre).
        if (db.objectStoreNames.contains('traceBlobs')) {
          const upgradeStore = e.target.transaction.objectStore('traceBlobs')
          if (upgradeStore.keyPath !== 'key') {
            db.deleteObjectStore('traceBlobs')
            db.createObjectStore('traceBlobs', { keyPath: 'key' })
          }
          // si keyPath === 'key' déjà : rien à faire
        } else {
          db.createObjectStore('traceBlobs', { keyPath: 'key' })
        }
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

// fix(audit) #1 — transaction atomique : get + put dans la même IDBTransaction
export async function updateVrac(id, fields) {
  await openDB()
  return new Promise((resolve, reject) => {
    const txn   = _db.transaction(['vrac'], 'readwrite')
    const store = txn.objectStore('vrac')
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const item = getReq.result
      if (!item) { txn.abort(); return reject(new Error('Vrac item not found')) }
      store.put({ ...item, ...fields })
    }
    getReq.onerror   = (e) => reject(e.target.error)
    txn.oncomplete   = () => resolve()
    txn.onerror      = (e) => reject(e.target.error)
    txn.onabort      = ()  => reject(txn.error || new Error('updateVrac aborted'))
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

// ─── Traces — tiroir mémoire photo ─────────────────────────────
// Schéma trace    : { id, createdAt, updatedAt, ...metadata }
// Schéma traceBlob: { key: traceId, blob, mimeType }
//   keyPath réel en prod = 'key' (migration v5 idempotente)

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

// fix(audit) #1 — transaction atomique : get + put dans la même IDBTransaction
export async function updateTrace(id, fields) {
  await openDB()
  return new Promise((resolve, reject) => {
    const txn   = _db.transaction(['traces'], 'readwrite')
    const store = txn.objectStore('traces')
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const item = getReq.result
      if (!item) { txn.abort(); return reject(new Error('Trace not found')) }
      store.put({ ...item, ...fields, updatedAt: new Date().toISOString() })
    }
    getReq.onerror   = (e) => reject(e.target.error)
    txn.oncomplete   = () => resolve()
    txn.onerror      = (e) => reject(e.target.error)
    txn.onabort      = ()  => reject(txn.error || new Error('updateTrace aborted'))
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

/**
 * Suppression atomique : traces + traceBlobs en une seule transaction.
 * oncomplete = les deux deletes ont réussi.
 * onerror / onabort = rejet avec l'erreur IDB réelle.
 */
export async function deleteTrace(id) {
  await openDB()
  return new Promise((resolve, reject) => {
    const txn = _db.transaction(['traces', 'traceBlobs'], 'readwrite')
    txn.oncomplete = () => resolve()
    txn.onerror    = (e) => reject(e.target.error || txn.error)
    txn.onabort    = ()  => reject(txn.error || new Error('deleteTrace transaction aborted'))
    txn.objectStore('traces').delete(id)
    txn.objectStore('traceBlobs').delete(id)
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
 * keyPath du store en prod = 'key' (migration v5 idempotente).
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

// fix(audit) #2 — transactions groupées : tous les put lancés sans await intermédiaire,
// résolution via txn.oncomplete. Réduit ~500 aller-retours IDB séquentiels à 1 passe/store.
export async function importSnapshot(snapshot) {
  if (!isValidSnapshot(snapshot)) {
    console.error('[Sync] Snapshot invalide — import annulé', snapshot)
    return false
  }
  await openDB()

  // 1. Clear + import chapitres en une transaction groupée
  await new Promise((resolve, reject) => {
    const txn   = _db.transaction(['chapters'], 'readwrite')
    const store = txn.objectStore('chapters')
    txn.oncomplete = () => resolve()
    txn.onerror    = (e) => reject(e.target.error)
    txn.onabort    = ()  => reject(txn.error || new Error('chapters import aborted'))
    store.clear()
    const now = new Date().toISOString()
    for (const ch of (snapshot.chapters || [])) {
      store.put({ ...ch, updatedAt: now })
    }
  })

  // 2. Clear + import vrac en une transaction groupée
  await new Promise((resolve, reject) => {
    const txn   = _db.transaction(['vrac'], 'readwrite')
    const store = txn.objectStore('vrac')
    txn.oncomplete = () => resolve()
    txn.onerror    = (e) => reject(e.target.error)
    txn.onabort    = ()  => reject(txn.error || new Error('vrac import aborted'))
    store.clear()
    for (const idea of (snapshot.vrac || [])) {
      store.put(idea)
    }
  })

  // 3. KV keys — séquentiel acceptable (≤10 clés fixes)
  const kv = snapshot.kv || {}
  for (const [key, value] of Object.entries(kv)) {
    if (KV_KEYS_SYNC.includes(key) && value !== undefined) {
      await setKV(key, value)
    }
  }

  // 4. Chat — clear + import en une transaction groupée (potentiellement 500 messages)
  if (Array.isArray(snapshot.chat)) {
    await new Promise((resolve, reject) => {
      const txn   = _db.transaction(['chat'], 'readwrite')
      const store = txn.objectStore('chat')
      txn.oncomplete = () => resolve()
      txn.onerror    = (e) => reject(e.target.error)
      txn.onabort    = ()  => reject(txn.error || new Error('chat import aborted'))
      store.clear()
      for (const msg of snapshot.chat.slice(-500)) {
        const { id, ...rest } = msg
        store.add(rest)
      }
    })
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
