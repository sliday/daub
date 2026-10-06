import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
import { COMP_PROPS, COMP_CATEGORIES, VALID_TYPES } from '../../mcp/lib/prompt.js';

const root = resolve('.');
const spec = {
  root: 'title',
  theme: 'bone',
  elements: { title: { type: 'Text', props: { content: 'Restored preview' } } },
};
let browser;
let server;
let base;

before(async () => {
  server = createServer(async (req, res) => {
    const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!path.startsWith(root + '/')) { res.writeHead(403).end(); return; }
    try {
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
      res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
      res.end(await readFile(path));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: true, timeout: 15000,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    channel: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? undefined : process.env.PLAYWRIGHT_CHANNEL || 'chrome',
  });
});

after(async () => {
  await browser?.close();
  if (server) await new Promise((done) => server.close(done));
});

async function open(t, { savedSpec = null, width = 1440, react = false, bundleFailure = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  t.after(() => context.close());
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (!url.startsWith(base) || url.includes('/api/')) return route.abort();
    if (bundleFailure && url.endsWith('index.playground-chat.js')) return route.abort();
    return route.continue();
  });
  await context.addInitScript((value) => {
    if (window !== window.top) return;
    localStorage.setItem('isolation-secret', 'parent-only');
    if (value) sessionStorage.setItem('pg-current-spec', JSON.stringify(value));
  }, savedSpec);
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  await page.goto(base + '/playground.html' + (react ? '?react-chat' : ''));
  return page;
}

test('restores the preview after iframe readiness', async (t) => {
  const page = await open(t, { savedSpec: spec });
  await page.frameLocator('#pg-preview-frame').getByText('Restored preview', { exact: true }).waitFor({ timeout: 3000 });
});

test('the live JSON prompt exposes all canonical props and supported types', async (t) => {
  const page = await open(t, { react: true });
  const prompt = await page.evaluate(() => window.__playgroundBridge.getSystemPrompt());
  for (const type of VALID_TYPES) assert.ok(prompt.includes('- ' + type + ': { ' + COMP_PROPS[type] + ' }'), type + ' props missing from prompt');
  assert.deepEqual(await page.evaluate(() => Object.keys(window.RENDERERS)), VALID_TYPES);
});

test('the OpenUI prompt exposes canonical props in parser positional order', async (t) => {
  const page = await open(t);
  const html = await readFile(new URL('../../playground.html', import.meta.url), 'utf8');
  const source = html.slice(html.indexOf('var OPENUI_SYSTEM_PROMPT ='), html.indexOf('// ---- Output format toggle'));
  const prompt = await page.evaluate(({ source, props, categories }) => {
    const build = new Function('COMP_PROPS', 'COMP_CATEGORIES', 'RENDERERS', 'DAUB', source + ';return OPENUI_SYSTEM_PROMPT;');
    return build(props, categories, window.RENDERERS, window.DAUB);
  }, { source, props: COMP_PROPS, categories: COMP_CATEGORIES });
  const schema = await page.evaluate(() => window.DaubOpenUI.COMP_SCHEMA);
  for (const type of VALID_TYPES) {
    const signature = prompt.split('\n').find(line => line.startsWith('- ' + type + '('));
    assert.ok(signature, type + ' missing from OpenUI prompt');
    for (const match of (COMP_PROPS[type] || '').matchAll(/(?:^|,\s*)(\w+)\s*:/g)) {
      assert.ok(signature.includes(match[1] + ':'), type + '.' + match[1] + ' missing from OpenUI prompt');
    }
    const args = signature.slice(('- ' + type + '(').length, -1);
    const parts = [];
    let depth = 0, start = 0;
    for (let index = 0; index <= args.length; index++) {
      const character = args[index];
      if (['(', '[', '{'].includes(character)) depth++;
      else if ([')', ']', '}'].includes(character)) depth--;
      else if ((character === ',' && depth === 0) || index === args.length) { parts.push(args.slice(start, index).trim()); start = index + 1; }
    }
    assert.deepEqual(parts.slice(0, (schema[type] || []).length).map(part => /^\w+/.exec(part)?.[0]), schema[type] || [], type + ' positional order');
  }
});

