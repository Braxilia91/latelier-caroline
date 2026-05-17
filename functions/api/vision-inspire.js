// Cloudflare Pages Function — Inspiration visuelle via Workers AI (LLaVA 1.5 7B)
// Requires : binding AI nommé "AI" dans Cloudflare Pages → Settings → Functions → Bindings.
// Auth via header X-Lea-Pass (même pattern que vision-ocr.js).

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
  let requestContext
  try {
    const body = await request.json()
    base64 = body.image
    requestContext = body.context || {}
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

  // ── Convertir base64 → Uint8Array (format Workers AI LLaVA : number[]) ──
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

  const safeContext = normalizeContext(requestContext)
  const carolineText = [
    safeContext.whyNow ? `Pourquoi cette photo, maintenant ? ${safeContext.whyNow}` : '',
    safeContext.detail ? `Quel détail te frappe en premier ? ${safeContext.detail}` : '',
    safeContext.unseen ? `Ce qu'on ne voit pas : ${safeContext.unseen}` : '',
    safeContext.leftToday ? `Ce que cette trace te laisse aujourd'hui : ${safeContext.leftToday}` : '',
    safeContext.ocrText ? `Texte transcrit dans l'image : ${safeContext.ocrText}` : '',
  ].filter(Boolean).join('\n')

  // ── Appel Workers AI — analyser les mots de Caroline puis faire parler l'image ──
  let result
  try {
    result = await env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
      prompt: [
        "Tu aides Caroline à écrire son histoire à partir d'une photo.",
        "Tu dois d'abord t'appuyer sur ce que Caroline a déjà écrit, puis seulement ensuite sur l'image.",
        "N'invente jamais de souvenir personnel. N'affirme jamais que Caroline a vécu quelque chose.",
        "Propose seulement des pistes au conditionnel, pour l'aider à regarder, ressentir et écrire.",
        '',
        'Texte déjà écrit par Caroline :',
        carolineText || '(Caroline n’a pas encore écrit de réponse exploitable.)',
        '',
        'Réponds exactement avec ces trois rubriques :',
        'Ce que tes mots ouvrent — 2 ou 3 pistes tirées uniquement du texte de Caroline. Si elle n’a rien écrit, dis simplement qu’il n’y a pas encore assez de mots.',
        'Ce que l’image ajoute — 3 détails concrets visibles dans l’image, sans interprétation forcée.',
        'Pistes pour écrire — 4 amorces à la première personne, au conditionnel ou inachevées, que Caroline pourra compléter.',
        '',
        'Style : chaleureux, sobre, utile. Phrases courtes. Pas de conclusion, pas de commentaire technique.',
      ].join('\n'),
      image: [...imageBytes],
      max_tokens: 900,
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Erreur Workers AI : ${err?.message || 'inconnue'}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const text = result?.description || result?.response || ''

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

function normalizeContext(context) {
  const source = context && typeof context === 'object' ? context : {}
  return {
    whyNow: cleanText(source.whyNow),
    detail: cleanText(source.detail),
    unseen: cleanText(source.unseen),
    leftToday: cleanText(source.leftToday),
    ocrText: cleanText(source.ocrText),
  }
}

function cleanText(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, 900)
}
