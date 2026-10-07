import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../../', import.meta.url);
const css = await readFile(new URL('daub.css', root), 'utf8');
const js = await readFile(new URL('daub.js', root), 'utf8');
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

async function mount(width, touch = false) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: touch, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.setContent('<html data-theme="github"><body style="margin:0;padding:16px"><main style="max-width:760px;margin:auto"></main></body></html>');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: js });
  await page.addScriptTag({ content: await readFile(new URL('assets/lucide.min.js', root), 'utf8') });
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
  await page.evaluate(() => {
    window.SpeechRecognition = class { start() {} stop() {} abort() {} };
    const form = document.createElement('form');
    form.className = 'db-chat-composer';
    const options = { models: [{ id: 'review', label: 'Long model name for release review', efforts: ['low', 'high', 'extra high'] }], actions: [{ id: 'context', label: 'Long configured action '.repeat(8) }] };
    form.setAttribute('data-db-chat-options', JSON.stringify(options));
    document.querySelector('main').append(form);
    window.composer = DAUB.createChatComposer(form);
    composer.setBusy(true);
    composer.setDraft('Review ' + 'very-long-source-filename-'.repeat(8) + '.txt before release');
    form.requestSubmit();
    composer.attachFiles([new File(['Release notes'], 'long-attachment-name-'.repeat(8) + '.txt', { type: 'text/plain' })]);
    composer.setDraft('Check the release');
    lucide.createIcons();
  });
  await page.locator('.db-chat-composer__dictation').click();
  assert.equal(await page.locator('.db-chat-composer__dictation-bar').isVisible(), true);
  await page.evaluate(() => {
    document.querySelector('.db-chat-composer__dictation-state').textContent = 'Listening to your ' + 'dictation '.repeat(12);
  });
  return { context, page };
}

