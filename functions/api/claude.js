// Cloudflare Pages Function — Proxy Anthropic Claude
// Auth via header X-Lea-Pass (doit matcher le secret LEA_PASSWORD)

export async function onRequestPost(context) {
  const { request, env } = context

  const password = request.headers.get('X-Lea-Pass') || ''
  if (!env.LEA_PASSWORD || password !== env.LEA_PASSWORD) {
    return new Response(
      JSON.stringify({ error: { type: 'authentication_error', message: 'Mot de passe Léa invalide' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (!env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: { type: 'config_error', message: 'ANTHROPIC_API_KEY non configurée' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const body = await request.text()
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body,
  })

  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
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
