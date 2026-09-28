// Hosted MCP (functions/api/mcp.js) behaviors the skill used to document as gaps.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

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
