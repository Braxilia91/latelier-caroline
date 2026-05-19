// ─── Mode B — Vision native Claude (multimodal) ──────────────────────────────
// Envoie une image en base64 directement dans les messages Claude.
// Le proxy Cloudflare (/api/claude) passe body intact → 0 modif proxy nécessaire.
// Compatible : JPEG, PNG, GIF, WebP (max ~5 MB recommandé).
//
// Usage :
//   import { fileToBase64, askClaudeWithImage, inspireFromImage } from '../lib/vision'
//   const b64 = await fileToBase64(file)
//   const result = await askClaudeWithImage({ apiKey, imageBase64: b64, textPrompt: '...' })

import { askClaude } from './claude'

// ─── Utilitaire : File/Blob → base64 (sans le préfixe data:...) ──────────────
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── Utilitaire : détecter le mediaType depuis un File ───────────────────────
export function detectMediaType(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  return allowed.includes(file?.type) ? file.type : 'image/jpeg'
}

// ─── Core : envoi image + texte à Claude (Mode B) ────────────────────────────
// systemPrompt : optionnel (ex : persona Léa)
// imageBase64  : string base64 sans préfixe
// mediaType    : 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
// textPrompt   : question ou consigne à soumettre avec l'image
// maxTokens    : défaut 900
export async function askClaudeWithImage({
  apiKey,
  systemPrompt = '',
  imageBase64,
  mediaType = 'image/jpeg',
  textPrompt,
  maxTokens = 900,
  onChunk,
}) {
  if (!apiKey)       throw new Error('Mot de passe Léa manquant')
  if (!imageBase64)  throw new Error('Image base64 manquante')
  if (!textPrompt)   throw new Error('Prompt texte manquant')

  const messages = [
    {
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: imageBase64,
          },
        },
        {
          type: 'text',
          text: textPrompt,
        },
      ],
    },
  ]

  return askClaude({
    apiKey,
    systemPrompt,
    messages,
    maxTokens,
    onChunk,
  })
}

// ─── Preset : Inspire — analyse visuelle d'une image pour l'écriture ─────────
// Caroline uploade une photo/illustration → Léa propose des pistes narratives.
// Retourne une string (réponse Léa).
const INSPIRE_SYSTEM = `Tu es Léa, coach d'écriture bienveillante et sensible. Tu regardes une image partagée par Caroline et tu lui proposes 3 à 5 pistes d'écriture concrètes et personnalisées, inspirées par ce que tu vois. Ton ton est chaleureux, précis, littéraire mais accessible. Pas de liste froide — des suggestions qui donnent envie d'écrire.`

export async function inspireFromImage({ apiKey, imageBase64, mediaType = 'image/jpeg', chapterContext = '', onChunk }) {
  const contextPart = chapterContext?.trim()
    ? `\n\nContexte du chapitre en cours : "${chapterContext.trim()}"`
    : ''

  const textPrompt = `Regarde cette image avec attention et propose-moi des pistes d'écriture pour nourrir mon texte.${contextPart}`

  return askClaudeWithImage({
    apiKey,
    systemPrompt: INSPIRE_SYSTEM,
    imageBase64,
    mediaType,
    textPrompt,
    maxTokens: 900,
    onChunk,
  })
}

// ─── Preset : Correction visuelle — analyser un screenshot de texte ──────────
// Utile si Caroline fait un screenshot de son manuscrit sur papier/tablette.
const CORRECT_SYSTEM = `Tu es Léa, coach d'écriture. Tu lis le texte visible dans cette image et tu proposes des corrections ou améliorations stylistiques. Tu cites les passages concernés entre guillemets avant de proposer une alternative.`

export async function correctFromImage({ apiKey, imageBase64, mediaType = 'image/jpeg', onChunk }) {
  return askClaudeWithImage({
    apiKey,
    systemPrompt: CORRECT_SYSTEM,
    imageBase64,
    mediaType,
    textPrompt: 'Lis ce texte et propose tes corrections ou suggestions stylistiques.',
    maxTokens: 900,
    onChunk,
  })
}
