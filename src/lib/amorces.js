// src/lib/amorces.js
// Bibliothèque locale d'amorces vocales pour Léa — TTS/Amorce
// Architecture : [oralité?] + gabarit({EXCERPT}?) + passerelle
// Rotation : 5 derniers gabarits bannis (global), dernière passerelle bannie (par famille)
// emotion : uniquement si marqueurs nets présents — sinon fallback clarification/miroir

// ── Bibliothèque validée ─────────────────────────────────────────

export const FAMILIES = {
  miroir: {
    label: 'Miroir neutre',
    templates: [
      "Donc, tu {EXCERPT}.",
      "Tu me dis que {EXCERPT}.",
      "Ce que tu écris, c'est {EXCERPT}.",
      "Si je te suis bien, tu {EXCERPT}.",
      "Là, tu me parles de ça : {EXCERPT}.",
      "D'accord, tu es en train de me dire que {EXCERPT}.",
      "Donc, ce que je reçois, c'est {EXCERPT}.",
      "Autrement dit, tu {EXCERPT}.",
      "Ce que j'entends, c'est que tu {EXCERPT}.",
      "En gros, tu {EXCERPT}.",
      "L'idée que tu poses, c'est {EXCERPT}.",
      "Si je reprends tes mots, tu {EXCERPT}.",
    ],
    transitions: [
      "Je vais te dire comment je vois ça.",
      "Je vais te partager ce que ça m'inspire.",
      "On va regarder ça ensemble.",
      "Je vais te dire ce que j'en comprends.",
      "Je vais partir de là pour te répondre.",
    ],
    oralites: [
      "Bon...",
      "D'accord...",
      "Oui...",
      "Alors...",
    ],
  },

  synthese: {
    label: 'Synthèse',
    templates: [
      "Si je résume, tu {EXCERPT}.",
      "En gros, ce que tu poses, c'est {EXCERPT}.",
      "Si je rassemble tout, tu {EXCERPT}.",
      "Pour synthétiser, tu {EXCERPT}.",
      "Ce que je retiens surtout, c'est que tu {EXCERPT}.",
      "Le cœur de ce que tu dis, c'est {EXCERPT}.",
      "Si je vais à l'essentiel, tu {EXCERPT}.",
      "En te suivant, le point central, c'est {EXCERPT}.",
      "Ce qui ressort de ton message, c'est que tu {EXCERPT}.",
      "Si je condense un peu, tu {EXCERPT}.",
      "Au fond, ce que tu cherches à dire, c'est {EXCERPT}.",
      "Ce que je garde de tout ça, c'est {EXCERPT}.",
    ],
    transitions: [
      "Je vais te répondre à partir de ça.",
      "Je vais te dire comment je comprends l'ensemble.",
      "Je vais te montrer ce que je vois comme axe.",
      "On va prendre ça par le bon bout.",
      "Je vais reprendre ça simplement avec toi.",
    ],
    oralites: [
      "Bon...",
      "Alors...",
      "Oui...",
      "Disons que...",
    ],
  },

  clarification: {
    label: 'Clarification douce',
    templates: [
      "Si je comprends bien, tu {EXCERPT}.",
      "Si je te suis bien, tu {EXCERPT}.",
      "Autrement dit, pour toi, c'est {EXCERPT}.",
      "On dirait que tu {EXCERPT}.",
      "Ce que j'entends derrière ça, c'est {EXCERPT}.",
      "Là, j'ai l'impression que tu {EXCERPT}.",
      "Si je ne force pas le trait, tu {EXCERPT}.",
      "Donc, pour le moment, tu {EXCERPT}.",
      "Ce que tu essaies de cerner, c'est {EXCERPT}.",
      "Tu es peut-être en train de dire que {EXCERPT}.",
      "Si je reformule doucement, tu {EXCERPT}.",
      "J'entends surtout que tu {EXCERPT}.",
    ],
    transitions: [
      "Je vais te dire comment je l'éclaircirais.",
      "Je vais essayer de te le remettre au clair.",
      "Je vais voir avec toi où ça se joue.",
      "Je vais te dire comment je démêlerais ça.",
      "On va préciser ça ensemble.",
    ],
    oralites: [
      "Voyons...",
      "Oui...",
      "Bon...",
      "D'accord...",
    ],
  },

  emotion: {
    label: 'Émotion contenue',
    templates: [
      "J'entends que ça te travaille.",
      "On sent que ce point-là te pèse un peu.",
      "Oui, j'entends que ce n'est pas simple pour toi.",
      "Là, on sent qu'il y a quelque chose de sensible.",
      "Tu ne poses pas ça à la légère.",
      "J'entends que tu avances avec une vraie hésitation.",
      "On dirait que ce sujet te remue davantage que les autres.",
      "Il y a quelque chose de délicat pour toi là-dedans.",
      "Oui, j'entends que tu ne veux pas te tromper sur ce point.",
      "Ce que tu dis là a l'air de compter vraiment pour toi.",
      "On sent que tu cherches le bon endroit, sans te brusquer.",
      "J'entends qu'il y a à la fois de l'envie et de la retenue.",
    ],
    transitions: [
      "Je vais te dire comment je vois les choses, tranquillement.",
      "On va regarder ça sans forcer.",
      "Je vais essayer de te répondre avec justesse.",
      "Je vais prendre ça doucement et te dire ce que j'en perçois.",
      "Je vais voir avec toi comment l'aborder sans le brusquer.",
    ],
    oralites: [
      "Oui...",
      "Bon...",
      "D'accord...",
    ],
  },

  pratique: {
    label: 'Demande pratique',
    templates: [
      "D'accord, tu veux surtout un appui concret.",
      "Là, tu me demandes quelque chose de très pratique.",
      "Si je te suis bien, tu veux savoir comment t'y prendre.",
      "Tu attends surtout un repère clair pour avancer.",
      "Ce que tu me demandes, c'est un vrai coup de main concret.",
      "Tu veux que je t'aide à trancher ou à formuler.",
      "Là, tu cherches surtout une direction utile.",
      "Si je résume, tu as besoin d'un point d'appui concret.",
      "Tu me demandes moins une analyse qu'une façon d'avancer.",
      "Ce que tu veux, c'est quelque chose de simple et applicable.",
      "Tu cherches une réponse qui t'aide vraiment à faire le prochain pas.",
      "D'accord, tu veux une aide pratique, pas juste une impression.",
    ],
    transitions: [
      "Je vais te proposer quelque chose de concret.",
      "Je vais te dire comment je m'y prendrais.",
      "Je vais te donner un appui simple pour avancer.",
      "Je vais te répondre de la façon la plus utile possible.",
      "Je vais te proposer une piste claire.",
    ],
    oralites: [
      "Bon...",
      "D'accord...",
      "Alors...",
    ],
  },
}

