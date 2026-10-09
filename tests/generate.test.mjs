import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/generate.js';
import snowflake from '../playground-snowflake.js';

function request(signal, extra = {}) {
  return new Request('https://daub.dev/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://daub.dev' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Build a dashboard' }], ...extra }),
    signal,
  });
}

function call(req, env = {}) {
  return onRequestPost({ request: req, env: { OPENROUTER_API_KEY: 'test-key', ...env } });
}

beforeEach(t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Live calls forbidden'); });
});

const mandatoryReasoningMessage = 'Reasoning is mandatory for this endpoint and cannot be disabled.';
const mandatoryReasoningError = JSON.stringify({ error: {
  message: mandatoryReasoningMessage, code: 400, metadata: { provider_name: null },
} });

for (const stage of ['layout', 'refine', 'spacing']) test(`reasoning compatibility retry preserves the strict ${stage} request`, async t => {
  const response_format = snowflake.responseFormat(stage);
  const sent = [];
  const sse = 'data: {"choices":[{"delta":{"content":"{}"}}]}\n\ndata: [DONE]\n\n';
  const deadline = new AbortController();
  const timeout = t.mock.method(AbortSignal, 'timeout', ms => {
    assert.equal(ms, 60_000);
    return deadline.signal;
  });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    sent.push({ url, ...options, payload: JSON.parse(options.body) });
    return sent.length === 1 ? new Response(mandatoryReasoningError, { status: 400 }) : new Response(sse);
  });
  const response = await call(request(undefined, {
    model: 'openrouter/auto', response_format, reasoning: { effort: 'none' },
    cost_tier: 'medium', session_id: 'compat-session', max_tokens: 1234,
  }));
  t.diagnostic(`Captured ${sent.length} upstream request(s); first reasoning effort: ${sent[0].payload.reasoning.effort}`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), sse);
  assert.equal(response.headers.get('Content-Type'), 'text/event-stream');
  assert.equal(response.headers.get('Cache-Control'), 'no-cache');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://daub.dev');
  assert.equal(sent.length, 2);
  const { reasoning, ...preserved } = sent[0].payload;
  assert.deepEqual(reasoning, { effort: 'none' });
  assert.deepEqual(sent[1].payload, preserved);
  assert.deepEqual(preserved.response_format, response_format);
  assert.deepEqual(preserved.provider, { require_parameters: true });
  assert.equal(preserved.model, 'openrouter/auto');
  assert.deepEqual(preserved.plugins, [{ id: 'auto-router', cost_tier: 'medium' }]);
  assert.equal(preserved.session_id, 'compat-session');
  assert.equal(preserved.max_tokens, 1234);
  assert.equal(preserved.stream, true);
  assert.equal(sent[0].url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(sent[1].url, sent[0].url);
  assert.deepEqual(sent[1].headers, sent[0].headers);
  assert.equal(sent[1].method, 'POST');
  assert.equal(sent[1].signal, sent[0].signal);
  assert.equal(timeout.mock.callCount(), 1);
});

test('reasoning compatibility retry preserves a requested pinned model', async t => {
  const sent = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    sent.push(JSON.parse(options.body));
    return sent.length === 1 ? new Response(mandatoryReasoningError, { status: 400 }) : new Response('data: [DONE]\n\n');
  });
  const model = 'google/gemini-3.1-pro-preview';
  const response = await call(request(undefined, {
    model, response_format: snowflake.responseFormat('layout'), reasoning: { effort: 'none' },
  }));
  assert.equal(response.status, 200);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].model, model);
  assert.equal(sent[1].model, model);
  assert.equal(sent[1].reasoning, undefined);
  assert.deepEqual(sent[1].response_format, sent[0].response_format);
  assert.deepEqual(sent[1].provider, { require_parameters: true });
});

