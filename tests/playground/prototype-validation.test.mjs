import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('../../playground-prototype.js', import.meta.url), 'utf8'), context);
const { validate, format } = context.DaubPrototypeUI;
const fixture = () => ({ title: 'Counter', brief: ['Increment a value.'], interactive: true,
  html: '<main id="prototype-app"><button id="add">Add</button><output id="count">0</output></main>',
  css: '#prototype-app { max-width: 40rem; }',
  js: 'let count=0; api.on("#add","click",()=>api.publish({count:++count}));',
  smoke: [{ action: 'click', selector: '#add', value: '' }, { action: 'assertOutput', selector: 'count', value: '1' }],
});

test('prototype format keeps the complete implementation in one strict response', () => {
  const schema = format().json_schema;
  assert.equal(schema.name, 'playground_prototype');
  assert.equal(schema.strict, true);
  assert.equal(schema.schema.additionalProperties, false);
  assert.deepEqual(Array.from(schema.schema.required), ['title', 'brief', 'interactive', 'html', 'css', 'js', 'smoke']);
});

test('validation compiles but never executes generated behavior in the host', () => {
  const value = fixture(); value.js = 'globalThis.didExecute = true;';
  assert.equal(validate(value).js, value.js);
  assert.equal(context.didExecute, undefined);
});

for (const name of ['', ' init']) test('function' + name + ' responses normalize without executing or mutating input', () => {
  const value = fixture(); value.js = 'function' + name + '(container, api) { globalThis.didExecute = true; };';
  const normalized = validate(value);
  assert.match(normalized.js, /^return \(function(?: init)?\(container, api\)/);
  assert.equal(context.didExecute, undefined);
  assert.match(value.js, /^function/);
  new Function('container', 'api', normalized.js);
});

test('a helper declaration followed by initialization remains a function body', () => {
  const value = fixture(); value.js = 'function init(container, api) { globalThis.didExecute = true; } init(container, api);';
  assert.equal(validate(value).js, value.js);
  assert.equal(context.didExecute, undefined);
});

test('invalid JavaScript and active HTML fail before publishing', () => {
  assert.throws(() => validate({ ...fixture(), js: 'const broken = ;' }), /Unexpected token/);
  for (const html of ['<script>alert(1)</script>', '<button onclick="run()">Run</button>', '<iframe src="x"></iframe>', '<a href="javascript:run()">Run</a>']) {
    assert.throws(() => validate({ ...fixture(), html }), /HTML cannot contain/);
  }
  assert.throws(() => validate({ ...fixture(), html: '<button>Test: Force Game Over</button>' }), /test-only/);
});

test('interactive responses require behavior, a user action and an assertion', () => {
  assert.throws(() => validate({ ...fixture(), js: '' }), /core interaction check/);
  assert.throws(() => validate({ ...fixture(), smoke: [] }), /core interaction check/);
  assert.throws(() => validate({ ...fixture(), smoke: [{ action: 'click', selector: '#add', value: '' }] }), /core interaction check/);
  assert.equal(validate({ ...fixture(), interactive: false, js: '', smoke: [] }).interactive, false);
});

test('smoke checks bound wait duration and reject unsafe output paths', () => {
  for (const selector of ['__proto__.x', 'constructor.x', 'prototype', 'x..y']) {
    assert.throws(() => validate({ ...fixture(), smoke: [{ action: 'assertOutput', selector, value: '1' }] }), /output path/);
  }
  assert.throws(() => validate({ ...fixture(), smoke: [{ action: 'wait', selector: '', value: '1501' }] }), /1500/);
  assert.throws(() => validate({ ...fixture(), smoke: Array.from({ length: 3 }, () => ({ action: 'wait', selector: '', value: '1500' })) }), /short interaction/);
  assert.throws(() => validate({ ...fixture(), smoke: [{ action: 'assertText', selector: '#count', value: '' }] }), /meaningful/);
});
