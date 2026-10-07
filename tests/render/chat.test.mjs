import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { COMP_PROPS, COMP_CATEGORIES, buildSystemPrompt } from '../../mcp/lib/prompt.js';
import { validateSpec } from '../../mcp/lib/validate.js';
import { renderToHTML } from '../../mcp/lib/render.js';
import { onRequestPost } from '../../functions/api/mcp.js';

const require = createRequire(import.meta.url);
const { openUItoSpec, COMP_SCHEMA } = require('../../daub-openui-parser.js');
const { RENDERER_TYPES } = require('../../daub-render.js');
const source = await readFile(new URL('../../daub-render.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../../daub.css', import.meta.url), 'utf8');
const runtime = await readFile(new URL('../../daub.js', import.meta.url), 'utf8');
const types = ['MessageScroller', 'Message', 'Bubble', 'Attachment', 'Marker'];
const spec = { root: 'thread', elements: {
  thread: { type: 'MessageScroller', props: { autoScroll: false, defaultScrollPosition: 'last-anchor', peek: 24 }, children: ['notice', 'reply'] },
  notice: { type: 'Marker', props: { content: 'Today', variant: 'separator' } },
  reply: { type: 'Message', props: { messageId: 'reply-1', scrollAnchor: true, name: 'Ada', timestamp: '10:42', avatar: 'AL', align: 'end' }, children: ['bubble', 'file'] },
  bubble: { type: 'Bubble', props: { content: 'Review ready.', variant: 'secondary', align: 'end', reactions: [{ label: 'Helpful', count: 2, pressed: true }] }, children: ['body'] },
  body: { type: 'Text', props: { content: 'Three tasks need review.' } },
  file: { type: 'Attachment', props: { name: 'Review.pdf', description: 'PDF document', href: '/review.pdf', state: 'uploading', progress: 25, size: 'sm' }, children: ['remove'] },
  remove: { type: 'Button', props: { label: 'Remove attachment', variant: 'ghost', icon: 'x' } },
} };
let browser;
let page;
let work;
before(async () => {
  work = await mkdtemp(join(tmpdir(), 'daub-chat-render-'));
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  page = await browser.newPage();
  page.setDefaultTimeout(3000);
  await page.setContent('<!doctype html><main></main>');
  await page.addScriptTag({ content: source });
});
after(async () => { await browser?.close(); if (work) await rm(work, { recursive: true, force: true }); });

