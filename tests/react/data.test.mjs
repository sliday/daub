import assert from 'node:assert/strict';
import { before, beforeEach, after, afterEach, test } from 'node:test';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const reactRequire = createRequire(new URL('../../react/package.json', import.meta.url));
const { build } = reactRequire('esbuild');
const { chromium } = require('playwright');
const css = readFileSync(new URL('../../daub.css', import.meta.url), 'utf8');
const nativeJS = readFileSync(new URL('../../daub.js', import.meta.url), 'utf8');
let browser, page, script, errors;

before(async () => {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL('./data-fixture.tsx', import.meta.url))],
    bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    nodePaths: [fileURLToPath(new URL('../../react/node_modules', import.meta.url))],
  });
  script = bundle.outputFiles[0].text;
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
});
beforeEach(async () => {
  page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
  page.setDefaultTimeout(1000);
  errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setContent('<html data-theme="github"><body><div id="root"></div></body></html>');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
});
afterEach(async () => { await page?.close(); assert.deepEqual(errors, [], 'React/browser errors'); });
after(async () => { await browser?.close(); });
const mount = (kind, props = {}) => page.evaluate(({ kind, props }) => window.mountData(kind, props), { kind, props });
const events = () => page.evaluate(() => window.dataEvents);
const table = { columns: [{ label: 'Name', sortable: true }, { label: 'Count', sortable: true }], rows: [['Zoe', 2], ['Ada', 10], ['Ben', 1]], selectable: true };
const rowNames = () => page.locator('tbody tr').evaluateAll(nodes => nodes.map(row => row.querySelector('td:not(:has(input))').textContent));
const visualScreenshot = async (name) => {
  if (!process.env.REACT_SCREENSHOT_DIR) return;
  mkdirSync(process.env.REACT_SCREENSHOT_DIR, { recursive: true });
  await page.locator('form').screenshot({ path: join(process.env.REACT_SCREENSHOT_DIR, `${name}.png`) });
};
const gestureCarousel = { gesture: true, style: { width: 320 } };
const touchSession = async () => {
  const session = await page.context().newCDPSession(page);
  return {
    start: (x, y) => session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }),
    move: (x, y) => session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] }),
    end: () => session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
    cancel: () => session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }),
  };
};
const slideText = () => page.getByRole('link').textContent();
const gestureClick = () => page.getByRole('link').evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })));

test('Carousel touch swipe follows native threshold, wraps and retains inert slide focus isolation', async () => {
  await mount('Carousel', gestureCarousel);
  assert.equal(await page.locator('.db-carousel__track').evaluate(node => getComputedStyle(node).touchAction), 'pan-y');
  const touch = await touchSession();
  await touch.start(240, 70); await touch.move(193, 70); await touch.end();
  assert.equal(await slideText(), 'Content 1');
  await touch.start(240, 70); await touch.move(192, 70); await touch.end();
  assert.equal(await slideText(), 'Content 2');
  assert.deepEqual(await page.locator('.db-carousel__slide').evaluateAll(nodes => nodes.map(node => node.inert)), [true, false, true]);
  await touch.start(100, 70); await touch.move(240, 70); await touch.end();
  assert.equal(await slideText(), 'Content 1');
  await touch.start(100, 70); await touch.move(240, 70); await touch.end();
  assert.equal(await slideText(), 'Content 3');
  assert.deepEqual(await events(), [1, 0, 2]);
});

test('Carousel pen swipes navigate while mouse drags preserve slide state', async () => {
  await mount('Carousel', gestureCarousel);
  await page.evaluate(() => {
    window.penEvents = [];
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture', 'dragstart']) {
      document.addEventListener(type, event => window.penEvents.push({ type, pointer: event.pointerType, primary: event.isPrimary, button: event.button, target: event.target.tagName }), true);
    }
  });
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 240, y: 70, button: 'left', buttons: 1, clickCount: 1, pointerType: 'pen' });
  await session.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 100, y: 70, button: 'left', buttons: 1, pointerType: 'pen' });
  await session.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 100, y: 70, button: 'left', buttons: 0, clickCount: 1, pointerType: 'pen' });
  assert.equal(await slideText(), 'Content 2', JSON.stringify(await page.evaluate(() => window.penEvents)));
  await page.mouse.move(240, 70); await page.mouse.down(); await page.mouse.move(100, 70); await page.mouse.up();
  assert.equal(await slideText(), 'Content 2');
  assert.equal((await events()).filter(event => typeof event === 'number').length, 1);
});

