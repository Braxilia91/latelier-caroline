/**
 * tests/db.test.js — Vitest
 *
 * Tests sur isValidSnapshot — guard critique qui protège les données
 * de Caroline contre la corruption KV lors d'un import distant.
 *
 * Signature réelle (db.js) :
 *   isValidSnapshot(data) : boolean
 *   Requis : { version: number, chapters: array, vrac: array, kv: object }
 *   Optionnel : syncedAt (ISO string parseable si présent)
 */
import { describe, it, expect } from 'vitest'
import { isValidSnapshot } from '../src/lib/db'

// Snapshot minimal valide (base de référence pour les mutations)
const VALID = {
  version:  2,
  chapters: [],
  vrac:     [],
  kv:       {},
  syncedAt: '2026-05-05T21:00:00.000Z',
}

describe('isValidSnapshot', () => {

  // ── Cas valides ────────────────────────────────────────────────
  it('accepte un snapshot complet valide', () => {
    expect(isValidSnapshot(VALID)).toBe(true)
  })

  it('accepte sans syncedAt (champ optionnel)', () => {
    const { syncedAt: _omit, ...noDate } = VALID
    expect(isValidSnapshot(noDate)).toBe(true)
  })

  it('accepte des chapitres avec id string non-vide', () => {
    expect(isValidSnapshot({
      ...VALID,
      chapters: [{ id: 'ch_1234', title: 'Chapitre 1', content: '' }],
    })).toBe(true)
  })

  // ── Cas rejetés — champs manquants ────────────────────────────
  it('rejette null', () => {
    expect(isValidSnapshot(null)).toBe(false)
  })

  it('rejette undefined', () => {
    expect(isValidSnapshot(undefined)).toBe(false)
  })

  it('rejette sans version', () => {
    const { version: _omit, ...noVersion } = VALID
    expect(isValidSnapshot(noVersion)).toBe(false)
  })

  it('rejette version string (doit être number)', () => {
    expect(isValidSnapshot({ ...VALID, version: '2' })).toBe(false)
  })

  it('rejette sans chapters', () => {
    const { chapters: _omit, ...noChapters } = VALID
    expect(isValidSnapshot(noChapters)).toBe(false)
  })

  it('rejette chapters non-array (objet)', () => {
    expect(isValidSnapshot({ ...VALID, chapters: {} })).toBe(false)
  })

  it('rejette sans vrac', () => {
    const { vrac: _omit, ...noVrac } = VALID
    expect(isValidSnapshot(noVrac)).toBe(false)
  })

  it('rejette sans kv', () => {
    const { kv: _omit, ...noKv } = VALID
    expect(isValidSnapshot(noKv)).toBe(false)
  })

  it('rejette kv null (doit être object non-null)', () => {
    expect(isValidSnapshot({ ...VALID, kv: null })).toBe(false)
  })

  // ── syncedAt corrompu ─────────────────────────────────────────
  it('rejette syncedAt non-parseable', () => {
    expect(isValidSnapshot({ ...VALID, syncedAt: 'not-a-date' })).toBe(false)
  })

  it('rejette syncedAt chaîne vide (non-parseable)', () => {
    expect(isValidSnapshot({ ...VALID, syncedAt: '' })).toBe(false)
  })

  it('accepte syncedAt ISO valide sans millisecondes', () => {
    expect(isValidSnapshot({ ...VALID, syncedAt: '2026-05-05T21:00:00Z' })).toBe(true)
  })

  // ── Chapitre avec id invalide ──────────────────────────────────
  it('rejette chapitre avec id vide', () => {
    expect(isValidSnapshot({
      ...VALID,
      chapters: [{ id: '', title: 'Sans id' }],
    })).toBe(false)
  })

  it('rejette chapitre avec id number (doit être string)', () => {
    expect(isValidSnapshot({
      ...VALID,
      chapters: [{ id: 123 }],
    })).toBe(false)
  })

})
