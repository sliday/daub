import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';

const root = new URL('../../', import.meta.url);
const css = await readFile(new URL('daub.css', root), 'utf8');
const catalog = JSON.parse(await readFile(new URL('components.json', root), 'utf8'));
const example = catalog.components.find(component => component.name === 'Number Field').html;
let browser;

before(async () => {
  const engine = process.env.DAUB_TEST_BROWSER || 'chromium';
  browser = await ({ chromium, firefox, webkit })[engine].launch({ headless: true });
});
after(async () => { await browser?.close(); });

async function glyphCenter(page, input, value) {
  await input.fill(value);
  await page.getByRole('heading', { name: 'Quantity' }).click();
  const filled = (await input.screenshot()).toString('base64');
  await input.fill('');
  await page.getByRole('heading', { name: 'Quantity' }).click();
  const empty = (await input.screenshot()).toString('base64');
  return page.evaluate(async ({ filled, empty }) => {
    const images = await Promise.all([filled, empty].map(async base64 => {
      const image = new Image();
      image.src = 'data:image/png;base64,' + base64;
      await image.decode();
      return image;
    }));
    const canvas = document.createElement('canvas');
    canvas.width = images[0].width;
    canvas.height = images[0].height;
    const context = canvas.getContext('2d');
    const pixels = images.map(image => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    });
    let left = canvas.width, right = -1;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const index = (y * canvas.width + x) * 4;
        const difference = [0, 1, 2].reduce((sum, channel) => sum + Math.abs(pixels[0][index + channel] - pixels[1][index + channel]), 0);
        if (difference > 60) { left = Math.min(left, x); right = Math.max(right, x); }
      }
    }
    return { left, right, center: (left + right + 1) / 2, width: canvas.width };
  }, { filled, empty });
}

for (const theme of ['light', 'dark']) {
  test('Number Field centers rendered digits without a native spinner in ' + theme, async () => {
    const page = await browser.newPage({ viewport: { width: 375, height: 600 }, reducedMotion: 'reduce' });
    try {
      await page.route('**/*', route => route.abort());
      await page.setContent('<html data-theme="' + theme + '"><body style="padding:24px"><h1>Quantity</h1>' + example + '<input class="db-input" type="number" aria-label="Standalone quantity"></body></html>');
      await page.addStyleTag({ content: css + '\n*,*::before,*::after{transition:none!important;animation:none!important}' });
      const input = page.getByRole('spinbutton', { name: 'Quantity', exact: true });
      for (const value of ['3', '128']) {
        const bounds = await glyphCenter(page, input, value);
        assert.ok(bounds.right >= bounds.left, 'number renders visible pixels');
        assert.ok(Math.abs(bounds.center - bounds.width / 2) <= 2, JSON.stringify({ value, ...bounds }));
      }
      assert.equal(await input.evaluate(element => getComputedStyle(element).appearance), 'textfield');
      assert.notEqual(await page.getByRole('spinbutton', { name: 'Standalone quantity' }).evaluate(element => getComputedStyle(element).appearance), 'textfield');
      await input.fill('3');
      await page.getByRole('button', { name: 'Increase quantity' }).click();
      assert.equal(await input.inputValue(), '4');
      await page.getByRole('button', { name: 'Decrease quantity' }).click();
      assert.equal(await input.inputValue(), '3');
      await input.press('ArrowUp');
      assert.equal(await input.inputValue(), '4');
      await input.press('ArrowDown');
      assert.equal(await input.inputValue(), '3');
    } finally { await page.close(); }
  });
}
