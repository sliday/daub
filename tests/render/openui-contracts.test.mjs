import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { RENDERER_TYPES } from '../../mcp/lib/renderers.js';
import { validateSpec } from '../../mcp/lib/validate.js';

const require = createRequire(import.meta.url);
const { COMP_SCHEMA, openUItoSpec, createStreamingOpenUIParser } = require('../../daub-openui-parser.js');

test('OpenUI schema exposes the complete browser/MCP renderer contract', () => {
  assert.deepEqual(Object.keys(COMP_SCHEMA).sort(), [...RENDERER_TYPES].sort());
});

for (const type of RENDERER_TYPES) {
  test(`OpenUI contract: ${type} survives parsing and MCP validation`, () => {
    const spec = openUItoSpec(`root = ${type}()`);
    assert.equal(spec.elements[spec.root].type, type);
    assert.equal(validateSpec(spec).valid, true);
  });
}

test('new component slots preserve inline elements and named values', () => {
  const spec = openUItoSpec('root = Frame([Meter(72, 0, 100, "warning", "Storage"), NumberField(3, 0, 5, 1, "Quantity")], [Text("Project")], [Button("Save")], true)');
  const frame = spec.elements[spec.root];
  assert.equal(frame.type, 'Frame');
  assert.equal(frame.props.flush, true);
  assert.equal(spec.elements[frame.props.header[0]].props.content, 'Project');
  assert.equal(spec.elements[frame.props.footer[0]].props.label, 'Save');
  assert.equal(spec.elements[frame.children[0]].props.value, 72);
  assert.equal(spec.elements[frame.children[1]].props.value, 3);
  assert.equal(validateSpec(spec).valid, true);
});

test('OpenUI links preserve href and new component types stream', () => {
  const link = openUItoSpec('root = Link("Documentation", "/docs.html", "db-link")');
  assert.equal(link.elements[link.root].props.href, '/docs.html');
  const parser = createStreamingOpenUIParser();
  const { spec } = parser.push('root = Toolbar([Toggle("Bold")], false, "Editor tools")\n');
  assert.equal(spec.elements[spec.root].type, 'Toolbar');
});
