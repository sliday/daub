import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../../', import.meta.url);
const css = await readFile(new URL('daub.css', root), 'utf8');
const icons = await readFile(new URL('assets/lucide.min.js', root), 'utf8');
const catalog = JSON.parse(await readFile(new URL('components.json', root), 'utf8'));
const example = catalog.components.find(component => component.name === 'Alert').html;
let browser;

before(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
});
after(async () => { await browser?.close(); });

test('Alert omits empty and comment-only icon gutters while keeping its padding', async () => {
  const page = await browser.newPage();
  try {
    for (const theme of ['light', 'dark']) {
      for (const variant of ['warning', 'error', 'success', 'info']) {
        for (const icon of ['', '<span class="db-alert__icon"></span>', '<span class="db-alert__icon"><!-- icon --></span>']) {
          await page.setContent('<html data-theme="' + theme + '"><body><div class="db-alert db-alert--' + variant + '">' + icon + '<div class="db-alert__content"><div class="db-alert__title">Warning</div><p>Something needs attention.</p></div></div></body></html>');
          await page.addStyleTag({ content: css });
          const geometry = await page.locator('.db-alert').evaluate(element => {
            const style = getComputedStyle(element);
            const alert = element.getBoundingClientRect();
            const content = element.querySelector('.db-alert__content').getBoundingClientRect();
            return { inset: content.left - alert.left, expected: parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth) };
          });
          assert.equal(geometry.inset, geometry.expected, theme + '/' + variant + '/' + icon);
        }
      }
    }
  } finally { await page.close(); }
});

test('Alert catalog example renders a warning icon with one content gap', async () => {
  const page = await browser.newPage({ viewport: { width: 320, height: 500 } });
  try {
    await page.route('**/*', route => route.abort());
    await page.setContent('<body style="padding:16px">' + example + '</body>');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: icons });
    await page.evaluate(() => lucide.createIcons());
    assert.equal(await page.locator('.db-alert__icon svg.lucide-triangle-alert').count(), 1);
    const geometry = await page.locator('.db-alert').evaluate(element => {
      const icon = element.querySelector('.db-alert__icon').getBoundingClientRect();
      const glyph = element.querySelector('.db-alert__icon svg').getBoundingClientRect();
      const content = element.querySelector('.db-alert__content').getBoundingClientRect();
      return { iconWidth: icon.width, glyphWidth: glyph.width, glyphHeight: glyph.height, gap: content.left - icon.right, expectedGap: parseFloat(getComputedStyle(element).columnGap), overflow: element.scrollWidth > element.clientWidth };
    });
    assert.equal(geometry.iconWidth, 20);
    assert.equal(geometry.glyphWidth, 20);
    assert.equal(geometry.glyphHeight, 20);
    assert.equal(geometry.gap, geometry.expectedGap);
    assert.equal(geometry.overflow, false);
  } finally { await page.close(); }
});
