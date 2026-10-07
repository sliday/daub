import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const catalog = JSON.parse(read('components.json'));
const pkg = JSON.parse(read('package.json'));
const blocks = JSON.parse(read('blocks/index.json'));
const themeSection = read('daub.js').match(/var THEME_FAMILIES = \{([\s\S]*?)\n  \};/)[1];
const themeFamilies = [...themeSection.matchAll(/'[^']+':\s*\{\s*light:/g)].length;

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

test('current public copy and metadata use catalog totals', () => {
  for (const path of ['README.md', 'ROADMAP.md', 'demo.html', 'playground.html', 'roadmap.html']) {
    const text = read(path).split('<!-- Version Timeline -->')[0].replace(/\*\*/g, '');
    for (const match of text.matchAll(/\b(\d+) (?:DAUB |neo-skeuomorphic |class-based )?components\b/g)) {
      assert.equal(Number(match[1]), catalog.components.length, path + ': ' + match[0]);
    }
    for (const match of text.matchAll(/\b(\d+) theme families\b/g)) {
      assert.equal(Number(match[1]), themeFamilies, path + ': ' + match[0]);
    }
    for (const match of text.matchAll(/\b(\d+)\+?(?:-block RAG library| block RAG library| pre-made (?:blocks|layout patterns))/g)) {
      assert.equal(Number(match[1]), blocks.length, path + ': ' + match[0]);
    }
  }
  assert.ok(read('README.md').includes('badge/components-' + catalog.components.length + '-'));
  assert.ok(read('README.md').includes('## Components (' + catalog.components.length + ')'));
  assert.ok(read('llms.txt').includes('## Components (' + catalog.components.length + ')'));
  assert.ok(read('README.md').includes('| Components | ' + catalog.components.length + ' in one CSS file |'));
  assert.ok(read('ROADMAP.md').includes('with ' + themeFamilies * 2 + ' variants'));
  assert.ok(read('ROADMAP.md').includes('across ' + new Set(blocks.map(block => block.category)).size + ' categories'));
});