test('Carousel swipe thresholds clamp to native 30px and 80px bounds', async () => {
  const touch = await touchSession();
  for (const [width, start, below, boundary] of [[200, 140, 111, 110], [1000, 240, 161, 160]]) {
    await mount('Carousel', { gesture: true, current: 0, style: { width } });
    const before = (await events()).length;
    await touch.start(start, 70); await touch.move(below, 70); await touch.end();
    assert.equal((await events()).length, before);
    await touch.start(start, 70); await touch.move(boundary, 70); await touch.end();
    assert.equal((await events()).length, before + 1);
  }
  assert.deepEqual(await events(), [1, 1]);
});

test('Carousel clears captured gestures on capture loss and unmount', async () => {
  await mount('Carousel', gestureCarousel);
  await page.evaluate(() => {
    window.captureEvents = [];
    document.addEventListener('pointerdown', event => { window.carouselPointer = event.pointerId; });
    document.addEventListener('gotpointercapture', event => { window.carouselCapture = event.target.classList.contains('db-carousel__track'); });
    for (const type of ['pointermove', 'gotpointercapture', 'lostpointercapture']) {
      document.addEventListener(type, event => window.captureEvents.push({ type, target: event.target.tagName, classes: event.target.className, x: event.clientX, id: event.pointerId }), true);
    }
  });
  const touch = await touchSession();
  await touch.start(240, 70); await touch.move(100, 70);
  await page.waitForFunction(() => document.querySelector('.db-carousel__track').hasPointerCapture(window.carouselPointer));
  await touch.move(90, 70);
  await page.waitForFunction(() => window.carouselCapture === true);
  assert.equal(await page.evaluate(() => window.carouselCapture), true, JSON.stringify(await page.evaluate(() => window.captureEvents)));
  assert.equal(await page.locator('.db-carousel__track').evaluate(node => node.hasPointerCapture(window.carouselPointer)), true);
  await page.locator('.db-carousel__track').evaluate(node => node.releasePointerCapture(window.carouselPointer));
  await touch.move(80, 70); await touch.end();
  assert.equal(await slideText(), 'Content 1');
  assert.deepEqual(await events(), []);
  await touch.start(240, 70); await touch.move(100, 70);
  await mount('Chip', { children: 'Other view' });
  await touch.end();
  assert.deepEqual(await events(), []);
  await mount('Carousel', gestureCarousel);
  await touch.start(240, 70); await touch.move(100, 70); await touch.end();
  assert.equal(await slideText(), 'Content 2');
  assert.deepEqual(await events(), [1]);
});

test('Carousel discards gestures disabled mid-drag and accepts the next enabled swipe', async () => {
  await mount('Carousel', gestureCarousel);
  const touch = await touchSession();
  await touch.start(240, 70); await touch.move(100, 70);
  await mount('Carousel', { ...gestureCarousel, disabled: true });
  await touch.end();
  assert.deepEqual(await events(), []);
  assert.equal(await page.getByRole('button', { name: 'Next slide' }).isDisabled(), true);
  await mount('Carousel', gestureCarousel);
  await touch.start(240, 70); await touch.move(100, 70); await touch.end();
  assert.deepEqual(await events(), [1]);
});

test('Carousel post-swipe click guard expires at the native 350ms duration', async () => {
  await mount('Carousel', { ...gestureCarousel, current: 0 });
  const touch = await touchSession();
  await touch.start(240, 70); await touch.move(100, 70); await touch.end();
  await page.waitForTimeout(375);
  assert.equal(await gestureClick(), true);
  assert.deepEqual(await events(), [1, 'link:0']);
});

test('Carousel swipe controlled requests do not mutate supplied selection or submit forms', async () => {
  await mount('Carousel', { ...gestureCarousel, current: 0 });
  const touch = await touchSession();
  await touch.start(240, 70); await touch.move(100, 70); await touch.end();
  assert.equal(await slideText(), 'Content 1');
  assert.equal(await page.locator('.db-carousel__track').evaluate(node => node.style.transform), 'translateX(0%)');
  assert.deepEqual(await events(), [1]);
  await mount('Carousel', { ...gestureCarousel, current: 1 });
  assert.equal(await slideText(), 'Content 2');
});

test('Carousel preserves link taps and keyboard activation but suppresses the post-swipe click', async () => {
  await mount('Carousel', { ...gestureCarousel, current: 0 });
  const touch = await touchSession();
  await touch.start(100, 70); await touch.end();
  assert.deepEqual(await events(), ['link:0']);
  await touch.start(240, 70); await touch.move(100, 70); await touch.end();
  assert.deepEqual(await events(), ['link:0', 1]);
  assert.equal(await gestureClick(), false);
  assert.deepEqual(await events(), ['link:0', 1]);
  await touch.start(100, 70); await touch.end();
  assert.deepEqual(await events(), ['link:0', 1, 'link:0']);
  await touch.start(240, 70); await touch.move(100, 70); await touch.end();
  await page.getByRole('link').focus();
  await page.keyboard.press('Enter');
  assert.deepEqual(await events(), ['link:0', 1, 'link:0', 1, 'link:0']);
});

