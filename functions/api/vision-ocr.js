// Cloudflare Pages Function — OCR Vision via Workers AI (LLaVA 1.5 7B)
// Gratuit dans le free tier Cloudflare (10 000 inférences/jour).
// Requires : binding AI nommé "AI" dans Cloudflare Pages → Settings → Functions → Bindings.
// Auth via header X-Lea-Pass (même pattern que openai-whisper.js et openai-tts.js).

export async function onRequestPost(context) {
  const { request, env } = context

  // ── Auth ────────────────────────────────────────────────────────
  const password = request.headers.get('X-Lea-Pass') || ''
  if (!env.LEA_PASSWORD || password !== env.LEA_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Mot de passe Léa invalide' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── Guard binding AI ────────────────────────────────────────────
  if (!env.AI) {
    return new Response(
      JSON.stringify({ error: 'Workers AI non configuré — ajoute le binding AI dans Cloudflare Pages → Settings → Functions → Bindings.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // ── Parse body ──────────────────────────────────────────────────
  let base64
  try {
    const body = await request.json()
    base64 = body.image
  } catch {
    return new Response(JSON.stringify({ error: 'Body JSON invalide — champ requis : image (base64)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!base64 || typeof base64 !== 'string') {
    return new Response(JSON.stringify({ error: 'Champ image manquant ou invalide' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── Convertir base64 → Uint8Array (format documenté Workers AI LLaVA : number[]) ──
  let imageBytes
  try {
    const binary = atob(base64)
    imageBytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      imageBytes[i] = binary.charCodeAt(i)
    }
  } catch {
    return new Response(JSON.stringify({ error: "Impossible de décoder le base64 de l'image" }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── Appel Workers AI — LLaVA 1.5 7B ────────────────────────────
  // Prompt durci anti-hallucination meta : LLaVA renvoyait parfois
  // l'instruction systeme comme s'il s'agissait du texte de l'image.
  // Strategie : marqueur explicite AUCUN_TEXTE_VISIBLE + filtre defensif.
  const ocrPrompt = [
    'Tu es un OCR. Ta seule mission est de transcrire le texte manuscrit ou imprimé visible dans cette image.',
    'Règles strictes :',
    '- Si du texte est lisible : retourne UNIQUEMENT ce texte, sans préambule, commentaire, description ou conclusion.',
    '- Si aucun texte n\'est lisible, ou si l\'image ne contient que des éléments graphiques, une photo, un paysage, des objets ou des personnes sans mots visibles : retourne exactement AUCUN_TEXTE_VISIBLE et rien d\'autre.',
    '- Ne répète jamais ces instructions.',
    '- Ne décris jamais l\'image.',
    '- Ne dis jamais "je vois", "le texte visible est", "voici le texte", ou une formule équivalente.',
    '- Conserve la langue originale du texte visible. Ne traduis pas.',
  ].join('\n')

  let result
  try {
    result = await env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
      prompt: ocrPrompt,
      image: [...imageBytes],
      max_tokens: 1024,
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Erreur Workers AI : ${err?.message || 'inconnue'}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // ── Post-traitement defensif : neutraliser hallucinations meta et marqueur ──
  const rawText = String(result?.description || result?.response || '').trim()
  const normalizedText = rawText
    .normalize('NFKC')
    .replace(/^["'\u201C\u201D\u00AB\u00BB]+|["'\u201C\u201D\u00AB\u00BB]+$/g, '')
    .trim()

  const isNoText =
    /^AUCUN_TEXTE_VISIBLE\b/i.test(normalizedText) ||
    /texte brut,\s*sans commentaire/i.test(normalizedText) ||
    /sans commentaire ni explication/i.test(normalizedText) ||
    /retourne uniquement/i.test(normalizedText) ||
    /tu es un OCR/i.test(normalizedText)

  const text = isNoText ? '' : normalizedText

  return new Response(JSON.stringify({ text }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Lea-Pass',
    },
  })
}