const addedTypes = {
  CheckboxGroup: { props: { label: 'Permissions', helper: 'Select access', inline: true }, className: 'db-checkbox-group', children: ['checkbox'] },
  Fieldset: { props: { legend: 'Contact details', helper: 'Workspace account', disabled: true }, className: 'db-fieldset', children: ['input'] },
  Frame: { props: { header: 'Profile header', footer: 'Profile footer', flush: true }, className: 'db-frame', children: ['text'] },
  Group: { props: { label: 'Formatting', attached: true, vertical: true }, className: 'db-group', children: ['toggle'] },
  Meter: { props: { label: 'Capacity', value: 15, min: 10, max: 20, status: 'warning' }, className: 'db-meter' },
  NumberField: { props: { label: 'Seats', value: 1, min: 0, max: 2 }, className: 'db-number-field' },
  PreviewCard: { props: { trigger: 'Preview profile', title: 'Sarah Chen', description: 'Design engineer' }, className: 'db-preview-card', children: ['text'] },
  Toolbar: { props: { label: 'Editor tools', vertical: true }, className: 'db-toolbar', children: ['toggle'] },
};

for (const [type, fixture] of Object.entries(addedTypes)) {
  test('JSON editor validates and renders ' + type + ' through the canonical body', async (t) => {
    const page = await open(t);
    const elements = {
      root: { type, props: fixture.props, children: fixture.children || [] },
      checkbox: { type: 'Checkbox', props: { label: 'Edit projects', checked: true } },
      input: { type: 'Input', props: { placeholder: 'Work email', type: 'email' } },
      text: { type: 'Text', props: { content: 'Profile content' } },
      toggle: { type: 'Toggle', props: { label: 'Bold' } },
    };
    const childIds = new Set(fixture.children || []);
    for (const id of Object.keys(elements)) if (id !== 'root' && !childIds.has(id)) delete elements[id];
    await page.locator('[data-tab="structure"]').click();
    await page.locator('#pg-json').fill(JSON.stringify({ root: 'root', elements }));
    await page.locator('#pg-render').click();
    assert.equal(await page.locator('.pg-json-error').isVisible(), false, await page.locator('#pg-json-error-msg').textContent());
    assert.equal(await page.locator('#pg-status').textContent(), 'Rendered');
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('pg-current-spec')).elements.root.type), type);
    await page.locator('[data-tab="design"]').click();
    const frame = page.frameLocator('#pg-preview-frame');
    const component = frame.locator('[data-spec-id="root"].' + fixture.className);
    await component.waitFor();
    assert.ok(!(await frame.locator('#pg-iframe-root').textContent()).includes('Unknown:'));
    if (type === 'CheckboxGroup') assert.equal(await component.getByRole('checkbox', { name: 'Edit projects' }).isChecked(), true);
    if (type === 'Fieldset') assert.equal(await component.locator('input').isDisabled(), true);
    if (type === 'Frame') assert.equal(await component.locator('.db-frame__footer').textContent(), 'Profile footer');
    if (type === 'Group') assert.equal(await component.getAttribute('aria-label'), 'Formatting');
    if (type === 'Meter') assert.equal(await component.getAttribute('aria-valuenow'), '15');
    if (type === 'NumberField') {
      await page.screenshot();
      await component.getByRole('button', { name: 'Increase seats', exact: true }).click();
      assert.equal(await component.getByRole('spinbutton', { name: 'Seats', exact: true }).inputValue(), '2');
      assert.equal(await component.getByRole('button', { name: 'Increase seats', exact: true }).isDisabled(), true);
    }
    if (type === 'PreviewCard') assert.equal(await component.locator('.db-preview-card__title').textContent(), 'Sarah Chen');
    if (type === 'Toolbar') assert.equal(await component.getAttribute('aria-orientation'), 'vertical');
  });
}