test('Carousel allows vertical page scroll, ignores diagonal gestures and honors pointercancel', async () => {
  await mount('Carousel', gestureCarousel);
  await page.evaluate(() => document.body.style.minHeight = '2000px');
  const touch = await touchSession();
  await touch.start(240, 70); await touch.move(100, 70); await touch.cancel();
  assert.equal(await slideText(), 'Content 1');
  await touch.start(240, 100); await touch.move(210, 10); await touch.end();
  await page.waitForFunction(() => window.scrollY > 0);
  assert.equal(await slideText(), 'Content 1');
  assert.equal((await events()).filter(event => typeof event === 'number').length, 0);
});

test('Carousel ignores editing controls and disabled or single-slide gesture targets', async () => {
  const touch = await touchSession();
  await mount('Carousel', { ...gestureCarousel, editors: true });
  for (const selector of ['.db-carousel__slide button', '.db-carousel__slide input', '.db-carousel__slide select', '.db-carousel__slide textarea', '.db-carousel__slide [contenteditable]']) {
    const box = await page.locator(selector).first().boundingBox();
    const x = box.x + Math.min(20, box.width / 2), y = box.y + box.height / 2;
    await touch.start(x, y); await touch.move(x + 90, y); await touch.end();
    assert.equal(await slideText(), 'Content 1', selector);
  }
  for (const props of [{ 'aria-disabled': true }, { disabled: true }, { className: 'db-carousel--loading' }, { slides: 1 }]) {
    await mount('Carousel', { ...gestureCarousel, ...props });
    await touch.start(240, 70); await touch.move(100, 70); await touch.end();
    assert.equal(await slideText(), 'Content 1');
  }
  assert.equal((await events()).filter(event => typeof event === 'number').length, 0);
});

test('Carousel composes consumer pointer handlers and respects cancellation at each gesture phase', async () => {
  const touch = await touchSession();
  for (const cancelPointer of ['pointerdown', 'pointermove', 'pointerup']) {
    await mount('Carousel', { ...gestureCarousel, cancelPointer });
    await touch.start(240, 70); await touch.move(100, 70); await touch.end();
    assert.equal(await slideText(), 'Content 1', cancelPointer);
    assert.equal((await events()).filter(event => typeof event === 'number').length, 0);
    assert.equal(await page.evaluate(phase => window.dataPointerEvents.includes(phase), cancelPointer), true);
  }
  await mount('Carousel', { ...gestureCarousel, pointerHandlers: true });
  await touch.start(240, 70); await touch.move(100, 70); await touch.end();
  assert.equal(await slideText(), 'Content 2');
  assert.equal((await events()).filter(event => typeof event === 'number').length, 1);
});

test('DataTable sorts through keyboard controls, preserves numeric order and the table ref', async () => {
  await mount('DataTable', table);
  await page.getByRole('button', { name: 'Sort by Count' }).press('Enter');
  assert.deepEqual(await rowNames(), ['Ben', 'Zoe', 'Ada']);
  assert.equal(await page.getByRole('columnheader', { name: /Count/ }).getAttribute('aria-sort'), 'ascending');
  await page.getByRole('button', { name: 'Sort by Count' }).press('Space');
  assert.deepEqual(await rowNames(), ['Ada', 'Zoe', 'Ben']);
  await page.getByRole('button', { name: 'Sort by Name' }).click();
  assert.deepEqual(await rowNames(), ['Ada', 'Ben', 'Zoe']);
  assert.equal(await page.evaluate(() => window.dataRef === document.querySelector('table')), true);
  assert.deepEqual(await events(), [{ column: 1, direction: 'ascending' }, { column: 1, direction: 'descending' }, { column: 0, direction: 'ascending' }]);
});

test('DataTable names selection, synchronizes select-all and retains selection after sorting', async () => {
  await mount('DataTable', table);
  const all = page.getByRole('checkbox', { name: 'Select all rows' });
  await page.getByRole('checkbox', { name: 'Select row 1' }).check();
  assert.equal(await all.evaluate(node => node.indeterminate), true);
  await page.getByRole('button', { name: 'Sort by Name' }).click();
  assert.equal(await page.locator('tbody tr').filter({ hasText: 'Zoe' }).getByRole('checkbox').isChecked(), true);
  assert.equal(await page.locator('tbody tr[data-selected]').count(), 1);
  await all.check();
  assert.equal(await page.locator('tbody input:checked').count(), 3);
  assert.equal(await all.evaluate(node => node.indeterminate), false);
  await all.uncheck();
  assert.equal(await page.locator('tbody tr[data-selected]').count(), 0);
  assert.deepEqual(await events(), [[0], { column: 0, direction: 'ascending' }, [0, 1, 2], []]);
});

