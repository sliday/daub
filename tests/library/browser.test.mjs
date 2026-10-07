import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';

const root = new URL('../../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('components.json', root), 'utf8'));
const assets = new Map();
for (const name of ['docs.html', 'components.html', 'site-nav.js', 'site-nav.css', 'component-browser.js', 'component-browser.css', 'component-preview.html', 'component-preview.js', 'components.json', 'daub.js', 'daub.css', 'assets/lucide.min.js']) {
  assets.set('/' + name, await readFile(new URL(name, root), 'utf8'));
}
let browser, page;
const errors = [];
before(async () => {
  const engine = process.env.DAUB_TEST_BROWSER || 'chromium';
  browser = await ({ chromium, firefox, webkit })[engine].launch({ headless: true, executablePath: process.env.PLAYWRIGHT_BROWSER_EXECUTABLE_PATH || (engine === 'chromium' ? process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH : undefined) });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(3000);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'daub.test') return route.abort();
    const body = assets.get(url.pathname);
    if (!body) return route.fulfill({ status: 404, body: '' });
    const contentType = url.pathname.endsWith('.js') ? 'application/javascript' : url.pathname.endsWith('.css') ? 'text/css' : url.pathname.endsWith('.json') ? 'application/json' : 'text/html';
    return route.fulfill({ body, contentType });
  });
});
after(async () => { await browser?.close(); });

async function navigate(component) {
  await page.goto('http://daub.test/components.html#' + component.class.slice(3));
  await page.getByRole('heading', { level: 1, name: component.name, exact: true }).waitFor();
  await page.frameLocator('#component-preview').locator('#preview-root [class*="' + component.class + '"]').first().waitFor({ state: 'attached' });
}

for (const component of catalog.components) {
  test(`component browser: ${component.name} renders its catalog example`, async () => {
    await navigate(component);
    assert.equal(await page.locator('#component-nav a').count(), catalog.components.length);
    assert.equal(await page.locator('#component-nav [aria-current="page"]').textContent(), component.name);
    assert.equal(await page.locator('#component-source').textContent(), component.html);
    assert.equal(await page.frameLocator('#component-preview').locator('html').getAttribute('data-theme'), 'light');
    assert.deepEqual(errors, []);
  });
}

test('legacy documentation links reach the shared guide and matching component pages', async () => {
  await page.goto('http://daub.test/docs.html?source=old');
  await page.getByRole('heading', { name: 'Getting started', exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/components.html');
  assert.equal(new URL(page.url()).search, '?source=old');
  assert.equal(await page.locator('#component-detail').isVisible(), false);
  await page.locator('.guide-toc').getByRole('link', { name: 'React', exact: true }).click();
  assert.equal(await page.locator('#getting-started').isVisible(), true);
  assert.equal(new URL(page.url()).hash, '#react');
  for (const name of ['Button', 'Text Field', 'Bottom Navigation', 'Modal Overlay', 'Chat Composer']) {
    const legacy = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const component = catalog.components.find(item => item.name === name);
    await page.goto('http://daub.test/docs.html#' + legacy);
    await page.getByRole('heading', { level: 1, name, exact: true }).waitFor();
    assert.equal(new URL(page.url()).hash, '#' + component.class.slice(3));
    assert.equal(await page.locator('#getting-started').isVisible(), false);
  }
  await page.goto('http://daub.test/docs.html#cat-conversation');
  await page.getByRole('heading', { level: 1, name: catalog.components.find(item => item.category === 'conversation').name, exact: true }).waitFor();
  assert.deepEqual(errors, []);
});

test('guide navigation and inline code remain readable on narrow screens and in both schemes', async () => {
  for (const width of [320, 1280]) for (const colorScheme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme });
    await page.goto('http://daub.test/components.html#getting-started');
    await page.getByRole('heading', { name: 'Getting started', exact: true }).waitFor();
    assert.equal(await page.locator('main:visible').count(), 1);
    const code = await page.locator('#installation p code').first().evaluate(element => {
      const style = getComputedStyle(element), prose = getComputedStyle(element.parentElement);
      return { size: parseFloat(style.fontSize), proseSize: parseFloat(prose.fontSize), line: style.lineHeight, proseLine: prose.lineHeight, padding: parseFloat(style.paddingLeft), background: style.backgroundColor };
    });
    assert.ok(code.size < code.proseSize && code.padding > 0);
    assert.ok(parseFloat(code.line) <= parseFloat(code.proseLine), 'inline code does not increase prose line height');
    assert.notEqual(code.background, 'rgba(0, 0, 0, 0)');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await navigate(catalog.components.find(item => item.class === 'db-chat-composer'));
    const tokens = await page.locator('#component-description code').allTextContents();
    assert.ok(tokens.includes('daub.js'));
    assert.ok(tokens.includes('DAUB.createChatComposer(root, options)'));
    assert.ok(tokens.includes('db:chat-send'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'light' });
});

test('reference previews keep carousel, chart, toast, and overlay interactions working', async () => {
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await navigate(catalog.components.find(item => item.class === 'db-carousel'));
    const frame = page.frameLocator('#component-preview');
    await frame.getByRole('button', { name: 'Next slide', exact: true }).click();
    assert.equal(await frame.getByRole('heading', { name: 'Project Birch', exact: true }).isVisible(), true);
    await navigate(catalog.components.find(item => item.class === 'db-chart-card'));
    assert.equal(await frame.locator('.db-chart__bar').count(), 3);
    assert.equal(await frame.locator('canvas').count(), 0);
    await navigate(catalog.components.find(item => item.class === 'db-alert-dialog'));
    await frame.getByRole('button', { name: 'Delete draft', exact: true }).first().click();
    const dialog = frame.getByRole('alertdialog', { name: 'Delete this draft?', exact: true });
    await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).press('Escape');
    assert.equal(await dialog.isVisible(), false);
    await navigate(catalog.components.find(item => item.class === 'db-toast'));
    await frame.getByRole('button', { name: 'Show toast', exact: true }).click();
    assert.ok(await frame.locator('.db-toast-stack .db-toast').count() > 0);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  assert.deepEqual(errors, []);
});

