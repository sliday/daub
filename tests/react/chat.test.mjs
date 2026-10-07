import assert from 'node:assert/strict';
import { before, beforeEach, after, afterEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const require = createRequire(new URL('../../react/package.json', import.meta.url));
const { build } = require('esbuild');
let browser, page, script, errors;
before(async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('chat-fixture.tsx', import.meta.url))],
    bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    nodePaths: [fileURLToPath(new URL('../../react/node_modules', import.meta.url))],
  });
  script = result.outputFiles[0].text;
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
});
beforeEach(async () => {
  page = await browser.newPage({ viewport: { width: 800, height: 700 } });
  page.setDefaultTimeout(2500);
  errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setContent('<html><body><div id="root"></div></body></html>');
  await page.addStyleTag({ content: readFileSync(new URL('../../daub.css', import.meta.url), 'utf8') });
  await page.addScriptTag({ content: script });
});
afterEach(async () => { await page?.close(); assert.deepEqual(errors, [], 'React/browser errors'); });
after(async () => { await browser?.close(); });
const mount = async (kind, props = {}) => {
  await page.evaluate(({ kind, props }) => window.mountChat(kind, props), { kind, props });
  await page.waitForFunction(() => Object.values(window.chatRefs).some(Boolean));
  if (kind === 'scroller') await page.waitForFunction(() => window.chatApi && !document.querySelector('.db-message-scroller__viewport').hasAttribute('data-pending-scroll'));
};
const metrics = () => page.locator('.db-message-scroller__viewport').evaluate(element => ({ top: element.scrollTop, remaining: element.scrollHeight - element.clientHeight - element.scrollTop }));
const events = () => page.evaluate(() => window.chatEvents);
const atEnd = () => page.waitForFunction(() => { const v = document.querySelector('.db-message-scroller__viewport'); return v.scrollHeight - v.clientHeight - v.scrollTop <= 1; });

test('scroller starts at end, forwards DOM refs, and mirrors provider options', async () => {
  await mount('scroller', { scrollPreviousItemPeek: 28 });
  await atEnd();
  assert.ok((await metrics()).top > 500);
  assert.equal(await page.locator('#thread').getAttribute('data-db-auto-scroll'), 'true');
  assert.equal(await page.locator('#thread').getAttribute('data-db-scroll-peek'), '28');
  assert.equal(await page.locator('.db-message-scroller__button').isHidden(), true);
  assert.equal(await page.locator('#thread').getAttribute('data-scrollable'), 'start');
  assert.deepEqual(await page.evaluate(() => Object.fromEntries(['root', 'viewport', 'content', 'm0', 'button'].map(name => [name, window.chatRefs[name] instanceof HTMLElement]))), { root: true, viewport: true, content: true, m0: true, button: true });
  await page.evaluate(() => window.unmountChat());
  assert.equal(await page.evaluate(() => ['root', 'viewport', 'content', 'm0', 'button'].every(name => window.chatRefs[name] === null)), true);
});

test('streaming follows at live edge and releases after wheel intent', async () => {
  await mount('scroller');
  const initial = await metrics();
  await page.evaluate(() => window.streamChat());
  await page.waitForFunction(top => document.querySelector('.db-message-scroller__viewport').scrollTop > top + 80, initial.top);
  await atEnd();
  await page.locator('.db-message-scroller__viewport').dispatchEvent('wheel', { deltaY: -400 });
  await page.locator('.db-message-scroller__viewport').evaluate(element => { element.scrollTop -= 300; element.dispatchEvent(new Event('scroll')); });
  const reading = await metrics();
  await page.evaluate(() => window.streamChat());
  await page.waitForFunction(() => document.querySelector('[data-db-message-id="m19"]').getBoundingClientRect().height >= 256);
  assert.ok(Math.abs((await metrics()).top - reading.top) <= 1);
  await page.waitForFunction(() => document.querySelector('.db-message-scroller__button').hidden === false);
  assert.ok((await events()).includes('wheel'));
  await page.getByRole('button', { name: 'Scroll to end' }).click();
  await atEnd();
  assert.ok((await events()).includes('jump'));
});