async function render(input = spec) {
  await page.evaluate(input => document.querySelector('main').replaceChildren(renderElement(input.elements, input.root, 0)), input);
}
async function renderOne(type, props = {}, children = []) {
  await render({ root: 'root', elements: { root: { type, props, children }, action: spec.elements.remove, body: spec.elements.body } });
}
async function callCloud(name, args) {
  const response = await onRequestPost({ request: new Request('https://daub.test/api/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) }), env: {} });
  assert.equal(response.status, 200);
  const result = (await response.json()).result;
  assert.equal(result.isError, undefined, result.content[0].text);
  return JSON.parse(result.content[0].text);
}

test('chat types share the browser, parser, validator and local/cloud catalogs', async () => {
  assert.equal(RENDERER_TYPES.length, 88);
  const cloud = await callCloud('get_component_catalog', {});
  for (const type of types) {
    assert.ok(RENDERER_TYPES.includes(type), type);
    assert.ok(COMP_SCHEMA[type], type);
    assert.ok(COMP_CATEGORIES.flatMap(([, entries]) => entries).includes(type), type);
    assert.equal(Object.values(cloud.categories).find(category => type in category)?.[type], COMP_PROPS[type]);
    assert.ok(buildSystemPrompt([], 'Build a support thread').includes('- ' + type + ':'));
  }
  assert.equal(validateSpec(spec).valid, true);
  assert.equal((await callCloud('validate_spec', { spec: JSON.stringify(spec) })).valid, true);
});

test('chat OpenUI keeps children first and accepts named metadata in both parsers', async () => {
  const code = 'root = MessageScroller([Message([Bubble([Text("Review")], content: "Ready", variant: "outline")], align: "end", avatar: "AL", name: "Ada", messageId: "m1", scrollAnchor: true), Attachment([Button("Remove")], name: "Review.pdf", state: "uploading", progress: 25), Marker([], content: "Today", variant: "separator")], height: 360, autoScroll: false, defaultScrollPosition: "last-anchor", peek: 24)';
  const parsed = openUItoSpec(code);
  assert.ok(parsed);
  assert.equal(validateSpec(parsed).valid, true);
  const cloud = await callCloud('parse_openui', { code });
  assert.equal(cloud.validation.valid, true);
  assert.deepEqual(cloud.spec, parsed);
  assert.equal(parsed.elements[parsed.root].props.autoScroll, false);
  assert.deepEqual(types.filter(type => Object.values(parsed.elements).some(def => def.type === type)), types);
});

test('MessageScroller renders options, stable IDs, anchors and named scroll controls', async () => {
  await render();
  const scroller = page.locator('.db-message-scroller');
  assert.equal(await scroller.evaluate(el => el.style.height), '360px');
  assert.equal(await scroller.getAttribute('data-db-auto-scroll'), 'false');
  assert.equal(await scroller.getAttribute('data-db-scroll-position'), 'last-anchor');
  assert.equal(await scroller.getAttribute('data-db-scroll-peek'), '24');
  assert.deepEqual(await page.locator('.db-message-scroller__content > .db-message-scroller__item').evaluateAll(rows => rows.map(row => row.dataset.dbMessageId)), ['notice', 'reply-1']);
  assert.equal(await page.locator('.db-message-scroller__item[data-db-message-id="reply-1"]').getAttribute('data-db-scroll-anchor'), 'true');
  assert.equal(await page.locator('[data-db-message-id="reply-1"]').count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Scroll to start' }).getAttribute('data-db-scroll-to'), 'start');
  assert.equal(await page.getByRole('button', { name: 'Scroll to end' }).getAttribute('data-db-scroll-to'), 'end');
  await renderOne('MessageScroller', { height: -1, peek: -1, defaultScrollPosition: 'invalid' }, ['body']);
  assert.equal(await scroller.evaluate(el => el.style.height), '360px');
  assert.equal(await scroller.getAttribute('data-db-auto-scroll'), 'true');
  assert.equal(await scroller.getAttribute('data-db-scroll-position'), 'end');
  assert.equal(await scroller.getAttribute('data-db-scroll-peek'), '0');
});

test('MessageScroller respects the renderer depth limit for cyclic content', async () => {
  await render({ root: 'loop', elements: { loop: { type: 'MessageScroller', children: ['loop'] } } });
  assert.ok((await page.locator('main').textContent()).includes('[max depth]'));
});

test('Message and Bubble render scoped content, metadata and reactions', async () => {
  await render();
  assert.equal(await page.locator('.db-message--end > .db-message__avatar').textContent(), 'AL');
  assert.equal(await page.locator('.db-message__header time').textContent(), '10:42');
  assert.equal(await page.locator('.db-message__content > .db-bubble--secondary.db-bubble--end > .db-bubble__content').textContent(), 'Review ready.Three tasks need review.');
  assert.equal(await page.getByRole('button', { name: 'Helpful' }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByRole('button', { name: 'Helpful' }).textContent(), 'Helpful 2');
  await renderOne('Message', { footer: 'Delivered' });
  assert.equal(await page.locator('.db-message__footer').textContent(), 'Delivered');
  assert.equal(await page.locator('.db-message').getAttribute('data-db-message-id'), 'root');
  for (const variant of ['primary', 'default', 'secondary', 'muted', 'tinted', 'outline', 'ghost', 'destructive', 'invalid']) {
    await renderOne('Bubble', { variant, content: 0 });
    assert.equal(await page.locator('.db-bubble__content').textContent(), '0');
    assert.equal(await page.locator('.db-bubble').getAttribute('class'), 'db-bubble db-bubble--' + (['default', 'invalid'].includes(variant) ? 'primary' : variant));
  }
});

test('Attachment keeps its full-card link separate from named child actions', async () => {
  await render();
  assert.equal(await page.locator('.db-attachment--sm').getAttribute('data-state'), 'uploading');
  assert.equal(await page.locator('.db-attachment__trigger').getAttribute('href'), '/review.pdf');
  assert.equal((await page.locator('.db-attachment__actions > button').textContent()).trim(), 'Remove attachment');
  assert.equal(await page.locator('a button, button button').count(), 0);
  assert.equal(await page.getByRole('progressbar', { name: 'Upload Review.pdf' }).getAttribute('aria-valuenow'), '25');
  await renderOne('Attachment', { name: 'Report.pdf', orientation: 'vertical', size: 'xs', state: 'uploading', progress: 200 }, ['action']);
  assert.equal(await page.locator('.db-attachment--vertical.db-attachment--xs').count(), 1);
  assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), '100');
  for (const state of ['idle', 'uploading', 'processing', 'error', 'done', 'invalid']) {
    await renderOne('Attachment', { name: 'Report.pdf', state });
    assert.equal(await page.locator('.db-attachment').getAttribute('data-state'), state === 'invalid' ? 'idle' : state);
    assert.equal(await page.locator('.db-attachment').getAttribute('aria-busy'), ['uploading', 'processing'].includes(state) ? 'true' : 'false');
  }
});

test('chat renderer escapes text and refuses executable image/link URLs', async () => {
  const attack = '<img src=x onerror="window.injected=true">';
  for (const type of ['Message', 'Bubble', 'Attachment', 'Marker']) {
    const props = { content: attack, name: attack, timestamp: attack, footer: attack, description: attack, alt: attack, icon: attack, avatar: { initials: attack, src: 'jAvAsCrIpT:alert(1)' }, src: 'data:text/html,<script>alert(1)</script>', href: 'java\nscript:alert(1)', reactions: [{ label: attack }] };
    await renderOne(type, props, ['body']);
    assert.equal(await page.locator('img,script,a[href]').count(), 1, type + ' (only the installed renderer script)');
    assert.equal(await page.locator('[onerror],[onclick]').count(), 0);
    assert.equal(await page.evaluate(() => !!window.injected), false);
    assert.ok((await page.locator('main').textContent()).includes(attack), type);
  }
  await renderOne('Attachment', { name: 'Preview.png', src: '/preview.png', alt: 'Preview image', href: '/preview.png' });
  assert.equal(await page.locator('.db-attachment__media--image img').getAttribute('alt'), 'Preview image');
  await renderOne('Marker', { content: 'Generating', busy: true, status: true, variant: 'border', icon: 'loader' });
  assert.equal(await page.getByRole('status').getAttribute('aria-busy'), 'true');
  assert.equal(await page.locator('.db-marker--border .db-marker__icon [data-lucide]').getAttribute('aria-hidden'), 'true');
});

for (const mode of ['local', 'cloud']) {
  test(`${mode} exported chat HTML renders and initializes native commands at desktop/mobile widths`, async () => {
    const thread = structuredClone(spec);
    thread.elements.thread.props.defaultScrollPosition = 'start';
    for (let i = 0; i < 16; i++) {
      const id = 'message-' + i;
      thread.elements.thread.children.push(id);
      thread.elements[id] = { type: 'Message', props: { messageId: id, name: 'Ada', scrollAnchor: i === 0 }, children: [id + '-bubble'] };
      thread.elements[id + '-bubble'] = { type: 'Bubble', props: { content: ('Review the task history before publishing. ').repeat(4) } };
    }
    const html = mode === 'local' ? await readFile(renderToHTML(thread, join(work, 'thread.html')), 'utf8') : (await callCloud('render_spec', { spec: JSON.stringify(thread) })).html;
    for (const width of [1280, 390]) {
      const exported = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      exported.setDefaultTimeout(3000);
      const errors = [];
      exported.on('pageerror', error => errors.push(error.message));
      await exported.route('**/*', route => {
        const url = route.request().url();
        if (url === 'http://daub.test/') return route.fulfill({ contentType: 'text/html', body: html });
        if (url.includes('/daub.css')) return route.fulfill({ contentType: 'text/css', body: css });
        if (url.includes('/daub.js')) return route.fulfill({ contentType: 'application/javascript', body: runtime });
        if (url.includes('lucide')) return route.fulfill({ contentType: 'application/javascript', body: 'window.lucide = { createIcons: function() {} };' });
        return route.fulfill({ contentType: 'text/css', body: '' });
      });
      await exported.goto('http://daub.test/');
      assert.deepEqual(errors, []);
      assert.equal(await exported.locator('.db-alert--warning').count(), 0);
      for (const id of Object.keys(thread.elements)) assert.equal(await exported.locator(`[data-spec-id="${id}"]`).count(), 1, id);
      assert.equal(await exported.locator('.db-message-scroller').evaluate(el => el.getBoundingClientRect().height), 360);
      assert.equal(await exported.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const state = await exported.evaluate(() => {
        window.scroller = DAUB.createMessageScroller(document.querySelector('.db-message-scroller'));
        scroller.scrollToEnd({ behavior: 'instant' });
        return scroller.getState();
      });
      assert.equal(state.atEnd, true);
      assert.equal(new Set(state.visibleMessageIds).size, state.visibleMessageIds.length);
      assert.ok(state.visibleMessageIds.includes('message-15'));
      assert.equal(await exported.evaluate(() => scroller.scrollToMessage('missing')), false);
      assert.equal(await exported.evaluate(() => scroller.scrollToStart({ behavior: 'instant' })), true);
      assert.equal(await exported.evaluate(() => scroller.getState().atStart), true);
      assert.equal(await exported.evaluate(() => scroller.scrollToMessage('reply-1', { block: 'start', behavior: 'instant' })), true);
      await exported.evaluate(() => document.querySelector('[data-spec-id="remove"]').addEventListener('click', () => { window.removed = true; }));
      await exported.getByRole('button', { name: 'Remove attachment' }).click();
      assert.equal(await exported.evaluate(() => window.removed), true);
      assert.deepEqual(errors, []);
      await exported.evaluate(() => scroller.destroy());
      await exported.close();
    }
  });
}
