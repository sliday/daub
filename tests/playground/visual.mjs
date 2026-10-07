import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.PLAYGROUND_URL || 'http://127.0.0.1:8890';
const output = process.env.PLAYGROUND_SCREENSHOT_DIR || '/private/tmp/daub-playground-review';
const spec = {
  root: 'settings', theme: 'bone',
  elements: {
    settings: { type: 'Stack', props: { gap: 3 }, children: ['title', 'description', 'profile', 'actions'] },
    title: { type: 'Text', props: { tag: 'h2', content: 'Account settings' } },
    description: { type: 'Text', props: { content: 'Profile and workspace preferences.' } },
    profile: { type: 'Card', props: { title: 'Public profile', description: 'Your details appear on your workspace profile.' }, children: ['name', 'email', 'timezone'] },
    name: { type: 'Field', props: { label: 'Display name', placeholder: 'Sarah Chen' } },
    email: { type: 'Field', props: { label: 'Email address', type: 'email', placeholder: 'sarah@example.com' } },
    timezone: { type: 'Field', props: { label: 'Timezone', placeholder: 'Europe/Warsaw' } },
    actions: { type: 'Stack', props: { direction: 'horizontal', justify: 'end' }, children: ['cancel', 'save'] },
    cancel: { type: 'Button', props: { label: 'Cancel', variant: 'secondary' } },
    save: { type: 'Button', props: { label: 'Save changes', variant: 'primary', icon: 'check' } },
  },
};

await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true, timeout: 15000,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  channel: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? undefined : 'chrome',
});
try {
  for (const width of [1440, 768, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width > 1024 ? 900 : 844 } });
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      const assets = ['unpkg.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
      if (url.pathname.startsWith('/api/') || !(url.origin === base || assets.includes(url.hostname))) return route.abort();
      return route.continue();
    });
    await context.addInitScript((value) => { if (window === window.top) sessionStorage.setItem('pg-current-spec', JSON.stringify(value)); }, spec);
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await page.goto(base + '/playground.html?react-chat', { waitUntil: 'networkidle' });
    if (width <= 1024) await page.locator('[data-panel="preview"]').click();
    await page.frameLocator('#pg-preview-frame').getByText('Account settings', { exact: true }).waitFor();
    const screenshot = await page.evaluate(() => new Promise((resolve, reject) => {
      const frame = document.querySelector('#pg-preview-frame').contentWindow;
      const timer = setTimeout(() => { window.removeEventListener('message', receive); reject(new Error('Preview screenshot timed out')); }, 10000);
      function receive(event) {
        if (event.source !== frame || event.data?.type !== 'screenshot') return;
        clearTimeout(timer);
        window.removeEventListener('message', receive);
        resolve(event.data.data);
      }
      window.addEventListener('message', receive);
      window.__playgroundBridge.postToPreview({ type: 'screenshot' });
    }));
    assert.ok(screenshot?.startsWith('data:image/jpeg;base64,'), 'opaque preview screenshot');
    const pixels = await page.evaluate(async (data) => {
      const image = new Image();
      image.src = data;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Set();
      for (let i = 0; i < rgba.length; i += 64) colors.add(`${rgba[i]},${rgba[i + 1]},${rgba[i + 2]}`);
      return { width: canvas.width, height: canvas.height, colors: colors.size };
    }, screenshot);
    assert.ok(pixels.width > 0 && pixels.height > 0 && pixels.colors > 8, JSON.stringify(pixels));
    await writeFile(`${output}/capture-${width}.jpg`, Buffer.from(screenshot.split(',')[1], 'base64'));
    await page.locator('[data-viewport="mobile"]').click();
    const bounds = await page.locator('#pg-preview-frame').boundingBox();
    assert.ok(bounds.width <= Math.min(width, 375), JSON.stringify(bounds));
    assert.ok(bounds.x + bounds.width <= width, JSON.stringify(bounds));
    await page.screenshot({ path: `${output}/design-${width}.png`, fullPage: true });
    await page.locator('[data-tab="structure"]').click();
    assert.equal(await page.locator('#pg-json').isVisible(), true);
    const editor = await page.locator('#pg-json').boundingBox();
    const panel = await page.locator('#pg-preview-body').boundingBox();
    assert.ok(editor.width >= panel.width - 2, JSON.stringify({ editor, panel }));
    await page.screenshot({ path: `${output}/structure-${width}.png`, fullPage: true });
    console.log(JSON.stringify({ width, capture: pixels, preview: bounds, editor: await page.locator('#pg-json').boundingBox(), documentWidth: await page.evaluate(() => document.documentElement.scrollWidth) }));
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(`Screenshots: ${output}`);
