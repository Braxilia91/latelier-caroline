/**
 * tests/sync.test.js — Vitest
 *
 * 5 chemins critiques de sync.js (error paths)
 * Signature réelle : pushSnapshot({ token, snapshot }) / pullSnapshot({ token })
 *
 * Run : npx vitest run --reporter=verbose
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { pushSnapshot, pullSnapshot } from '../src/lib/sync'

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
