import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';

const root = new URL('../../', import.meta.url);
const css = await readFile(new URL('daub.css', root), 'utf8');
const script = await readFile(new URL('daub.js', root), 'utf8');
const icons = await readFile(new URL('assets/lucide.min.js', root), 'utf8');
const catalog = JSON.parse(await readFile(new URL('components.json', root), 'utf8'));
const example = catalog.components.find(component => component.name === 'Sidebar').html;
let browser;

before(async () => {
  const engine = process.env.DAUB_TEST_BROWSER || 'chromium';
  browser = await ({ chromium, firefox, webkit })[engine].launch({ headless: true });
});
after(async () => { await browser?.close(); });

async function withSidebar(width, run) {
  const page = await browser.newPage({ viewport: { width, height: 700 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(2000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.abort());
  try {
    await page.setContent('<main style="padding:24px;max-width:320px">' + example + '</main>');
    await page.addStyleTag({ content: css + '\n*,*::before,*::after{transition:none!important;animation:none!important}' });
    await page.addScriptTag({ content: icons });
    await page.evaluate(() => lucide.createIcons());
    await page.addScriptTag({ content: script });
    await page.evaluate(() => DAUB.init());
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}

for (const width of [375, 1280]) {
  test('Sidebar toggle matches the visible collapsed state and reopens at ' + width + 'px', async () => {
    await withSidebar(width, async page => {
      const sidebar = page.locator('.db-sidebar');
      const toggle = sidebar.getByRole('button', { name: 'Toggle sidebar' });
      const mobile = width <= 640;
      assert.equal(await toggle.getAttribute('aria-expanded'), String(!mobile));
      assert.equal(await toggle.getAttribute('aria-controls'), await sidebar.getAttribute('id'));
      assert.equal((await sidebar.boundingBox()).width, mobile ? 64 : 260);
      await page.evaluate(() => { DAUB.init(); DAUB.init(); });
      if (mobile) await toggle.press('Enter');
      const header = await sidebar.locator('.db-sidebar__header').evaluate(element => {
        const title = element.querySelector('h3').getBoundingClientRect();
        const button = element.querySelector('button').getBoundingClientRect();
        return { title: title.toJSON(), button: button.toJSON(), centerDifference: Math.abs(title.top + title.height / 2 - button.top - button.height / 2) };
      });
      assert.ok(header.centerDifference <= 0.5, JSON.stringify(header));
      assert.ok(header.title.right <= header.button.left, 'title and toggle do not overlap');
      await toggle.press('Space');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      assert.equal((await sidebar.boundingBox()).width, 64);
      assert.equal(await sidebar.locator('h3').isVisible(), false);
      const rail = await sidebar.boundingBox();
      const button = await toggle.boundingBox();
      assert.ok(button.x >= rail.x && button.x + button.width <= rail.x + rail.width);
      await toggle.press('Enter');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      assert.equal((await sidebar.boundingBox()).width, 260);
      assert.equal(await sidebar.locator('h3').isVisible(), true);
      assert.ok(await sidebar.evaluate(element => element.scrollWidth <= element.clientWidth));
    });
  });
}

test('Sidebar auto-collapse updates accessible state on viewport changes', async () => {
  await withSidebar(1280, async page => {
    const toggle = page.getByRole('button', { name: 'Toggle sidebar' });
    await page.setViewportSize({ width: 375, height: 700 });
    await page.waitForFunction(() => document.querySelector('.db-sidebar__toggle').getAttribute('aria-expanded') === 'false');
    assert.equal((await page.locator('.db-sidebar').boundingBox()).width, 64);
    await page.setViewportSize({ width: 1280, height: 700 });
    await page.waitForFunction(() => document.querySelector('.db-sidebar__toggle').getAttribute('aria-expanded') === 'true');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  });
});

test('nested Sidebars retain separate toggle ownership and accessible targets', async () => {
  await withSidebar(1280, async page => {
    await page.evaluate(html => {
      document.querySelector('.db-sidebar__section').insertAdjacentHTML('beforeend', html);
      DAUB.init();
    }, example);
    const outer = page.locator('.db-sidebar').first();
    const inner = page.locator('.db-sidebar').last();
    const outerToggle = outer.locator(':scope > .db-sidebar__header > button');
    const innerToggle = inner.locator(':scope > .db-sidebar__header > button');
    assert.equal(await outerToggle.getAttribute('aria-controls'), await outer.getAttribute('id'));
    assert.equal(await innerToggle.getAttribute('aria-controls'), await inner.getAttribute('id'));
    await innerToggle.click();
    assert.equal(await innerToggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await outerToggle.getAttribute('aria-expanded'), 'true');
    await outerToggle.click();
    await outerToggle.click();
    assert.equal(await outerToggle.getAttribute('aria-expanded'), 'true');
    assert.equal(await innerToggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await innerToggle.getAttribute('aria-controls'), await inner.getAttribute('id'));
  });
});

test('collapsed Sidebar labels escape its scroll clipping and support keyboard dismissal', async () => {
  await withSidebar(1280, async page => {
    const sidebar = page.locator('.db-sidebar');
    await sidebar.getByRole('button', { name: 'Toggle sidebar' }).click();
    const item = sidebar.getByRole('link', { name: 'Dashboard', exact: true });
    await item.hover();
    const tooltip = page.getByRole('tooltip', { name: 'Dashboard', exact: true });
    await tooltip.waitFor();
    const position = await tooltip.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const rail = element.closest('.db-sidebar').getBoundingClientRect();
      return { rightOfRail: rect.left >= rail.right, popover: element.matches(':popover-open') };
    });
    assert.equal(position.rightOfRail, true);
    assert.equal(position.popover, true);
    await page.mouse.move(0, 0);
    await item.focus();
    await tooltip.waitFor();
    assert.ok((await item.getAttribute('aria-describedby')).includes(await tooltip.getAttribute('id')));
    await item.press('Escape');
    await tooltip.waitFor({ state: 'hidden' });
    await sidebar.getByRole('button', { name: 'Toggle sidebar' }).click();
    await item.hover();
    assert.equal(await tooltip.isVisible(), false);
  });
});
