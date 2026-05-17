// Cloudflare Pages Function — Proxy OpenAI TTS
// Auth via header X-Lea-Pass

export async function onRequestPost(context) {
  const { request, env } = context

  const password = request.headers.get('X-Lea-Pass') || ''
  if (!env.LEA_PASSWORD || password !== env.LEA_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Mot de passe Léa invalide' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY non configurée' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = await request.text()
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body,
  })

  // ── Diagnostic : si OpenAI répond non-2xx, lire le body texte/JSON ──
  // Permet de distinguer clé absente, quota, modèle invalide, timeout, etc.
  // On conserve une réponse HTTP 500 côté client pour déclencher le fallback navigateur.
  if (!response.ok) {
    let openaiBodyPreview = ''
    try {
      const raw = await response.text()
      openaiBodyPreview = raw.length > 400 ? raw.slice(0, 400) + '…' : raw
    } catch {
      openaiBodyPreview = '(body OpenAI illisible)'
    }

    console.error('[openai-tts] échec OpenAI', {
      status: response.status,
      statusText: response.statusText,
      bodyPreview: openaiBodyPreview,
    })

    return new Response(
      JSON.stringify({
        error: 'OpenAI TTS a échoué',
        openaiStatus: response.status,
        openaiBodyPreview,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg',
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
