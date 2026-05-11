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

/**
 * Restaure un chapitre supprimé — wrapper safe sur saveChapter.
 * Utilisé par le toast undo après removeChapter.
 */
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
    // LOT 4C.2 — retourne l'id auto-incrémenté pour permettre la suppression unitaire
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

// LOT 4C.2 — Suppression d'un message individuel par id auto-incrémenté
export async function deleteChatMessage(id) {
  if (id == null) return
  await openDB()
  return new Promise((resolve, reject) => {
    const req = tx('chat', 'readwrite').delete(id)
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
  // chat est optionnel pour rétrocompatibilité (anciens snapshots)
  if (data.chat != null && !Array.isArray(data.chat)) return false
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
 * LOT 4F.1 — Convertit un export "ancien format" en snapshot moderne v3.
 * Détecte les exports minimaux antérieurs (sans `version`, avec `vracIdeas` ou `vrac`).
 * Retourne le snapshot moderne si conversion possible, sinon retourne l'input tel quel
 * (laisse isValidSnapshot rejeter si vraiment invalide).
 */
function normalizeLegacyExport(data) {
  if (!data || typeof data !== 'object') return data
  // Déjà au format moderne (version présente)
  if (typeof data.version === 'number') return data
  // Détection legacy : chapters[] + (vracIdeas[] ou vrac[]) sans version
  if (Array.isArray(data.chapters) && (Array.isArray(data.vracIdeas) || Array.isArray(data.vrac))) {
    const vracSrc = Array.isArray(data.vracIdeas) ? data.vracIdeas : data.vrac
    return {
      version: 3,
      syncedAt: data.exportedAt || new Date().toISOString(),
      chapters: data.chapters,
      vrac: (vracSrc || []).map(v => ({
        id:        v.id        || `vrac_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        text:      v.text      || '',
        tag:       v.tag       || 'idée',
        chapterId: v.chapterId ?? null,
        used:      !!v.used,
        createdAt: v.createdAt || new Date().toISOString(),
      })),
      chat: [],
      kv: {
        name: data.name || '',
      },
    }
  }
  return data
}

/**
 * Écrase les données locales avec un snapshot distant.
 * Retourne false si le snapshot est invalide — jamais de corruption silencieuse.
 * Les clés sensibles (apiKey, openAiKey) ne sont jamais remplacées.
 * NB : le store 'fragments' n'est pas inclus dans le snapshot pour l'instant
 * (sera ajouté dans une livraison ultérieure quand le format sera stabilisé).
 *
 * LOT 4F.1 — Tolère les anciens exports JSON via normalizeLegacyExport.
 */
export async function importSnapshot(snapshot) {
  const data = normalizeLegacyExport(snapshot)
  if (!isValidSnapshot(data)) {
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
  for (const ch of (data.chapters || [])) {
    await saveChapter(ch)
  }

  // ── Vrac ─────────────────────────────────────────────────────
  await new Promise((resolve, reject) => {
    const req = tx('vrac', 'readwrite').clear()
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
  const kv = data.kv || {}
  for (const [key, value] of Object.entries(kv)) {
    if (KV_KEYS_SYNC.includes(key) && value !== undefined) {
      await setKV(key, value)
    }
  }

  // ── Vrac items ───────────────────────────────────────────────
  for (const idea of (data.vrac || [])) {
    await new Promise((resolve, reject) => {
      const req = tx('vrac', 'readwrite').put(idea)
      req.onsuccess = () => resolve()
      req.onerror   = (e) => reject(e.target.error)
    })
  }

  // ── Chat history (sync) ─────────────────────────────────────
  // Si le snapshot contient chat, on remplace l'historique local par le distant
  // (last-write-wins par snapshot, pas par message — simple et lisible)
  if (Array.isArray(data.chat)) {
    await new Promise((resolve, reject) => {
      const req = tx('chat', 'readwrite').clear()
      req.onsuccess = () => resolve()
      req.onerror   = (e) => reject(e.target.error)
    })
    for (const msg of data.chat.slice(-500)) {
      await new Promise((resolve, reject) => {
        // On laisse IndexedDB générer l'id auto-incrémenté
        const { id, ...rest } = msg
        const req = tx('chat', 'readwrite').add(rest)
        req.onsuccess = () => resolve()
        req.onerror   = (e) => reject(e.target.error)
      })
    }
  }

  // Marquer le moment du dernier import
  await setKV('lastSyncedAt', data.syncedAt || new Date().toISOString())
  return true
}

// ─── Export complet ─────────────────────────────────────────────
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

// ─── LOT 4F.1 — Sauvegarde locale complète au format importable ───
/**
 * Construit un snapshot complet de l'app au MÊME format que `importSnapshot` attend.
 * = ce qu'on exporte peut être réimporté tel quel, sans conversion.
 *
 * Inclut : chapitres, vrac, chat (500 derniers), KV non-sensible.
 * Exclut : apiKey, openAiKey (sécurité).
 */
export async function buildLocalBackup() {
  const [
    chapters, vrac, chat,
    name, leaVoice, streak, sessions, lastSession, moodToday, moodValue,
    profile, leaMemory, lastSyncedAt,
  ] = await Promise.all([
    getChapters(),
    getVrac(),
    getChatHistoryRecent(500),
    getKV('name',             ''),
    getKV('leaVoice',         'nova'),
    getKV('streak',           0),
    getKV('sessions',         0),
    getKV('lastSession',      ''),
    getKV('moodToday',        ''),
    getKV('moodValue',        ''),
    getKV('caroline_profile', null),
    getKV('lea_memory',       null),
    getKV('lastSyncedAt',     null),
  ])
  return {
    version:  3,
    syncedAt: new Date().toISOString(),
    chapters,
    vrac,
    chat,
    kv: {
      name,
      leaVoice,
      streak,
      sessions,
      lastSession,
      moodToday,
      moodValue,
      caroline_profile: profile,
      lea_memory:       leaMemory,
      lastSyncedAt,
    },
  }
}

// ─── Estimation du stockage ─────────────────────────────────────
/**
 * Estime le quota IndexedDB utilisé.
 * Retourne { usage, quota, ratio } ou null si non supporté.
 */
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
