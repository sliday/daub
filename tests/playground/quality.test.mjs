import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const quality = createRequire(import.meta.url)('../../playground-quality.js');

function previewFixture(ids = []) {
  const targets = ids.map(id => ({ getAttribute: name => name === 'data-spec-id' ? id : null }));
  return { calls: [], targets, querySelectorAll: () => targets };
}

for (const code of ['let questions = [;', 'let count = ;']) {
  test('invalid shared syntax aborts all chunks: ' + code, t => {
    const preview = previewFixture();
    const errors = [];
    quality.executeCustomJS(preview, [
      { id: 'before', code: 'preview.calls.push("before");' },
      { id: '_shared_state', code },
      { id: 'after', code: 'preview.calls.push("after");' },
    ], error => errors.push(error));
    t.diagnostic(`Shared initializer errors: ${errors.length}; dependent chunks run: ${preview.calls.length}`);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].name, 'SyntaxError');
    assert.ok(errors[0].message.includes('CustomHTML _shared_state: '));
    assert.deepEqual(preview.calls, []);
  });
}

test('shared initialization failure aborts dependent chunks and reports the original error', () => {
  const preview = previewFixture();
  preview.failure = new Error('Seed unavailable');
  const errors = [];
  quality.executeCustomJS(preview, [
    { id: '_shared_state', code: 'let count = 0; throw preview.failure;' },
    { id: 'dependent', code: 'preview.calls.push(count);' },
  ], error => errors.push(error));
  assert.equal(errors.length, 1);
  assert.equal(errors[0].cause, preview.failure);
  assert.ok(errors[0].message.includes('CustomHTML _shared_state: Seed unavailable'));
  assert.deepEqual(preview.calls, []);
});

for (const code of [null, undefined, 42, {}]) test('non-string shared initializer aborts chunks: ' + JSON.stringify(code), () => {
  const preview = previewFixture(), errors = [];
  quality.executeCustomJS(preview, [
    { id: '_shared_state', code },
    { id: 'dependent', code: 'preview.calls.push("ran");' },
  ], error => errors.push(error));
  assert.equal(errors.length, 1);
  assert.equal(errors[0].name, 'TypeError');
  assert.ok(errors[0].message.includes('CustomHTML _shared_state: '));
  assert.deepEqual(preview.calls, []);
});

test('shared declarations span initializers while chunk locals and returns stay isolated', () => {
  const preview = previewFixture(['first', 'second']);
  const errors = [];
  quality.executeCustomJS(preview, [
    { id: 'first', code: 'let local = "first"; var privateValue = 1; count++; container.result = title + count; preview.calls.push(local); return;' },
    { id: '_shared_state', code: 'let count = 0; const title = "Step ";' },
    { id: '_shared_state', code: 'const initial = count; function next() { return ++count; }' },
    { id: 'second', code: 'let local = "second"; container.result = title + next(); preview.calls.push(local, initial, typeof privateValue);' },
  ], error => errors.push(error));
  assert.deepEqual(errors, []);
  assert.deepEqual(preview.calls, ['first', 'second', 0, 'undefined']);
  assert.deepEqual(preview.targets.map(target => target.result), ['Step 1', 'Step 2']);
});

test('chunk callbacks retain shared lexical state after execution without leaking between runs', () => {
  const errors = [];
  const first = previewFixture(), second = previewFixture();
  const items = [
    { id: '_shared_state', code: 'let count = 0; const values = [];' },
    { id: 'write', code: 'preview.increment = function() { values.push(++count); };' },
    { id: 'read', code: 'preview.read = function() { return [count, values.slice()]; };' },
  ];
  quality.executeCustomJS(first, items, error => errors.push(error));
  quality.executeCustomJS(second, items, error => errors.push(error));
  first.increment(); first.increment(); second.increment();
  assert.deepEqual(first.read(), [2, [1, 2]]);
  assert.deepEqual(second.read(), [1, [1]]);
  assert.deepEqual(errors, []);
});

test('a syntax error in any shared initializer prevents even valid initializers from running', () => {
  const preview = previewFixture(), errors = [];
  quality.executeCustomJS(preview, [
    { id: '_shared_state', code: 'preview.calls.push("seed"); let count = 1;' },
    { id: '_shared_state', code: 'const invalid = ;' },
    { id: 'dependent', code: 'preview.calls.push(count);' },
  ], error => errors.push(error));
  assert.equal(errors.length, 1);
  assert.deepEqual(preview.calls, []);
});

