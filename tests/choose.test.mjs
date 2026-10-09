import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideComponents, onRequestPost, jevDecide } from '../functions/api/choose.js';

const components = { Button: 'Submit the response', RadioGroup: 'Pick one answer' };
const answers = { Button: { type: 'noul', noul: 0.9 }, RadioGroup: { type: 'noul', noul: 0.85 } };

test('component selection sends one Jev latest Decisions batch and returns the resolved model', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://openrouter.ai/api/alpha/decisions');
    const body = JSON.parse(options.body);
    assert.equal(body.model, '~typesafe/jev-latest');
    assert.deepEqual(body.state, { request: 'A quiz' });
    assert.deepEqual(Object.keys(body.questions), Object.keys(components));
    assert.ok(Object.values(body.questions).every(q => q.type === 'noul'));
    return Response.json({ model: 'typesafe/jev-tested-version', answers, usage: { cost: 0.001 } });
  });
  assert.deepEqual(await decideComponents({ prompt: 'A quiz', components, apiKey: 'fixture' }), {
    model: 'typesafe/jev-tested-version', scores: { Button: 0.9, RadioGroup: 0.85 }, usage: { cost: 0.001 },
  });
  assert.equal(fetch.mock.callCount(), 1);
});

for (const answer of [undefined, { noul: 0.9 }, { type: 'choice', noul: 0.9 }, { type: 'noul', noul: '0.9' }, { type: 'noul', noul: -0.1 }, { type: 'noul', noul: 1.1 }, { type: 'noul', noul: null }]) {
  test('rejects incomplete or invalid component probability ' + JSON.stringify(answer), async t => {
    const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ answers: { ...answers, Button: answer } }));
    await assert.rejects(decideComponents({ prompt: 'Quiz', components, apiKey: 'fixture' }), { status: 502 });
    assert.equal(fetch.mock.callCount(), 1);
  });
}

for (const status of [402, 429]) test('selector forwards quota status without retry ' + status, async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { message: 'Fixture limit' } }, { status }));
  const response = await onRequestPost({
    request: new Request('https://daub.dev/api/choose', { method: 'POST', body: JSON.stringify({ prompt: 'Quiz', components }) }),
    env: { OPENROUTER_API_KEY: 'fixture' },
  });
  assert.equal(response.status, status);
  assert.equal(fetch.mock.callCount(), 1);
});

test('an aborted selector never contacts the provider', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected provider call'); });
  const response = await onRequestPost({
    request: new Request('https://daub.dev/api/choose', { method: 'POST', body: JSON.stringify({ prompt: 'Quiz', components }), signal: AbortSignal.abort() }),
    env: { OPENROUTER_API_KEY: 'fixture' },
  });
  assert.equal(response.status, 499);
  assert.equal(fetch.mock.callCount(), 0);
});

test('other Jev callers keep their pinned default', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(JSON.parse(options.body).model, 'typesafe/jev-1.13-20260917');
    return Response.json({ answers: {} });
  });
  await jevDecide({ state: {}, questions: {}, apiKey: 'fixture' });
});