test('DataTable empty rows disable select-all and announce the empty state', async () => {
  await mount('DataTable', { ...table, rows: [] });
  assert.equal(await page.getByRole('checkbox', { name: 'Select all rows' }).isDisabled(), true);
  assert.equal(await page.locator('tbody').textContent(), 'No data');
});

test('DataTable controlled selection and sorting only report requests until rerender', async () => {
  await mount('DataTable', { ...table, selectedRows: [], sort: null });
  await page.getByRole('checkbox', { name: 'Select row 1' }).click();
  assert.equal(await page.getByRole('checkbox', { name: 'Select row 1' }).isChecked(), false);
  await page.getByRole('button', { name: 'Sort by Name' }).click();
  assert.deepEqual(await rowNames(), ['Zoe', 'Ada', 'Ben']);
  assert.deepEqual(await events(), [[0], { column: 0, direction: 'ascending' }]);
  await mount('DataTable', { ...table, selectedRows: [0], sort: { column: 0, direction: 'ascending' } });
  assert.deepEqual(await rowNames(), ['Ada', 'Ben', 'Zoe']);
  assert.equal(await page.getByRole('checkbox', { name: 'Select row 1' }).isChecked(), true);
});

test('DataTable removes invalid selection indexes and ignores non-sortable columns', async () => {
  await mount('DataTable', { ...table, defaultSelectedRows: [-1, 0, 99], defaultSort: { column: 99, direction: 'ascending' } });
  assert.equal(await page.locator('tbody tr[data-selected]').count(), 1);
  assert.deepEqual(await rowNames(), ['Zoe', 'Ada', 'Ben']);
  await page.getByRole('checkbox', { name: 'Select row 2' }).check();
  assert.deepEqual(await events(), [[0, 1]]);
  await mount('DataTable', { ...table, rows: [table.rows[1]] });
  assert.equal(await page.getByRole('checkbox', { name: 'Select all rows' }).isChecked(), true);
});

test('Table sortable sorts data without moving the forwarded table ref', async () => {
  await mount('Table', { columns: ['Name', 'Count'], rows: table.rows, sortable: true });
  await page.getByRole('button', { name: 'Sort by Count' }).click();
  assert.deepEqual(await rowNames(), ['Ben', 'Zoe', 'Ada']);
  await page.getByRole('button', { name: 'Sort by Count' }).click();
  assert.deepEqual(await rowNames(), ['Ada', 'Zoe', 'Ben']);
  assert.equal(await page.evaluate(() => window.dataRef === document.querySelector('table')), true);
});

test('Table and DataTable sort signed decimal numeric strings by value', async () => {
  for (const kind of ['Table', 'DataTable']) {
    await mount(kind, { columns: kind === 'Table' ? ['Score'] : [{ label: 'Score', sortable: true }], ...(kind === 'Table' ? { sortable: true } : {}), rows: [['-2.5'], ['-10'], ['2'], ['1.5']] });
    await page.getByRole('button', { name: 'Sort by Score' }).click();
    assert.deepEqual(await rowNames(), ['-10', '-2.5', '1.5', '2']);
    await page.getByRole('button', { name: 'Sort by Score' }).click();
    assert.deepEqual(await rowNames(), ['2', '1.5', '-2.5', '-10']);
  }
});

test('Wide Table and DataTable content stays in a scrollable native wrapper at mobile widths', async () => {
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    for (const kind of ['Table', 'DataTable']) {
      const labels = ['Project name', 'Monthly active users', 'Current monthly revenue'];
      await mount(kind, { columns: kind === 'Table' ? labels : labels.map(label => ({ label, sortable: true })), ...(kind === 'Table' ? { sortable: true } : { selectable: true }), rows: [['Analytics workspace', 10, 500], ['Billing workspace', 20, 100]] });
      const wrapper = page.locator('form > div');
      assert.equal(await wrapper.evaluate(node => getComputedStyle(node).overflowX), 'auto');
      assert.equal(await wrapper.evaluate(node => node.querySelector('table').getBoundingClientRect().width >= node.clientWidth), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await page.getByRole('button', { name: 'Sort by Current monthly revenue' }).click();
      assert.deepEqual(await rowNames(), ['Billing workspace', 'Analytics workspace']);
      if (process.env.REACT_SCREENSHOT_DIR) {
        mkdirSync(process.env.REACT_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: join(process.env.REACT_SCREENSHOT_DIR, `${kind}-${width}.png`) });
      }
    }
  }
});

