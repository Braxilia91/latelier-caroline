// ─── Minimal IndexedDB wrapper ────────────────────────────────
const DB_NAME = 'atelier_v3'
const DB_VERSION = 1

let _db = null

async function openDB() {
  if (_db) return _db
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('kv'))
        db.createObjectStore('kv', { keyPath: 'key' })
      if (!db.objectStoreNames.contains('chapters'))
        db.createObjectStore('chapters', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('chat'))
        db.createObjectStore('chat', { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess  = (e) => { _db = e.target.result; resolve(_db) }
    req.onerror    = (e) => reject(e.target.error)
    req.onblocked  = ()  => reject(new Error('DB blocked'))
  })
}

function tx(storeName, mode = 'readonly') {
  return _db.transaction([storeName], mode).objectStore(storeName)
}

// ─── KV store (settings, preferences) ─────────────────────────
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
    req.onerror   = () => resolve([])
  })
}

export async function saveChapter(chapter) {
  await openDB()
  return new Promise((resolve, reject) => {
    const req = tx('chapters', 'readwrite').put({
      ...chapter,
      updatedAt: new Date().toISOString()
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

// ─── Chat history ──────────────────────────────────────────────
export async function getChatHistory() {
  await openDB()
  return new Promise((resolve) => {
    const req = tx('chat').getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror   = () => resolve([])
  })
}

export async function addChatMessage(msg) {
  await openDB()
  return new Promise((resolve, reject) => {
    const req = tx('chat', 'readwrite').add({
      ...msg,
      timestamp: new Date().toISOString()
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

// ─── Export all data ────────────────────────────────────────────
export async function exportAllData() {
  const chapters = await getChapters()
  const name     = await getKV('name', '')
  const streak   = await getKV('streak', 0)
  const sessions = await getKV('sessions', 0)
  return { name, chapters, streak, sessions, exportedAt: new Date().toISOString() }
}

// ─── Reset ─────────────────────────────────────────────────────
export async function resetAllData() {
  if (_db) { _db.close(); _db = null }
  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
}

// ─── PIN ────────────────────────────────────────────────────────
export async function getPinHash() { return getKV('pin_hash', null) }
export async function setPinHash(hash) { return setKV('pin_hash', hash) }