test('JSON editor renders canonical Link, Icon, and Image props', async (t) => {
  const page = await open(t);
  await page.locator('[data-tab="structure"]').click();
  await page.locator('#pg-json').fill(JSON.stringify({ root: 'root', elements: {
    root: { type: 'Stack', children: ['link', 'icon', 'image'] },
    link: { type: 'Link', props: { label: 'Documentation', href: '/docs.html' } },
    icon: { type: 'Icon', props: { name: 'check', size: 'xl' } },
    image: { type: 'Image', props: { src: '/og-image.png', alt: 'DAUB library', width: 160 } },
  } }));
  await page.locator('#pg-render').click();
  assert.equal(await page.locator('.pg-json-error').isVisible(), false);
  await page.locator('[data-tab="design"]').click();
  const frame = page.frameLocator('#pg-preview-frame');
  assert.equal(await frame.getByRole('link', { name: 'Documentation' }).getAttribute('href'), '/docs.html');
  assert.equal(await frame.locator('[data-spec-id="icon"]').evaluate((el) => el.style.width), '32px');
  await frame.getByRole('img', { name: 'DAUB library' }).waitFor();
  assert.equal(await frame.getByRole('img', { name: 'DAUB library' }).evaluate((el) => el.naturalWidth > 0), true);
});

test('client validation rejects types outside the canonical registry', async (t) => {
  const page = await open(t);
  await page.locator('[data-tab="structure"]').click();
  for (const type of ['UnsupportedType', 'constructor']) {
    await page.locator('#pg-json').fill(JSON.stringify({ root: 'root', elements: { root: { type } } }));
    await page.locator('#pg-render').click();
    assert.equal(await page.locator('.pg-json-error').isVisible(), true);
    assert.ok((await page.locator('#pg-json-error-msg').textContent()).includes('Unknown type "' + type + '"'));
  }
});

test('exports canonical Frame slots and working NumberField controls', async (t) => {
  const frameSpec = {
    root: 'frame', elements: {
      frame: { type: 'Frame', props: { header: ['heading'], footer: ['footer'] }, children: ['seats'] },
      heading: { type: 'Text', props: { content: 'Team settings' } },
      seats: { type: 'NumberField', props: { label: 'Seats', value: 1, min: 0, max: 2 } },
      footer: { type: 'Toolbar', props: { label: 'Settings actions' }, children: ['save'] },
      save: { type: 'Button', props: { label: 'Save settings' } },
    },
  };
  const page = await open(t, { savedSpec: frameSpec });
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#pg-download').click();
  const html = await readFile(await (await downloadPromise).path(), 'utf8');
  await page.setContent(html);
  await page.getByRole('button', { name: 'Increase seats', exact: true }).click();
  assert.equal(await page.getByRole('spinbutton', { name: 'Seats', exact: true }).inputValue(), '2');
  assert.equal(await page.locator('[data-spec-id="heading"]').count(), 1);
  assert.equal(await page.locator('[data-spec-id="footer"]').count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Save settings', exact: true }).count(), 1);
});

test('edits JSON, persists the rendered spec, and reports invalid specs', async (t) => {
  const page = await open(t);
  await page.locator('[data-tab="structure"]').click();
  assert.equal(await page.locator('#pg-json').isVisible(), true);
  const edited = structuredClone(spec);
  edited.elements.title.props.content = 'Edited title';
  await page.locator('#pg-json').fill(JSON.stringify(edited));
  await page.locator('#pg-render').click();
  assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('pg-current-spec')).elements.title.props.content), 'Edited title');
  await page.locator('#pg-json').fill('{}');
  await page.locator('#pg-render').click();
  assert.equal(await page.locator('.pg-json-error').isVisible(), true);
  assert.notEqual(await page.locator('#pg-status').textContent(), 'Rendered');
});

