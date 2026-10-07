// Cloudflare Pages Function: instant first paint from the curated block library.
// POST /api/assemble  { prompt: string }
// -> { spec, archetype, archetype_confidence, theme, theme_family, picks: [{ id, p, slot, kind }],
//      confidence, coverage, fallback, preview, timing_ms: { jev, assemble, total }, jev_usage, model }
//
// One Jev request answers: which page archetype (choice), which theme family (choice),
// dark or light (noul), and one yes/no per candidate block. Code then assembles the page
// deterministically (functions/_lib/assemble.js). Jev cannot write text, so every word on
// the page comes from the curated block content; an LLM pass can rewrite copy afterwards.
//
// spec is null (fallback: "llm") when Jev picks the "custom" archetype: the request needs
// bespoke UI (chat, player, calculator), so the client should stream from the LLM instead.
// preview is true when the page is worth painting as a draft (confidence >= 0.6 and
// coverage >= 0.5, see DEFAULTS). The copy belongs to other products, so clients keep
// streaming the LLM draft and replace the preview when it lands.

import { corsFor, jevDecide } from './choose.js';
import { BLOCKS } from '../_lib/blocks-catalog.js';
import { ARCHETYPES, THEME_FAMILIES } from '../_lib/archetypes.js';
import { assemble, buildQuestions, candidateBlocks } from '../_lib/assemble.js';

const MAX_PROMPT = 4000;
const TIMEOUT_MS = 8_000;

// Built once per isolate: ~250 questions, ~21k input tokens per request.
const CANDIDATES = candidateBlocks(BLOCKS);
const QUESTIONS = buildQuestions(CANDIDATES);

export async function onRequestPost(context) {
  const { request, env } = context;
  const t0 = Date.now();
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

  return json(...await handleAssemble({ prompt, apiKey: env.OPENROUTER_API_KEY, t0 }));
}

// Split out so tests can drive it with a mocked fetch. Resolves to [body, status].
export async function handleAssemble({ prompt, apiKey, t0 = Date.now(), timeoutMs = TIMEOUT_MS }) {
  if (!apiKey) return [{ error: 'Server misconfigured: missing API key' }, 500];
  let data;
  const tJev = Date.now();
  try {
    data = await jevDecide({ state: { request: prompt }, questions: QUESTIONS, apiKey, timeoutMs });
  } catch (e) {
    // Timeouts, network errors and upstream 4xx/5xx all mean "no decision": 502, reason attached.
    return [{
      error: `Decision model failed: ${(e && e.message) || 'upstream error'}`,
      upstream_status: (e && e.status) || null,
    }, 502];
  }
  const jevMs = Date.now() - tJev;

  const answers = (data && data.answers) || {};
  const arch = answers.archetype;
  if (!arch || typeof arch.choice !== 'string' || !Object.hasOwn(ARCHETYPES, arch.choice)) {
    return [{ error: 'Decision model failed: response had no usable archetype answer' }, 502];
  }
  const theme = answers.theme && typeof answers.theme.choice === 'string' && Object.hasOwn(THEME_FAMILIES, answers.theme.choice) ? answers.theme.choice : 'default';
  const darkP = answers.dark && typeof answers.dark.noul === 'number' ? answers.dark.noul : 0;
  const scores = {};
  for (const b of CANDIDATES) {
    const a = answers[b.id];
    if (a && typeof a.noul === 'number') scores[b.id] = a.noul;
  }

  const tAsm = Date.now();
  let r;
  try {
    r = assemble({
      archetype: arch.choice,
      archetypeConfidence: typeof arch.confidence === 'number' ? arch.confidence : 0,
      themeFamily: theme,
      darkP,
      scores,
      blocks: CANDIDATES,
    });
  } catch (e) {
    return [{ error: `Assembly failed: ${(e && e.message) || 'unknown error'}` }, 500];
  }
  const asmMs = Date.now() - tAsm;

  return [{
    spec: r.spec,
    archetype: r.archetype,
    archetype_confidence: typeof arch.confidence === 'number' ? arch.confidence : null,
    theme: r.theme,
    theme_family: r.themeFamily,
    picks: r.picks,
    confidence: r.confidence,
    coverage: r.coverage,
    fallback: r.fallback,
    preview: r.preview,
    timing_ms: { jev: jevMs, assemble: asmMs, total: Date.now() - t0 },
    jev_usage: (data && data.usage) || null,
    model: (data && data.model) || null,
  }, 200];
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: corsFor(context.request) });
}
