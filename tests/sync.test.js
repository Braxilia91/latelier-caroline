/**
 * tests/sync.test.js — Vitest
 *
 * 5 chemins critiques de sync.js (error paths)
 * Signature réelle : pushSnapshot({ token, snapshot }) / pullSnapshot({ token })
 *
 * Run : npx vitest run --reporter=verbose
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { pushSnapshot, pullSnapshot, mergeChapters, mergeById, mergeTombstones } from '../src/lib/sync'

beforeEach(() => {
  vi.restoreAllMocks()
  // Par défaut : en ligne
  Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
})

describe('sync — chemins d\'erreur critiques', () => {

  // ── 1. Token incorrect (HMAC secret changé côté Worker) ────────
  it('401 → message token incorrect', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false, status: 401,
      json: () => Promise.resolve({}),
    })
    await expect(
      pushSnapshot({
        token: 'token-valide-vingt-chars-ok',
        snapshot: { syncedAt: new Date().toISOString(), version: 2, chapters: [], vrac: [], kv: {} },
      })
    ).rejects.toThrow('Mot secret incorrect')
  })

  // ── 2. Hors-ligne + fetch throw → message offline ──────────────
  it('fetch throw + offline → message connexion internet', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(
      pushSnapshot({ token: 'token-valide-vingt-chars-ok', snapshot: {} })
    ).rejects.toThrow('Pas de connexion internet')
  })

  // ── 3. En ligne + fetch throw → Worker down (pas offline) ──────
  it('fetch throw + online → message service temporairement indisponible', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(
      pushSnapshot({ token: 'token-valide-vingt-chars-ok', snapshot: {} })
    ).rejects.toThrow('temporairement indisponible')
  })

  // ── 4. HTTP 503 → message service indisponible ─────────────────
  it('503 HTTP push → message service indisponible', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false, status: 503,
      json: () => Promise.resolve({}),
    })
    await expect(
      pushSnapshot({
        token: 'token-valide-vingt-chars-ok',
        snapshot: { syncedAt: new Date().toISOString(), version: 2, chapters: [], vrac: [], kv: {} },
      })
    ).rejects.toThrow('temporairement indisponible')
  })

  // ── 5. pullSnapshot hors-ligne ────────────────────────────────
  it('pullSnapshot offline → message connexion internet', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    vi.spyOn(global, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(
      pullSnapshot({ token: 'token-valide-vingt-chars-ok' })
    ).rejects.toThrow('Pas de connexion internet')
  })

})

describe('mergeChapters / mergeById — anti-écrasement multi-appareil', () => {

  // ── PC édite chapitre A, smartphone édite chapitre B → les deux survivent ──
  it('deux chapitres différents modifiés en parallèle → aucun perdu', () => {
    const local  = [{ id: 'A', title: 'A', content: 'A modifié PC',  updatedAt: '2026-01-01T10:00:00Z' }]
    const remote = [{ id: 'B', title: 'B', content: 'B modifié tel', updatedAt: '2026-01-01T09:00:00Z' }]
    const result = mergeChapters({ local, remote })
    expect(result.map(c => c.id).sort()).toEqual(['A', 'B'])
  })

  // ── Même chapitre modifié des deux côtés avec un contenu différent ──────
  it('même chapitre, contenu différent → les deux versions survivent (copie)', () => {
    const local  = [{ id: 'X', title: 'Chap 1', content: 'Version PC',  updatedAt: '2026-01-01T12:00:00Z' }]
    const remote = [{ id: 'X', title: 'Chap 1', content: 'Version tel', updatedAt: '2026-01-01T09:00:00Z' }]
    const result = mergeChapters({ local, remote })
    expect(result).toHaveLength(2)
    const winner = result.find(c => c.id === 'X')
    const copy   = result.find(c => c.id !== 'X')
    expect(winner.content).toBe('Version PC')       // le plus récent garde l'id
    expect(copy.content).toBe('Version tel')         // rien n'est perdu
    expect(copy.title).toContain('copie à vérifier')
  })

  // ── Même chapitre, même contenu (juste un timestamp différent) → pas de doublon ──
  it('même chapitre, même contenu → pas de copie créée', () => {
    const local  = [{ id: 'X', title: 'Chap 1', content: 'Identique', updatedAt: '2026-01-01T12:00:00Z' }]
    const remote = [{ id: 'X', title: 'Chap 1', content: 'Identique', updatedAt: '2026-01-01T09:00:00Z' }]
    const result = mergeChapters({ local, remote })
    expect(result).toHaveLength(1)
  })

  // ── Suppression sur un appareil ne doit pas ressusciter depuis l'autre ──
  it('chapitre supprimé localement, absent du distant → pas de résurrection', () => {
    const local  = [] // supprimé ici
    const remote = [{ id: 'X', title: 'Chap 1', content: 'ancienne version', updatedAt: '2026-01-01T08:00:00Z' }]
    const localDeleted = [{ id: 'X', deletedAt: '2026-01-01T12:00:00Z' }] // suppression postérieure à l'édition distante
    const result = mergeChapters({ local, remote, localDeleted })
    expect(result).toHaveLength(0)
  })

  // ── Sauf si l'autre appareil a édité APRÈS la suppression → l'édition l'emporte ──
  it('chapitre supprimé puis réédité ailleurs après coup → l\'édition survit', () => {
    const local  = []
    const remote = [{ id: 'X', title: 'Chap 1', content: 'édité après suppression', updatedAt: '2026-01-01T15:00:00Z' }]
    const localDeleted = [{ id: 'X', deletedAt: '2026-01-01T12:00:00Z' }]
    const result = mergeChapters({ local, remote, localDeleted })
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('édité après suppression')
  })

  // ── mergeById générique (vrac) — même logique, tombstone-aware ──────────
  it('mergeById (vrac) : idée supprimée sur un appareil ne revient pas', () => {
    const local  = [{ id: 'v1', text: 'idée gardée', createdAt: '2026-01-01T08:00:00Z' }]
    const remote = [
      { id: 'v1', text: 'idée gardée', createdAt: '2026-01-01T08:00:00Z' },
      { id: 'v2', text: 'idée supprimée sur PC', createdAt: '2026-01-01T08:00:00Z' },
    ]
    const localDeleted = [{ id: 'v2', deletedAt: '2026-01-01T09:00:00Z' }]
    const result = mergeById({ local, remote, localDeleted, contentKeys: ['text'] })
    expect(result.map(v => v.id).sort()).toEqual(['v1'])
  })

  it('mergeTombstones : dédoublonne par id, garde la suppression la plus récente', () => {
    const a = [{ id: 'X', deletedAt: '2026-01-01T08:00:00Z' }]
    const b = [{ id: 'X', deletedAt: '2026-01-01T12:00:00Z' }, { id: 'Y', deletedAt: '2026-01-01T09:00:00Z' }]
    const result = mergeTombstones(a, b)
    expect(result).toHaveLength(2)
    expect(result.find(t => t.id === 'X').deletedAt).toBe('2026-01-01T12:00:00Z')
  })

})
