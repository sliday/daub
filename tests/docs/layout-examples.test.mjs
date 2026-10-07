import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('components.json', root), 'utf8'));
const css = await readFile(new URL('daub.css', root), 'utf8');
const script = await readFile(new URL('daub.js', root), 'utf8');
let browser;

before(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
});
after(async () => { await browser?.close(); });

async function withExample(name, width, run) {
  const page = await browser.newPage({ viewport: { width, height: 800 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.abort());
  try {
    const example = catalog.components.find(component => component.name === name);
    assert.ok(example, name + ' exists in the catalog');
    await page.setContent('<!doctype html><main style="padding:24px;text-align:left;">' + example.html + '</main>');
    await page.addStyleTag({ content: css + '\n*,*::before,*::after{transition:none!important;animation:none!important}' });
    await page.addScriptTag({ content: script });
    await page.evaluate(() => DAUB.init(document.querySelector('main')));
    await run(page);
    assert.deepEqual(errors, []);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'example fits the viewport');
  } finally {
    await page.close();
  }
}

for (const width of [320, 390, 1280]) {
  for (const name of ['Surface', 'Elevation']) {
    test('catalog ' + name + ' separates padded samples at ' + width + 'px', async () => {
      await withExample(name, width, async page => {
        for (const theme of ['light', 'dark']) {
          await page.evaluate(theme => DAUB.setTheme(theme), theme);
          const grid = page.locator('main > .db-grid');
          assert.equal(await grid.count(), 1);
          const samples = await grid.locator(':scope > .db-surface').evaluateAll(elements => elements.map(element => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            const range = document.createRange();
            range.selectNodeContents(element);
            const text = range.getBoundingClientRect();
            return { text: element.textContent, padding: ['Top', 'Right', 'Bottom', 'Left'].map(side => parseFloat(style['padding' + side])),
              rect: rect.toJSON(), textRect: text.toJSON(), shadow: style.boxShadow };
          }));
          assert.equal(samples.length, name === 'Surface' ? 4 : 3);
          for (const [index, sample] of samples.entries()) {
            assert.deepEqual(sample.padding, [16, 16, 16, 16]);
            assert.ok(sample.textRect.left >= sample.rect.left + 16);
            assert.ok(sample.textRect.top >= sample.rect.top + 16);
            assert.ok(sample.rect.bottom >= sample.textRect.bottom + 16);
            if (index > 0) {
              const previous = samples[index - 1].rect;
              assert.ok(sample.rect.left - previous.right >= 15 || sample.rect.top - previous.bottom >= 15, 'samples have room for their shadows');
            }
          }
          if (name === 'Elevation') assert.equal(new Set(samples.map(sample => sample.shadow)).size, 3);
        }
      });
    });
  }

  test('catalog Resizable shows handles and bounds keyboard and pointer resizing at ' + width + 'px', async () => {
    await withExample('Resizable', width, async page => {
      const panel = page.locator('.db-resizable');
      const right = panel.locator('.db-resizable__handle--right');
      const bottom = panel.locator('.db-resizable__handle--bottom');
      const bounds = await panel.evaluate(element => {
        const style = getComputedStyle(element);
        return { minHeight: parseFloat(style.minHeight), maxHeight: parseFloat(style.maxHeight), border: parseFloat(style.borderTopWidth) };
      });
      assert.ok(bounds.minHeight > 0 && Number.isFinite(bounds.maxHeight), 'example supplies height bounds');
      assert.ok(bounds.border > 0, 'panel has a visible boundary');
      assert.match(await panel.textContent(), /Project notes/);
      for (const handle of [right, bottom]) {
        assert.equal(await handle.getAttribute('role'), 'separator');
        assert.equal(await handle.getAttribute('tabindex'), '0');
        assert.notEqual(await handle.evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)', 'handle stays visible without hover');
      }
      const initial = await panel.boundingBox();
      await bottom.press('ArrowDown');
      assert.equal((await panel.boundingBox()).height, initial.height + 10);
      for (let step = 0; step < 12; step++) await bottom.press('Shift+ArrowDown');
      assert.equal((await panel.boundingBox()).height, bounds.maxHeight);
      for (let step = 0; step < 12; step++) await bottom.press('Shift+ArrowUp');
      assert.equal((await panel.boundingBox()).height, bounds.minHeight);
      for (let step = 0; step < 12; step++) await right.press('Shift+ArrowRight');
      const largest = await panel.boundingBox();
      assert.ok(largest.width <= Math.min(480, width - 48), 'panel stays inside its available width');
      for (let step = 0; step < 12; step++) await right.press('Shift+ArrowLeft');
      const smallest = await panel.boundingBox();
      assert.ok(smallest.width >= Math.min(240, width - 48), 'panel keeps a readable minimum width');
      const handleBox = await right.boundingBox();
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(handleBox.x + 26, handleBox.y + handleBox.height / 2, { steps: 4 });
      await page.mouse.up();
      assert.ok((await panel.boundingBox()).width > smallest.width, 'pointer drag resizes the panel');
      const content = panel.locator('.db-scroll-area');
      assert.equal(await content.count(), 1, 'notes remain in a scrollable content area');
      assert.ok(await content.evaluate(element => element.scrollHeight > element.clientHeight), 'notes overflow at minimum height');
    });
  });

  test('catalog Scroll Area contains real activity overflow and scrolls to the last row at ' + width + 'px', async () => {
    await withExample('Scroll Area', width, async page => {
      const area = page.getByRole('region', { name: 'Recent activity' });
      const layout = await area.evaluate(element => ({ height: element.clientHeight, scrollHeight: element.scrollHeight, overflowY: getComputedStyle(element).overflowY }));
      assert.equal(layout.overflowY, 'auto');
      assert.ok(layout.height > 0 && layout.scrollHeight > layout.height, 'activity extends below the visible area');
      assert.equal(await area.getAttribute('tabindex'), '0');
      await area.hover();
      await page.mouse.wheel(0, 1000);
      await page.waitForFunction(() => document.querySelector('.db-scroll-area').scrollTop > 0);
      await area.evaluate(element => { element.scrollTop = element.scrollHeight; });
      assert.ok(await area.locator('.db-list__item').last().evaluate(element => {
        const row = element.getBoundingClientRect();
        const viewport = element.closest('.db-scroll-area').getBoundingClientRect();
        return row.bottom <= viewport.bottom + 1 && row.top >= viewport.top;
      }), 'last activity row remains reachable');
    });
  });

  test('catalog Container centers a max-width box without centering its text at ' + width + 'px', async () => {
    await withExample('Container', width, async page => {
      const box = page.locator('.db-container');
      assert.equal(await box.count(), 1);
      const layout = await box.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const parent = element.parentElement.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { width: rect.width, maxWidth: parseFloat(style.maxWidth), left: rect.left - parent.left, right: parent.right - rect.right, textAlign: style.textAlign, border: parseFloat(style.borderTopWidth) };
      });
      assert.equal(layout.maxWidth, 640, 'sample retains the narrow utility max-width');
      assert.ok(layout.width <= layout.maxWidth);
      assert.ok(Math.abs(layout.left - layout.right) <= 1, 'box has equal side gutters');
      if (width === 1280) assert.ok(layout.left > 0 && layout.width === layout.maxWidth, 'desktop shows a constrained centered box');
      assert.equal(layout.textAlign, 'left');
      assert.ok(layout.border > 0, 'container boundary is visible');
      assert.ok(await box.locator('h3, p').count() >= 2, 'container includes meaningful content');
      await page.locator('main').evaluate(element => { element.style.textAlign = 'right'; });
      assert.equal(await box.evaluate(element => getComputedStyle(element).textAlign), 'right', 'container inherits text alignment');
    });
  });
}
