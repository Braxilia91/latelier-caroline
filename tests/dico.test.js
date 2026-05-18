/**
 * tests/dico.test.js — Vitest
 *
 * Tests unitaires sur les fonctions DicoCaro :
 *   - buildSynonymPrompt      → getSynonyms
 *   - buildWordSearchPrompt   → searchWord
 *   - buildDicoGuessPrompt    → devinage lexical (remplace Akinator)
 *   - buildDicoExplainPrompt  → explication du mot trouvé
 *   - buildPredictivePrompt   → getPredictiveWords
 *   - buildDiscoveryPrompt    → getDiscovery
 *
 * Stratégie : tester les fonctions de construction de prompt directement
 * (pures, sans effets de bord). Les hooks useCoach wrappent ces fonctions
 * via sendMessage → testé séparément avec mock si nécessaire.
 */
import { describe, it, expect } from 'vitest'
import {
  buildSynonymPrompt,
  buildWordSearchPrompt,
  buildDicoGuessPrompt,
  buildDicoExplainPrompt,
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

  it('contient une note sur le niveau de registre (simple → courant)', () => {
    const prompt = buildSynonymPrompt({ word: 'joie', sentence: '', level: 'simple' })
    expect(prompt).toContain('courant')
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
// buildDicoGuessPrompt  (remplace buildAkinatorSoftPrompt)
// ──────────────────────────────────────────────────────────────────
describe('buildDicoGuessPrompt', () => {
  const QUERY_FULL = {
    query: 'un violon ancien fabriqué par un grand luthier italien',
    rejectedWords: [],
  }

  it('contient la description query', () => {
    const prompt = buildDicoGuessPrompt(QUERY_FULL)
    expect(prompt).toContain('violon ancien')
  })

  it('mentionne le format JSON attendu', () => {
    const prompt = buildDicoGuessPrompt(QUERY_FULL)
    expect(prompt).toContain('"guesses"')
  })

  it('contient la mention confidence', () => {
    const prompt = buildDicoGuessPrompt(QUERY_FULL)
    expect(prompt).toContain('confidence')
  })

  it('contient les mots rejetés quand fournis', () => {
    const prompt = buildDicoGuessPrompt({
      query: 'sentiment mélangé de tristesse et joie',
      rejectedWords: ['nostalgie', 'spleen'],
    })
    expect(prompt).toContain('nostalgie')
    expect(prompt).toContain('spleen')
  })

  it('fonctionne sans rejectedWords', () => {
    const prompt = buildDicoGuessPrompt({ query: 'une chose douce' })
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(20)
  })

  it('fonctionne avec rejectedWords vide', () => {
    expect(() => buildDicoGuessPrompt({ query: 'idée floue', rejectedWords: [] })).not.toThrow()
  })

  it('fonctionne avec query vide', () => {
    expect(() => buildDicoGuessPrompt({ query: '' })).not.toThrow()
  })

  it('est une string non-vide', () => {
    const prompt = buildDicoGuessPrompt(QUERY_FULL)
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(30)
  })
})

// ──────────────────────────────────────────────────────────────────
// buildDicoExplainPrompt
// ──────────────────────────────────────────────────────────────────
describe('buildDicoExplainPrompt', () => {
  it('contient le mot à expliquer', () => {
    const prompt = buildDicoExplainPrompt('nostalgie')
    expect(prompt).toContain('nostalgie')
  })

  it('mentionne le format JSON attendu', () => {
    const prompt = buildDicoExplainPrompt('spleen')
    expect(prompt).toContain('"definition"')
    expect(prompt).toContain('"trivia"')
  })

  it('est une string non-vide', () => {
    const prompt = buildDicoExplainPrompt('mélancolie')
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(20)
  })

  it('ne plante pas avec un mot vide', () => {
    expect(() => buildDicoExplainPrompt('')).not.toThrow()
  })

  it('ne plante pas avec undefined', () => {
    expect(() => buildDicoExplainPrompt(undefined)).not.toThrow()
  })
})

// ──────────────────────────────────────────────────────────────────
// buildPredictivePrompt
// ──────────────────────────────────────────────────────────────────
describe('buildPredictivePrompt', () => {
  it('contient (une partie du) texte du chapitre', () => {
    const content = 'Je me souviens d’un été brûlant dans la cour de la maison.'
    const prompt = buildPredictivePrompt(content)
    expect(prompt).toContain('été brûlant')
  })

  it('tronque les chapitres très longs — contenu limité à 1000 chars', () => {
    const long = 'A'.repeat(2000)
    const prompt = buildPredictivePrompt(long)
    expect(prompt).not.toContain('A'.repeat(1001))
    expect(prompt.length).toBeLessThan(1800)
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

  it('contient une référence à l’autobiographie ou au contexte', () => {
    const prompt = buildDiscoveryPrompt('Elle avait les yeux clairs.')
    const lower = prompt.toLowerCase()
    const hasMention = lower.includes('caroline') || lower.includes('autobio') || lower.includes('mot') || lower.includes('écriture')
    expect(hasMention).toBe(true)
  })
})
