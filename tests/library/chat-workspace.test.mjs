import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';

const root = new URL('../../', import.meta.url);
const assets = new Map();
for (const file of ['chat-demo.html', 'chat-demo.css', 'chat-demo.js', 'chat-demo-shell.js', 'daub.css', 'daub.js', 'assets/lucide.min.js', 'case-studies/dashrock-overview.jpg']) assets.set('/' + file, await readFile(new URL(file, root)));
let browser;
before(async () => { browser = await ({ chromium, firefox, webkit })[process.env.DAUB_TEST_BROWSER || 'chromium'].launch({ headless: true }); });
after(async () => { await browser?.close(); });

async function workspace(run, { width = 1440, height = 900, clock = false, speech = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(3000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.protocol === 'blob:') return route.continue();
    const body = url.hostname === 'daub.test' && assets.get(url.pathname);
    if (!body) return route.abort();
    return route.fulfill({ body, contentType: url.pathname.endsWith('.js') ? 'application/javascript' : url.pathname.endsWith('.css') ? 'text/css' : url.pathname.endsWith('.jpg') ? 'image/jpeg' : 'text/html' });
  });
  if (speech) await page.addInitScript(() => {
    window.speechStarts = 0;
    window.SpeechRecognition = class {
      constructor() { window.speech = this; }
      start() { speechStarts++; }
      stop() { this.onend?.(); }
      abort() { this.aborted = true; }
    };
  });
  if (clock) await page.clock.install();
  try {
    await page.goto('http://daub.test/chat-demo.html');
    await page.locator('#chat-prompt').waitFor();
    await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}

async function send(page, text) {
  await page.locator('#chat-prompt').fill(text);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
}

async function add(page, name) {
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}