test('keeps mobile preview, navigation, and toolbar inside the viewport', async (t) => {
  const page = await open(t, { savedSpec: spec, width: 320 });
  await page.locator('[data-panel="preview"]').click();
  await page.locator('[data-viewport="mobile"]').click();
  const bounds = await page.locator('#pg-preview-frame').boundingBox();
  assert.ok(bounds.width <= 320 && bounds.x + bounds.width <= 320, JSON.stringify(bounds));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await page.locator('#pg-download').isVisible(), true);
  const download = await page.locator('#pg-download').boundingBox();
  assert.ok(download.x + download.width <= 320, JSON.stringify(download));
});

test('keeps the JSON editor full width after switching from mobile preview', async (t) => {
  const page = await open(t, { savedSpec: spec, width: 390 });
  await page.locator('[data-panel="preview"]').click();
  await page.locator('[data-viewport="mobile"]').click();
  await page.locator('[data-tab="structure"]').click();
  const editor = await page.locator('#pg-json').boundingBox();
  assert.ok(editor.width >= 370, JSON.stringify(editor));
});

test('keeps the theme switcher clear of phone navigation', async (t) => {
  const page = await open(t, { savedSpec: spec, width: 320 });
  await page.locator('[data-panel="preview"]').click();
  const theme = await page.locator('.db-theme-switcher').boundingBox();
  const nav = await page.locator('.pg-bottom-tabs').boundingBox();
  assert.ok(theme.y + theme.height <= nav.y, JSON.stringify({ theme, nav }));
});

test('clears stale code when starting a new chat', async (t) => {
  const page = await open(t, { savedSpec: spec });
  await page.locator('[data-tab="code"]').click();
  assert.ok((await page.locator('#pg-code-view').textContent()).includes('Restored preview'));
  await page.locator('#pg-new-chat').click();
  assert.equal(await page.locator('#pg-code-view').textContent(), '');
});

test('shows clipboard failures without an unhandled rejection', async (t) => {
  const page = await open(t, { savedSpec: spec });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('Denied')) }, configurable: true }));
  await page.locator('[data-tab="structure"]').click();
  await page.locator('#pg-copy-json').click();
  await page.getByText('Could not copy. Check clipboard permissions.', { exact: true }).waitFor({ timeout: 2000 });
  assert.deepEqual(errors, []);
});

test('downloads HTML with custom JavaScript and declarative state', async (t) => {
  const interactive = {
    root: 'counter', state: { count: 1 },
    elements: {
      counter: { type: 'CustomHTML', props: { html: '<button id="export-counter">Count</button>', js: 'container.querySelector("button").addEventListener("click", function(e) { e.target.textContent = "Clicked"; });' } },
    },
  };
  const page = await open(t, { savedSpec: interactive });
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#pg-download').click();
  const download = await downloadPromise;
  const html = await readFile(await download.path(), 'utf8');
  assert.ok(html.includes('__initDaubState'), 'export must include the state runtime');
  await page.setContent(html);
  await page.locator('#export-counter').click();
  assert.equal(await page.locator('#export-counter').textContent(), 'Clicked');
  assert.equal(await page.evaluate(() => window.__daubState._state.count), 1);
});

test('falls back to vanilla chat if the React bundle fails to load', async (t) => {
  const page = await open(t, { react: true, bundleFailure: true });
  assert.equal(await page.locator('#pg-prompt').isVisible(), true);
});

test('exposes accessible editor, prompt, preview, and keyboard tabs', async (t) => {
  const page = await open(t);
  assert.equal(await page.locator('#pg-prompt').getAttribute('aria-label'), 'Describe a UI');
  assert.equal(await page.locator('#pg-preview-frame').getAttribute('title'), 'UI preview');
  await page.locator('[data-tab="design"]').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('[data-tab="structure"]').getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('#pg-json').getAttribute('aria-label'), 'UI specification JSON');
});