test('Carousel disables empty navigation without NaN change requests', async () => {
  await mount('Carousel', { slides: 0, autoplay: true, duration: 10 });
  assert.equal(await page.getByRole('button', { name: 'Next slide' }).isDisabled(), true);
  await page.locator('.db-carousel__next').dispatchEvent('click');
  assert.deepEqual(await events(), []);
  assert.equal(await page.locator('.db-carousel__track').evaluate(node => node.style.transform), 'translateX(0%)');
});

test('Carousel exposes named native controls and hides inactive slides from focus', async () => {
  await mount('Carousel', { 'aria-label': 'Photos' });
  assert.equal(await page.getByRole('region', { name: 'Photos' }).getAttribute('aria-roledescription'), 'carousel');
  assert.equal(await page.getByRole('link').count(), 1);
  assert.deepEqual(await page.locator('.db-carousel__slide').evaluateAll(nodes => nodes.map(node => node.inert)), [false, true, true]);
  await page.getByRole('button', { name: 'Next slide' }).click();
  assert.equal(await page.getByRole('link').textContent(), 'Content 2');
  assert.equal(await page.getByRole('button', { name: 'Slide 2', exact: true }).getAttribute('aria-current'), 'true');
  assert.equal(await page.getByRole('button', { name: 'Next slide' }).evaluate(node => getComputedStyle(node).position), 'absolute');
});

test('Carousel arrows use native button geometry and opposite edge positioning', async () => {
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await mount('Carousel', { style: { height: 200, '--db-space-3': '12px' } });
    const arrows = await page.locator('.db-carousel__btn').evaluateAll(nodes => nodes.map(node => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      const parent = node.parentElement.getBoundingClientRect();
      return {
        position: style.position, width: rect.width, height: rect.height, radius: style.borderRadius,
        left: style.left, right: style.right, parentWidth: parent.width,
        centerY: rect.y + rect.height / 2 - parent.y,
        prev: node.classList.contains('db-carousel__btn--prev'),
        next: node.classList.contains('db-carousel__btn--next'),
      };
    }));
    assert.equal(arrows.length, 2);
    assert.deepEqual(arrows.map(({ position, width, height, radius, centerY, prev, next }) => ({ position, width, height, radius, centerY, prev, next })), [
      { position: 'absolute', width: 36, height: 36, radius: '50%', centerY: 100, prev: true, next: false },
      { position: 'absolute', width: 36, height: 36, radius: '50%', centerY: 100, prev: false, next: true },
    ]);
    assert.equal(arrows[0].left, '12px');
    assert.equal(arrows[1].right, '12px');
    assert.equal(parseFloat(arrows[0].right), arrows[0].parentWidth - 48);
    assert.equal(parseFloat(arrows[1].left), arrows[1].parentWidth - 48);
    await visualScreenshot(`Carousel-native-${width}`);
  }
});

test('StatCard trend values use native change typography and up/down colors', async () => {
  for (const [trend, color] of [['up', 'rgb(17, 102, 51)'], ['down', 'rgb(153, 34, 51)']]) {
    await mount('StatCard', { label: 'Revenue', value: 100, trend, trendValue: '12%', style: { '--db-success-text': '#116633', '--db-error-text': '#992233' } });
    const change = page.locator('.db-stat__change');
    assert.equal(await change.textContent(), '12%');
    assert.deepEqual(await change.evaluate(node => {
      const style = getComputedStyle(node);
      return { fontSize: style.fontSize, numeric: style.fontVariantNumeric, color: style.color };
    }), { fontSize: '12px', numeric: 'tabular-nums', color });
    assert.equal(await change.evaluate((node, direction) => node.classList.contains(`db-stat__change--${direction}`), trend), true);
    await visualScreenshot(`StatCard-native-${trend}`);
  }
});

test('Stepper indicators use native size and completed, active, pending treatments', async () => {
  for (const vertical of [false, true]) {
    await mount('Stepper', { vertical, steps: [{ label: 'Done', completed: true }, { label: 'Now', active: true }, { label: 'Later' }], style: { '--db-success-dark': '#116633', '--db-stepper-completed-bg': '#116633', '--db-terracotta': '#cc5522', '--db-accent-dark': '#993311', '--db-cream-dark': '#ddeeff', '--db-sand': '#aabbcc' } });
    const indicators = await page.locator('.db-stepper__indicator').evaluateAll(nodes => nodes.map(node => {
      const style = getComputedStyle(node);
      return { width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height, display: style.display, radius: style.borderRadius, border: style.borderTopWidth, background: style.backgroundColor, image: style.backgroundImage };
    }));
    assert.equal(indicators.length, 3);
    assert.deepEqual(indicators.map(({ width, height, display, radius, border }) => ({ width, height, display, radius, border })), Array(3).fill({ width: 32, height: 32, display: 'flex', radius: '50%', border: '2px' }));
    assert.equal(indicators[0].background, 'rgb(17, 102, 51)');
    assert.equal(indicators[1].image, 'linear-gradient(rgb(204, 85, 34) 0%, rgb(153, 51, 17) 100%)');
    assert.equal(indicators[2].background, 'rgb(221, 238, 255)');
    assert.equal(await page.locator('.db-stepper__step--pending').count(), 1);
    assert.equal(await page.locator('[aria-current="step"]').count(), 1);
    await visualScreenshot(`Stepper-native-${vertical ? 'vertical' : 'horizontal'}`);
  }
});

