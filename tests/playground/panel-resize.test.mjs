import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';

const source = await readFile(new URL('../../playground.html', import.meta.url), 'utf8');
const css = source.match(/<style>([\s\S]*?)<\/style>/)[1];
const divider = source.match(/<div class="pg-divider"[\s\S]*?<\/div>/)[0];
const collapse = source.slice(source.indexOf('function updateGridForCollapse()'), source.indexOf('//  DIFF'));
const resize = source.slice(source.indexOf('(function initResizers()'), source.indexOf('// ---- Mobile tab switching'));
const html = `<style>${css}body{margin:0}.pg-grid{height:600px}</style><div class="pg-grid"><div class="pg-panel pg-panel--active" id="panel-prompt"><div class="pg-panel__body"><input value="Keep this draft"></div></div>${divider}<div class="pg-panel" id="panel-preview"><iframe style="width:100%;height:100%;border:0" srcdoc="Preview"></iframe></div></div><script>${collapse}\n${resize}</script>`;
let browser;
before(async () => { browser = await ({ chromium, firefox, webkit })[process.env.DAUB_TEST_BROWSER || 'chromium'].launch({ headless: true }); });
after(async () => { await browser?.close(); });

async function open(t, options = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, ...options });
  t.after(() => page.close());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.route('http://daub.test/**', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('http://daub.test/playground.html');
  return page;
}

async function width(page) { return page.locator('#panel-prompt').evaluate(el => el.getBoundingClientRect().width); }
async function drag(page, targetWidth, release = true) {
  const bar = await page.locator('.pg-divider').boundingBox();
  const initial = await width(page);
  await page.mouse.move(bar.x + bar.width / 2, bar.y + 50);
  await page.mouse.down();
  await page.mouse.move(bar.x + bar.width / 2 + targetWidth - initial, bar.y + 50, { steps: 12 });
  if (release) await page.mouse.up();
}

test('the top, center, and bottom of the full divider collapse and restore the chat', async t => {
  const page = await open(t);
  const initial = await width(page);
  for (const y of [20, 300, 580]) {
    await page.locator('.pg-divider').click({ position: { x: 3, y } });
    assert.equal(await width(page), 40);
    assert.equal(await page.locator('.pg-divider').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('#panel-prompt').evaluate(el => el.inert), true);
    await page.getByRole('button', { name: 'Expand chat panel' }).click({ position: { x: 3, y } });
    assert.ok(Math.abs(await width(page) - initial) < 1);
    assert.equal(await page.locator('#panel-prompt input').inputValue(), 'Keep this draft');
  }
});

test('a normal drag resizes without toggling and restores saved proportions on reload', async t => {
  const page = await open(t);
  await drag(page, 300);
  assert.ok(Math.abs(await width(page) - 300) < 2);
  assert.equal(await page.locator('.pg-divider').getAttribute('aria-expanded'), 'true');
  await page.reload();
  assert.ok(Math.abs(await width(page) - 300) < 2);
});

test('dragging below 160px collapses and reopening restores the last usable width', async t => {
  const page = await open(t);
  await drag(page, 310);
  const initial = await width(page);
  await drag(page, 170);
  assert.ok(Math.abs(await width(page) - 180) < 2);
  await drag(page, initial);
  await drag(page, 140);
  assert.equal(await width(page), 40);
  await page.getByRole('button', { name: 'Expand chat panel' }).click({ position: { x: 3, y: 30 } });
  assert.ok(Math.abs(await width(page) - initial) < 2);
});

test('a captured drag can cross the preview iframe, reverse a collapse, and reopen a collapsed panel', async t => {
  const page = await open(t);
  const bar = await page.locator('.pg-divider').boundingBox();
  const initial = await width(page);
  await drag(page, 140, false);
  assert.equal(await width(page), 40);
  await page.mouse.move(bar.x + 3 + 550 - initial, bar.y + 50, { steps: 12 });
  await page.mouse.up();
  assert.ok(Math.abs(await width(page) - 550) < 2);
  await page.locator('.pg-divider').click({ position: { x: 3, y: 40 } });
  await drag(page, 280);
  assert.ok(Math.abs(await width(page) - 280) < 2);
});

test('keyboard and touch taps toggle the full divider', async t => {
  const page = await open(t, { hasTouch: true });
  const bar = page.locator('.pg-divider');
  await bar.focus();
  await page.keyboard.press('Enter');
  assert.equal(await width(page), 40);
  await page.keyboard.press('Space');
  assert.ok(await width(page) > 180);
  const box = await bar.boundingBox();
  await page.touchscreen.tap(box.x + 3, box.y + 20);
  assert.equal(await width(page), 40);
});

test('cancellation restores the panel and mobile layout remains usable after desktop collapse', async t => {
  const page = await open(t);
  const initial = await width(page);
  await drag(page, 140, false);
  const pointerId = await page.locator('.pg-divider').evaluate(el => Array.from({ length: 10 }, (_, id) => id).find(id => el.hasPointerCapture(id)));
  assert.notEqual(pointerId, undefined);
  await page.locator('.pg-divider').dispatchEvent('pointercancel', { pointerId });
  await page.mouse.up();
  assert.ok(Math.abs(await width(page) - initial) < 1);
  await page.locator('.pg-divider').click({ position: { x: 3, y: 20 } });
  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForFunction(() => !document.querySelector('#panel-prompt').inert);
  assert.equal(await page.locator('.pg-divider').isVisible(), false);
  assert.equal(await width(page), 390);
  assert.equal(await page.locator('#panel-prompt input').isVisible(), true);
});
