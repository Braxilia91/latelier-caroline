/**
 * tests/offline-local.test.js — Vitest
 *
 * Prouve l'invariant local-first : une écriture dans IndexedDB survit à un
 * "reload" (re-import du module db.js, comme un rechargement de page) sans
 * dépendre du réseau ni du Worker de sync. db.js n'importe jamais fetch/sync —
 * ce test vérifie le comportement réel, pas juste l'absence d'appel réseau.
 *
 * fake-indexeddb fournit le backend IndexedDB en Node (jsdom n'en a pas).
 */
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('offline / reload — persistance locale sans réseau', () => {

  // Un seul backend IndexedDB partagé entre les deux tests de ce fichier
  // (fake-indexeddb ne se réinitialise pas tout seul, comme un vrai
  // navigateur ne vide pas IndexedDB entre deux rechargements de page).
  // Chaque test utilise un id de chapitre distinct pour rester indépendant.
  beforeEach(() => {
    vi.resetModules()
  })

  it('un chapitre écrit localement est toujours là après un reload simulé', async () => {
    // ── 1. Premier "chargement de page" : écriture locale ────────
    const db1 = await import('../src/lib/db')
    await db1.saveChapter({ id: 'ch1', title: 'Mon chapitre', content: 'Texte écrit hors-ligne' })

    const afterWrite = await db1.getChapters()
    expect(afterWrite).toHaveLength(1)
    expect(afterWrite[0].content).toBe('Texte écrit hors-ligne')

    // ── 2. "Reload" : nouveau module db.js (nouvelle instance _db en mémoire),
    //      même backend IndexedDB physique (fake-indexeddb persiste le
    //      IDBFactory global, comme un vrai navigateur persiste le disque).
    vi.resetModules()
    const db2 = await import('../src/lib/db')

    const afterReload = await db2.getChapters()
    expect(afterReload).toHaveLength(1)
    expect(afterReload[0].id).toBe('ch1')
    expect(afterReload[0].content).toBe('Texte écrit hors-ligne')
  })

  it('deleteChapter marque un tombstone que le prochain sync doit voir après reload', async () => {
    const db1 = await import('../src/lib/db')
    await db1.saveChapter({ id: 'ch2', title: 'À supprimer', content: '...' })
    await db1.deleteChapter('ch2')

    vi.resetModules()
    const db2 = await import('../src/lib/db')

    const chapters = await db2.getChapters()
    expect(chapters.find(c => c.id === 'ch2')).toBeUndefined()

    const tombstones = await db2.getKV('deletedChapterIds', [])
    expect(tombstones.some(t => t.id === 'ch2')).toBe(true)
  })

})