test('Chart applies secondary styling to bars and aligns a separate native labels row', async () => {
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const bars = [{ label: 'Jan', value: 25 }, { value: 50 }, { label: 'Mar', value: 75 }];
    const style = { '--db-terracotta': '#cc5522', '--db-accent-dark': '#993311', '--db-sand': '#aabbcc', '--db-cream-dark': '#ddeeff' };
    await mount('Chart', { bars, secondary: true, style });
    const chartBars = page.locator('.db-chart__bar');
    assert.deepEqual(await chartBars.evaluateAll(nodes => nodes.map(node => ({ secondary: node.classList.contains('db-chart__bar--secondary'), background: getComputedStyle(node).backgroundImage, flex: getComputedStyle(node).flexGrow }))), Array(3).fill({ secondary: true, background: 'linear-gradient(rgb(170, 187, 204) 0%, rgb(221, 238, 255) 100%)', flex: '1' }));
    const labels = page.locator('.db-chart__labels');
    assert.equal(await labels.evaluate(node => getComputedStyle(node).display), 'flex');
    assert.deepEqual(await labels.locator('span').allTextContents(), ['Jan', '', 'Mar']);
    assert.deepEqual(await labels.locator('span').evaluateAll(nodes => nodes.map(node => ({ fontSize: getComputedStyle(node).fontSize, align: getComputedStyle(node).textAlign }))), Array(3).fill({ fontSize: '10px', align: 'center' }));
    assert.equal(await labels.evaluate(node => node.getBoundingClientRect().top >= document.querySelector('.db-chart').getBoundingClientRect().bottom), true);
    const centers = await page.evaluate(() => {
      const center = node => { const rect = node.getBoundingClientRect(); return rect.left + rect.width / 2; };
      return { bars: [...document.querySelectorAll('.db-chart__bar')].map(center), labels: [...document.querySelectorAll('.db-chart__labels span')].map(center) };
    });
    centers.bars.forEach((center, i) => assert.ok(Math.abs(center - centers.labels[i]) < 1));
    assert.equal(await page.evaluate(() => window.dataRef === document.querySelector('.db-chart')), true);
    await visualScreenshot(`Chart-native-secondary-${width}`);
    await mount('Chart', { bars, secondary: false, style });
    assert.equal(await page.locator('.db-chart__bar--secondary').count(), 0);
    assert.equal(await chartBars.first().evaluate(node => getComputedStyle(node).backgroundImage), 'linear-gradient(rgb(204, 85, 34) 0%, rgb(153, 51, 17) 100%)');
  }
});

test('Carousel bounds controlled indexes and stops autoplay while focused', async () => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await mount('Carousel', { current: 99, autoplay: true, duration: 10000 });
  assert.equal(await page.getByRole('link').textContent(), 'Content 3');
  await mount('Carousel', { current: 0, autoplay: true, duration: 40 });
  await page.getByRole('link').focus();
  await page.clock.runFor(150);
  assert.deepEqual(await events(), []);
  await page.getByRole('button', { name: 'Next slide' }).click();
  assert.deepEqual(await events(), [1]);
  assert.equal(await page.getByRole('link').textContent(), 'Content 1');
});

test('Meter clamps visual and announced values with degenerate bounds', async () => {
  for (const [props, expected] of [
    [{ value: 200 }, [0, 100, 100, '100%']],
    [{ value: -1 }, [0, 100, 0, '0%']],
    [{ value: 30, min: 10, max: 10 }, [10, 10, 10, '0%']],
    [{ value: 30, min: 10, max: 5 }, [10, 10, 10, '0%']],
    [{ value: NaN }, [0, 100, 0, '0%']],
  ]) {
    await mount('Meter', { ...props, 'aria-label': 'Storage' });
    assert.deepEqual(await page.getByRole('meter', { name: 'Storage' }).evaluate(node => [Number(node.getAttribute('aria-valuemin')), Number(node.getAttribute('aria-valuemax')), Number(node.getAttribute('aria-valuenow')), node.style.getPropertyValue('--db-meter')]), expected);
  }
});

