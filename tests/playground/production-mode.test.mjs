import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('.');
const spec = { root: 'page', elements: {
  page: { type: 'Stack', props: { gap: 4 }, children: ['headline'] },
  headline: { type: 'Text', props: { tag: 'h2', content: 'Production fixture' }, children: [] },
} };
const brief = {
  title: 'Production fixture', summary: 'A static page with a heading.', assumptions: [], outOfScope: [],
  screens: [{ id: 'home', title: 'Home', phase: 'initial', targetIds: ['headline'], layout: 'A vertical stack.', content: 'Production fixture heading.', journeyId: '' }],
  flow: [], edgeCases: [], outputs: [],
};
const contract = { interactive: false, fixtures: '{}', recipe: null, brief,
  requirements: [{ id: 'heading', targetId: 'headline', text: 'Production fixture', when: 'initial' }], journeys: [] };
const prototype = {
  title: 'Production fixture', brief: ['A static page with a heading.'], interactive: false,
  html: '<main id="prototype-app"><h2>Production fixture</h2></main>', css: '', js: '', smoke: [],
};
const preferences = { 'pg-use-default': 'false', 'pg-provider': 'anthropic', 'pg-model': 'legacy-model',
  'pg-generation-mode': 'direct', 'pg-apikeys': '{"anthropic":"saved-test-key"}', 'pg-fast-mode': 'true' };
let server, browser, base;

before(async () => {
  server = createServer(async (req, res) => {
    const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!path.startsWith(root + '/')) return res.writeHead(403).end();
    try {
      res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(path)] || 'application/octet-stream');
      res.end(await readFile(path));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
});
after(async () => { await browser?.close(); if (server?.listening) await new Promise(done => server.close(done)); });

async function open(t, query = '', options = {}) {
  const context = await browser.newContext({ viewport: { width: options.width || 1440, height: 900 } });
  t.after(() => context.close());
  const calls = [], unexpected = [], errors = [];
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (url === base + '/api/choose') {
      const body = route.request().postDataJSON();
      return route.fulfill({ json: { model: 'fixture-jev', scores: Object.fromEntries(Object.keys(body.components).map(key => [key, 0.1])) } });
    }
    if (url === base + '/api/generate') {
      const body = route.request().postDataJSON(), stage = body.response_format?.json_schema?.name;
      calls.push(stage);
      assert.equal(body.model, 'openrouter/auto');
      assert.equal(body.response_format.json_schema.strict, true);
      assert.ok(!route.request().postData().includes('saved-test-key'));
      if (options.fail) return route.fulfill({ status: 429, json: { error: 'Rate limit exceeded' } });
      const result = stage === 'playground_prototype' ? prototype : null;
      if (!result) { unexpected.push(stage); return route.fulfill({ status: 500, json: { error: 'Unexpected stage' } }); }
      return route.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ choices: [{ delta: { content: JSON.stringify(result) }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n' });
    }
    if (url.includes('/api/') || /api\.(openai|anthropic)\.com|openrouter\.ai/.test(url)) unexpected.push(url);
    return url.startsWith(base) && !url.includes('/api/') ? route.continue() : route.abort();
  });
  await context.addInitScript(({ preferences, saved }) => {
    if (window !== window.top) return;
    Object.entries(preferences).forEach(([key, value]) => localStorage.setItem(key, value));
    if (saved) sessionStorage.setItem('pg-current-spec', JSON.stringify(saved));
    window.LZString = { compressToEncodedURIComponent: encodeURIComponent, decompressFromEncodedURIComponent: decodeURIComponent };
  }, { preferences, saved: options.saved });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(10000);
  t.after(() => { assert.deepEqual(errors, [], 'Uncaught browser errors'); assert.deepEqual(unexpected, [], 'Unexpected provider path'); });
  await page.goto(base + '/playground.html' + query);
  return { page, calls };
}

