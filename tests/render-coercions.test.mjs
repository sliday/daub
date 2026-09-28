// normalizeProps coercions for model-written props, checked in all three renderer copies:
// playground.html (inline RENDERERS), daub-render.js (hosted MCP page) and mcp/lib/renderers.js (npm MCP).
// Each copy's helper block (mkEl .. normalizeProps) runs in a vm with a stub DOM and a stub lucide build.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Lucide names the stub build knows; anything else is "not an icon" (mkIcon returns null)
const LUCIDE = ['KeyRound', 'CircleCheck', 'Users', 'Headset', 'DollarSign', 'ShieldCheck', 'Minus', 'Check'];

function stubEl(tag) {
  return { tagName: String(tag).toUpperCase(), style: {}, attrs: {}, children: [], setAttribute(k, v) { this.attrs[k] = String(v); }, appendChild(c) { this.children.push(c); return c; } };
}

function load(file) {
  const src = readFileSync(file, 'utf8');
  const start = src.indexOf('function mkEl(');
  const end = src.indexOf('// Visible label above a control');
  assert.ok(start > 0 && end > start, file + ': helper block not found');
  const ctx = {
    document: { createElement: stubEl, createElementNS: (ns, tag) => stubEl(tag) },
    lucide: { icons: Object.fromEntries(LUCIDE.map(k => [k, []])) },
  };
  vm.createContext(ctx);
  vm.runInContext('var RENDERING = Object.create(null);\n' + src.slice(start, end) + '\nthis.normalizeProps = normalizeProps;', ctx);
  return ctx.normalizeProps;
}

const COPIES = {
  playground: load('playground.html'),
  'daub-render': load('daub-render.js'),
  'mcp-renderers': load('mcp/lib/renderers.js'),
};

// Run one normalizeProps call in every copy; all must agree, and the result must match `want` (a subset check)
function norm(type, props, want) {
  const outs = Object.entries(COPIES).map(([name, fn]) => [name, JSON.parse(JSON.stringify(fn(type, props)))]);
  for (const [name, out] of outs.slice(1)) assert.deepEqual(out, outs[0][1], name + ' disagrees with playground for ' + type + ' ' + JSON.stringify(props));
  const got = outs[0][1];
  for (const k of Object.keys(want)) assert.deepEqual(got[k], want[k], type + '.' + k + ' for ' + JSON.stringify(props));
  return got;
}

describe('Avatar: src takes only an image URL', () => {
  it('a size token in the src slot becomes the size', () => {
    norm('Avatar', { initials: 'MC', src: 'sm' }, { initials: 'MC', src: '', size: 'sm' });
  });
  it('a name in the src slot is dropped, initials stay', () => {
    norm('Avatar', { initials: 'JD', src: 'Jordan Diaz' }, { initials: 'JD', src: '' });
  });
  it('swapped args: a URL in initials moves to src', () => {
    norm('Avatar', { initials: 'https://i.pravatar.cc/80?img=12', src: 'Ada Lovelace' }, { initials: '', src: 'https://i.pravatar.cc/80?img=12' });
  });
  it('an explicit size wins over a size token in src', () => {
    norm('Avatar', { initials: 'MC', src: 'lg', size: 'sm' }, { src: '', size: 'sm' });
  });
  it('real image URLs are untouched', () => {
    for (const src of ['https://i.pravatar.cc/80', '//cdn.x/a.png', '/img/me.jpg', './me.webp', 'me.png', 'blob:abc']) {
      norm('Avatar', { initials: 'MC', src }, { initials: 'MC', src });
    }
  });
});
