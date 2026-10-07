import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const catalog = JSON.parse(read('components.json'));
const pkg = JSON.parse(read('package.json'));

test('public site component counts match the native catalog', () => {
  for (const path of ['index.html', 'demo.html', 'roadmap.html', 'og-template.html']) {
    const text = read(path).replace(/<[^>]*>/g, '');
    const counts = [...text.matchAll(/(?<!top )\b(\d+) (?:UI |production-ready )?components\b/gi)];
    assert.ok(counts.length, path + ' has a component count');
    for (const match of counts) assert.equal(Number(match[1]), catalog.components.length, path + ': ' + match[0]);
  }
  assert.ok(read('index.html').includes('<td><strong>' + catalog.components.length + '</strong></td>'));
});

test('homepage distinguishes the CDN release from the published npm package', () => {
  const html = read('index.html');
  assert.equal(catalog.version, pkg.version);
  assert.ok(html.includes('CDN v' + pkg.version + '</span>'));
  const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
  assert.ok(schemas.some(schema => schema.version === pkg.version));
  assert.ok(html.includes('https://img.shields.io/npm/v/daub-ui?'));
  assert.ok(html.includes('label=npm%20published'));
});
