// Hosted MCP (functions/api/mcp.js) behaviors the skill used to document as gaps.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const parser = require('../daub-openui-parser.js');
const mcp = await import(pathToFileURL(path.resolve('functions/api/mcp.js')).href);

async function call(name, args) {
  const req = new Request('https://daub.dev/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
  const res = await mcp.onRequestPost({ request: req, env: {} });
  const { result } = await res.json();
  const text = result.content[0].text;
  return { isError: !!result.isError, text, json: result.isError ? null : JSON.parse(text) };
}

const SPEC = { theme: 'nord', root: 'r', elements: { r: { type: 'Stack', children: ['t'] }, t: { type: 'Text', props: { content: 'Hi' } } } };

describe('validate_spec and render_spec take the spec as a JSON string or an object', () => {
  for (const tool of ['validate_spec', 'render_spec']) {
    it(`${tool}: object and string give the same result`, async () => {
      const a = await call(tool, { spec: SPEC });
      const b = await call(tool, { spec: JSON.stringify(SPEC) });
      assert.equal(a.isError, false, a.text);
      assert.deepEqual(a.json, b.json);
      const v = tool === 'render_spec' ? a.json.validation : a.json;
      assert.equal(v.valid, true, JSON.stringify(v.issues));
    });
    it(`${tool}: a missing spec names the argument; bad JSON still fails`, async () => {
      const missing = await call(tool, {});
      assert.equal(missing.isError, true);
      assert.match(missing.text, /requires "spec" as a JSON string or object/);
      const bad = await call(tool, { spec: '{"root":' });
      assert.equal(bad.isError, true);
      assert.match(bad.text, /JSON/);
    });
  }
  it('render_spec embeds the object spec in the page', async () => {
    const { json } = await call('render_spec', { spec: SPEC });
    assert.deepEqual(json.spec, SPEC);
    assert.match(json.html, /data-theme="nord"/);
  });
});

describe('Icon and Link parse and validate like the playground', () => {
  const CODE = 'root = Stack([icon, link], "horizontal")\nicon = Icon("star", "lg", "branded")\nlink = Link("Docs")';

  it('parse_openui builds Icon and Link elements, the same spec as daub-openui-parser.js', async () => {
    const { json } = await call('parse_openui', { code: CODE });
    assert.deepEqual(json.spec, parser.openUItoSpec(CODE));
    assert.deepEqual(json.spec.elements.icon, { type: 'Icon', props: { name: 'star', size: 'lg', variant: 'branded' } });
    assert.deepEqual(json.spec.elements.link, { type: 'Link', props: { label: 'Docs' } });
    assert.equal(json.validation.valid, true, JSON.stringify(json.validation.issues));
  });

  it('inline Icon(...) stays an Icon, not a stray Text with a dangling child id', async () => {
    const { json } = await call('parse_openui', { code: 'root = Stack([Icon("check"), Text("Done")])' });
    const kids = json.spec.elements.root.children.map(id => json.spec.elements[id]);
    assert.deepEqual(kids.map(k => k && k.type), ['Icon', 'Text']);
    assert.equal(json.validation.valid, true, JSON.stringify(json.validation.issues));
  });

  it('the hosted parser knows every type daub-openui-parser.js knows, in the same positional order', () => {
    const src = readFileSync('functions/api/mcp.js', 'utf8');
    const hosted = new Function('return ' + /const COMP_SCHEMA = (\{[\s\S]*?\n\});/.exec(src)[1])();
    assert.deepEqual(hosted, parser.COMP_SCHEMA);
  });

  it('get_component_catalog lists Icon and Link with props', async () => {
    const { json } = await call('get_component_catalog', {});
    for (const t of ['Icon', 'Link']) assert.ok(json.all_types.includes(t), t);
    assert.match(json.categories['Layout & Structure'].Icon, /Lucide icon name/);
  });

  it('validate_spec passes every block that uses Icon or Link', async () => {
    const index = JSON.parse(readFileSync('blocks/index.json', 'utf8'));
    const uses = index.filter(b => (b.components_used || []).some(t => t === 'Icon' || t === 'Link'));
    assert.ok(uses.length >= 60, `only ${uses.length} blocks use Icon or Link`);
    const unknown = [];
    for (const b of uses) {
      const { json } = await call('validate_spec', { spec: readFileSync(path.join('blocks', b.file), 'utf8') });
      for (const i of json.issues) if (/Unknown type/.test(i)) unknown.push(`${b.id}: ${i}`);
    }
    assert.deepEqual(unknown, []);
  });
});
