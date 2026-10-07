import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../react/package.json', import.meta.url));
const { build } = require('esbuild');
const result = await build({
  entryPoints: [fileURLToPath(new URL('../../react/src/index.ts', import.meta.url))],
  bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
});
const module = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
const { createElement: h } = require('react');
const { renderToString } = require('react-dom/server');

test('public ChatComposer renders an empty React-owned form without browser globals', () => {
  assert.ok(module.exports.ChatComposer, 'Missing public ChatComposer export');
  assert.equal(typeof window, 'undefined');
  const html = renderToString(h(module.exports.ChatComposer, {
    id: 'compose', className: 'custom', 'aria-label': 'Compose', busy: true,
    models: [{ id: 'demo', label: 'Demo (simulated)' }], placeholder: '\"><script>attack</script>',
    onSend: () => { throw new Error('SSR must not dispatch host events'); },
  }));
  assert.match(html, /^<form/);
  assert.match(html, /class="db-chat-composer custom"/);
  assert.match(html, /data-db-react=""/);
  assert.match(html, /data-db-chat-options="/);
  assert.match(html, /id="compose"/);
  assert.match(html, /aria-label="Compose"/);
  assert.match(html, /><\/form>$/);
  assert.doesNotMatch(html, /<script|models=|busy=|placeholder=|onSend=/);
});
