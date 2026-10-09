import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const output = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto('file://' + resolve(output, 'index.html'));
  await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode().catch(() => {}))));
  for (const section of await page.locator('section').all()) {
    const id = await section.getAttribute('id');
    await section.screenshot({ path: resolve(output, `${id}.png`) });
  }
} finally { await browser.close(); }
