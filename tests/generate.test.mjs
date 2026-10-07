import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/generate.js';

function request(signal) {
  return new Request('https://daub.dev/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://daub.dev' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Build a dashboard' }] }),
    signal,
  });
}

function call(req, env = {}) {
  return onRequestPost({ request: req, env: { OPENROUTER_API_KEY: 'test-key', ...env } });
}

beforeEach(t => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Live calls forbidden'); });
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