test('Progress clamps determinate values and omits indeterminate aria-valuenow', async () => {
  await mount('Progress', { value: 200, 'aria-label': 'Upload' });
  assert.equal(await page.getByRole('progressbar', { name: 'Upload' }).getAttribute('aria-valuenow'), '100');
  assert.equal(await page.locator('.db-progress__bar').evaluate(node => node.style.width), '100%');
  await mount('Progress', { value: -2 });
  assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), '0');
  await mount('Progress', { indeterminate: true });
  assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), null);
});

test('Chart names values and bounds visual heights, including empty data', async () => {
  await mount('Chart', { bars: [{ label: 'A', value: -5 }, { label: 'B', value: 120 }, { value: NaN }] });
  assert.equal(await page.getByRole('img').getAttribute('aria-label'), 'A: 0; B: 100; Bar 3: 0');
  assert.deepEqual(await page.locator('.db-chart__bar').evaluateAll(nodes => nodes.map(node => node.style.height)), ['0%', '100%', '0%']);
  await mount('Chart', { bars: [] });
  assert.equal(await page.getByRole('img').getAttribute('aria-label'), 'No data');
});

test('ChartCard associates its title and exposes an empty-data message', async () => {
  await mount('ChartCard', { title: 'Revenue' });
  const group = page.getByRole('group', { name: 'Revenue' });
  assert.equal(await group.locator('.db-chart-card__body').textContent(), 'No data');
  const titleId = await group.getAttribute('aria-labelledby');
  assert.equal(await page.locator(`#${titleId.replaceAll(':', '\\:')}`).textContent(), 'Revenue');
});