test('prepended history preserves a visible stable message and its viewport offset', async () => {
  await mount('scroller', { autoScroll: false, defaultScrollPosition: 'start' });
  await page.evaluate(() => window.chatApi.scrollToMessage('m8', { align: 'start' }));
  await page.waitForFunction(() => JSON.parse(document.querySelector('#scroll-state').textContent).visibleMessageIds.includes('m8'));
  const offset = await page.locator('[data-db-message-id="m8"]').evaluate(element => element.getBoundingClientRect().top);
  await page.evaluate(() => window.prependChat());
  await page.waitForFunction(() => !!document.querySelector('[data-db-message-id="history-a"]'));
  await page.waitForFunction(top => Math.abs(document.querySelector('[data-db-message-id="m8"]').getBoundingClientRect().top - top) <= 1, offset);
  assert.equal(await page.locator('[data-db-message-id="m8"]').getAttribute('data-message-id'), 'm8');
});

test('hook commands, visible IDs, and anchored turns retain engine behavior', async () => {
  await mount('scroller', { defaultScrollPosition: 'start', autoScroll: false, scrollPreviousItemPeek: 0 });
  assert.equal((await metrics()).top, 0);
  assert.equal(await page.evaluate(() => window.chatApi.scrollToMessage('missing')), false);
  assert.equal(await page.evaluate(() => window.chatApi.scrollToMessage('m10', { align: 'start' })), true);
  await page.waitForFunction(() => JSON.parse(document.querySelector('#scroll-state').textContent).visibleMessageIds.includes('m10'));
  await page.evaluate(() => window.appendChat(true));
  await page.waitForFunction(() => !!document.querySelector('[data-db-message-id="new-20"]'));
  assert.equal(await page.locator('[data-db-message-id="new-20"]').getAttribute('data-db-scroll-anchor'), 'true');
  assert.equal(await page.evaluate(() => window.chatApi.scrollToMessage('new-20', { scrollMargin: -16 })), true);
  await page.waitForFunction(() => JSON.parse(document.querySelector('#scroll-state').textContent).currentAnchorId === 'new-20');
  assert.equal(await page.evaluate(() => window.chatApi.scrollToStart()), true);
  assert.equal((await metrics()).top, 0);
});

test('headless button composes consumer and render handlers and respects cancellation', async () => {
  await mount('scroller', { autoScroll: false, defaultScrollPosition: 'start', cancel: true, customRender: true });
  const button = page.getByRole('button', { name: 'Scroll to end' });
  assert.equal(await button.getAttribute('data-custom'), 'true');
  assert.equal(await button.getAttribute('type'), 'button');
  await button.click();
  assert.equal((await metrics()).top, 0);
  assert.deepEqual((await events()).filter(event => event === 'jump' || event === 'render'), ['render', 'jump']);
});

test('disabled scroller button remains hidden and cannot change position', async () => {
  await mount('scroller', { autoScroll: false, defaultScrollPosition: 'start', disabled: true });
  const button = page.locator('.db-message-scroller__button');
  assert.equal(await button.isHidden(), true);
  assert.equal(await button.isDisabled(), true);
  await button.dispatchEvent('click');
  assert.equal((await metrics()).top, 0);
});

test('empty scroller clears pending state and follows its first append', async () => {
  await mount('scroller', { count: 0 });
  assert.equal(await page.locator('.db-message-scroller__button').isHidden(), true);
  await page.evaluate(() => window.appendChat());
  await page.waitForFunction(() => !!document.querySelector('[data-db-message-id="new-0"]'));
  await atEnd();
});

test('families forward native refs and metadata, while busy marker exposes status', async () => {
  await mount('families');
  assert.equal(await page.locator('.db-message').getAttribute('title'), 'Native title');
  assert.equal(await page.locator('.db-message').getAttribute('data-db-react'), '');
  assert.equal(await page.getByRole('status').textContent(), '*Processing');
  assert.equal(await page.locator('.db-marker__icon').getAttribute('aria-hidden'), 'true');
  assert.equal(await page.locator('.db-attachment').getAttribute('aria-busy'), 'true');
  assert.equal(await page.getByRole('progressbar', { name: 'Upload progress' }).getAttribute('aria-valuenow'), '42');
  assert.equal(await page.evaluate(() => Object.values(window.chatRefs).filter(Boolean).every(element => element instanceof HTMLElement)), true);
  assert.equal(await page.evaluate(() => Object.values(window.chatRefs).filter(Boolean).length), 24);
});

test('attachment trigger and action remain sibling buttons and do not submit a form', async () => {
  await mount('families');
  assert.equal(await page.locator('button button').count(), 0);
  await page.getByRole('button', { name: 'Open notes.pdf' }).click();
  await page.getByRole('button', { name: 'Remove notes.pdf' }).click();
  assert.deepEqual(await events(), ['open', 'remove']);
});

