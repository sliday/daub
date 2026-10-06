import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdtemp, rm, copyFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { DAUB_RENDER_BODY, RENDERER_TYPES, THEMES } from '../../mcp/lib/renderers.js';
import { COMP_CATEGORIES, COMP_PROPS, VALID_TYPES, buildSystemPrompt } from '../../mcp/lib/prompt.js';
import { validateSpec } from '../../mcp/lib/validate.js';
import { renderToHTML } from '../../mcp/lib/render.js';
import { onRequestPost } from '../../functions/api/mcp.js';
import { buildRendererModule } from './sync-renderers.mjs';

const root = new URL('../../', import.meta.url);
const require = createRequire(import.meta.url);
const canonical = require('../../daub-render.js');
const css = await readFile(new URL('daub.css', root), 'utf8');
const runtime = await readFile(new URL('daub.js', root), 'utf8');
const additions = ['CheckboxGroup', 'Fieldset', 'Frame', 'Group', 'Meter', 'NumberField', 'PreviewCard', 'Toolbar'];
const spec = { theme: 'github-dark', root: 'page', elements: {
  page: { type: 'Stack', children: additions.map(type => type.toLowerCase()) },
  checkboxgroup: { type: 'CheckboxGroup', props: { label: 'Topics', helper: 'Choose topics', inline: true }, children: ['design'] },
  design: { type: 'Checkbox', props: { label: 'Design', checked: true } },
  fieldset: { type: 'Fieldset', props: { legend: 'Profile', helper: 'Workspace profile' }, children: ['name'] },
  name: { type: 'Input', props: { label: 'Name', value: 'Ada' } },
  frame: { type: 'Frame', props: { header: 'Project', footer: 'Updated today', flush: true }, children: ['summary'] },
  summary: { type: 'Text', props: { content: 'Three tasks are ready.' } },
  group: { type: 'Group', props: { attached: true, label: 'Actions' }, children: ['save'] },
  save: { type: 'Button', props: { label: 'Save' } },
  meter: { type: 'Meter', props: { value: 72, status: 'warning', label: 'Storage' } },
  numberfield: { type: 'NumberField', props: { min: 0, max: 5, defaultValue: 3, label: 'Quantity' } },
  previewcard: { type: 'PreviewCard', props: { trigger: 'Account', title: 'Ada Lovelace', description: 'Workspace owner' } },
  toolbar: { type: 'Toolbar', props: { label: 'Editor tools' }, children: ['bold'] },
  bold: { type: 'Toggle', props: { label: 'Bold' } },
} };
let browser;
let work;
before(async () => {
  work = await mkdtemp(join(tmpdir(), 'daub-render-contracts-'));
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
});
after(async () => { await browser?.close(); if (work) await rm(work, { recursive: true, force: true }); });

async function callCloud(name, args) {
  const response = await onRequestPost({ request: new Request('https://daub.test/api/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) }), env: {} });
  assert.equal(response.status, 200);
  const result = (await response.json()).result;
  assert.equal(result.isError, undefined, result.content[0].text);
  return JSON.parse(result.content[0].text);
}

async function openHTML(html, viewport = { width: 1280, height: 900 }) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url === 'http://daub.test/') return route.fulfill({ contentType: 'text/html', body: html });
    if (url.includes('/daub.css')) return route.fulfill({ contentType: 'text/css', body: css });
    if (url.includes('/daub.js')) return route.fulfill({ contentType: 'application/javascript', body: runtime });
    if (url.includes('lucide')) return route.fulfill({ contentType: 'application/javascript', body: 'window.lucide = { createIcons: function() {} };' });
    return route.fulfill({ contentType: 'text/css', body: '' });
  });
  await page.goto('http://daub.test/');
  assert.deepEqual(errors, []);
  return page;
}

