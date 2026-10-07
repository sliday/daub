import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';

const root = new URL('../../', import.meta.url);
const assets = new Map();
for (const file of ['chat-demo.html', 'chat-demo.css', 'site-nav.css', 'chat-demo.js', 'chat-demo-shell.js', 'daub.css', 'daub.js', 'assets/lucide.min.js', 'case-studies/dashrock-overview.jpg']) assets.set('/' + file, await readFile(new URL(file, root)));
let browser;
before(async () => { browser = await ({ chromium, firefox, webkit })[process.env.DAUB_TEST_BROWSER || 'chromium'].launch({ headless: true }); });
after(async () => { await browser?.close(); });

async function fixture(width = 1440, height = 900) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(3000);
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    const body = url.hostname === 'daub.test' && assets.get(url.pathname);
    if (!body) return route.abort();
    return route.fulfill({ body, contentType: url.pathname.endsWith('.js') ? 'application/javascript' : url.pathname.endsWith('.css') ? 'text/css' : url.pathname.endsWith('.jpg') ? 'image/jpeg' : 'text/html' });
  });
  await page.clock.install();
  await page.goto('http://daub.test/chat-demo.html');
  await page.addStyleTag({ content: '*,*::before,*::after { transition: none !important; animation: none !important; }' });
  return page;
}

test('completed replies avoid placeholder reactions and duplicate completion metadata', async () => {
  const page = await fixture();
  try {
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Review this release');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await page.clock.runFor(6000);
    const answer = page.locator('[data-db-message-id="assistant-1"]');
    assert.equal(await answer.getByRole('button', { name: 'Received', exact: true }).count(), 0);
    assert.equal(await answer.locator('.chat-demo-run-footer').count(), 0);
    assert.equal(await answer.locator('.db-message__header .chat-demo-run-label').count(), 0);
    assert.equal(await answer.locator('.chat-demo-thinking__state').textContent(), 'Complete');
    assert.equal(await answer.locator('.db-message__footer--hover time').count(), 1);
    assert.equal(await answer.getByRole('button', { name: 'Copy response', exact: true }).count(), 1);
  } finally { await page.close(); }
});

test('composer popups use one UI font and dismiss sibling panels without closing nested choices', async () => {
  const page = await fixture();
  try {
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    const add = page.locator('.db-chat-composer__add-menu');
    assert.equal(await add.isVisible(), true);
    await page.getByRole('button', { name: 'Chat settings', exact: true }).click();
    const settings = page.getByRole('dialog', { name: 'Chat settings', exact: true });
    assert.equal(await add.isVisible(), false);
    assert.equal(await settings.isVisible(), true);
    const fonts = await settings.evaluate(element => ({ heading: getComputedStyle(element.querySelector('h3')).fontFamily, panel: getComputedStyle(element).fontFamily, input: getComputedStyle(element.querySelector('input')).fontFamily, composer: getComputedStyle(document.querySelector('.db-chat-composer')).fontFamily }));
    assert.equal(fonts.heading, fonts.composer);
    assert.equal(fonts.panel, fonts.composer);
    assert.equal(fonts.input, fonts.composer);
    const effort = settings.getByRole('combobox', { name: 'Effort', exact: true });
    assert.equal(await effort.evaluate(element => element.tagName), 'BUTTON');
    await effort.click();
    assert.equal(await settings.isVisible(), true);
    await settings.getByRole('option', { name: 'Low', exact: true }).click();
    assert.equal(await effort.getAttribute('aria-expanded'), 'false');
    await page.getByRole('combobox', { name: 'Model', exact: true }).click();
    assert.equal(await settings.isVisible(), false);
    assert.equal(await page.getByRole('listbox', { name: 'Model', exact: true }).isVisible(), true);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    assert.equal(await page.getByRole('listbox', { name: 'Model', exact: true }).isVisible(), false);
  } finally { await page.close(); }
});

test('demo change summaries expose real view and undo actions without changing filesystem state', async () => {
  for (const width of [320, 1440]) {
    const page = await fixture(width);
    try {
      const summary = page.locator('[data-db-message-id="initial-answer"] .db-change-summary');
      assert.equal(await summary.count(), 1);
      assert.equal(await summary.locator('.db-change-summary__title').textContent(), 'Prepared 2 demo files');
      assert.deepEqual(await summary.locator('.db-change-summary__path').allTextContents(), ['review-checklist.md', 'release-notes.md']);
      assert.equal(await summary.locator('.db-change-summary__totals').textContent(), '+5-1');
      await summary.getByRole('button', { name: 'View demo changes', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Demo changes', exact: true });
      console.log('Change dialog audit: ' + JSON.stringify(await page.locator('#chat-changes-modal').evaluate(element => ({ classes: element.className, hidden: element.getAttribute('aria-hidden'), display: getComputedStyle(element).display, visibility: getComputedStyle(element).visibility, panel: getComputedStyle(element.querySelector('.db-modal')).visibility }))));
      assert.equal(await dialog.isVisible(), true);
      assert.match(await dialog.locator('pre').first().textContent(), /Keyboard and focus checks/);
      await page.keyboard.press('Escape');
      await summary.getByRole('button', { name: 'Undo demo changes', exact: true }).click();
      assert.equal(await summary.locator('.db-change-summary__title').textContent(), 'Reverted 2 demo files');
      assert.equal(await summary.getByRole('button', { name: 'Undo demo changes', exact: true }).isDisabled(), true);
      await summary.getByRole('button', { name: 'View demo changes', exact: true }).click();
      assert.equal(await dialog.locator('pre').first().textContent(), '# Release review\n- Desktop smoke test\n- Export a report');
      await page.keyboard.press('Escape');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.getByRole('button', { name: 'Reset conversation', exact: true }).click();
      assert.equal(await summary.locator('.db-change-summary__title').textContent(), 'Prepared 2 demo files');
    } finally { await page.close(); }
  }
});