async function submit(page) {
  await page.locator('#pg-prompt').fill('A static page titled Production fixture.');
  await page.locator('#pg-prompt').press('Enter');
  await page.waitForFunction(() => window.__prototypeLastRun && document.querySelector('.pg-chat').getAttribute('aria-busy') === 'false');
}

test('production removes both old entry implementations and the selector', async () => {
  const html = await readFile(resolve(root, 'playground.html'), 'utf8');
  assert.doesNotMatch(html, /id="pg-generation-mode"|function generateRecursive\(/);
  assert.equal((html.match(/function generate\(/g) || []).length, 1);
  const entry = html.slice(html.indexOf('function generate()'), html.indexOf('function checkPreviewHealth('));
  assert.match(entry, /return DaubPrototypeUI\.create/);
  assert.doesNotMatch(entry, /streamDefault|runBlockingGenerate|design=/);
  assert.match(html, /playground-prototype\.js\?v=/);
  assert.match(html, /playground-prototype-runtime\.js\?v=/);
});

for (const query of ['', '?design=direct', '?design=snowflake', '?design=hybrid', '?react-chat&design=direct']) {
  test('quick prototype is the sole generation route for ' + (query || 'the default URL'), async t => {
    const { page, calls } = await open(t, query);
    assert.equal(await page.locator('#pg-generation-mode').count(), 0);
    assert.equal(await page.locator('#pg-chat-mount').count(), 0);
    for (const id of ['pg-byok-link', 'pg-byok-modal', 'pg-attach', 'pg-attach-img', 'pg-weblook', 'pg-figma']) {
      assert.equal(await page.locator('#' + id).isVisible(), false, id);
    }
    await submit(page);
    assert.deepEqual(calls, ['playground_prototype']);
    assert.equal(await page.evaluate(() => window.__prototypeLastRun.reason), 'complete');
    assert.equal(await page.locator('#pg-status').isVisible(), false);
    assert.equal(await page.locator('#pg-chat-messages .pg-result-meta').filter({ hasText: 'Prototype ready' }).count(), 1);
    assert.equal(await page.locator('#pg-chat-messages summary').filter({ hasText: 'Prototype brief' }).count(), 1);
    assert.deepEqual(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(preferences)), preferences);
    await page.frameLocator('#pg-preview-frame').getByText('Production fixture', { exact: true }).waitFor();
    if (!query) {
      await page.screenshot({ path: '/tmp/daub-production-desktop.png' });
      await page.reload();
      assert.equal(await page.locator('#pg-chat-messages summary').filter({ hasText: 'Prototype brief' }).count(), 1);
      assert.deepEqual(calls, ['playground_prototype']);
    }
  });
}

test('URL prompt auto-submit also uses the quick prototype', async t => {
  const { page, calls } = await open(t, '?design=snowflake&prompt=Production%20fixture');
  await page.waitForFunction(() => window.__prototypeLastRun);
  assert.deepEqual(calls, ['playground_prototype']);
  assert.equal(await page.evaluate(() => window.__prototypeLastRun.reason), 'complete');
});

test('unsupported key, attachment, paste and drop attempts reject without requests', async t => {
  const { page, calls } = await open(t, '', { width: 390 });
  await page.screenshot({ path: '/tmp/daub-production-mobile.png' });
  for (const id of ['pg-attach-img', 'pg-attach', 'pg-weblook', 'pg-figma', 'pg-file-input', 'pg-file-input-img', 'pg-byok-save', 'pg-provider', 'pg-model', 'pg-apikey']) {
    assert.equal(await page.locator('#' + id).isDisabled(), true, id);
    await page.locator('#' + id).dispatchEvent('change', { bubbles: true, cancelable: true });
  }
  await page.locator('#pg-byok-link').dispatchEvent('click', { bubbles: true, cancelable: true });
  await page.locator('#pg-default-link').dispatchEvent('click', { bubbles: true, cancelable: true });
  const prevented = await page.evaluate(() => {
    const data = new DataTransfer();
    data.items.add(new File(['fixture'], 'fixture.png', { type: 'image/png' }));
    const paste = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data });
    document.getElementById('pg-prompt').dispatchEvent(paste);
    const drop = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data });
    document.querySelector('.pg-chat').dispatchEvent(drop);
    const figma = new DataTransfer(); figma.setData('text/plain', 'https://figma.com/design/test/design');
    const link = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: figma });
    document.getElementById('pg-prompt').dispatchEvent(link);
    return [paste.defaultPrevented, drop.defaultPrevented, link.defaultPrevented];
  });
  assert.deepEqual(prevented, [true, true, true]);
  assert.match(await page.locator('body').innerText(), /Attachments and own API keys are not supported/);
  assert.deepEqual(calls, []);
  assert.deepEqual(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(preferences)), preferences);
  assert.equal(await page.locator('#pg-img-strip').textContent(), '');
});

