// OpenUI parse fixes for shapes models write, checked in both parser copies:
// daub-openui-parser.js (playground, npm MCP) and the inline parser in functions/api/mcp.js (hosted MCP, parse_openui tool).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { openUItoSpec } = require('../daub-openui-parser.js');
const mcp = await import(pathToFileURL(path.resolve('functions/api/mcp.js')).href);

async function hostedParse(code) {
  const req = new Request('https://daub.dev/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'parse_openui', arguments: { code } } }),
  });
  const res = await mcp.onRequestPost({ request: req, env: {} });
  return JSON.parse((await res.json()).result.content[0].text).spec;
}

// Parse with both copies; they must produce the same spec
async function parse(code) {
  const a = openUItoSpec(code), b = await hostedParse(code);
  assert.deepEqual(b, a, 'functions/api/mcp.js parser disagrees with daub-openui-parser.js');
  return a;
}

describe('__state keys passed to controls', () => {
  it('Switch(webhook1) takes its checked state from __state, not a label', async () => {
    const s = await parse('__state = {webhook1: true, w2: false}\nroot = Stack([Switch(webhook1), Checkbox(w2), Toggle(webhook1)])');
    const [sw, cb, tg] = s.elements.root.children.map(id => s.elements[id].props);
    assert.deepEqual(sw, { checked: true });
    assert.deepEqual(cb, { checked: false });
    assert.deepEqual(tg, { pressed: true });
  });
  it('explicit positional state wins; unknown identifiers and statement names keep today\'s behavior', async () => {
    const s = await parse('__state = {w2: false}\nroot = Stack([Switch(w2, true), Switch(nope), Switch(lbl)])\nlbl = Text("x")');
    const [a, b, c] = s.elements.root.children.map(id => s.elements[id].props);
    assert.equal(a.checked, true);
    assert.equal(b.label, 'nope');
    assert.equal(c.label, 'lbl');
  });
});