test('BubbleCollapsible retains input state and reports controlled requests', async () => {
  await mount('families');
  const trigger = page.getByRole('button', { name: 'Details', exact: true });
  assert.equal(await trigger.getAttribute('type'), 'button');
  await trigger.click();
  await page.getByRole('textbox', { name: 'Notes' }).fill('Saved');
  await trigger.click();
  assert.equal(await page.getByRole('textbox', { name: 'Notes' }).isVisible(), false);
  await trigger.click();
  assert.equal(await page.getByRole('textbox', { name: 'Notes' }).inputValue(), 'Saved');
  await mount('families', { open: false });
  await trigger.click();
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(await events(), [['collapse', true]]);
});

test('native DAUB initialization leaves React scroller and app-owned attachment state intact', async () => {
  await mount('scroller', { defaultScrollPosition: 'start', autoScroll: false });
  await page.addScriptTag({ content: readFileSync(new URL('../../daub.js', import.meta.url), 'utf8') });
  await page.evaluate(() => window.DAUB.init());
  await page.getByRole('button', { name: 'Scroll to end' }).click();
  await atEnd();
  assert.equal((await events()).filter(event => event === 'jump').length, 1);
  await mount('families', { state: 'error' });
  await page.evaluate(() => window.DAUB.init());
  await page.getByRole('button', { name: 'Remove notes.pdf' }).click();
  assert.equal(await page.locator('.db-attachment').getAttribute('data-state'), 'error');
  assert.deepEqual(await events(), ['remove']);
});

test('scroller root ref works inside a shadow root and cleans up on unmount', async () => {
  await page.evaluate(() => {
    const host = document.createElement('div');
    document.body.append(host);
    const container = document.createElement('div');
    host.attachShadow({ mode: 'open' }).append(container);
    window.mountChat('scroller', { count: 1, defaultScrollPosition: 'start' }, container);
  });
  await page.waitForFunction(() => !!window.chatRefs.viewport);
  assert.equal(await page.evaluate(() => window.chatRefs.root?.classList.contains('db-message-scroller') ?? false), true);
  await page.evaluate(() => window.unmountChat());
  assert.equal(await page.evaluate(() => window.chatRefs.root), null);
});

test('last-anchor restores a long turn with configured previous-item peek', async () => {
  await mount('scroller', { defaultScrollPosition: 'last-anchor', anchorIndex: 16, scrollPreviousItemPeek: 24 });
  const offset = await page.locator('[data-db-message-id="m16"]').evaluate(element => element.getBoundingClientRect().top - document.querySelector('.db-message-scroller__viewport').getBoundingClientRect().top);
  assert.ok(Math.abs(offset - 40) <= 1, `Anchor offset includes 16px content padding plus 24px peek: ${offset}`);
  await mount('scroller', { defaultScrollPosition: 'last-anchor', anchorLast: true });
  await atEnd();
});

test('native keyboard and touch callbacks compose with headless scroll intent', async () => {
  await mount('scroller');
  const viewport = page.locator('.db-message-scroller__viewport');
  await viewport.press('Home');
  await viewport.dispatchEvent('touchmove');
  assert.ok((await events()).includes('Home'));
  assert.ok((await events()).includes('touch'));
  await mount('scroller', { autoScroll: false, defaultScrollPosition: 'start' });
  await page.evaluate(() => window.streamChat());
  await page.waitForFunction(() => document.querySelector('[data-db-message-id="m19"]').getBoundingClientRect().height >= 156);
  assert.equal((await metrics()).top, 0);
});

test('server transcript hydrates without mismatches or DAUB globals', async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../../react/src/index.ts', import.meta.url))],
    bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic',
    external: ['react', 'react-dom', 'react/jsx-runtime'],
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
  const chat = module.exports;
  const { createElement: h } = require('react');
  const { renderToString } = require('react-dom/server');
  const html = renderToString(h(chat.MessageScrollerProvider, null, h(chat.MessageScroller, { id: 'hydrated' },
    h(chat.MessageScrollerViewport, null, h(chat.MessageScrollerContent, null,
      h(chat.MessageScrollerItem, { messageId: 'hydrated-row' }, 'Hello'))), h(chat.MessageScrollerButton))));
  await page.locator('#root').evaluate((element, html) => { element.innerHTML = html; }, html);
  await page.evaluate(() => window.hydrateChat());
  await page.waitForFunction(() => !document.querySelector('#hydrated').hasAttribute('data-pending-scroll'));
  assert.equal(await page.locator('[data-db-message-id="hydrated-row"]').textContent(), 'Hello');
  assert.equal(await page.evaluate(() => typeof window.DAUB), 'undefined');
});