for (const [name, status, body] of [
  ['unrelated 400', 400, '{"error":{"message":"Invalid response_format"}}'],
  ['similar 400', 400, '{"error":{"message":"Reasoning is not supported for this endpoint."}}'],
  ['quoted message', 400, JSON.stringify({ error: { message: 'Invalid schema: ' + mandatoryReasoningMessage } })],
  ['nested metadata', 400, JSON.stringify({ error: { message: 'Provider failed', metadata: { raw: mandatoryReasoningMessage } } })],
  ['plain text', 400, mandatoryReasoningMessage],
  ['malformed JSON', 400, '{"error":'],
  ['null JSON', 400, 'null'],
  ['quota', 402, mandatoryReasoningError],
  ['rate limit', 429, mandatoryReasoningError],
  ['server error', 500, mandatoryReasoningError],
]) test(`reasoning compatibility does not retry ${name}`, async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(body, { status }));
  const response = await call(request(undefined, {
    response_format: snowflake.responseFormat('spacing'), reasoning: { effort: 'none' },
  }));
  assert.equal(response.status, status);
  assert.equal(await response.text(), body);
  assert.equal(fetch.mock.callCount(), 1);
});

for (const reasoning of [undefined, { effort: 'low' }, { effort: 'medium' }, { effort: 'high' }, { effort: 'invalid' }]) {
  test(`reasoning compatibility requires outgoing effort none: ${JSON.stringify(reasoning)}`, async t => {
    const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(mandatoryReasoningError, { status: 400 }));
    const response = await call(request(undefined, { response_format: snowflake.responseFormat('spacing'), reasoning }));
    assert.equal(response.status, 400);
    assert.equal(await response.text(), mandatoryReasoningError);
    assert.equal(fetch.mock.callCount(), 1);
  });
}

for (const status of [400, 402, 429, 503]) test(`reasoning compatibility returns final HTTP ${status} without a third request`, async t => {
  let calls = 0;
  const finalBody = status === 400 ? mandatoryReasoningError : JSON.stringify({ error: { message: 'Final provider error', code: status } });
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return new Response(calls === 1 ? mandatoryReasoningError : finalBody, { status: calls === 1 ? 400 : status });
  });
  const response = await call(request(undefined, {
    response_format: snowflake.responseFormat('spacing'), reasoning: { effort: 'none' },
  }));
  assert.equal(response.status, status);
  assert.equal(await response.text(), finalBody);
  assert.equal(response.headers.get('Content-Type'), 'application/json');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://daub.dev');
  assert.equal(calls, 2);
});

for (const failAt of [1, 2]) test(`reasoning compatibility sanitizes transport errors on request ${failAt}`, async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    if (++calls === failAt) throw new Error('Bearer test-key: private transport detail');
    return new Response(mandatoryReasoningError, { status: 400 });
  });
  const response = await call(request(undefined, {
    response_format: snowflake.responseFormat('spacing'), reasoning: { effort: 'none' },
  }));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: 'Bad Gateway: upstream LLM request failed' });
  assert.equal(calls, failAt);
});

for (const cause of ['caller', 'timeout']) {
  for (const phase of ['before retry', 'during retry', 'retry error body', 'retry stream']) {
    test(`reasoning compatibility respects ${cause} cancellation ${phase}`, async t => {
      const caller = new AbortController();
      const deadline = new AbortController();
      const reason = new DOMException('private cancellation detail', cause === 'caller' ? 'AbortError' : 'TimeoutError');
      const cancel = () => (cause === 'caller' ? caller : deadline).abort(reason);
      const timeout = t.mock.method(AbortSignal, 'timeout', () => deadline.signal);
      const signals = [];
      t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
        signals.push(signal);
        if (signals.length === 1) {
          const rejected = new Response(mandatoryReasoningError, { status: 400 });
          if (phase === 'before retry') t.mock.method(rejected, 'text', async () => {
            cancel();
            return mandatoryReasoningError;
          });
          return rejected;
        }
        if (phase === 'during retry') return new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });
          cancel();
        });
        if (phase === 'retry error body') return new Response(new ReadableStream({
          pull(controller) {
            signal.addEventListener('abort', () => controller.error(signal.reason), { once: true });
            cancel();
          },
        }, { highWaterMark: 0 }), { status: 400 });
        return new Response(new ReadableStream({ start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {}\n\n'));
          signal.addEventListener('abort', () => controller.error(signal.reason), { once: true });
        } }));
      });
      const response = await call(request(caller.signal, {
        response_format: snowflake.responseFormat('spacing'), reasoning: { effort: 'none' },
      }));
      if (phase === 'retry stream') {
        assert.equal(response.status, 200);
        const reader = response.body.getReader();
        assert.equal(new TextDecoder().decode((await reader.read()).value), 'data: {}\n\n');
        const pending = assert.rejects(reader.read(), error => error === reason);
        cancel();
        await pending;
      } else {
        assert.equal(response.status, cause === 'caller' ? 499 : 504);
        assert.deepEqual(await response.json(), { error: cause === 'caller'
          ? 'Request aborted' : 'Gateway Timeout: upstream LLM did not respond in time' });
      }
      assert.equal(signals.length, phase === 'before retry' ? 1 : 2);
      assert.ok(signals.every(signal => signal === signals[0] && signal.aborted));
      assert.equal(timeout.mock.callCount(), 1);
    });
  }
}