async function geometry(page, target) {
  return page.evaluate(target => {
    const root = document.querySelector('.db-chat-composer');
    const visible = element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
    const controls = [...root.querySelectorAll('button, select')].filter(visible);
    const failures = [];
    function clippedRect(element) {
      const rect = element.getBoundingClientRect().toJSON();
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
        if (['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX)) { rect.left = Math.max(rect.left, bounds.left); rect.right = Math.min(rect.right, bounds.right); }
        if (['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowY)) { rect.top = Math.max(rect.top, bounds.top); rect.bottom = Math.min(rect.bottom, bounds.bottom); }
      }
      return rect;
    }
    for (const element of controls) {
      const rect = element.getBoundingClientRect();
      if (rect.width < target || rect.height < target) failures.push({ kind: 'target', slot: element.className, rect: rect.toJSON() });
      if (rect.left < 0 || rect.right > innerWidth) failures.push({ kind: 'overflow', slot: element.className, rect: rect.toJSON() });
      if (parseFloat(getComputedStyle(element).borderRadius) > 8) failures.push({ kind: 'radius', slot: element.className });
    }
    for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
      if (controls[i].closest('.db-dropdown__menu, .db-dropdown__content') !== controls[j].closest('.db-dropdown__menu, .db-dropdown__content')) continue;
      const a = clippedRect(controls[i]), b = clippedRect(controls[j]);
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) failures.push({ kind: 'overlap', slots: [controls[i].className, controls[j].className] });
    }
    const queue = root.querySelector('.db-chat-composer__queue'), panel = root.querySelector('.db-chat-composer__panel');
    return { failures, overflow: document.documentElement.scrollWidth > innerWidth, queueBottom: queue.getBoundingClientRect().bottom, panelTop: panel.getBoundingClientRect().top, rootBorder: getComputedStyle(root).borderTopWidth, panelBorder: getComputedStyle(panel).borderTopWidth };
  }, target);
}

test('composer slots fit 320, 375 and desktop with distinct queue, panel and action targets', async () => {
  for (const width of [320, 375, 1440]) {
    const { context, page } = await mount(width, width < 500);
    try {
      const result = await geometry(page, width < 500 ? 44 : 32);
      assert.deepEqual(result.failures, [], JSON.stringify({ width, result }));
      assert.equal(result.overflow, false);
      assert.ok(result.queueBottom < result.panelTop);
      assert.equal(result.rootBorder, '0px');
      assert.equal(result.panelBorder, '1px');
      const size = width < 500 ? 44 : 32;
      for (const selector of ['.db-chat-composer__add', '.db-chat-composer__send', '.db-chat-composer__stop']) {
        assert.deepEqual(await page.locator(selector).evaluate(el => ({ width: el.offsetWidth, height: el.offsetHeight })), { width: size, height: size });
      }
      const steer = page.locator('.db-chat-composer__steer');
      assert.equal(await steer.textContent(), 'Steer');
      assert.ok(await steer.evaluate((el, size) => el.offsetWidth >= size && el.offsetHeight === size, size));
      assert.equal(await page.locator('.db-chat-composer__panel').evaluate(el => getComputedStyle(el).position), 'relative');
      assert.equal(await page.locator('.db-chat-composer__panel').evaluate(el => getComputedStyle(el).pointerEvents), 'auto');
      if (process.env.DAUB_COMPOSER_EVIDENCE) await page.screenshot({ path: `${process.env.DAUB_COMPOSER_EVIDENCE}-${width}.png`, fullPage: true });
      await page.locator('.db-chat-composer__add').click();
      assert.equal(await page.locator('.db-chat-composer__add-menu').isVisible(), true);
      assert.ok((await page.locator('.db-chat-composer__add-menu').boundingBox()).y >= 0);
      assert.deepEqual((await geometry(page, width < 500 ? 44 : 32)).failures, []);
    } finally { await context.close(); }
  }
});

test('short 320px windows retain transcript space with a scrolling queue and listening text', async () => {
  const { context, page } = await mount(320, true);
  try {
    await page.setViewportSize({ width: 320, height: 320 });
    const result = await page.evaluate(() => {
      const shell = document.querySelector('main');
      Object.assign(shell.style, { height: 'calc(100dvh - 96px)', display: 'flex', flexDirection: 'column' });
      const transcript = document.createElement('div');
      transcript.textContent = 'Previous messages';
      Object.assign(transcript.style, { flex: '1', minHeight: '0', overflowY: 'auto' });
      shell.prepend(transcript);
      const queue = document.querySelector('.db-chat-composer__queue');
      for (let i = 0; i < 12; i++) queue.append(queue.firstElementChild.cloneNode(true));
      const listening = document.querySelector('.db-chat-composer__dictation-bar > span');
      return { transcript: transcript.getBoundingClientRect().height, root: document.querySelector('.db-chat-composer').getBoundingClientRect().height, queue: queue.getBoundingClientRect().height, listening: listening.getBoundingClientRect().height, queueScrolls: queue.scrollHeight > queue.clientHeight, panelScrolls: document.querySelector('.db-chat-composer__panel').scrollHeight > document.querySelector('.db-chat-composer__panel').clientHeight, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.ok(result.transcript >= 32, JSON.stringify(result));
    assert.ok(result.root <= 192, JSON.stringify(result));
    assert.ok(result.queue <= 52);
    assert.ok(result.listening <= 44);
    assert.equal(result.queueScrolls, true);
    assert.equal(result.panelScrolls, true);
    assert.equal(result.overflow, false);
    console.log(`Composer short window: ${JSON.stringify(result)}`);
    if (process.env.DAUB_COMPOSER_EVIDENCE) await page.screenshot({ path: `${process.env.DAUB_COMPOSER_EVIDENCE}-320-short.png` });
    await page.locator('.db-chat-composer__send').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('.db-chat-composer__send').isVisible(), true);
    assert.deepEqual((await geometry(page, 44)).failures, []);
  } finally { await context.close(); }
});

test('runtime queue editing, attachment preview, drag feedback and separate actions fit', async () => {
  const { context, page } = await mount(375, true);
  try {
    assert.equal(await page.locator('.db-chat-composer__model option').textContent(), 'Long model name for release review');
    assert.equal(await page.locator('.db-chat-composer__stop').isVisible(), true);
    assert.equal(await page.locator('.db-chat-composer__send').getAttribute('aria-label'), 'Queue message');
    await page.locator('.db-chat-composer__queued-actions .db-dropdown__trigger').click();
    await page.getByRole('menuitem', { name: 'Edit message', exact: true }).click();
    const editor = page.locator('.db-chat-composer__queued-input');
    assert.equal(await editor.isVisible(), true);
    const height = await editor.evaluate(el => el.getBoundingClientRect().height);
    assert.ok(height >= 64 && height <= 160);
    assert.deepEqual((await geometry(page, 44)).failures, []);
    await editor.fill('Updated release review');
    await page.getByRole('button', { name: 'Save edit', exact: true }).click();
    assert.equal(await page.locator('.db-chat-composer__queued-text').textContent(), 'Updated release review');
    await page.locator('.db-chat-composer__file-input').setInputFiles(new URL('case-studies/dashrock-overview.jpg', root).pathname);
    const preview = page.locator('.db-chat-composer__attachments img');
    await page.waitForFunction(() => { const img = document.querySelector('.db-chat-composer__attachments img'); return img?.complete && img.naturalWidth > 0; });
    assert.deepEqual(await preview.evaluate(img => ({ width: img.width, height: img.height })), { width: 32, height: 32 });
    assert.deepEqual((await geometry(page, 44)).failures, []);
    await page.locator('.db-chat-composer__input').dispatchEvent('dragover');
    const overlay = await page.locator('.db-chat-composer__panel').evaluate(panel => {
      const style = getComputedStyle(panel, '::after');
      return { content: style.content, position: style.position, pointer: style.pointerEvents, inset: style.top };
    });
    assert.deepEqual(overlay, { content: '"Drop files here"', position: 'absolute', pointer: 'none', inset: '4px' });
    await page.locator('.db-chat-composer__input').dispatchEvent('dragleave');
    assert.equal(await page.locator('.db-chat-composer__panel').evaluate(panel => getComputedStyle(panel, '::after').content), 'none');
    await page.evaluate(() => composer.setBusy(false));
    assert.equal(await page.locator('.db-chat-composer__stop').isVisible(), false);
    assert.equal(await page.locator('.db-chat-composer__send').getAttribute('aria-label'), 'Send message');
  } finally { await context.close(); }
});

test('composer text and focus meet contrast thresholds across all 42 themes', async () => {
  const { context, page } = await mount(1440);
  try {
    await page.locator('.db-chat-composer__input').focus();
    await page.keyboard.press('Tab');
    await page.locator('.db-chat-composer__add').press('ArrowDown');
    const result = await page.evaluate(() => {
      const canvas = document.createElement('canvas').getContext('2d');
      function rgba(value) {
        canvas.clearRect(0, 0, 1, 1); canvas.fillStyle = value; canvas.fillRect(0, 0, 1, 1);
        return [...canvas.getImageData(0, 0, 1, 1).data].map((v, i) => i === 3 ? v / 255 : v);
      }
      const blend = (fg, bg) => fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]));
      function background(element) {
        const chain = [];
        for (let parent = element; parent; parent = parent.parentElement) chain.unshift(parent);
        return chain.reduce((bg, parent) => blend(rgba(getComputedStyle(parent).backgroundColor), bg), [255, 255, 255]);
      }
      function luminance(rgb) {
        return rgb.map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
      }
      function ratio(fg, bg) { const a = luminance(blend(fg, bg)), b = luminance(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }
      const failures = [], ratios = [];
      const composer = document.querySelector('.db-chat-composer');
      for (const theme of DAUB.THEMES) {
        DAUB.setTheme(theme);
        document.body.style.background = 'var(--db-color-bg)';
        for (const element of composer.querySelectorAll('button, select, textarea, input:not([type=file]), label, .db-chat-composer__status, .db-chat-composer__queued-text, .db-chat-composer__dictation-bar > span, .db-attachment__title, .db-attachment__meta')) {
          if (element.disabled) continue;
          if (!element.getClientRects().length) continue;
          const value = ratio(rgba(getComputedStyle(element).color), background(element));
          ratios.push(value);
          if (value < 4.5) failures.push({ theme, slot: element.className, ratio: value });
          if (element.tagName === 'TEXTAREA') {
            const placeholder = ratio(rgba(getComputedStyle(element, '::placeholder').color), background(element));
            if (placeholder < 4.5) failures.push({ theme, slot: 'placeholder', ratio: placeholder });
          }
        }
        const button = composer.querySelector('.db-chat-composer__add');
        button.focus();
        const style = getComputedStyle(button);
        if (style.outlineStyle === 'none' || parseFloat(style.outlineWidth) < 2 || ratio(rgba(style.outlineColor), background(button)) < 3) failures.push({ theme, slot: 'focus' });
      }
      return { themes: DAUB.THEMES.length, minimum: Math.min(...ratios), failures };
    });
    assert.equal(result.themes, 42);
    assert.deepEqual(result.failures, []);
    assert.ok(result.minimum >= 4.5);
    console.log(`Composer contrast: ${result.themes} themes, minimum ${result.minimum.toFixed(2)}:1`);
  } finally { await context.close(); }
});