test('copies an edited share spec and runnable HTML', async (t) => {
  const page = await open(t, { savedSpec: spec });
  await page.evaluate(() => {
    window.copied = [];
    window.LZString = { compressToEncodedURIComponent: encodeURIComponent };
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: (text) => { window.copied.push(text); return Promise.resolve(); } }, configurable: true });
  });
  await page.locator('[data-tab="structure"]').click();
  const edited = structuredClone(spec);
  edited.elements.title.props.content = 'Shared edit';
  await page.locator('#pg-json').fill(JSON.stringify(edited));
  await page.locator('#pg-render').click();
  await page.locator('[data-tab="design"]').click();
  await page.locator('#pg-share').click();
  const url = new URL(await page.evaluate(() => window.copied[0]));
  assert.ok(url.hash.startsWith('#s='));
  assert.equal(JSON.parse(decodeURIComponent(url.hash.slice(3))).elements.title.props.content, 'Shared edit');
  await page.locator('[data-tab="code"]').click();
  await page.locator('#pg-copy-html').click();
  assert.ok((await page.evaluate(() => window.copied[1])).startsWith('<!DOCTYPE html>'));
});

test('exports the preview theme and scheme chosen after rendering', async (t) => {
  const page = await open(t, { savedSpec: spec, react: true });
  await page.evaluate(() => {
    window.__playgroundBridge.postToPreview({ type: 'theme', value: 'grape' });
    window.__playgroundBridge.postToPreview({ type: 'scheme', value: 'dark' });
  });
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#pg-download').click();
  const html = await readFile(await (await downloadPromise).path(), 'utf8');
  await page.setContent(html);
  await page.locator('[data-spec-id="title"]').waitFor();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'grape');
  assert.equal(await page.locator('html').getAttribute('data-scheme'), 'dark');
});

test('ignores forged HTML messages from the parent window', async (t) => {
  const page = await open(t, { savedSpec: spec });
  await page.evaluate(() => window.postMessage({ type: 'html', data: '<p>Forged</p>' }, '*'));
  await page.locator('[data-tab="code"]').click();
  assert.ok(!(await page.locator('#pg-code-view').textContent()).includes('Forged'));
});

test('isolates custom JavaScript from parent storage and DOM while retaining local behavior', async (t) => {
  const isolated = {
    root: 'custom', state: { enabled: true },
    elements: { custom: { type: 'CustomHTML', props: {
      html: '<button id="isolated-button">Run</button><output id="isolation-result"></output>',
      js: 'var result = {}; try { result.storage = parent.localStorage.getItem("isolation-secret"); } catch (error) { result.storage = error.name; } try { result.dom = parent.document.querySelector("#pg-prompt").id; } catch (error) { result.dom = error.name; } container.querySelector("output").textContent = JSON.stringify(result); container.querySelector("button").onclick = function(e) { e.target.textContent = "Local JS works"; };',
    } } },
  };
  const page = await open(t, { savedSpec: isolated });
  const frame = page.frameLocator('#pg-preview-frame');
  await frame.locator('#isolation-result').waitFor();
  const result = JSON.parse(await frame.locator('#isolation-result').textContent());
  assert.deepEqual(result, { storage: 'SecurityError', dom: 'SecurityError' });
  await frame.locator('#isolated-button').click();
  assert.equal(await frame.locator('#isolated-button').textContent(), 'Local JS works');
  assert.equal(await page.locator('#pg-preview-frame').evaluate((el) => el.contentDocument), null);
});

test('supports highlight and unhighlight messages without parent DOM access', async (t) => {
  const page = await open(t, { savedSpec: spec, react: true });
  const title = page.frameLocator('#pg-preview-frame').locator('[data-spec-id="title"]');
  await title.waitFor();
  await page.evaluate(() => window.__playgroundBridge.postToPreview({ type: 'highlight', elements: ['title'] }));
  await title.locator('xpath=self::*[contains(@class,"db-skeleton")]').waitFor();
  await page.evaluate(() => window.__playgroundBridge.postToPreview({ type: 'unhighlight', elements: ['title'] }));
  await title.locator('xpath=self::*[contains(@class,"db-skeleton")]').waitFor({ state: 'hidden' });
});