for (const stage of ['layout', 'refine', 'spacing']) test(`forwards strict ${stage} schema and requires provider support`, async t => {
  const response_format = snowflake.responseFormat(stage);
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.deepEqual(body.response_format, response_format);
    assert.deepEqual(body.provider, { require_parameters: true });
    assert.equal(body.model, 'openrouter/auto');
    assert.equal(body.stream, true);
    return new Response('data: [DONE]\n\n');
  });
  assert.equal((await call(request(undefined, { response_format }))).status, 200);
});

test('default JSON requests require parameter support while OpenUI stays unstructured', async t => {
  const sent = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => { sent.push(JSON.parse(options.body)); return new Response(''); });
  await call(request());
  await call(request(undefined, { response_format: false }));
  assert.deepEqual(sent[0].response_format, { type: 'json_object' });
  assert.equal(sent[0].provider.require_parameters, true);
  assert.equal(sent[1].response_format, undefined);
  assert.equal(sent[1].provider, undefined);
});

test('recursive generation can disable reasoning without losing Auto Router or the strict schema', async t => {
  const format = snowflake.responseFormat('layout');
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const sent = JSON.parse(options.body);
    assert.equal(sent.model, 'openrouter/auto');
    assert.deepEqual(sent.reasoning, { effort: 'none' });
    assert.deepEqual(sent.response_format, format);
    assert.equal(sent.provider.require_parameters, true);
    return new Response('data: [DONE]\n\n');
  });
  assert.equal((await call(request(undefined, { response_format: format, reasoning: { effort: 'none' } }))).status, 200);
});