test('a provider limit stops the quick prototype without a Direct fallback', async t => {
  const { page, calls } = await open(t, '?design=direct', { fail: true });
  await submit(page);
  assert.deepEqual(calls, ['playground_prototype']);
  assert.equal(await page.evaluate(() => window.__prototypeLastRun.reason), 'provider-error');
  assert.equal(await page.evaluate(() => window.__prototypeLastRun.requests), 1);
  assert.match(await page.evaluate(() => window.__prototypeLastRun.error), /429|rate limit/i);
  assert.equal(await page.locator('#pg-chat-messages .pg-result-meta').innerText(), 'Provider limit reached: Rate limit exceeded');
  assert.equal(await page.locator('[data-prototype-probe]').count(), 0);
});

test('saved legacy JSON renders and exports without generating or losing custom code', async t => {
  const saved = structuredClone(spec);
  saved.elements.headline.js = 'window.exportFixture = "preserved";';
  const { page, calls } = await open(t, '?design=direct', { saved });
  await page.frameLocator('#pg-preview-frame').getByText('Production fixture', { exact: true }).waitFor();
  assert.deepEqual(JSON.parse(await page.locator('#pg-json').inputValue()), saved);
  await page.getByRole('tab', { name: 'Structure', exact: true }).click();
  await page.getByRole('button', { name: 'Render JSON', exact: true }).click();
  assert.deepEqual(JSON.parse(await page.locator('#pg-json').inputValue()), saved);
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.locator('#pg-download').click();
  const html = await readFile(await (await download).path(), 'utf8');
  assert.match(html, /Production fixture/);
  assert.match(html, /exportFixture/);
  assert.match(html, /<base href="https:\/\/daub.dev\/"/);
  assert.equal(await page.locator('#pg-preview-frame').getAttribute('sandbox'), 'allow-scripts allow-forms');
  assert.deepEqual(calls, []);
});

test('shared Hybrid code retains consent and JSON/export data', async t => {
  const shared = structuredClone(spec);
  shared.hybrid = { contract, program: { initial: { count: 0 }, reduce: 'return state;', render: 'ui.text("headline", "Controller ran");', bind: '' } };
  const { page, calls } = await open(t, '#s=' + encodeURIComponent(JSON.stringify(shared)));
  await page.locator('[data-share-notice]').waitFor();
  await page.frameLocator('#pg-preview-frame').getByText('Production fixture', { exact: true }).waitFor();
  assert.deepEqual(JSON.parse(await page.locator('#pg-json').inputValue()), shared);
  const download = page.waitForEvent('download');
  await page.locator('#pg-download').click();
  assert.match(await readFile(await (await download).path(), 'utf8'), /Controller ran/);
  await page.getByRole('button', { name: 'Run code', exact: true }).click();
  await page.frameLocator('#pg-preview-frame').getByText('Controller ran', { exact: true }).waitFor();
  assert.deepEqual(calls, []);
});