test('queue edits survive arrivals, steer interrupts now, and remaining requests drain in order', async () => {
  await workspace(async page => {
    await send(page, 'Review the release');
    assert.equal(await page.getByRole('combobox', { name: 'Model', exact: true }).isDisabled(), true);
    await page.locator('#chat-prompt').fill('First follow-up');
    await page.getByRole('button', { name: 'Queue message', exact: true }).click();
    const first = page.locator('.db-chat-composer__queued-item').first();
    await first.getByRole('button', { name: 'Edit queued message', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Edit message', exact: true }).click();
    await first.getByRole('textbox', { name: 'Edit queued message', exact: true }).fill('Mobile follow-up');
    await page.locator('#chat-prompt').fill('Second follow-up');
    await page.getByRole('button', { name: 'Queue message', exact: true }).click();
    assert.equal(await first.getByRole('textbox', { name: 'Edit queued message', exact: true }).inputValue(), 'Mobile follow-up');
    await first.getByRole('button', { name: 'Save edit', exact: true }).click();
    assert.equal(await page.locator('#chat-queue-count').textContent(), '2');
    await first.getByRole('button', { name: 'Steer queued message', exact: true }).click();
    assert.equal(await page.locator('[data-db-message-id="assistant-1"] .chat-demo-thinking').getAttribute('data-state'), 'steered');
    assert.match(await page.locator('[data-db-message-id="user-2"] .db-message__header').textContent(), /Steered mid-run/);
    assert.equal(await page.locator('#chat-queue-count').textContent(), '1');
    await page.clock.runFor(10000);
    assert.deepEqual(await page.locator('[data-db-message-id^="user-"] .db-bubble__content').allTextContents(), ['Review the release', 'Mobile follow-up', 'Second follow-up']);
    assert.equal(await page.locator('.db-chat-composer__queued-item').count(), 0);
    assert.equal(await page.getByRole('combobox', { name: 'Model', exact: true }).isDisabled(), false);
  }, { clock: true });
});

test('file drop, context, goal, plan and model selections affect the next request', async () => {
  await workspace(async page => {
    const transfer = await page.evaluateHandle(() => {
      const data = new DataTransfer();
      data.items.add(new File(['Release notes'], 'release.md', { type: 'text/markdown' }));
      return data;
    });
    await page.locator('.chat-demo-shell').dispatchEvent('dragover', { dataTransfer: transfer });
    assert.equal(await page.locator('.db-chat-composer__dropzone').isVisible(), true);
    await page.locator('.chat-demo-shell').dispatchEvent('drop', { dataTransfer: transfer });
    assert.equal(await page.locator('#pending-attachments .db-attachment').count(), 1);
    assert.equal(page.url(), 'http://daub.test/chat-demo.html');
    await add(page, 'Browser or text context');
    const context = page.getByRole('dialog', { name: 'Add context', exact: true });
    await context.getByRole('textbox', { name: 'Context', exact: true }).fill('Check the release notes against the mobile layout.');
    await context.getByRole('button', { name: 'Attach context', exact: true }).click();
    await add(page, 'Set goal');
    const goal = page.getByRole('dialog', { name: 'Set goal', exact: true });
    await goal.getByRole('textbox', { name: 'Goal', exact: true }).fill('Complete the release review');
    await goal.getByRole('button', { name: 'Set goal', exact: true }).click();
    await add(page, 'Plan mode');
    await page.getByRole('combobox', { name: 'Model', exact: true }).selectOption('demo-brief');
    await page.getByRole('button', { name: 'Chat settings', exact: true }).click();
    const settings = page.getByRole('dialog', { name: 'Chat settings', exact: true });
    await settings.getByRole('combobox', { name: 'Effort', exact: true }).selectOption('low');
    await settings.getByRole('combobox', { name: 'Approval', exact: true }).selectOption('auto');
    await page.keyboard.press('Escape');
    await send(page, 'Plan the release');
    await page.clock.runFor(6000);
    const answer = page.locator('[data-db-message-id="assistant-1"]');
    assert.match(await answer.locator('.db-message__header').textContent(), /brief \/ low/);
    assert.match(await answer.locator('.db-bubble__content').textContent(), /1\. Review the main workflow/);
    assert.equal(await page.locator('[data-db-message-id="user-1"] .db-attachment').count(), 2);
    assert.match(await page.locator('[data-db-message-id="user-1"] .db-message__header').textContent(), /Goal/);
    await page.locator('[data-chat-view="files"]').click();
    assert.deepEqual(await page.locator('#chat-view-panel a').evaluateAll(links => links.map(link => link.download)), ['release.md', 'Context.txt']);
  }, { clock: true });
});

test('sketch has nonblank pixels, undo and clear work, and attaching creates a PNG', async () => {
  await workspace(async page => {
    await add(page, 'Draw sketch');
    const dialog = page.getByRole('dialog', { name: 'Sketch', exact: true });
    const canvas = dialog.locator('canvas');
    const bounds = await canvas.boundingBox();
    await page.mouse.move(bounds.x + 30, bounds.y + 30);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 130, bounds.y + 70, { steps: 10 });
    await page.mouse.up();
    const pixels = async () => canvas.evaluate(element => [...element.getContext('2d').getImageData(0, 0, element.width, element.height).data].filter((value, index) => index % 4 !== 3 && value < 240).length);
    assert.ok(await pixels() > 100);
    await dialog.getByRole('button', { name: 'Undo stroke', exact: true }).click();
    assert.equal(await pixels(), 0);
    await page.mouse.click(bounds.x + 50, bounds.y + 50);
    assert.ok(await pixels() > 0);
    await dialog.getByRole('button', { name: 'Clear sketch', exact: true }).click();
    assert.equal(await pixels(), 0);
    await page.mouse.click(bounds.x + 60, bounds.y + 60);
    await dialog.getByRole('button', { name: 'Attach sketch', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#pending-attachments .db-attachment__title').textContent(), 'Sketch.png');
    assert.ok(await page.locator('#pending-attachments img').evaluate(image => image.src.startsWith('blob:')));
  });
});

test('toolbar rename, pin, export, fork and mobile navigation operate on local state', async () => {
  await workspace(async page => {
    const menu = async name => {
      await page.getByRole('button', { name: 'Conversation menu', exact: true }).click();
      await page.getByRole('menuitem', { name, exact: true }).click();
    };
    await menu('Rename');
    const rename = page.getByRole('dialog', { name: 'Rename conversation', exact: true });
    await rename.getByRole('textbox', { name: 'Name', exact: true }).fill('Mobile release');
    await rename.getByRole('button', { name: 'Rename', exact: true }).click();
    assert.equal(await page.locator('#chat-title').textContent(), 'Mobile release');
    await menu('Pin conversation');
    assert.equal(await page.locator('#chat-pin-indicator').isVisible(), true);
    const download = page.waitForEvent('download');
    await menu('Export transcript');
    assert.equal((await download).suggestedFilename(), 'Mobile-release.md');
    await menu('Fork conversation');
    assert.equal(await page.locator('#chat-pin-indicator').isVisible(), false);
    assert.equal(await page.locator('#chat-title').textContent(), 'Mobile release copy');
    assert.equal(await page.locator('#pending-attachments .db-attachment__title').textContent(), 'Conversation context.txt');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole('button', { name: 'Show workspace navigation', exact: true }).click();
    assert.equal(await page.locator('#chat-sidebar').getAttribute('aria-modal'), 'true');
    await page.locator('[data-chat-view="files"]').click();
    assert.equal(await page.getByRole('button', { name: 'Show workspace navigation', exact: true }).getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('#chat-view-panel a').count(), 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  });
});

test('mocked dictation keeps final text, cancels to the original draft, and pagehide aborts capture', async () => {
  await workspace(async page => {
    await page.locator('#chat-prompt').fill('Review');
    await page.getByRole('button', { name: 'Start dictation', exact: true }).click();
    await page.evaluate(() => {
      const result = Object.assign([{ transcript: 'the release' }], { isFinal: true });
      speech.onresult({ results: [result] });
    });
    await page.locator('.db-chat-composer__dictation-stop').click();
    assert.equal(await page.locator('#chat-prompt').inputValue(), 'Review the release');
    await page.getByRole('button', { name: 'Start dictation', exact: true }).click();
    await page.evaluate(() => speech.onresult({ results: [Object.assign([{ transcript: 'wrong text' }], { isFinal: false })] }));
    await page.getByRole('button', { name: 'Cancel dictation', exact: true }).click();
    assert.equal(await page.locator('#chat-prompt').inputValue(), 'Review the release');
    await page.getByRole('button', { name: 'Start dictation', exact: true }).click();
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    assert.equal(await page.evaluate(() => speech.aborted), true);
    assert.equal(await page.locator('#chat-form').getAttribute('data-dictation'), 'stopped');
    assert.equal(await page.evaluate(() => speechStarts), 3);
  }, { width: 375, height: 812, speech: true });
});

test('settings and Add popups fit desktop, mobile, and short mobile viewports', async () => {
  for (const [width, height] of [[320, 320], [375, 812], [1440, 900]]) {
    await workspace(async page => {
      const assertFits = async locator => {
        const bounds = await locator.boundingBox();
        assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height, JSON.stringify({ width, height, bounds }));
      };
      await page.getByRole('button', { name: 'Chat settings', exact: true }).click();
      const settings = page.getByRole('dialog', { name: 'Chat settings', exact: true });
      await assertFits(settings);
      assert.equal(await settings.getByRole('combobox').count(), 3);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await assertFits(page.locator('.db-chat-composer__add-menu'));
    }, { width, height });
  }
});