export const PATIENCE = [
  "Je prends un instant pour formuler ça bien.",
  "Laisse-moi le tourner correctement.",
  "Une seconde, je précise ma pensée.",
  "Je cherche la façon la plus juste de te le dire.",
  "Attends, je te le pose proprement.",
]

// ── Triggers de détection ────────────────────────────────────────

const EMOTION_TRIGGERS = [
  'peur', 'dur ', 'dure', 'pèse', 'bloquée', 'bloqué', 'bloque',
  "n'arrive pas", 'narrive', 'triste', 'tristesse', 'difficile',
  'perdue', 'perdu', 'malaise', 'angoisse', 'angoissée',
  'inquiète', 'inquiet', 'souffre', 'souffrir', 'pesant', 'lourd',
  'dur à', 'pas simple', 'trop dur', 'trop dure',
]

const CLARIFICATION_TRIGGERS = [
  '?', 'je sais pas', 'je ne sais pas', 'hésite', 'hésites',
  'peut-être', 'pas sûre', 'pas sure', 'pas sûr', 'incertaine',
  'incertain', 'je vois pas', 'je ne vois pas',
]

const PRATIQUE_TRIGGERS = [
  'aide-moi', 'dis-moi', 'comment faire', 'donne-moi', 'corrige',
  'écris', 'propose', 'suggère', 'suggere', 'explique-moi',
  'montre-moi', 'comment je', 'comment on',
]

// ── État interne (module-level, persistant entre appels) ─────────

const _state = {
  recentKeys:       [],   // derniers 5 '{famille}:{templateIdx}' (global)
  lastTransIdx:     {},   // { famille: idx } dernière passerelle par famille
  lastPatienceIdx:  -1,
}

// ── Utilitaires ──────────────────────────────────────────────────

function pickFrom(arr, bannedIdxSet = new Set()) {
  let candidates = arr.map((t, i) => ({ t, i })).filter(({ i }) => !bannedIdxSet.has(i))
  if (candidates.length === 0) candidates = arr.map((t, i) => ({ t, i }))
  return candidates[Math.floor(Math.random() * candidates.length)]
}

