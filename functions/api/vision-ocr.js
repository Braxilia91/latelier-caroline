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
  let result
  try {
    result = await env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
      prompt: 'Transcris exactement le texte visible dans cette image en français. Retourne uniquement le texte brut, sans commentaire ni explication.',
      image: [...imageBytes],
      max_tokens: 1024,
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
