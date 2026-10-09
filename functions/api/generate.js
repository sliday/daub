// Cloudflare Pages Function — OpenRouter SSE proxy
// POST /api/generate  { messages: [{role, content}, ...] }

// openrouter/auto picks the model per prompt; pinned ids stay allowed for the fallback path and cached clients
const DEFAULT_MODEL = 'openrouter/auto';
const ALLOWED_MODELS = [DEFAULT_MODEL, 'google/gemini-3-flash-preview', 'google/gemini-3.1-pro-preview', 'google/gemini-3.1-flash-lite', 'moonshotai/kimi-k2.5'];
const ALLOWED_EFFORTS = ['none', 'low', 'medium', 'high'];
// Auto Router cost band; unset routes at roughly "low". Capped at medium on the server key.
const ALLOWED_COST_TIERS = ['low', 'medium'];

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

  const aborted = () => new Response(JSON.stringify({ error: 'Request aborted' }), {
    status: 499,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
  if (request.signal.aborted) return aborted();

  if (env.RL_GENERATE) {
    try {
      const key = request.headers.get('CF-Connecting-IP') || 'unknown';
      const { success } = await env.RL_GENERATE.limit({ key });
      if (!success) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded — 60 req/min per IP' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch {}
  }

  let body;
  try {
    body = await request.json();
  } catch {
    if (request.signal.aborted) return aborted();
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!body || typeof body !== 'object' || !Array.isArray(body.messages) || body.messages.length === 0) {
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

  let responseFormat = body.response_format === false ? null : { type: 'json_object' };
  if (body.response_format && typeof body.response_format === 'object') {
    const format = body.response_format;
    const schema = format.json_schema;
    if (format.type === 'json_schema' && schema && /^[A-Za-z0-9_-]{1,64}$/.test(schema.name)
      && schema.strict === true && schema.schema && schema.schema.type === 'object'
      && JSON.stringify(schema.schema).length <= 65536) {
      responseFormat = { type: 'json_schema', json_schema: { name: schema.name, strict: true, schema: schema.schema } };
    } else if (format.type !== 'json_object') {
      return new Response(JSON.stringify({ error: 'A valid strict JSON schema is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured: missing API key' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const model = ALLOWED_MODELS.includes(body.model) ? body.model : DEFAULT_MODEL;

  let upstream;
  try {
    if (request.signal.aborted) return aborted();
    const upstreamBody = Object.assign({
      model,
      messages: body.messages,
      temperature: 0.7,
      max_tokens: Math.min(Math.max(parseInt(body.max_tokens) || 16384, 1), 32768),
      stream: true,
      reasoning: { effort: body.reasoning && ALLOWED_EFFORTS.includes(body.reasoning.effort) ? body.reasoning.effort : 'medium' },
    }, responseFormat ? { response_format: responseFormat, provider: { require_parameters: true } } : {},
      model === 'openrouter/auto' && ALLOWED_COST_TIERS.includes(body.cost_tier) ? { plugins: [{ id: 'auto-router', cost_tier: body.cost_tier }] } : {},
      typeof body.session_id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(body.session_id) ? { session_id: body.session_id } : {});
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]);
    for (let attempt = 0; attempt < 2; attempt++) {
      signal.throwIfAborted();
      upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://daub.dev',
          'X-Title': 'DAUB Playground',
        },
        body: JSON.stringify(upstreamBody),
        signal,
      });
      if (upstream.ok) break;
      const errBody = await upstream.text();
      if (attempt === 0 && upstream.status === 400 && upstreamBody.reasoning.effort === 'none') {
        let message;
        try { message = JSON.parse(errBody)?.error?.message; } catch {}
        if (message === 'Reasoning is mandatory for this endpoint and cannot be disabled.') {
          // Use provider defaults without weakening the schema or renewing the deadline.
          delete upstreamBody.reasoning;
          continue;
        }
      }
      return new Response(errBody, {
        status: upstream.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (e) {
    if (request.signal.aborted) return aborted();
    if (e && (e.name === 'AbortError' || e.name === 'TimeoutError')) {
      return new Response(JSON.stringify({ error: 'Gateway Timeout: upstream LLM did not respond in time' }), {
        status: 504,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'Bad Gateway: upstream LLM request failed' }), {
      status: 502,
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

export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin') || '';
  const allowedOrigins = ['https://daub.dev', 'https://daub.pages.dev'];
  const isAllowed = allowedOrigins.some(o => origin === o || origin.endsWith('.daub.pages.dev'));
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
