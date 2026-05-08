/**
 * tests/dico.test.js — Vitest
 *
 * Tests unitaires sur les fonctions DicoCaro :
 *   - buildSynonymPrompt     → getSynonyms
 *   - buildWordSearchPrompt  → searchWord
 *   - buildAkinatorSoftPrompt → startAkinatorSoft
 *   - buildPredictivePrompt  → getPredictiveWords
 *   - buildDiscoveryPrompt   → getDiscovery
 *
 * Stratégie : tester les fonctions de construction de prompt directement
 * (pures, sans effets de bord). Les hooks useCoach wrappent ces fonctions
 * via sendMessage → testé séparément avec mock si nécessaire.
 */
import { describe, it, expect } from 'vitest'
import {
  buildSynonymPrompt,
  buildWordSearchPrompt,
  buildAkinatorSoftPrompt,
  buildPredictivePrompt,
  buildDiscoveryPrompt,
} from '../src/lib/prompts'

// ──────────────────────────────────────────────────────────────────
// buildSynonymPrompt
// ──────────────────────────────────────────────────────────────────
describe('buildSynonymPrompt', () => {
  it('contient le mot demandé', () => {
    const prompt = buildSynonymPrompt({ word: 'mélancolie', sentence: '', level: 'soutenu' })
    expect(prompt).toContain('mélancolie')
  })

  it('contient le niveau de registre', () => {
    const prompt = buildSynonymPrompt({ word: 'joie', sentence: '', level: 'populaire' })
    expect(prompt).toContain('populaire')
  })

  it('intègre la phrase contextuelle quand fournie', () => {
    const prompt = buildSynonymPrompt({ word: 'regard', sentence: 'Son regard me touchait.', level: 'mixte' })
    expect(prompt).toContain('Son regard me touchait.')
  })

  it('est une string non-vide', () => {
    const prompt = buildSynonymPrompt({ word: 'lumière', sentence: '', level: 'mixte' })
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(20)
  })

  it('fonctionne avec sentence vide', () => {
    expect(() => buildSynonymPrompt({ word: 'nuit', sentence: '', level: 'courant' })).not.toThrow()
  })

  it('fonctionne avec sentence undefined', () => {
    expect(() => buildSynonymPrompt({ word: 'nuit', sentence: undefined, level: 'courant' })).not.toThrow()
  })
})

// ──────────────────────────────────────────────────────────────────
// buildWordSearchPrompt
// ──────────────────────────────────────────────────────────────────
describe('buildWordSearchPrompt', () => {
  it('contient la description utilisateur', () => {
    const desc = 'une sensation de flottement léger'
    const prompt = buildWordSearchPrompt(desc)
    expect(prompt).toContain(desc)
  })

  it('est une string non-vide', () => {
    const prompt = buildWordSearchPrompt('quelque chose de doux')
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(10)
  })

  it('ne plante pas avec une chaîne très courte', () => {
    expect(() => buildWordSearchPrompt('x')).not.toThrow()
  })
})

// ──────────────────────────────────────────────────────────────────
// buildAkinatorSoftPrompt
// ──────────────────────────────────────────────────────────────────
describe('buildAkinatorSoftPrompt', () => {
  const ANSWERS_FULL = {
    nature:    'émotion',
    mouvement: 'oui',
    registre:  'soutenu',
    contexte:  'Quand elle est partie sans se retourner.',
  }

  it('contient la nature', () => {
    const prompt = buildAkinatorSoftPrompt(ANSWERS_FULL)
    expect(prompt).toContain('émotion')
  })

  it('contient le mouvement', () => {
    const prompt = buildAkinatorSoftPrompt(ANSWERS_FULL)
    expect(prompt).toContain('oui')
  })

  it('contient le registre', () => {
    const prompt = buildAkinatorSoftPrompt(ANSWERS_FULL)
    expect(prompt).toContain('soutenu')
  })

  it('contient le contexte', () => {
    const prompt = buildAkinatorSoftPrompt(ANSWERS_FULL)
    expect(prompt).toContain('Quand elle est partie sans se retourner.')
  })

  it('fonctionne sans mouvement (optionnel)', () => {
    const prompt = buildAkinatorSoftPrompt({ nature: 'sensation', registre: 'courant', contexte: '' })
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(20)
    expect(prompt).toContain('non précisé')
  })

  it('fonctionne sans contexte (optionnel)', () => {
    const prompt = buildAkinatorSoftPrompt({ nature: 'état', mouvement: 'non', registre: 'mixte', contexte: '' })
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(20)
  })

  it('fonctionne avec contexte undefined', () => {
    expect(() => buildAkinatorSoftPrompt({ nature: 'idée', mouvement: undefined, registre: undefined, contexte: undefined })).not.toThrow()
  })

  it('est une string non-vide', () => {
    const prompt = buildAkinatorSoftPrompt(ANSWERS_FULL)
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(30)
  })
})

// ──────────────────────────────────────────────────────────────────
// buildPredictivePrompt
// ──────────────────────────────────────────────────────────────────
describe('buildPredictivePrompt', () => {
  it('contient (une partie du) texte du chapitre', () => {
    const content = 'Je me souviens d\u2019un été brûlant dans la cour de la maison.'
    const prompt = buildPredictivePrompt(content)
    expect(prompt).toContain('été brûlant')
  })

  it('tronque les chapitres très longs à 1000 caractères max', () => {
    const long = 'A'.repeat(2000)
    const prompt = buildPredictivePrompt(long)
    expect(prompt.length).toBeLessThan(1500)
  })

  it('est une string non-vide avec contenu vide', () => {
    const prompt = buildPredictivePrompt('')
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(10)
  })

  it('ne plante pas avec undefined', () => {
    expect(() => buildPredictivePrompt(undefined)).not.toThrow()
  })

  it('mentionne les 3 catégories attendues', () => {
    const prompt = buildPredictivePrompt('Un souvenir de printemps.')
    expect(prompt).toContain('Émotions')
    expect(prompt).toContain('Sensations')
    expect(prompt).toContain('Style')
  })
})

// ──────────────────────────────────────────────────────────────────
// buildDiscoveryPrompt
// ──────────────────────────────────────────────────────────────────
describe('buildDiscoveryPrompt', () => {
  it('est une string non-vide', () => {
    const prompt = buildDiscoveryPrompt('Je marchais sous les tilleuls.')
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(10)
  })

  it('ne plante pas avec une chaîne vide', () => {
    expect(() => buildDiscoveryPrompt('')).not.toThrow()
  })

  it('ne plante pas avec undefined', () => {
    expect(() => buildDiscoveryPrompt(undefined)).not.toThrow()
  })

  it('contient une référence à l\u2019autobiographie ou au contexte', () => {
    const prompt = buildDiscoveryPrompt('Elle avait les yeux clairs.')
    const lower = prompt.toLowerCase()
    const hasMention = lower.includes('caroline') || lower.includes('autobio') || lower.includes('mot') || lower.includes('écriture')
    expect(hasMention).toBe(true)
  })
})
