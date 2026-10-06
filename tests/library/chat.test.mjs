import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';

const root = new URL('../../', import.meta.url);
const assets = new Map();
for (const name of ['chat-demo.html', 'chat-demo.css', 'chat-demo.js', 'daub.css', 'daub.js', 'assets/lucide.min.js', 'case-studies/dashrock-overview.jpg']) {
  assets.set('/' + name, await readFile(new URL(name, root)));
}
let browser, page;
const errors = [];
before(async () => {
  const engine = process.env.DAUB_TEST_BROWSER || 'chromium';
  browser = await ({ chromium, firefox, webkit })[engine].launch({ headless: true });
  page = await browser.newPage({ reducedMotion: 'reduce' });
  page.setDefaultTimeout(5000);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    const body = url.hostname === 'daub.test' && assets.get(url.pathname);
    if (!body) return route.abort();
    const contentType = url.pathname.endsWith('.js') ? 'application/javascript' : url.pathname.endsWith('.css') ? 'text/css' : url.pathname.endsWith('.jpg') ? 'image/jpeg' : 'text/html';
    return route.fulfill({ body, contentType });
  });
});
after(async () => { await browser?.close(); });

test('conversation fits mobile and desktop widths and loads its attachment image', async () => {
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('http://daub.test/chat-demo.html');
    await page.waitForFunction(() => document.querySelector('.db-attachment img').complete);
    assert.ok(await page.locator('.db-attachment img').evaluate(image => image.naturalWidth > 0));
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Check mobile layout');
    await page.getByRole('textbox', { name: 'Message', exact: true }).press('Enter');
    await page.getByRole('button', { name: 'Stop response', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Stop response', exact: true }).click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const bounds = await page.locator('.chat-demo-composer').boundingBox();
    assert.ok(bounds.y + bounds.height <= 812, 'composer remains in the viewport');
    const theme = await page.getByRole('button', { name: 'Open theme picker', exact: true }).boundingBox();
    const send = await page.getByRole('button', { name: 'Send message', exact: true }).boundingBox();
    assert.ok(theme.y + theme.height <= 56, 'theme control stays in the header');
    assert.ok(theme.y + theme.height <= send.y, 'theme control does not cover Send');
  }
  assert.deepEqual(errors, []);
});

test('send, stream, stop, reset, and composition keyboard input remain independent', async () => {
  await page.goto('http://daub.test/chat-demo.html');
  const input = page.getByRole('textbox', { name: 'Message', exact: true });
  assert.equal(await page.getByRole('button', { name: 'Send message', exact: true }).isDisabled(), true);
  await input.fill('Review attachment states');
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true });
  assert.equal(await page.locator('[data-db-message-id^="user-"]').count(), 0);
  await input.press('Shift+Enter');
  assert.equal(await page.locator('[data-db-message-id^="user-"]').count(), 0);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-db-message-id^="assistant-"] .db-bubble__content').textContent.length > 10);
  await page.getByRole('button', { name: 'Stop response', exact: true }).click();
  const stopped = await page.locator('[data-db-message-id^="assistant-"] .db-bubble__content').textContent();
  await page.waitForTimeout(160);
  assert.equal(await page.locator('[data-db-message-id^="assistant-"] .db-bubble__content').textContent(), stopped);
  assert.equal(await page.locator('#chat-messages').getAttribute('aria-busy'), 'false');
  await page.getByRole('button', { name: 'Reset conversation', exact: true }).click();
  assert.equal(await page.locator('[data-db-message-id^="user-"]').count(), 0);
  await input.fill('Release review');
  await input.press('Enter');
  await page.waitForFunction(() => document.querySelector('#chat-status').textContent === 'Ready');
  const reaction = page.getByRole('button', { name: 'Received', exact: true });
  await reaction.click();
  assert.equal(await reaction.getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Reset conversation', exact: true }).click();
  await page.getByRole('button', { name: 'Copy review checklist', exact: true }).click();
  await page.waitForFunction(() => /Copied|Clipboard unavailable/.test(document.querySelector('#chat-status').textContent));
  assert.deepEqual(errors, []);
});

test('local attachment actions remove files without submitting and long names do not overflow', async () => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto('http://daub.test/chat-demo.html');
  const name = 'release-review-' + 'long-name-'.repeat(8) + '.txt';
  await page.locator('#chat-file').setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from('Local attachment') });
  assert.equal(await page.locator('#pending-attachments .db-attachment').count(), 1);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole('button', { name: 'Remove ' + name, exact: true }).click();
  assert.equal(await page.locator('#pending-attachments .db-attachment').count(), 0);
  assert.equal(await page.locator('[data-db-message-id^="user-"]').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Send message', exact: true }).isDisabled(), true);
});

test('long filenames and short windows keep the composer within reach', async () => {
  const name = 'x'.repeat(250) + '.txt';
  for (const height of [568, 320]) {
    await page.setViewportSize({ width: 320, height });
    await page.goto('http://daub.test/chat-demo.html');
    await page.addStyleTag({ content: '.chat-demo .chat-demo-icon-button{width:44px;height:44px}' });
    await page.locator('#chat-file').setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from('Local') });
    const title = await page.locator('#pending-attachments .db-attachment__title').boundingBox();
    const send = await page.getByRole('button', { name: 'Send message', exact: true }).boundingBox();
    const viewport = await page.locator('.db-message-scroller__viewport').boundingBox();
    assert.ok(title.height < 50, 'filename stays within two lines');
    assert.equal(await page.locator('#pending-attachments .db-attachment__title').getAttribute('title'), name);
    assert.ok(viewport.height > 0, 'transcript retains visible space');
    assert.ok(send.y + send.height <= height, 'Send remains in the viewport');
  }
});

test('delayed clipboard results cannot overwrite a newer streaming status', async () => {
  await page.setViewportSize({ width: 800, height: 700 });
  await page.goto('http://daub.test/chat-demo.html');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise(resolve => { window.resolveCopy = resolve; }) } }));
  await page.getByRole('button', { name: 'Copy review checklist', exact: true }).click();
  await page.getByRole('button', { name: 'Reset conversation', exact: true }).click();
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Review the release');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.evaluate(() => window.resolveCopy());
  assert.equal(await page.locator('#chat-status').textContent(), 'Simulated response');
  await page.getByRole('button', { name: 'Stop response', exact: true }).click();
});

test('chat primitives inherit 42 themes, constrain corners, and respect reduced motion', async () => {
  await page.goto('http://daub.test/chat-demo.html');
  const themes = await page.evaluate(() => DAUB.THEMES);
  for (const theme of themes) {
    await page.evaluate(theme => DAUB.setTheme(theme), theme);
    const style = await page.evaluate(() => {
      const bubble = getComputedStyle(document.querySelector('.db-bubble'));
      const button = getComputedStyle(document.querySelector('#chat-send'));
      const attachment = getComputedStyle(document.querySelector('.db-attachment'));
      return { bubbleText: bubble.color, buttonText: button.color, bubbleRadius: parseFloat(bubble.borderTopLeftRadius), attachmentRadius: parseFloat(attachment.borderTopLeftRadius) };
    });
    assert.equal(style.bubbleText, style.buttonText, theme + ' primary text contrast');
    assert.ok(style.bubbleRadius <= 8 && style.attachmentRadius <= 8, theme + ' corner limit');
  }
  await page.locator('#chat-prompt').fill('Start a reply');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  assert.equal(await page.locator('.db-shimmer').evaluate(element => getComputedStyle(element).animationName), 'none');
  await page.getByRole('button', { name: 'Stop response', exact: true }).click();
  assert.deepEqual(errors, []);
});