test('rejects a forged render message from the preview window itself', async (t) => {
  const page = await open(t, { savedSpec: spec });
  const preview = page.frames().find((frame) => frame.parentFrame());
  await preview.locator('[data-spec-id="title"]').waitFor();
  await preview.evaluate(() => window.postMessage({ type: 'render', html: '<p>Forged preview</p>' }, '*'));
  await page.locator('[data-tab="structure"]').click();
  await page.locator('[data-tab="design"]').click();
  assert.equal(await preview.locator('[data-spec-id="title"]').textContent(), 'Restored preview');
});

test('accepts screenshot replies only from the expected opaque preview', async (t) => {
  const page = await open(t, { savedSpec: spec, react: true });
  const preview = page.frames().find((frame) => frame.parentFrame());
  await preview.locator('[data-spec-id="title"]').waitFor();
  await preview.evaluate(() => {
    window.html2canvas = () => new Promise((resolve) => setTimeout(() => resolve({ toDataURL: () => 'data:image/jpeg;base64,preview' }), 30));
  });
  const html = await readFile(new URL('../../playground.html', import.meta.url), 'utf8');
  const source = html.slice(html.indexOf('function capturePreview()'), html.indexOf('// ---- SSE response parser'));
  const result = await page.evaluate(async (source) => {
    const capture = new Function('$previewFrame', 'currentSpec', 'postToPreview', source + ';return capturePreview();');
    const pending = capture(document.querySelector('#pg-preview-frame'), window.__playgroundBridge.getCurrentSpec(), window.__playgroundBridge.postToPreview);
    window.postMessage({ type: 'screenshot', data: 'forged' }, '*');
    return pending;
  }, source);
  assert.equal(result, 'data:image/jpeg;base64,preview');
});

test('uses the screenshot fallback when html2canvas cannot clone an opaque iframe', async (t) => {
  const page = await open(t, { savedSpec: spec, react: true });
  const preview = page.frames().find((frame) => frame.parentFrame());
  await preview.locator('[data-spec-id="title"]').waitFor();
  await preview.evaluate(() => {
    window.html2canvas = () => Promise.reject(new DOMException('Opaque iframe clone', 'SecurityError'));
    window.htmlToImage = { toJpeg: () => Promise.resolve('data:image/jpeg;base64,fallback') };
  });
  const result = await page.evaluate(() => new Promise((resolve) => {
    const frame = document.querySelector('#pg-preview-frame').contentWindow;
    function receive(event) {
      if (event.source !== frame || event.data?.type !== 'screenshot') return;
      window.removeEventListener('message', receive);
      resolve(event.data.data);
    }
    window.addEventListener('message', receive);
    window.__playgroundBridge.postToPreview({ type: 'screenshot' });
  }));
  assert.equal(result, 'data:image/jpeg;base64,fallback');
});

test('runs chunk tests in the opaque preview and rejects forged test-result replies', async (t) => {
  const page = await open(t, { savedSpec: spec, react: true });
  await page.frameLocator('#pg-preview-frame').locator('[data-spec-id="title"]').waitFor();
  const html = await readFile(new URL('../../playground.html', import.meta.url), 'utf8');
  const source = html.slice(html.indexOf('function runChunkTests('), html.indexOf('function reviewAndAssemble('));
  const results = await page.evaluate(async (source) => {
    const run = new Function('postToPreview', source + ';return runChunkTests([{chunkId:"isolated",success:true,elements:[{id:"title",test:"return new Promise(function(resolve) { setTimeout(function() { resolve(); }, 30); });"}]}], 200);');
    const pending = run(window.__playgroundBridge.postToPreview);
    window.postMessage({ type: 'testResults', results: [{ chunkId: 'forged', pass: true }] }, '*');
    return pending;
  }, source);
  assert.deepEqual(results, [{ chunkId: 'isolated', pass: true, error: null }]);
});

