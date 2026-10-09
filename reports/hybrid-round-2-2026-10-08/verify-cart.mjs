import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const home = dirname(fileURLToPath(import.meta.url)), root = resolve(home, '../..');
const html = await readFile(resolve(home, 'live/09-hybrid/generated.html'), 'utf8');
const output = resolve(home, 'cart-supplement');
await mkdir(output);
const results = [], browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const width of [390, 1200]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.href === 'http://daub.test/') return route.fulfill({ body: '<html></html>', contentType: 'text/html' });
      if (route.request().method() === 'GET' && ['daub.test', 'daub.dev'].includes(url.hostname) && /^\/daub(?:-render)?\.(js|css)$/.test(url.pathname)) {
        return route.fulfill({ body: await readFile(resolve(root, '.' + url.pathname)), contentType: url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
      }
      return route.abort();
    });
    try {
      const page = await context.newPage();
      await page.goto('http://daub.test/');
      await page.setContent(html, { waitUntil: 'load' });
      const read = () => page.evaluate(() => ({ text: document.body.innerText, output: window.DaubPrototype.getOutput() }));
      const initial = await read();
      assert.deepEqual(initial.output, { appleQuantity: 2, bananaQuantity: 1, total: 35.5 });
      await page.getByRole('button', { name: 'Increase Apple quantity', exact: true }).click();
      await page.getByRole('button', { name: 'Increase Banana quantity', exact: true }).click();
      const changed = await read();
      assert.deepEqual(changed.output, { appleQuantity: 3, bananaQuantity: 2, total: 61 });
      assert.match(changed.text, /\$61\.00/);
      await page.getByRole('button', { name: 'Decrease Apple quantity', exact: true }).click();
      await page.getByRole('button', { name: 'Decrease Banana quantity', exact: true }).click();
      const restored = await read();
      assert.deepEqual(restored.output, initial.output);
      assert.match(restored.text, /\$35\.50/);
      await page.getByRole('button', { name: 'Checkout', exact: true }).click();
      const afterCheckout = await read();
      const checkoutChangesState = JSON.stringify(restored) !== JSON.stringify(afterCheckout);
      await page.screenshot({ path: resolve(output, width + '.png') });
      results.push({ width, quantitiesAndTypedTotals: 'pass', checkoutChangesState, initial, changed, restored, afterCheckout });
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await writeFile(resolve(output, 'results.json'), JSON.stringify({ htmlSha256: createHash('sha256').update(html).digest('hex'), limitation: 'Supplement for this artifact only. Does not change frozen benchmark evaluator or score.', results }, null, 2));
}
console.log(JSON.stringify(results.map(({ width, quantitiesAndTypedTotals, checkoutChangesState }) => ({ width, quantitiesAndTypedTotals, checkoutChangesState }))));