test('generated MCP snapshot equals the canonical browser body', async () => {
  assert.equal(DAUB_RENDER_BODY, canonical.DAUB_RENDER_BODY);
  assert.deepEqual(RENDERER_TYPES, canonical.RENDERER_TYPES);
  assert.equal(await readFile(new URL('mcp/lib/renderers.js', root), 'utf8'), buildRendererModule());
  assert.doesNotMatch(await readFile(new URL('mcp/lib/renderers.js', root), 'utf8'), /DAUB_RENDER_FACTORY\.toString\(/);
});

test('local and cloud catalogs and valid types cover the renderer registry', async () => {
  assert.equal(RENDERER_TYPES.length, 87);
  assert.deepEqual([...VALID_TYPES].sort(), [...RENDERER_TYPES].sort());
  assert.deepEqual(COMP_CATEGORIES.flatMap(([, types]) => types).sort(), [...RENDERER_TYPES].sort());
  assert.deepEqual(Object.keys(COMP_PROPS).sort(), [...RENDERER_TYPES].sort());
  const cloud = await callCloud('get_component_catalog', {});
  assert.deepEqual([...cloud.all_types].sort(), [...RENDERER_TYPES].sort());
  assert.deepEqual(Object.values(cloud.categories).flatMap(category => Object.keys(category)).sort(), [...RENDERER_TYPES].sort());
  for (const type of additions) assert.equal(Object.values(cloud.categories).find(category => type in category)[type], COMP_PROPS[type]);
  assert.deepEqual(cloud.themes, THEMES);
});

test('catalog theme names match the native theme list and CSS', async () => {
  const themes = Object.values(THEMES).flat();
  assert.equal(themes.length, 42);
  assert.equal(new Set(themes).size, 42);
  const page = await openHTML('<html><body><script src="https://daub.test/daub.js"></script></body></html>');
  assert.deepEqual((await page.evaluate(() => DAUB.THEMES)).sort(), [...themes].sort());
  for (const theme of themes.filter(theme => !['light', 'dark'].includes(theme))) assert.ok(css.includes(`[data-theme="${theme}"]`), theme);
  for (const text of [buildSystemPrompt([], 'Build a blog'), buildSystemPrompt([], 'Build a fitness app')]) assert.doesNotMatch(text, /"(?:paper|material-dark|solarized-light|gruvbox-dark)"/);
  await page.close();
});

test('local and cloud validators accept new types and reject broken slot references and themes', async () => {
  assert.equal(validateSpec(spec).valid, true);
  assert.deepEqual(await callCloud('validate_spec', { spec: JSON.stringify(spec) }), validateSpec(spec));
  for (const invalid of [
    { ...spec, theme: 'paper' },
    { ...spec, elements: { root: null }, root: 'root' },
    { root: 'root', elements: { root: { type: 'Frame', props: { footer: ['missing'] } } } },
    { root: 'root', elements: { root: { type: 'Toolbar', children: 'missing' } } },
    { root: '__proto__', elements: { root: { type: 'Text', props: { content: 'Workspace' } } } },
    { root: 'root', elements: { root: { type: 'Frame', props: { footer: ['constructor'] } } } },
  ]) {
    const validation = validateSpec(invalid);
    assert.equal(validation.valid, false);
    assert.deepEqual(await callCloud('validate_spec', { spec: JSON.stringify(invalid) }), validation);
  }
  const namedPrototype = JSON.parse('{"root":"__proto__","elements":{"__proto__":{"type":"Stack","children":["save"]},"save":{"type":"Button","props":{"label":"Save","variant":"primary"}}}}');
  assert.equal(validateSpec(namedPrototype).valid, true);
});

for (const mode of ['local', 'cloud']) {
  test(`${mode} HTML renders all eight components without external services at desktop and mobile sizes`, async () => {
    const html = mode === 'local' ? await readFile(renderToHTML(spec, join(work, 'local.html')), 'utf8') : (await callCloud('render_spec', { spec: JSON.stringify(spec) })).html;
    assert.ok(html.includes(DAUB_RENDER_BODY));
    assert.doesNotMatch(html, /var\(--db-(?:bg|fg)\)/);
    for (const width of [1280, 390]) {
      const page = await openHTML(html, { width, height: 900 });
      assert.equal(await page.getByRole('group', { name: 'Topics' }).count(), 1);
      assert.equal(await page.getByRole('group', { name: 'Profile' }).count(), 1);
      assert.equal(await page.getByRole('meter', { name: 'Storage' }).getAttribute('aria-valuenow'), '72');
      await page.getByRole('button', { name: 'Increase quantity' }).click();
      assert.equal(await page.getByRole('spinbutton', { name: 'Quantity' }).inputValue(), '4');
      await page.getByRole('button', { name: 'Bold' }).click();
      assert.equal(await page.getByRole('button', { name: 'Bold' }).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('.db-frame--flush').count(), 1);
      assert.equal(await page.locator('.db-preview-card__title').textContent(), 'Ada Lovelace');
      const colors = await page.evaluate(() => {
        const body = getComputedStyle(document.body);
        const probe = document.createElement('span');
        probe.style.cssText = 'background:var(--db-color-bg);color:var(--db-color-text)';
        document.body.append(probe);
        const expected = getComputedStyle(probe);
        return [body.backgroundColor, body.color, expected.backgroundColor, expected.color];
      });
      assert.deepEqual(colors.slice(0, 2), colors.slice(2));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (process.env.DAUB_RENDER_SCREENSHOTS) {
        await mkdir(process.env.DAUB_RENDER_SCREENSHOTS, { recursive: true });
        await page.screenshot({ path: join(process.env.DAUB_RENDER_SCREENSHOTS, `${mode}-${width}.png`), fullPage: true });
      }
      await page.close();
    }
  });

  test(`${mode} HTML contains hostile theme and spec strings without script execution`, async () => {
    const content = '</script><script>window.injected = true</script><img src=x onerror="window.injected = true">\u2028\u2029';
    const hostile = { theme: '\"><script>window.themeInjected = true</script>', root: 'text', elements: { text: { type: 'Text', props: { content } } } };
    const html = mode === 'local' ? await readFile(renderToHTML(hostile, join(work, 'hostile.html')), 'utf8') : (await callCloud('render_spec', { spec: JSON.stringify(hostile) })).html;
    const page = await openHTML(html);
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    assert.equal(await page.locator('[data-spec-id="text"]').textContent(), content);
    assert.equal(await page.evaluate(() => !!(window.injected || window.themeInjected)), false);
    assert.equal(await page.locator('img').count(), 0);
    await page.close();
  });

  test(`${mode} HTML renders orphan Frame slot children once`, async () => {
    const orphanSpec = { root: 'root', elements: {
      root: { type: 'Text', props: { content: 'Workspace' } },
      preview: { type: 'Frame', props: { header: ['action'], footer: ['footer'] }, children: ['body'] },
      action: { type: 'Button', props: { label: 'Save' } },
      footer: { type: 'Text', props: { content: 'Updated today' } },
      body: { type: 'Text', props: { content: 'Project notes' } },
      constructor: { type: 'Text', props: { content: 'Own-key orphan' } },
    } };
    const html = mode === 'local' ? await readFile(renderToHTML(orphanSpec, join(work, 'orphans.html')), 'utf8') : (await callCloud('render_spec', { spec: JSON.stringify(orphanSpec) })).html;
    const page = await openHTML(html);
    for (const id of Object.keys(orphanSpec.elements)) assert.equal(await page.locator(`[data-spec-id="${id}"]`).count(), 1, id);
    await page.close();
  });
}

test('standalone MCP package renderer does not need the root checkout', async () => {
  const packageDir = join(work, 'standalone');
  await mkdir(join(packageDir, 'lib'), { recursive: true });
  await writeFile(join(packageDir, 'package.json'), '{"type":"module"}');
  for (const name of ['render.js', 'renderers.js']) await copyFile(new URL(`mcp/lib/${name}`, root), join(packageDir, 'lib', name));
  const packaged = await import(pathToFileURL(join(packageDir, 'lib', 'render.js')).href);
  const html = await readFile(packaged.renderToHTML(spec, join(work, 'packaged.html')), 'utf8');
  assert.ok(html.includes(DAUB_RENDER_BODY));
  const page = await openHTML(html);
  assert.equal(await page.getByRole('spinbutton', { name: 'Quantity' }).inputValue(), '3');
  await page.close();
});

test('cloud OpenUI accepts new named types and existing Icon/Link aliases', async () => {
  for (const code of ['root = NumberField(value: 3, min: 0, max: 5, label: "Quantity")', 'root = Frame([Text("Preview")], "Project")', 'root = Link("Docs", "/docs.html")', 'root = Icon("folder", "sm")']) {
    const result = await callCloud('parse_openui', { code });
    assert.equal(result.validation.valid, true, JSON.stringify(result));
  }
});