test('preserves declarative state actions in the opaque preview', async (t) => {
  const stateSpec = {
    root: 'toggle', state: { enabled: false },
    elements: { toggle: { type: 'Button', props: { label: { $cond: { $state: '/enabled' }, $then: 'Enabled', $else: 'Disabled' } }, on: { click: { action: 'toggleState', params: { path: '/enabled' } } } } },
  };
  const page = await open(t, { savedSpec: stateSpec });
  const toggle = page.frameLocator('#pg-preview-frame').getByRole('button', { name: 'Disabled', exact: true });
  await toggle.click();
  await page.frameLocator('#pg-preview-frame').getByRole('button', { name: 'Enabled', exact: true }).waitFor();
});

test('React example selection fills the controlled composer and retains provider settings', async (t) => {
  const page = await open(t, { react: true });
  await page.locator('#pg-chat-mount').getByText('Settings page with tabs and form fields', { exact: true }).click();
  assert.equal(await page.locator('[data-aui-composer-input]').inputValue(), 'Settings page with tabs and form fields');
  await page.locator('#pg-chat-mount').getByRole('button', { name: 'Own Key' }).click();
  assert.equal(await page.locator('#pg-byok-modal').getAttribute('aria-hidden'), 'false');
});

test('React chat commits successful responses and updates later request context', async (t) => {
  const page = await open(t, { react: true });
  let request;
  await page.route('**/api/generate', async (route) => {
    request = route.request().postDataJSON();
    await route.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ choices: [{ delta: { content: JSON.stringify(spec) } }] }) + '\n\ndata: [DONE]\n\n' });
  });
  await page.locator('[data-aui-composer-input]').fill('Build a title');
  await page.locator('#pg-chat-mount').getByRole('button', { name: 'Send' }).click();
  await page.frameLocator('#pg-preview-frame').getByText('Restored preview', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__playgroundBridge.getCurrentSpec().root), 'title');
  await page.locator('[data-aui-composer-input]').fill('Change the title');
  await page.locator('#pg-chat-mount').getByRole('button', { name: 'Send' }).click();
  await page.locator('#pg-chat-mount').getByRole('button', { name: 'Send' }).waitFor();
  assert.ok(request.messages.some((message) => message.role === 'assistant' && message.content === JSON.stringify(spec)));
});

test('React Stop cancels without persisting a spec', async (t) => {
  const page = await open(t, { react: true });
  let release;
  await page.route('**/api/generate', async (route) => {
    await new Promise((resolve) => { release = resolve; });
    await route.abort();
  });
  await page.locator('[data-aui-composer-input]').fill('Build a title');
  await page.locator('#pg-chat-mount').getByRole('button', { name: 'Send' }).click();
  await page.locator('#pg-chat-mount').getByRole('button', { name: 'Stop' }).click();
  release?.();
  await page.locator('#pg-chat-mount').getByRole('button', { name: 'Send' }).waitFor();
  assert.equal(await page.evaluate(() => sessionStorage.getItem('pg-current-spec')), null);
});

test('React chat surfaces provider errors and makes one request for a quota error', async (t) => {
  const page = await open(t, { react: true });
  let requests = 0;
  await page.route('**/api/generate', async (route) => {
    requests++;
    await route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Quota exceeded' } }) });
  });
  await page.locator('[data-aui-composer-input]').fill('Build a title');
  await page.locator('#pg-chat-mount').getByRole('button', { name: 'Send' }).click();
  await page.locator('#pg-chat-mount [role="alert"]').waitFor();
  assert.equal(requests, 1);
  assert.equal(await page.evaluate(() => window.__playgroundBridge.getCurrentSpec()), null);
});