for (const format of [
  { type: 'json_schema' },
  { type: 'json_schema', json_schema: { name: 'bad', strict: false, schema: { type: 'object' } } },
  { type: 'json_schema', json_schema: { name: 'bad', strict: true, schema: { type: 'array' } } },
  { type: 'json_schema', json_schema: { name: 'bad', strict: true, schema: { type: 'object', description: 'x'.repeat(65536) } } },
  { type: 'unknown' },
]) test('invalid schema fails before contacting the provider: ' + JSON.stringify(format).slice(0, 120), async () => {
  assert.equal((await call(request(undefined, { response_format: format }))).status, 400);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('unsupported schema provider does not fall back to unstructured generation', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{"error":"No compatible endpoints"}', { status: 404 }));
  const response = await call(request(undefined, { response_format: snowflake.responseFormat('layout') }));
  assert.equal(response.status, 404);
  assert.equal(globalThis.fetch.mock.callCount(), 1);
});

test('pre-aborted requests spend no body read, limiter call, or provider fetch', async () => {
  const req = request(AbortSignal.abort(new Error('private reason')));
  let limited = 0;
  const response = await call(req, { RL_GENERATE: { limit() { limited++; return { success: true }; } } });
  assert.equal(response.status, 499);
  assert.deepEqual(await response.json(), { error: 'Request aborted' });
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://daub.dev');
  assert.equal(req.bodyUsed, false);
  assert.equal(limited, 0);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('abort during the limiter check prevents provider fetch', async () => {
  const caller = new AbortController();
  const response = await call(request(caller.signal), { RL_GENERATE: { async limit() {
    caller.abort('private reason');
    return { success: true };
  } } });
  assert.equal(response.status, 499);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('abort while reading the incoming body stays a cancellation', async t => {
  const caller = new AbortController();
  const req = request(caller.signal);
  t.mock.method(req, 'json', async () => {
    caller.abort('private reason');
    throw new DOMException('private reason', 'AbortError');
  });
  const response = await call(req);
  assert.equal(response.status, 499);
  assert.deepEqual(await response.json(), { error: 'Request aborted' });
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

for (const cause of ['caller', 'timeout']) {
  test(`${cause} cancellation reaches an in-flight provider fetch without retry`, async t => {
    const caller = new AbortController();
    const deadline = new AbortController();
    const reason = new DOMException('private reason', cause === 'caller' ? 'AbortError' : 'TimeoutError');
    t.mock.method(AbortSignal, 'timeout', ms => { assert.equal(ms, 60_000); return deadline.signal; });
    let outgoing;
    const fetch = t.mock.method(globalThis, 'fetch', (_url, { signal }) => {
      outgoing = signal;
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        (cause === 'caller' ? caller : deadline).abort(reason);
        if (!signal.aborted) reject(new Error('Cancellation did not reach provider'));
      });
    });
    const response = await call(request(caller.signal));
    assert.equal(response.status, cause === 'caller' ? 499 : 504);
    assert.doesNotMatch((await response.json()).error, /private reason/);
    assert.equal(outgoing.aborted, true);
    assert.equal(outgoing.reason, reason);
    assert.equal(fetch.mock.callCount(), 1);
  });

  test(`${cause} cancellation still aborts the SSE body after headers and a chunk`, async t => {
    const caller = new AbortController();
    const deadline = new AbortController();
    const reason = new DOMException('stopped', cause === 'caller' ? 'AbortError' : 'TimeoutError');
    t.mock.method(AbortSignal, 'timeout', ms => { assert.equal(ms, 60_000); return deadline.signal; });
    let outgoing, streamController;
    const chunk = new TextEncoder().encode('data: {"choices":[]}\n\n');
    t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
      outgoing = signal;
      return new Response(new ReadableStream({ start(controller) {
        streamController = controller;
        controller.enqueue(chunk);
        signal.addEventListener('abort', () => controller.error(signal.reason), { once: true });
      } }));
    });
    const response = await call(request(caller.signal));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'text/event-stream');
    const reader = response.body.getReader();
    assert.deepEqual(await reader.read(), { done: false, value: chunk });
    const pending = reader.read();
    const rejected = assert.rejects(pending, error => error === reason);
    (cause === 'caller' ? caller : deadline).abort(reason);
    const propagated = outgoing.aborted;
    if (!propagated) streamController.error(reason);
    await rejected;
    assert.equal(propagated, true, 'Caller signal must remain connected after headers');
  });
}

test('caller abort during a provider error-body read returns 499', async t => {
  const caller = new AbortController();
  const reason = new DOMException('private reason', 'AbortError');
  let propagated;
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => new Response(new ReadableStream({
    pull(controller) {
      caller.abort(reason);
      propagated = signal.aborted;
      controller.error(signal.aborted ? signal.reason : new Error('Cancellation did not reach provider'));
    },
  }, { highWaterMark: 0 }), { status: 429 }));
  const response = await call(request(caller.signal));
  assert.equal(response.status, 499);
  assert.deepEqual(await response.json(), { error: 'Request aborted' });
  assert.equal(propagated, true);
});

test('downstream stream cancellation reaches the upstream body', async t => {
  let cancelled;
  t.mock.method(globalThis, 'fetch', async () => new Response(new ReadableStream({
    cancel(reason) { cancelled = reason; },
  })));
  const response = await call(request());
  await response.body.cancel('consumer stopped');
  assert.equal(cancelled, 'consumer stopped');
});

test('provider quota responses retain their status and body without retry', async t => {
  const body = JSON.stringify({ error: { message: 'Credits required' } });
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(body, { status: 402 }));
  const response = await call(request());
  assert.equal(response.status, 402);
  assert.equal(await response.text(), body);
  assert.equal(fetch.mock.callCount(), 1);
});
