import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { COMP_PROPS, COMP_CATEGORIES, VALID_TYPES } from '../../mcp/lib/prompt.js';

const html = await readFile(new URL('../../playground.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('var COMP_PROPS ='), html.indexOf('// ---- Dynamic system prompt'));
const catalog = { RENDERERS: Object.fromEntries(VALID_TYPES.map((type) => [type, () => {}])) };
runInNewContext(source, catalog);
const plain = (value) => JSON.parse(JSON.stringify(value));

test('embedded component props match the canonical 89-type MCP catalog', () => {
  assert.equal(Object.keys(COMP_PROPS).length, 89);
  assert.deepEqual(plain(catalog.COMP_PROPS), COMP_PROPS);
});

test('embedded component categories match the canonical catalog without duplicate types', () => {
  assert.deepEqual(plain(catalog.COMP_CATEGORIES), COMP_CATEGORIES);
  const types = catalog.COMP_CATEGORIES.flatMap((category) => category[1]);
  assert.equal(types.length, 89);
  assert.equal(new Set(types).size, 89);
});

test('valid types and generation hints expose the canonical registry once per type', () => {
  assert.deepEqual(catalog.VALID_TYPES && plain(catalog.VALID_TYPES), VALID_TYPES);
  const types = catalog.VALID_TYPES_HINT.split('\n')[0].split(': ')[1].split(', ');
  assert.deepEqual(types, VALID_TYPES);
});
