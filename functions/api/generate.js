// Cloudflare Pages Function — OpenRouter SSE proxy
// POST /api/generate  { messages: [{role, content}, ...] }

export async function onRequestPost(context) {
  const { request, env } = context;

  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = ['https://daub.dev', 'https://daub.pages.dev'];
  const isAllowed = allowedOrigins.some(o => origin === o || origin.endsWith('.daub.pages.dev'));
  const corsOrigin = isAllowed ? origin : allowedOrigins[0];

  const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages array required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (body.messages.length > 20) {
    return new Response(JSON.stringify({ error: 'Maximum 20 messages allowed' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured: missing API key' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://daub.dev',
      'X-Title': 'DAUB Playground',
    },
    body: JSON.stringify(Object.assign({
      model: body.model || 'google/gemini-3.1-flash-lite-preview',
      messages: body.messages,
      temperature: 0.7,
      max_tokens: body.max_tokens || 16384,
      stream: true,
      reasoning: body.reasoning || { effort: 'medium' },
    }, body.response_format !== false ? { response_format: { type: 'json_object' } } : {})),
  });

  if (!upstream.ok) {
    const errBody = await upstream.text();
    return new Response(errBody, {
      status: upstream.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://daub.dev',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