test('search, browser history, variant markup, and keyboard tabs stay synchronized', async () => {
  await navigate(catalog.components[0]);
  await page.getByLabel('Search components', { exact: true }).fill('checkbox');
  assert.equal(await page.locator('#component-nav a').count(), 2);
  await page.getByLabel('Search components', { exact: true }).fill('nonsense-no-result');
  assert.equal(await page.locator('#search-empty').isVisible(), true);
  await page.getByLabel('Search components', { exact: true }).fill('switch');
  await page.locator('#component-nav a').filter({ hasText: /^Switch$/ }).click();
  await page.getByRole('heading', { name: 'Switch', exact: true }).waitFor();
  await page.goBack({ waitUntil: 'commit' });
  await page.getByRole('heading', { name: 'Button', exact: true }).waitFor();
  assert.equal(new URL(page.url()).hash, '#btn');
  await page.getByLabel('Component variant', { exact: true }).selectOption('--sm');
  assert.match(await page.locator('#component-source').textContent(), /db-btn--sm/);
  assert.match(await page.locator('#component-source').textContent(), /db-btn--primary/);
  await page.getByLabel('Component variant', { exact: true }).selectOption('--loading');
  assert.equal(await page.frameLocator('#component-preview').getByRole('button', { name: 'Save changes', exact: true }).isDisabled(), true);
  assert.match(await page.locator('#component-source').textContent(), /aria-busy="true"/);
  await page.getByRole('tab', { name: 'Preview', exact: true }).press('ArrowRight');
  assert.equal(await page.getByRole('tab', { name: 'HTML', exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('#panel-html').isVisible(), true);
  await page.getByRole('tab', { name: 'HTML', exact: true }).press('End');
  assert.equal(await page.getByRole('tab', { name: 'Anatomy', exact: true }).getAttribute('aria-selected'), 'true');
});

test('sandboxed preview supports all theme variants and working overlays', async () => {
  await navigate(catalog.components.find(component => component.name === 'Modal'));
  const frame = page.frameLocator('#component-preview');
  const themes = await page.locator('#preview-theme option').evaluateAll(options => options.map(option => option.value));
  assert.equal(themes.length, 42);
  for (const theme of themes) {
    await page.getByLabel('Preview theme', { exact: true }).selectOption(theme);
    await page.waitForFunction(theme => document.querySelector('#preview-theme').value === theme, theme);
    await frame.locator(`html[data-theme="${theme}"]`).waitFor();
  }
  await frame.getByRole('button', { name: 'Open project details' }).click();
  await frame.getByRole('dialog', { name: 'Project details' }).waitFor();
  await frame.getByRole('button', { name: 'Close dialog' }).press('Escape');
  assert.equal(await frame.getByRole('dialog', { name: 'Project details' }).isVisible(), false);
  assert.deepEqual(errors, []);
});

test('Theme Switcher opens inside the component preview and applies theme choices', async () => {
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await navigate(catalog.components.find(component => component.name === 'Theme Switcher'));
    const frame = page.frameLocator('#component-preview');
    await page.getByLabel('Preview theme', { exact: true }).selectOption('light');
    await frame.locator('html[data-theme="light"]').waitFor();
    const toggle = frame.getByRole('button', { name: 'Open theme picker', exact: true });
    await toggle.click();
    const picker = frame.locator('.db-theme-switcher__popover');
    assert.equal(await picker.isVisible(), true);
    assert.equal(await picker.locator('[data-family]').count(), 21);
    const bounds = await picker.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { rect: rect.toJSON(), width: innerWidth, overflow: element.scrollWidth > element.clientWidth };
    });
    assert.ok(bounds.rect.left >= 0 && bounds.rect.right <= bounds.width, JSON.stringify(bounds));
    assert.ok(bounds.rect.top >= 0, JSON.stringify(bounds));
    assert.equal(bounds.overflow, false);
    await picker.getByRole('button', { name: 'dark mode', exact: true }).click();
    assert.equal(await frame.locator('html').getAttribute('data-theme'), 'dark');
    await picker.getByRole('button', { name: 'dark mode', exact: true }).press('Escape');
    assert.equal(await picker.isVisible(), false);
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  }
});