test('Avatar falls back after image errors and retries when src changes', async () => {
  await mount('Avatar', { src: 'data:image/png;base64,broken', alt: 'Ada', initials: 'AL' });
  await page.waitForFunction(() => document.querySelector('.db-avatar').textContent === 'AL');
  assert.equal(await page.getByRole('img', { name: 'Ada' }).count(), 1);
  await mount('Avatar', { src: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', alt: 'Ada', initials: 'AL' });
  assert.equal(await page.locator('.db-avatar img').count(), 1);
  assert.equal(await page.evaluate(() => {
    window.mountData('Avatar', { src: 'data:image/png;base64,broken', alt: 'Ada', initials: 'AL' });
    return !!document.querySelector('.db-avatar img');
  }), true);
  await page.waitForFunction(() => document.querySelector('.db-avatar').textContent === 'AL');
});

test('AvatarGroup honors max and announces overflow without losing its ref', async () => {
  await mount('AvatarGroup', { max: 2 });
  assert.equal(await page.locator('.db-avatar-group .db-avatar').count(), 2);
  assert.equal(await page.getByLabel('2 more avatars').textContent(), '+2');
  await mount('AvatarGroup', { max: 0 });
  assert.equal(await page.locator('.db-avatar-group .db-avatar').count(), 0);
  assert.equal(await page.getByLabel('4 more avatars').textContent(), '+4');
});

test('Chip close and Toast dismiss have names and do not submit forms', async () => {
  await mount('Chip', { children: 'Work', closable: true });
  await page.getByRole('button', { name: 'Remove chip' }).click();
  await mount('Toast', { id: 'saved', title: 'Saved', message: 'Done' });
  assert.equal(await page.getByRole('status').getAttribute('aria-atomic'), 'true');
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  assert.deepEqual(await events(), ['close', 'saved']);
  await mount('Toast', { id: 'error', type: 'error', message: 'Failed' });
  assert.equal(await page.getByRole('alert').count(), 1);
});

test('Card uses native text classes and keyboard activation without nested activation', async () => {
  await mount('Card', { interactive: true, title: 'Open project', description: 'Project details', nested: true });
  const card = page.getByRole('button', { name: /Open project/ }).first();
  assert.equal(await card.getAttribute('tabindex'), '0');
  assert.equal(await card.locator('.db-card__title').textContent(), 'Open project');
  assert.equal(await card.locator('.db-card__desc').textContent(), 'Project details');
  await card.press('Enter');
  await card.press('Space');
  await page.getByRole('button', { name: 'Nested', exact: true }).press('Enter');
  assert.deepEqual(await events(), ['activate', 'activate']);
  await mount('Card', { interactive: true, title: 'Open project', cancel: true });
  await card.press('Enter');
  await card.press('Space');
  assert.deepEqual(await events(), ['activate', 'activate']);
});

test('Card aria-disabled blocks mouse and keyboard activation', async () => {
  await mount('Card', { interactive: true, title: 'Disabled', 'aria-disabled': true });
  const card = page.getByRole('button', { name: 'Disabled' });
  assert.equal(await card.getAttribute('tabindex'), '-1');
  await card.dispatchEvent('click');
  await card.press('Enter');
  await card.press('Space');
  assert.deepEqual(await events(), []);
});

test('BottomNav and NavMenu provide actions and static items without dead links', async () => {
  for (const kind of ['BottomNav', 'NavMenu']) {
    await mount(kind, { actions: true, className: 'db-bottom-nav--always db-bottom-nav--static' });
    await page.getByRole('button', { name: 'Run' }).press('Enter');
    assert.equal(await page.getByRole('link').count(), 1);
    assert.equal(await page.locator('[aria-current="page"]').textContent(), 'Static');
  }
  assert.deepEqual(await events(), ['run', 'run']);
});

test('Breadcrumbs keeps the current page and does not create dead ancestor links', async () => {
  await mount('Breadcrumbs', { items: [{ label: 'Root' }, { label: 'Home', href: '#home' }, { label: 'Current' }] });
  assert.equal(await page.getByRole('link').count(), 1);
  assert.equal(await page.locator('[aria-current="page"]').textContent(), 'Current');
});

test('List exposes list semantics and retains native content layout', async () => {
  await mount('List', { items: [{ title: 'Ada', secondary: 'Engineer', icon: 'A' }] });
  assert.equal(await page.getByRole('list').count(), 1);
  assert.equal(await page.getByRole('listitem').count(), 1);
  assert.equal(await page.locator('.db-list__content').textContent(), 'AdaEngineer');
  assert.equal(await page.locator('.db-list__item [aria-hidden="true"]').textContent(), 'A');
});

test('Alert, Stepper, Separator, Skeleton and ScrollArea expose their semantics', async () => {
  await mount('Alert', { variant: 'error', children: 'Failed' });
  assert.equal(await page.getByRole('alert').count(), 1);
  await mount('Alert', { variant: 'success', children: 'Saved' });
  assert.equal(await page.getByRole('status').count(), 1);
  await mount('Stepper', { steps: [{ label: 'Done', completed: true }, { label: 'Now', active: true }] });
  assert.equal(await page.locator('[aria-current="step"]').textContent(), '2Now');
  await mount('Separator', { vertical: true });
  assert.equal(await page.getByRole('separator').getAttribute('aria-orientation'), 'vertical');
  await mount('Skeleton', { lines: 3 });
  assert.equal(await page.locator('form > div').getAttribute('aria-hidden'), 'true');
  await mount('ScrollArea', { 'aria-label': 'History', children: 'Logs', style: { maxHeight: 100 } });
  assert.equal(await page.getByRole('region', { name: 'History' }).getAttribute('tabindex'), '0');
});

test('Owned component roots carry the native-JS isolation marker', async () => {
  const samples = {
    Alert: {}, Avatar: {}, AvatarGroup: {}, BottomNav: { items: [] }, Breadcrumbs: { items: [] }, Card: {}, Carousel: { slides: 0 },
    Chart: { bars: [] }, ChartCard: {}, Chip: {}, DataTable: { columns: [], rows: [] }, List: {}, Meter: {}, NavMenu: { items: [] },
    Progress: {}, ScrollArea: {}, Separator: {}, Skeleton: {}, StatCard: { label: 'Total', value: 5 }, Stepper: { steps: [] },
    Table: { columns: [], rows: [] }, Toast: { id: 'id', message: 'Saved' },
  };
  for (const [kind, props] of Object.entries(samples)) {
    await mount(kind, props);
    assert.equal(await page.locator('form > *').getAttribute('data-db-react'), '', kind);
  }
});

test('DAUB.init leaves controlled React sorting, selection and Carousel state alone', async () => {
  await mount('DataTable', { ...table, selectedRows: [], sort: null });
  await page.addScriptTag({ content: nativeJS });
  await page.evaluate(() => { window.DAUB.init(); window.DAUB.init(document.querySelector('.db-data-table')); });
  await page.getByRole('button', { name: 'Sort by Name' }).click();
  await page.getByRole('checkbox', { name: 'Select all rows' }).click();
  assert.deepEqual(await rowNames(), ['Zoe', 'Ada', 'Ben']);
  assert.equal(await page.locator('tbody input:checked').count(), 0);
  assert.deepEqual(await events(), [{ column: 0, direction: 'ascending' }, [0, 1, 2]]);
  await mount('Carousel', { current: 1 });
  await page.evaluate(() => window.DAUB.init());
  assert.equal(await page.getByRole('link').textContent(), 'Content 2');
  await page.getByRole('button', { name: 'Next slide' }).click();
  assert.equal(await page.getByRole('link').textContent(), 'Content 2');
  assert.equal(await page.locator('.db-carousel__track').evaluate(node => node.style.transform), 'translateX(-100%)');
  assert.deepEqual(await events(), [{ column: 0, direction: 'ascending' }, [0, 1, 2], 2]);
});
