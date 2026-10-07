import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const require = createRequire(new URL('../../playground-chat/package.json', import.meta.url));
const { transformSync } = require('esbuild');
const source = readFileSync(new URL('../../playground-chat/src/runtime/daub-adapter.ts', import.meta.url), 'utf8');
const compiled = transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2020' }).code;

function adapter(bridge) {
  const module = { exports: {} };
  runInNewContext(compiled, {
    module, exports: module.exports, setTimeout, clearTimeout, console,
    require: (name) => {
      assert.equal(name, './bridge');
      return { getBridge: () => bridge };
    },
  });
  return module.exports.daubAdapter;
}

function fixture(overrides = {}) {
  const calls = [];
  const spec = { root: 'title', elements: { title: { type: 'Text', props: { content: 'Done' } } } };
  return {
    calls,
    getProviderConfig: () => ({ provider: 'openai', fastMode: false }),
    getSystemPrompt: () => 'System', getCurrentSpec: () => null,
    isDefaultMode: () => true,
    cleanJSON: (value) => value, repairJSON: JSON.parse,
    commitSpec: (value) => calls.push(value), renderSpec: () => {},
    setJsonValue: () => {}, pushVersion: () => {}, refreshJsonTree: () => {},
    updatePreviewToolbar: () => {}, hideJsonError: () => {}, showJsonError: () => {},
    streamDefault: (_messages, chunk, done) => { chunk(JSON.stringify(spec)); done(); },
    ...overrides,
  };
}

async function drain(runtime, signal) {
  const results = [];
  for await (const result of runtime.run({ messages: [{ role: 'user', content: [{ type: 'text', text: 'Build' }] }], abortSignal: signal })) results.push(result);
  return results;
}

test('passes the default stream model and abort signal in their source-defined positions', async () => {
  const control = new AbortController();
  let args;
  const bridge = fixture({ streamDefault: (...values) => { args = values; values[1]('{"root":"x","elements":{"x":{"type":"Text"}}}'); values[2](); } });
  await drain(adapter(bridge), control.signal);
  assert.equal(args[4], undefined);
  assert.equal(args[5], control.signal);
  assert.equal(bridge.calls.length, 1);
});

test('handles stream errors without a detached rejected promise', async () => {
  const bridge = fixture({ streamDefault: (_messages, _chunk, _done, error) => error(new Error('Quota exceeded')) });
  await assert.rejects(drain(adapter(bridge), new AbortController().signal), /Quota exceeded/);
  assert.equal(bridge.calls.length, 0);
});

test('does not start a request after cancellation', async () => {
  const control = new AbortController();
  control.abort();
  let requests = 0;
  const bridge = fixture({ streamDefault: () => requests++ });
  await drain(adapter(bridge), control.signal);
  assert.equal(requests, 0);
});

test('does not commit a result when cancellation races with stream completion', async () => {
  const control = new AbortController();
  const bridge = fixture({ streamDefault: (_messages, chunk, done) => {
    chunk('{"root":"x","elements":{"x":{"type":"Text"}}}');
    control.abort(); done();
  } });
  await drain(adapter(bridge), control.signal);
  assert.equal(bridge.calls.length, 0);
});

test('reports malformed model responses without committing them', async () => {
  const bridge = fixture({ streamDefault: (_messages, chunk, done) => { chunk('not a spec'); done(); } });
  const results = await drain(adapter(bridge), new AbortController().signal);
  assert.equal(bridge.calls.length, 0);
  assert.match(results.at(-1).content[0].text, /Could not parse/);
});

test('does not restore the previous preview after New Chat cancels a partial render', async () => {
  const control = new AbortController();
  let current = { root: 'old', elements: { old: { type: 'Text' } } };
  let renders = 0;
  const partial = { root: 'a', elements: { a: { type: 'Text', props: { content: 'a'.repeat(600) } }, b: { type: 'Text' }, c: { type: 'Text' } } };
  const bridge = fixture({
    getCurrentSpec: () => current,
    streamDefault: (_messages, chunk) => chunk(JSON.stringify(partial)),
    renderSpec: () => { renders++; current = null; control.abort(); },
  });
  await drain(adapter(bridge), control.signal);
  assert.equal(renders, 1);
});
