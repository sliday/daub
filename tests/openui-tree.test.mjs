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

describe('Tabs with a string list first', () => {
  it('Tabs(["All", "Active", "Done"], "All") is the tab list and active tab, not three Text panels', async () => {
    const s = await parse('root = Tabs(["All", "Active", "Done"], "All")');
    assert.deepEqual(s.elements.root, { type: 'Tabs', props: { tabs: ['All', 'Active', 'Done'], active: 'All' } });
    assert.equal(Object.keys(s.elements).length, 1);
  });
  it('panel refs (bare or quoted statement names) stay children', async () => {
    for (const first of ['[a, b]', '["a", "b"]']) {
      const s = await parse('root = Tabs(' + first + ', [{label: "A", id: "a"}, {label: "B", id: "b"}], "a")\na = Text("x")\nb = Text("y")');
      assert.deepEqual(s.elements.root.children, ['a', 'b']);
    }
  });
});

describe('EmptyState action children', () => {
  it('a 4th positional arg is its children instead of being dropped', async () => {
    const s = await parse('root = EmptyState("bell-off", "No notifications yet", "Alerts will appear here.", [emptyBtn])\nemptyBtn = Button("Notification settings", "primary", "sm")');
    assert.deepEqual(s.elements.root.children, ['emptyBtn']);
    assert.deepEqual(s.elements.root.props, { icon: 'bell-off', title: 'No notifications yet', message: 'Alerts will appear here.' });
  });
});

// Every parent of each child id, across the whole spec
function parents(spec) {
  const out = {};
  for (const [id, el] of Object.entries(spec.elements)) for (const c of el.children || []) (out[c] = out[c] || []).push(id);
  return out;
}

describe('a named element listed under two parents', () => {
  it('renders once: the first placement in document order wins', async () => {
    const s = await parse('root = Stack([tabs, secA])\ntabs = Tabs([panel], [{label: "Overview", id: "o"}], "o")\npanel = Stack([secA])\nsecA = Card([Text("Mon Tue Wed")], "This Week")');
    assert.deepEqual(parents(s).secA, ['panel']);
    assert.deepEqual(s.elements.root.children, ['tabs']);
  });
  it('a repeat in a sibling panel of the same Tabs stays', async () => {
    const s = await parse('root = Tabs([all, unread], [{label: "All", id: "a"}, {label: "Unread", id: "u"}], "a")\nall = Stack([n1, n2])\nunread = Stack([n1])\nn1 = Text("one")\nn2 = Text("two")');
    assert.deepEqual(parents(s).n1.sort(), ['all', 'unread']);
  });
  it('an element listed inside itself loses the self entry', async () => {
    const s = await parse('root = Stack([box])\nbox = Stack([Text("x"), box])');
    assert.deepEqual(parents(s).box, ['root']);
  });
  it('dedupeRefs is exported for JSON specs', () => {
    const { dedupeRefs } = require('../daub-openui-parser.js');
    const els = { r: { type: 'Stack', children: ['a', 'b'] }, b: { type: 'Stack', children: ['a'] }, a: { type: 'Text' } };
    dedupeRefs(els, 'r');
    assert.deepEqual([els.r.children, els.b.children], [['a', 'b'], []]);
  });
});

describe('alias statements (name = otherName)', () => {
  it('root = page makes page the root', async () => {
    const s = await parse('root = page\npage = Stack([Text("Hello"), Card([Text("Body")], "Card title")])');
    assert.equal(s.root, 'page');
    assert.equal(s.elements.root, undefined);
  });
  it('a Tabs panel given as an alias resolves to its target', async () => {
    const s = await parse('root = Stack([tabs])\ntabs = Tabs([p1, p2], [{label: "A", id: "a"}, {label: "B", id: "b"}], "a")\np1 = Card([Text("one")], "One")\np2 = secB\nsecB = Card([Text("two")], "Two")');
    assert.deepEqual(s.elements.tabs.children, ['p1', 'secB']);
  });
  it('aliases to data resolve to the data; cycles stop', async () => {
    const s = await parse('root = List(items2)\nitems2 = items\nitems = [{title: "A"}]');
    assert.deepEqual(s.elements.root.props.items, [{ title: 'A' }]);
    const c = await parse('root = Stack([a])\na = b\nb = a');
    assert.ok(c.elements.root);
  });
});

describe('overlays called id-first (AlertDialog order)', () => {
  it('Modal("id", "Title", "Description", [footer]) maps id, title, description and footer', async () => {
    const s = await parse('root = Stack([openBtn])\nopenBtn = Button("Upload", "primary", trigger: "upload-modal")\nuploadModal = Modal("upload-modal", "Upload files", "Drag files here", [cancelBtn])\ncancelBtn = Button("Cancel", "ghost")');
    assert.deepEqual(s.elements.uploadModal.props, { id: 'upload-modal', title: 'Upload files', description: 'Drag files here', footer: ['cancelBtn'] });
    assert.equal(s.elements.uploadModal.children, undefined);
  });
  it('Modal("id", [body], "Title") keeps the body as children', async () => {
    const s = await parse('root = Stack([m])\nm = Modal("add-habit", [f1], "Add a habit")\nf1 = Input("Name")');
    assert.deepEqual(s.elements.m.props, { id: 'add-habit', title: 'Add a habit' });
    assert.deepEqual(s.elements.m.children, ['f1']);
  });
  it('Modal("uploadModal", ...) with its own statement name no longer nests itself', async () => {
    const s = await parse('root = Stack([b])\nb = Button("Up", trigger: "uploadModal")\nuploadModal = Modal("uploadModal", "Upload Files", "Drop files", [ok])\nok = Button("OK")');
    assert.equal(s.elements.uploadModal.props.id, 'uploadModal');
    assert.equal(s.elements.uploadModal.children, undefined);
  });
  it('the schema order still works: Modal([body], "id", "Title") and Modal("Hello", "m", "Greeting")', async () => {
    const a = await parse('root = Modal([t], "m1", "Title")\nt = Text("x")');
    assert.deepEqual([a.elements.root.props, a.elements.root.children], [{ id: 'm1', title: 'Title' }, ['t']]);
    const b = await parse('root = Modal("Hello", "m", "Greeting")');
    assert.deepEqual(b.elements.root.props, { id: 'm', title: 'Greeting' });
  });
});