test('conflicting shared declarations abort before side effects', () => {
  const preview = previewFixture(), errors = [];
  quality.executeCustomJS(preview, [
    { id: '_shared_state', code: 'preview.calls.push("seed"); let count = 1;' },
    { id: '_shared_state', code: 'let count = 2;' },
    { id: 'dependent', code: 'preview.calls.push(count);' },
  ], error => errors.push(error));
  assert.equal(errors.length, 1);
  assert.equal(errors[0].name, 'SyntaxError');
  assert.ok(errors[0].message.includes('CustomHTML _shared_state: '));
  assert.deepEqual(preview.calls, []);
});

test('invalid or throwing ordinary chunks do not prevent independent siblings', () => {
  const preview = previewFixture(), errors = [];
  quality.executeCustomJS(preview, [
    { id: '_shared_state', code: 'const seed = 7;' },
    { id: 'bad-syntax', code: 'const invalid = ;' },
    { id: 'bad-runtime', code: 'throw new Error("Chunk failed");' },
    { id: 'good', code: 'preview.calls.push(seed);' },
  ], error => errors.push(error));
  assert.equal(errors.length, 2);
  assert.equal(errors[0].name, 'SyntaxError');
  assert.ok(errors[0].message.includes('CustomHTML bad-syntax: '));
  assert.ok(errors[1].message.includes('CustomHTML bad-runtime: Chunk failed'));
  assert.deepEqual(preview.calls, [7]);
});

test('error context does not mutate reused frozen errors or prevent sibling execution', () => {
  const preview = previewFixture(), errors = [];
  preview.failure = Object.freeze(new Error('Shared failure'));
  quality.executeCustomJS(preview, [
    { id: 'first', code: 'throw preview.failure;' },
    { id: 'second', code: 'throw preview.failure;' },
    { code: 'throw "Thrown string";' },
    { id: 'good', code: 'preview.calls.push("ran");' },
  ], error => errors.push(error));
  assert.equal(errors.length, 3);
  assert.ok(errors[0].message.includes('CustomHTML first: Shared failure'));
  assert.ok(errors[1].message.includes('CustomHTML second: Shared failure'));
  assert.ok(errors[2].message.includes('CustomHTML #3: Thrown string'));
  assert.equal(errors[0].cause, preview.failure);
  assert.equal(errors[1].cause, preview.failure);
  assert.equal(preview.failure.message, 'Shared failure');
  assert.deepEqual(preview.calls, ['ran']);
});

test('serialized runner reports chunk IDs to health tracking without module closures', () => {
  const listeners = {};
  const context = vm.createContext({
    preview: previewFixture(),
    items: [
      { id: 'qty1', code: 'const broken = ;' },
      { id: 'applyBtn', code: 'throw new Error("Missing field");' },
    ],
    addEventListener: (type, callback) => { listeners[type] = callback; },
  });
  vm.runInContext('window = globalThis;', context);
  vm.runInContext('(' + quality.installHealthTracking.toString() + ')();', context);
  vm.runInContext('(' + quality.executeCustomJS.toString() + ')(preview, items, window.__pgReportError);', context);
  const messages = Array.from(context.__pgRuntimeErrors);
  assert.equal(messages.length, 2);
  assert.ok(messages[0].includes('CustomHTML qty1: '));
  assert.ok(messages[1].includes('CustomHTML applyBtn: Missing field'));
});

test('missing or absent target IDs use the preview as container', () => {
  const preview = previewFixture(), errors = [];
  quality.executeCustomJS(preview, [
    { id: 'missing', code: 'preview.calls.push(container === preview);' },
    { code: 'preview.calls.push(container === preview);' },
  ], error => errors.push(error));
  assert.deepEqual(preview.calls, [true, true]);
  assert.deepEqual(errors, []);
});

function initializedState(definitions) {
  const window = {};
  vm.runInNewContext(quality.parseStateDefs(definitions), { window });
  return window;
}

test('parseStateDefs accepts empty or absent state', () => {
  for (const input of [undefined, null, []]) assert.equal(quality.parseStateDefs(input), '');
});

