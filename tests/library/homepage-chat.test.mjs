import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';

const assets = new Map();
for (const name of ['index.html', 'daub.css', 'daub.js', 'site-nav.js', 'assets/lucide.min.js']) {
  assets.set('/' + name, await readFile(new URL('../../' + name, import.meta.url)));
}
let browser;
before(async () => {
  const engine = process.env.DAUB_TEST_BROWSER || 'chromium';
  browser = await ({ chromium, firefox, webkit })[engine].launch({
    headless: true,
    ...(engine === 'chromium' && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {})
  });
});
after(async () => { await browser?.close(); });

async function fixture(width = 1440, theme = 'light') {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(4000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'unpkg.com' && url.pathname.includes('lucide')) {
      return route.fulfill({ contentType: 'application/javascript', body: assets.get('/assets/lucide.min.js') });
    }
    if (url.hostname === 'daub.test' && ['/playground.html', '/chat-demo.html'].includes(url.pathname)) {
      return route.fulfill({ contentType: 'text/html', body: '<title>Destination</title>' });
    }
    const body = url.hostname === 'daub.test' && assets.get(url.pathname);
    if (!body) return route.abort();
    return route.fulfill({ body, contentType: url.pathname.endsWith('.js') ? 'application/javascript' : url.pathname.endsWith('.css') ? 'text/css' : 'text/html' });
  });
  await page.goto('http://daub.test/index.html#mcp');
  await page.evaluate(theme => DAUB.setTheme(theme), theme);
  return { page, errors };
}

test('homepage conversation uses shared chat components and preserves the MCP example', async () => {
  const { page, errors } = await fixture();
  try {
    const example = page.locator('.db-mcp-example');
    assert.equal(await example.locator('.db-message-scroller').count(), 1);
    assert.equal(await example.locator('.db-message-scroller__item').count(), 4);
    assert.equal(await example.locator('.db-message--end').count(), 2);
    assert.equal(await example.locator('.db-bubble--ghost').count(), 2);
    assert.equal(await example.locator('.db-message__avatar').count(), 2);
    assert.equal(await example.locator('.db-mcp-example__step').count(), 0);
    assert.match(await example.textContent(), /Build me a settings page/);
    assert.match(await example.textContent(), /Now 16 elements/);
    assert.equal(await example.getByRole('link', { name: 'Open in Playground', exact: true }).getAttribute('href'), 'playground.html');
    assert.equal(await example.getByRole('link', { name: 'Try chat', exact: true }).getAttribute('href'), 'chat-demo.html');
    assert.equal(await example.getByRole('textbox', { name: 'Message', exact: true }).count(), 1);
    assert.equal(await example.getByRole('button', { name: 'Send message', exact: true }).isDisabled(), true);
    assert.equal(await example.getByRole('combobox').count(), 0, 'homepage does not expose unwired model or configuration controls');
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('homepage composer opens the submitted prompt in Playground without calling a provider', async () => {
  const { page, errors } = await fixture(375);
  try {
    const prompt = 'Build a settings page with <strong>profile</strong> & notifications';
    await page.locator('.db-mcp-example').getByRole('textbox', { name: 'Message', exact: true }).fill(prompt);
    await page.locator('.db-mcp-example').getByRole('textbox', { name: 'Message', exact: true }).press('Enter');
    await page.waitForURL('**/playground.html?*');
    assert.equal(new URL(page.url()).searchParams.get('prompt'), prompt);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test('homepage Add menu opens the full chat and does not offer unsupported attachments', async () => {
  const { page } = await fixture(375);
  try {
    await page.locator('.db-mcp-example').getByRole('button', { name: 'Add', exact: true }).press('ArrowDown');
    assert.equal(await page.getByRole('menuitem', { name: 'Add files', exact: true }).count(), 0);
    await page.getByRole('menuitem', { name: 'Open full chat', exact: true }).press('Enter');
    await page.waitForURL('**/chat-demo.html');
  } finally { await page.close(); }
});

test('homepage chat fits mobile and desktop in light and dark themes', async () => {
  for (const width of [320, 375, 1440]) {
    for (const theme of ['light', 'dark']) {
      const { page, errors } = await fixture(width, theme);
      try {
        const example = page.locator('.db-mcp-example');
        await example.scrollIntoViewIfNeeded();
        assert.equal(await example.locator('.db-message-scroller__viewport').count(), 1);
        const layout = await example.evaluate(root => {
          const bounds = root.getBoundingClientRect();
          const parts = [...root.querySelectorAll('.db-message, .db-bubble, .db-chat-composer, textarea, .db-chat-composer__send')];
          return { width: bounds.width, contained: parts.every(part => {
            const rect = part.getBoundingClientRect();
            return rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1;
          }) };
        });
        assert.ok(layout.width <= width, theme + '/' + width + ' bounds');
        assert.equal(layout.contained, true, theme + '/' + width + ' chat contents fit');
        assert.ok(await example.locator('.db-message-scroller__viewport').evaluate(el => el.scrollWidth <= el.clientWidth), 'conversation has no horizontal overflow');
        assert.equal(await example.getByRole('button', { name: 'Send message', exact: true }).isVisible(), true);
        if (width === 1440 && theme === 'dark') await example.screenshot({ path: '/private/tmp/daub-homepage-chat-desktop.png' });
        if (width === 375 && theme === 'light') await example.screenshot({ path: '/private/tmp/daub-homepage-chat-mobile.png' });
        const latest = example.getByRole('button', { name: 'Scroll to latest message', exact: true });
        if (await latest.isVisible()) {
          await latest.click();
          await page.waitForFunction(() => {
            const viewport = document.querySelector('.db-mcp-example .db-message-scroller__viewport');
            return viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop < 2;
          });
        }
        const lastReplyVisible = await example.evaluate(root => {
          const viewport = root.querySelector('.db-message-scroller__viewport').getBoundingClientRect();
          const last = root.querySelector('[data-db-message-id="mcp-danger-reply"]').getBoundingClientRect();
          return last.top >= viewport.top && last.bottom <= viewport.bottom + 1;
        });
        assert.equal(lastReplyVisible, true, theme + '/' + width + ' latest reply stays readable');
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    }
  }
});