/**
 * Extrait un court syntagme verbal de userText pour l'insérer après "tu ".
 * Stratégie conservatrice :
 *   - Strip guillemets/espaces en tête
 *   - Convertit "Je suis" → "es", "J'ai" → "as", "Je " → ""
 *   - Troncature à 60 chars à la frontière d'un mot
 *   - Lowercase du premier caractère
 */
function buildExcerpt(userText) {
  let s = (userText || '').trim()
    .replace(/^[«"'""\s]+/, '')
    .replace(/\s+/g, ' ')

  // Conversion sujet → forme "tu" (conservatrice)
  s = s
    .replace(/^Je suis /i,   'es ')
    .replace(/^J'ai été /i,  'as été ')
    .replace(/^J'ai /i,      'as ')
    .replace(/^Je /i,        '')
    .replace(/^J'/i,         '')

  // Troncature 60 chars
  if (s.length > 60) {
    const cut = s.slice(0, 60)
    const lastSpace = cut.lastIndexOf(' ')
    s = (lastSpace > 20 ? cut.slice(0, lastSpace) : cut) + '…'
  }

  // Lowercase pour fit grammatical ("tu Cherches" → "tu cherches")
  if (s.length > 0) s = s.charAt(0).toLowerCase() + s.slice(1)

  return s
}

// ── Détection de famille ─────────────────────────────────────────
// Priorité : emotion (si marqueurs nets) > clarification > pratique > synthese > miroir

function detectFamily(userText) {
  const lower = (userText || '').toLowerCase()

  // emotion : seulement si signal suffisamment net
  const emotionHits = EMOTION_TRIGGERS.filter(t => lower.includes(t)).length
  if (emotionHits >= 1 && lower.length > 20) return 'emotion'

  if (CLARIFICATION_TRIGGERS.some(t => lower.includes(t))) return 'clarification'
  if (PRATIQUE_TRIGGERS.some(t => lower.includes(t)))      return 'pratique'
  if ((userText || '').length > 200)                        return 'synthese'
  return 'miroir'
}

// ── API publique ──────────────────────────────────────────────────

/**
 * Sélectionne et construit une amorce vocale pour userText.
 * Format : [oralité + ] gabarit(EXCERPT?) + passerelle
 *
 * @param {string} userText
 * @returns {{ text: string, family: string, templateKey: string, oraliteUsed: boolean }}
 */
export function pickAmorce(userText) {
  const family = detectFamily(userText || '')
  const def    = FAMILIES[family]

  // — Gabarit : ban derniers 5 (global) —
  const bannedKeys = new Set(_state.recentKeys)
  let tCandidates = def.templates
    .map((t, i) => ({ t, i, key: `${family}:${i}` }))
    .filter(({ key }) => !bannedKeys.has(key))
  if (tCandidates.length === 0) {
    tCandidates = def.templates.map((t, i) => ({ t, i, key: `${family}:${i}` }))
  }
  const tPick = tCandidates[Math.floor(Math.random() * tCandidates.length)]

  _state.recentKeys = [..._state.recentKeys, tPick.key].slice(-5)

  // Substitution EXCERPT si le gabarit l'attend
  let templateText = tPick.t
  if (templateText.includes('{EXCERPT}')) {
    templateText = templateText.replace('{EXCERPT}', buildExcerpt(userText))
  }

  // — Passerelle : ban dernière de cette famille —
  const lastTrans = _state.lastTransIdx[family] ?? -1
  const transPick = pickFrom(def.transitions, new Set([lastTrans]))
  _state.lastTransIdx[family] = transPick.i

  // — Oralité : 1/3 de chances —
  let oraliteUsed = false
  let prefix = ''
  if (Math.random() < 1 / 3) {
    const oralPick = pickFrom(def.oralites)
    prefix = oralPick.t + ' '
    oraliteUsed = true
  }

  const text = (prefix + templateText + ' ' + transPick.t).trim()

  return { text, family, templateKey: tPick.key, oraliteUsed }
}

/**
 * Sélectionne une phrase de patience (gap amorce→main > 1.5s).
 * Une seule patience max par tour, dernière bannie.
 *
 * @returns {{ text: string, patienceIdx: number }}
 */
export function pickPatience() {
  const pick = pickFrom(PATIENCE, new Set([_state.lastPatienceIdx]))
  _state.lastPatienceIdx = pick.i
  return { text: pick.t, patienceIdx: pick.i }
}