test('demo links keep the preview usable and reset discards prior form state', async () => {
  await navigate(catalog.components.find(component => component.name === 'Nav Menu'));
  const frame = page.frameLocator('#component-preview');
  await frame.getByRole('link', { name: 'Documentation', exact: true }).click();
  assert.equal(await frame.getByRole('link', { name: 'Documentation', exact: true }).getAttribute('aria-current'), 'page');
  await page.getByRole('button', { name: 'Reset preview', exact: true }).click();
  await frame.getByRole('link', { name: 'Home', exact: true }).waitFor();
  await navigate(catalog.components.find(component => component.name === 'Text Field'));
  await frame.getByRole('textbox', { name: 'Email', exact: true }).fill('owner@example.com');
  await page.getByRole('button', { name: 'Reset preview', exact: true }).click();
  await page.waitForFunction(() => document.getElementById('component-preview').getAttribute('aria-busy') === 'false');
  assert.equal(await frame.getByRole('textbox', { name: 'Email', exact: true }).inputValue(), '');
});

test('mobile navigation traps focus, closes on Escape, and leaves no page overflow', async () => {
  await page.setViewportSize({ width: 375, height: 812 });
  await navigate(catalog.components[0]);
  const toggle = page.getByRole('button', { name: 'Open component navigation' });
  await toggle.click();
  assert.equal(await page.locator('#library-main').evaluate(element => element.inert), true);
  assert.equal(await page.locator('[data-site-nav]').evaluate(element => element.inert), true);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'component-search');
  await page.getByLabel('Search components', { exact: true }).fill('modal');
  await page.getByLabel('Search components', { exact: true }).press('Enter');
  await page.getByRole('heading', { name: 'Modal', exact: true }).waitFor();
  assert.equal(await page.locator('#library-main').evaluate(element => element.inert), false);
  assert.equal(await page.locator('[data-site-nav]').evaluate(element => element.inert), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'component-title');
  await toggle.click();
  await page.locator('#close-sidebar').focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'component-search');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'open-sidebar');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});

test('short-screen docs navigation reaches the final component and restores content position', async () => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('http://daub.test/components.html#react');
  await page.getByRole('heading', { name: 'Getting started', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Open component navigation' }).click();
  const last = page.locator('#component-nav a').last();
  const label = await last.textContent();
  await last.click();
  await page.getByRole('heading', { name: label, exact: true }).waitFor();
  assert.equal(await page.locator('#library-sidebar').isVisible(), false);
  assert.equal(await page.locator('[data-site-nav]').evaluate(element => element.inert), false);
  assert.equal(await page.evaluate(() => scrollY), 0);
  assert.equal(await page.locator('[data-site-nav] [aria-current]').textContent(), 'Components');
});

test('responsive component browser screenshots show nonblank examples', async () => {
  await mkdir(new URL('test-results/library/', root), { recursive: true });
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await navigate(catalog.components.find(component => component.name === 'Card'));
    const frame = page.frameLocator('#component-preview');
    assert.match(await frame.locator('#preview-root').textContent(), /\S/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: new URL(`test-results/library/components-${width}.png`, root).pathname, fullPage: true });
    assert.ok(await page.locator('svg.lucide').count() > 5, 'navigation and copy icons render');
  }
  assert.deepEqual(errors, []);
});