test('parseStateDefs preserves JSON primitive types and decodes quoted strings once', () => {
  const state = initializedState([
    '(score 0)', '(running false)', '(enabled true)', '(empty null)',
    '(speed -1.25e2)', '(negativeZero -0)', '(label "all")', '(blank "")',
    '(escaped "line\\n\\\"quoted\\\"")', ' ($value_2 3) ',
  ]);
  assert.deepEqual(state, {
    score: 0, running: false, enabled: true, empty: null, speed: -125, negativeZero: -0,
    label: 'all', blank: '', escaped: 'line\n"quoted"', $value_2: 3,
  });
});

test('parseStateDefs accepts multiline nested JSON without interpreting prose as code', () => {
  const state = initializedState([
    '(recipes [\n {"name": "Taco", "tags": ["quick", "(fresh)"]},\n {"name": "Soup", "available": true}\n])',
    '(options {\n "count": 2,\n "filter": null, "note": "(array salmon taco)"\n})',
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(state)), {
    recipes: [{ name: 'Taco', tags: ['quick', '(fresh)'] }, { name: 'Soup', available: true }],
    options: { count: 2, filter: null, note: '(array salmon taco)' },
  });
});

test('parseStateDefs preserves JSON __proto__ keys as data', () => {
  const state = initializedState(['(data {"__proto__":{"polluted":true}})']);
  assert.equal(Object.hasOwn(state.data, '__proto__'), true);
  assert.equal(state.data.polluted, undefined);
  assert.equal(state.data.__proto__.polluted, true);
});

for (const input of [
  '', false, 0, {}, '(score 0)', [null], [42], [{}], Array(1),
  ['score 0'], ['(score)'], ['(score )'], ['(score 0) trailing'],
  ['(recipes (array salmon taco))'], ['(filter all)'], ["(filter 'all')"], ['(value `all`)'],
  ['(value undefined)'], ['(value NaN)'], ['(value Infinity)'], ['(value +1)'],
  ['(value 01)'], ['(value 0x10)'], ['(value 1+2)'], ['(value [1,])'],
  ['(value {key: 1})'], ['(value {"key":1,})'], ['(value /* seed */ 1)'],
  ['(value 1); globalThis.injected = true; (0)'],
  ['(value 1e400)'], ['(value [1e400])'],
  ['(1score 0)'], ['(a.b 0)'], ['(a-b 0)'], ['(x[0] 0)'],
  ['(class 0)'], ['(let 0)'], ['(await 0)'], ['(eval 0)'], ['(arguments 0)'],
  ['(score 0)', '(score 1)'],
]) test('parseStateDefs throws an Error for invalid state: ' + JSON.stringify(input), () => {
  assert.throws(() => quality.parseStateDefs(input), error => error instanceof Error && /state/i.test(error.message));
});

test('browser export includes parser and executes its state initializer before chunks', () => {
  const sandbox = vm.createContext({});
  vm.runInContext(readFileSync(new URL('../../playground-quality.js', import.meta.url), 'utf8'), sandbox);
  vm.runInContext('window = globalThis;', sandbox);
  const { DaubQuality } = sandbox;
  const preview = previewFixture(), errors = [];
  DaubQuality.executeCustomJS(preview, [
    { id: '_shared_state', code: DaubQuality.parseStateDefs(['(count 0)', '(items ["first"])']) },
    { id: 'increment', code: 'count++; items.push("second");' },
    { id: 'read', code: 'preview.calls.push(count, window.count, items.join(","));' },
  ], error => errors.push(error));
  assert.deepEqual(errors, []);
  assert.deepEqual(preview.calls, [1, 1, 'first,second']);
});

test('health tracking reports later event errors and deduplicates notifications', () => {
  const listeners = {}, notifications = [];
  const window = { addEventListener: (name, handler) => { listeners[name] = handler; } };
  const install = vm.runInNewContext('(' + quality.installHealthTracking.toString() + ')', { window });
  install(message => notifications.push(message));
  assert.deepEqual(notifications, []);
  listeners.error({ error: new Error('Delayed callback failed') });
  listeners.error({ error: new Error('Delayed callback failed') });
  listeners.unhandledrejection({ reason: new Error('Async callback failed') });
  assert.deepEqual(notifications, ['Delayed callback failed', 'Async callback failed']);
  assert.equal(window.__pgRuntimeErrors.length, 2);
});
