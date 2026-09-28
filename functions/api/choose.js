// Cloudflare Pages Function — component picker via Jev (TypeSafe decision model on OpenRouter)
// POST /api/choose  { prompt: string, components: { TypeName: "props summary", ... } }
// -> { model, scores: { TypeName: 0..1 }, usage }
//
// Jev is a decisions model: it answers typed questions with probabilities instead of
// generating text, so it only works on /api/alpha/decisions (not chat/completions).
// We ask one yes/no ("noul") question per component, all in one request.

const MODEL = '~typesafe/jev-latest';
const MAX_PROMPT = 4000;
const MAX_COMPONENTS = 120;
const MAX_DESC = 400;

export function corsFor(request) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = ['https://daub.dev', 'https://daub.pages.dev'];
  const isAllowed = allowedOrigins.some(o => origin === o || origin.endsWith('.daub.pages.dev'));
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = corsFor(request);
  const json = (obj, status) => new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  if (env.RL_GENERATE) {
    try {
      const key = request.headers.get('CF-Connecting-IP') || 'unknown';
      const { success } = await env.RL_GENERATE.limit({ key });
      if (!success) return json({ error: 'Rate limit exceeded — 60 req/min per IP' }, 429);
    } catch {}
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid JSON body' }, 400);

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, MAX_PROMPT) : '';
  if (!prompt) return json({ error: 'prompt string required' }, 400);

  const comps = body.components;
  if (!comps || typeof comps !== 'object' || Array.isArray(comps)) {
    return json({ error: 'components object required' }, 400);
  }
  const names = Object.keys(comps);
  if (!names.length || names.length > MAX_COMPONENTS) {
    return json({ error: `components must have 1-${MAX_COMPONENTS} entries` }, 400);
  }

  try {
    return json(await decideComponents({ prompt, components: comps, apiKey: env.OPENROUTER_API_KEY }), 200);
  } catch (e) {
    return json({ error: (e && e.message) || 'Upstream error' }, (e && e.status) || 502);
  }
}

function fail(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// Reusable Jev call (also used by functions/api/mcp.js). Resolves to { model, scores, usage };
// throws an Error with .status (400 bad name, 500 no key, 502/504 upstream, or upstream's status).
export async function decideComponents({ prompt, components, apiKey, timeoutMs = 10_000, title = 'DAUB Playground' }) {
  const names = Object.keys(components || {});
  const questions = {};
  for (const name of names) {
    // Names become question keys; keep them to plain component identifiers.
    if (!/^[A-Za-z][A-Za-z0-9]{0,39}$/.test(name)) throw fail(`invalid component name: ${name}`, 400);
    const desc = typeof components[name] === 'string' ? components[name].slice(0, MAX_DESC) : '';
    questions[name] = {
      type: 'noul',
      instructions: `Should the generated UI use the DAUB "${name}" component` + (desc ? ` (${desc})` : '') + '?',
      criteria: {
        true: `The requested UI clearly benefits from a ${name}.`,
        false: `A ${name} is not needed for this request.`,
      },
    };
  }

  const data = await jevDecide({ state: { request: String(prompt).slice(0, MAX_PROMPT) }, questions, apiKey, timeoutMs, title });

  const scores = {};
  const answers = (data && data.answers) || {};
  for (const name of names) {
    const a = answers[name];
    if (a && typeof a.noul === 'number') scores[name] = a.noul;
  }
  return { model: (data && data.model) || MODEL, scores, usage: (data && data.usage) || null };
}

// One Decisions API round trip (also used by functions/api/assemble.js). Resolves to the
// parsed response ({ model, answers, usage }); throws an Error with .status like decideComponents.
export async function jevDecide({ state, questions, apiKey, timeoutMs = 10_000, title = 'DAUB Playground' }) {
  if (!apiKey) throw fail('Server misconfigured: missing API key', 500);

  let upstream;
  try {
    upstream = await fetch('https://openrouter.ai/api/alpha/decisions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://daub.dev',
        'X-Title': title,
      },
      body: JSON.stringify({ model: MODEL, state, questions }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e && (e.name === 'AbortError' || e.name === 'TimeoutError')) {
      throw fail('Gateway Timeout: decision model did not respond in time', 504);
    }
    throw fail('Upstream request failed', 502);
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    throw fail('Invalid upstream response', 502);
  }
  if (!upstream.ok) {
    throw fail((data && data.error && data.error.message) || 'Upstream error', upstream.status);
  }
  return data;
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: corsFor(context.request) });
}
