// ─── IndexedDB wrapper v5 ──────────────────────────────────────
const DB_NAME    = 'atelier_v3' // nom historique conservé — ne pas renommer, casserait les bases existantes
const DB_VERSION = 5            // v5 : fix keyPath traceBlobs + deleteTrace cascade atomique
// Lot C — voice memos cohabitent dans le store 'traceBlobs' v5 sous la clé
// composée `voicememo_${traceId}` : aucun schema change, pas de bump DB_VERSION.

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
      if (old < 5) {
        if (db.objectStoreNames.contains('traceBlobs')) {
          const upgradeStore = e.target.transaction.objectStore('traceBlobs')
          if (upgradeStore.keyPath !== 'key') {
            db.deleteObjectStore('traceBlobs')
            db.createObjectStore('traceBlobs', { keyPath: 'key' })
          }
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
  await new Promise((resolve, reject) => {
    const req = tx('chapters', 'readwrite').delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
  // Anti-résurrection sync — voir recordTombstone plus bas.
  await recordTombstone('deletedChapterIds', id)
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

export async function updateVrac(id, fields) {
  await openDB()
  return new Promise((resolve, reject) => {
    const txn   = _db.transaction(['vrac'], 'readwrite')
    const store = txn.objectStore('vrac')
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const item = getReq.result
      if (!item) { txn.abort(); return reject(new Error('Vrac item not found')) }
      store.put({ ...item, ...fields, updatedAt: new Date().toISOString() })
    }
    getReq.onerror   = (e) => reject(e.target.error)
    txn.oncomplete   = () => resolve()
    txn.onerror      = (e) => reject(e.target.error)
    txn.onabort      = ()  => reject(txn.error || new Error('updateVrac aborted'))
  })
}

export async function deleteVrac(id) {
  await openDB()
  await new Promise((resolve, reject) => {
    const req = tx('vrac', 'readwrite').delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
  // Anti-résurrection sync — voir recordTombstone plus bas.
  await recordTombstone('deletedVracIds', id)
}

// ─── Tombstones de suppression (anti-résurrection en sync multi-appareil) ──
// Liste bornée { id, deletedAt } stockée en kv — aucun nouveau store IDB,
// pas de bump DB_VERSION. Consommé par sync.js (mergeChapters / mergeById)
// pour qu'une suppression sur un appareil ne revive pas depuis un autre
// appareil qui n'a pas encore vu la suppression.
const TOMBSTONE_CAP = 300

async function recordTombstone(kvKey, id) {
  const list = await getKV(kvKey, [])
  const next = [
    ...(Array.isArray(list) ? list : []).filter(t => t?.id !== id),
    { id, deletedAt: new Date().toISOString() },
  ]
  await setKV(kvKey, next.slice(-TOMBSTONE_CAP))
}

// ─── Traces — tiroir mémoire photo ─────────────────────────────
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

export async function addTrace(trace) {
  await openDB()
  const item = {
    title:     trace?.title || '',
    date:      trace?.date  || new Date().toISOString().split('T')[0],
    ...trace,
    id:        `tr_${Date.now()}`,
    chapterId: trace?.chapterId ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  return new Promise((resolve, reject) => {
    const req = tx('traces', 'readwrite').add(item)
    req.onsuccess = () => resolve(item)
    req.onerror   = (e) => reject(e.target.error)
  })
}

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
  await new Promise((resolve, reject) => {
    const txn = _db.transaction(['traces', 'traceBlobs'], 'readwrite')
    txn.oncomplete = () => resolve()
    txn.onerror    = (e) => reject(e.target.error || txn.error)
    txn.onabort    = ()  => reject(txn.error || new Error('deleteTrace transaction aborted'))
    txn.objectStore('traces').delete(id)
    txn.objectStore('traceBlobs').delete(id)                  // photo
    txn.objectStore('traceBlobs').delete(voiceMemoKey(id))    // Lot C — cascade voicememo (no-op si absent)
  })
  try {
    const { deleteBlobFromDrive } = await import('./driveSync')
    await deleteBlobFromDrive(id)
  } catch {
    // Non connecté à Drive — silencieux
  }
}

export async function getTraceBlob(traceId) {
  await openDB()
  return new Promise((resolve) => {
    const req = tx('traceBlobs').get(traceId)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror   = () => resolve(null)
  })
}

export async function loadTraceBlob(traceId) {
  return getTraceBlob(traceId)
}

export async function saveTraceBlob(traceId, blob, mimeType) {
  await openDB()
  return new Promise((resolve, reject) => {
    const req = tx('traceBlobs', 'readwrite').put({ key: traceId, blob, mimeType })
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
}

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

// ─── Lot C — Voice memos (audio attaché a posteriori à une trace) ───
// Stockage : même store que les photos ('traceBlobs' v5, keyPath: 'key')
//            sous la clé composée `voicememo_${traceId}` → pas de migration.
// Cascade  : intégrée dans deleteTrace (transaction atomique avec photo).
// Export   : sérialisé dans buildLocalBackup avec kind='voicememo'.
// Import   : importSnapshot route via kind vers la bonne clé.
// Drive    : différé hors MVP (P1 verrouillé) — pas de sync cloud.

function voiceMemoKey(traceId) {
  return `voicememo_${traceId}`
}

export async function saveVoiceMemo(traceId, blob, mimeType = 'audio/webm') {
  if (!traceId || !blob) throw new Error('saveVoiceMemo: traceId et blob requis')
  await openDB()
  return new Promise((resolve, reject) => {
    const req = tx('traceBlobs', 'readwrite').put({
      key: voiceMemoKey(traceId),
      blob,
      mimeType,
    })
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
}

export async function getVoiceMemo(traceId) {
  if (!traceId) return null
  await openDB()
  return new Promise((resolve) => {
    const req = tx('traceBlobs').get(voiceMemoKey(traceId))
    req.onsuccess = () => resolve(req.result || null)
    req.onerror   = () => resolve(null)
  })
}

export async function deleteVoiceMemo(traceId) {
  if (!traceId) return
  await openDB()
  return new Promise((resolve, reject) => {
    const req = tx('traceBlobs', 'readwrite').delete(voiceMemoKey(traceId))
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
}

// ─── T8.4a — Helpers blob ↔ base64 ─────────────────────────────
// Locaux à db.js : pas d'import depuis driveSync.js pour préserver la
// séparation des contextes (local vs cloud). 30 lignes dupliquées
// acceptables vs un couplage cross-module.

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      // reader.result = "data:<mime>;base64,<base64>" → on extrait le base64.
      const dataUrl = String(reader.result || '')
      const idx     = dataUrl.indexOf(',')
      resolve(idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl)
    }
    reader.onerror = () => reject(reader.error || new Error('blobToBase64 read failed'))
    reader.readAsDataURL(blob)
  })
}

function base64ToBlob(b64, mimeType) {
  const bin = atob(b64)
  const len = bin.length
  const arr = new Uint8Array(len)
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mimeType || 'application/octet-stream' })
}

// ─── Import snapshot (sync inter-appareils) ────────────────────
const KV_KEYS_SYNC = ['name','leaVoice','streak','sessions','lastSession','moodToday','moodValue','caroline_profile','lea_memory','deletedChapterIds','deletedVracIds']

export function isValidSnapshot(data) {
  if (!data || typeof data !== 'object')              return false
  if (typeof data.version !== 'number')               return false
  if (!Array.isArray(data.chapters))                  return false
  if (!Array.isArray(data.vrac))                      return false
  if (data.chat != null && !Array.isArray(data.chat)) return false
  if (typeof data.kv !== 'object' || !data.kv)        return false
  if (data.syncedAt != null && (!data.syncedAt || isNaN(Date.parse(data.syncedAt)))) return false
  // T8.4a — traces / traceBlobs optionnels (array si présents)
  if (data.traces     != null && !Array.isArray(data.traces))     return false
  if (data.traceBlobs != null && !Array.isArray(data.traceBlobs)) return false
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

  // ── 1) Pré-décodage base64 des traceBlobs HORS transaction ──
  // atob est synchrone : on évite de retenir une transaction IDB
  // pendant un décodage potentiellement coûteux sur plusieurs blobs.
  // En cas d'échec de décodage, on logge et on poursuit avec les blobs valides.
  //
  // Lot C — chaque entrée a un champ optionnel `kind` :
  //   - 'voicememo' → clé IDB = voicememo_${traceId} + mimeType audio par défaut
  //   - 'photo' (ou absent, rétro-compat snapshots v3-v5) → clé IDB = traceId
  //                                                       + mimeType image par défaut
  const decodedBlobs = []
  if (Array.isArray(snapshot.traceBlobs)) {
    for (const entry of snapshot.traceBlobs) {
      if (!entry?.traceId || !entry?.base64) continue
      const isVoicememo = entry.kind === 'voicememo'
      const key         = isVoicememo ? voiceMemoKey(entry.traceId) : entry.traceId
      const defaultMime = isVoicememo ? 'audio/webm' : 'image/jpeg'
      try {
        const blob = base64ToBlob(entry.base64, entry.mimeType || defaultMime)
        decodedBlobs.push({
          key,
          blob,
          mimeType: entry.mimeType || defaultMime,
        })
      } catch (e) {
        console.warn('[Import] base64 decode failed for trace', entry.traceId, entry.kind || 'photo', e?.message)
      }
    }
  }

  // ── 2) T9 — Transaction UNIQUE sur tous les stores impactés ──
  // Atomicité IDB garantie par construction : si la transaction abort
  // (erreur, crash, fermeture onglet), AUCUN store n'est modifié.
  // Plus de risque d'état partiel "chapters importé, traces pas encore".
  const now          = new Date().toISOString()
  const lastSyncedAt = snapshot.syncedAt || now
  const importChat   = Array.isArray(snapshot.chat)
  const importTraces = Array.isArray(snapshot.traces)
  // TraceBlobs : on ne clear que si l'array est non vide ET qu'on a
  // au moins un blob décodable → préserve les blobs locaux quand le
  // snapshot vient du sync Worker (metadata-only).
  const importBlobs  =
    Array.isArray(snapshot.traceBlobs) &&
    snapshot.traceBlobs.length > 0 &&
    decodedBlobs.length        > 0

  await new Promise((resolve, reject) => {
    const STORES = ['chapters', 'vrac', 'kv', 'chat', 'traces', 'traceBlobs']
    const txn    = _db.transaction(STORES, 'readwrite')
    txn.oncomplete = () => resolve()
    txn.onerror    = (e) => reject(e.target.error)
    txn.onabort    = ()  => reject(txn.error || new Error('importSnapshot aborted'))

    // — Chapters : clear + put N (avec updatedAt rafraîchi)
    const chaptersStore = txn.objectStore('chapters')
    chaptersStore.clear()
    for (const ch of (snapshot.chapters || [])) {
      chaptersStore.put({ ...ch, updatedAt: now })
    }

    // — Vrac : clear + put N
    const vracStore = txn.objectStore('vrac')
    vracStore.clear()
    for (const idea of (snapshot.vrac || [])) {
      vracStore.put(idea)
    }

    // — KV : merge sélectif (PAS de clear → autres clés préservées)
    //   + lastSyncedAt dans la même transaction (atomique avec le reste)
    const kvStore = txn.objectStore('kv')
    const kv      = snapshot.kv || {}
    for (const [key, value] of Object.entries(kv)) {
      if (KV_KEYS_SYNC.includes(key) && value !== undefined) {
        kvStore.put({ key, value })
      }
    }
    kvStore.put({ key: 'lastSyncedAt', value: lastSyncedAt })

    // — Chat : clear + put/add si array présent
    //   #26 : si msg.id présent → put (préserve l'id, pas de référence cassée)
    //         sinon → add (auto-increment pour vieux snapshots)
    if (importChat) {
      const chatStore = txn.objectStore('chat')
      chatStore.clear()
      for (const msg of snapshot.chat.slice(-500)) {
        if (msg.id != null) {
          chatStore.put(msg)
        } else {
          const { id: _dropped, ...rest } = msg
          chatStore.add(rest)
        }
      }
    }

    // — Traces : clear + put N si array présent
    if (importTraces) {
      const tracesStore = txn.objectStore('traces')
      tracesStore.clear()
      for (const tr of snapshot.traces) {
        if (tr?.id) tracesStore.put(tr)
      }
    }

    // — TraceBlobs : clear + put N uniquement si array non vide (v5+)
    if (importBlobs) {
      const blobsStore = txn.objectStore('traceBlobs')
      blobsStore.clear()
      for (const item of decodedBlobs) {
        blobsStore.put(item)
      }
    }
  })

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

/**
 * T8.4a — Backup local complet : inclut les blobs des traces en base64.
 * Lot C — inclut aussi les voice memos (kind: 'voicememo') si présents.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.includeBlobs=true] — si false, retourne v4 metadata only.
 * @returns {Promise<object>} snapshot prêt à sérialiser en JSON.
 *
 * Format de sortie traceBlobs[] :
 *   { traceId, base64, mimeType, kind: 'photo' | 'voicememo' }
 * Rétro-compat lecture : un snapshot v5 sans `kind` est interprété comme 'photo'
 * par importSnapshot (voir branche isVoicememo).
 *
 * Coût taille : +33 % par blob (base64 vs binaire). Pour Caroline (< 100 photos
 * + voicememos ≤ 2 min chacun), reste sous les 100 MB — acceptable car export rare.
 * Note : pour de très gros volumes futurs, envisager CompressionStream natif.
 */
export async function buildLocalBackup({ includeBlobs = true } = {}) {
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

  const traceBlobs = []
  if (includeBlobs && Array.isArray(traces) && traces.length > 0) {
    for (const tr of traces) {
      // — Photo
      try {
        const entry = await getTraceBlob(tr.id)
        if (entry?.blob) {
          const b64 = await blobToBase64(entry.blob)
          traceBlobs.push({
            traceId:  tr.id,
            base64:   b64,
            mimeType: entry.mimeType || 'image/jpeg',
            kind:     'photo',
          })
        }
      } catch (e) {
        console.warn('[Backup] photo encoding failed for trace', tr.id, e?.message)
      }
      // — Voice memo (Lot C) — silencieusement vide si la trace n'en a pas
      try {
        const memo = await getVoiceMemo(tr.id)
        if (memo?.blob) {
          const b64 = await blobToBase64(memo.blob)
          traceBlobs.push({
            traceId:  tr.id,
            base64:   b64,
            mimeType: memo.mimeType || 'audio/webm',
            kind:     'voicememo',
          })
        }
      } catch (e) {
        console.warn('[Backup] voicememo encoding failed for trace', tr.id, e?.message)
      }
    }
  }

  return {
    name, chapters, streak, sessions, profile, vrac,
    chat, leaMemory, traces, traceBlobs,
    backedUpAt: new Date().toISOString(),
    // v6 : ajout du champ `kind` sur les entrées traceBlobs[].
    //      Rétro-compat lecture des v3-v5 garantie par importSnapshot.
    version: includeBlobs ? 6 : 4,
  }
}

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

export async function resetAllData() {
  if (_db) { _db.close(); _db = null }
  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror   = (e) => reject(e.target.error)
  })
}
