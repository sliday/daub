import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../../', import.meta.url);
const assets = new Map();
for (const file of ['themes.html', 'theme-preview.html', 'site-nav.js', 'site-nav.css', 'components.json', 'daub.js', 'daub.css', 'assets/lucide.min.js']) {
  assets.set('/' + file, await readFile(new URL(file, root), 'utf8'));
}
let browser;
assets.set('/component-fixture.html', '<!doctype html><html><head><link rel="stylesheet" href="daub.css"><script src="assets/lucide.min.js" defer></script><script src="daub.js" defer></script></head><body></body></html>');

before(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
});
after(async () => { await browser?.close(); });

async function withPage(path, run, setup) {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  const errors = [];
  page.setDefaultTimeout(2000);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'daub.test') return route.abort();
    const body = assets.get(url.pathname);
    if (!body) return route.fulfill({ status: 404, body: '' });
    const contentType = url.pathname.endsWith('.js') ? 'application/javascript' : url.pathname.endsWith('.css') ? 'text/css' : url.pathname.endsWith('.json') ? 'application/json' : 'text/html';
    return route.fulfill({ body, contentType });
  });
  try {
    if (setup) await setup(page);
    await page.goto('http://daub.test/' + path);
    await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
    await page.locator(path === 'component-fixture.html' ? 'body' : path === 'themes.html' ? '#tg-grid .tg-card' : '#css-input').first().waitFor({ state: path === 'component-fixture.html' ? 'attached' : 'visible' });
    await run(page);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function withComponentFixture(run, setup) { return withPage('component-fixture.html', run, setup); }

async function assertAlertDialogExample(page, sample) {
  const trigger = sample.getByRole('button', { name: 'Delete draft', exact: true }).and(sample.locator('[data-db-trigger]'));
  assert.equal(await trigger.count(), 1);
  assert.equal(await trigger.isVisible(), true);
  const overlay = sample.locator('.db-alert-dialog');
  const dialog = sample.locator('.db-alert-dialog__panel');
  assert.equal(await dialog.isVisible(), false);
  assert.equal(await trigger.getAttribute('data-db-trigger'), await overlay.getAttribute('id'));
  for (const dismiss of ['cancel', 'confirm', 'escape', 'backdrop']) {
    await trigger.click();
    await dialog.waitFor({ state: 'visible' });
    assert.equal(await sample.getByRole('alertdialog', { name: 'Delete this draft?', exact: true }).isVisible(), true);
    assert.equal(await dialog.locator('.db-alert-dialog__desc').textContent(), 'This action cannot be undone.');
    assert.equal(await dialog.getAttribute('aria-describedby'), await dialog.locator('.db-alert-dialog__desc').getAttribute('id'));
    assert.equal(await overlay.getAttribute('aria-hidden'), 'false');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
    const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
    const confirm = dialog.getByRole('button', { name: 'Delete draft', exact: true });
    assert.equal(await cancel.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await confirm.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await cancel.evaluate(element => element === document.activeElement), true);
    assert.equal(await dialog.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight && element.scrollWidth <= element.clientWidth;
    }), true);
    if (dismiss === 'cancel') await cancel.click();
    else if (dismiss === 'confirm') await confirm.click();
    else if (dismiss === 'escape') await page.keyboard.press('Escape');
    else await sample.locator('.db-alert-dialog__overlay').click({ position: { x: 1, y: 1 } });
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await overlay.getAttribute('aria-hidden'), 'true');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
  }
}

for (const width of [320, 1280]) {
  for (const theme of ['light', 'dark']) {

    test('AI Docs Alert Dialog includes a working launcher at ' + width + 'px in ' + theme, async () => {
      const reference = await readFile(new URL('llms.txt', root), 'utf8');
      const html = reference.match(/### 22\. Alert Dialog[^]*?```html\n([^]*?)\n```/)[1];
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      page.setDefaultTimeout(2000);
      try {
        await page.setContent('<html data-theme="' + theme + '"><body>' + html + '</body></html>');
        await page.addStyleTag({ content: assets.get('/daub.css') + '\n*,*::before,*::after{transition:none!important;animation:none!important}' });
        await page.addScriptTag({ content: assets.get('/daub.js') });
        await page.evaluate(() => DAUB.init());
        await assertAlertDialogExample(page, page.locator('body'));
      } finally {
        await page.close();
      }
    });
  }
}

async function assertModalExample(page, sample, { triggerName = 'Open project details', title = 'Project details', body = 'Project Aurora has 3 tasks ready for review.' } = {}) {
  const trigger = sample.getByRole('button', { name: triggerName, exact: true });
  assert.equal(await trigger.count(), 1);
  assert.equal(await trigger.isVisible(), true);
  const overlay = sample.locator('.db-modal-overlay');
  const dialog = sample.locator('.db-modal');
  assert.equal(await dialog.isVisible(), false);
  assert.equal(await trigger.getAttribute('data-db-modal-trigger'), await overlay.getAttribute('id'));
  for (const dismiss of ['footer', 'close', 'escape', 'backdrop']) {
    await trigger.click();
    await dialog.waitFor({ state: 'visible' });
    assert.equal(await dialog.getByRole('heading', { name: title, exact: true }).isVisible(), true);
    assert.equal(await dialog.locator('.db-modal__body').textContent(), body);
    assert.equal(await overlay.getAttribute('aria-hidden'), 'false');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
    const bounds = await dialog.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { fits: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight, overflow: element.scrollWidth > element.clientWidth };
    });
    assert.equal(bounds.fits, true);
    assert.equal(bounds.overflow, false);
    if (dismiss === 'footer') await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    else if (dismiss === 'close') await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
    else if (dismiss === 'escape') await page.keyboard.press('Escape');
    else await overlay.click({ position: { x: 1, y: 1 } });
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await overlay.getAttribute('aria-hidden'), 'true');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
  }
}

for (const width of [320, 1280]) {
  for (const theme of ['light', 'dark']) {

    test('catalog Modal Overlay opens and dismisses its populated example at ' + width + 'px in ' + theme, async () => {
      const component = JSON.parse(assets.get('/components.json')).components.find(component => component.name === 'Modal Overlay');
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      page.setDefaultTimeout(2000);
      try {
        await page.setContent('<html data-theme="' + theme + '"><body>' + component.html + '</body></html>');
        await page.addStyleTag({ content: assets.get('/daub.css') + '\n*,*::before,*::after{transition:none!important;animation:none!important}' });
        await page.addScriptTag({ content: assets.get('/daub.js') });
        await page.evaluate(() => DAUB.init());
        const body = component.html.match(/<div class="db-modal__body">([^]*?)<\/div>/)[1];
        await assertModalExample(page, page.locator('body'), { triggerName: 'Open release notes', title: 'Release notes', body });
      } finally {
        await page.close();
      }
    });

    test('AI Docs Modal includes a working launcher at ' + width + 'px in ' + theme, async () => {
      const reference = await readFile(new URL('llms.txt', root), 'utf8');
      const html = reference.match(/### 21\. Modal[^]*?```html\n([^]*?)\n```/)[1];
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      try {
        await page.setContent('<html data-theme="' + theme + '"><body>' + html + '</body></html>');
        await page.addStyleTag({ content: assets.get('/daub.css') + '\n*,*::before,*::after{transition:none!important;animation:none!important}' });
        await page.addScriptTag({ content: assets.get('/daub.js') });
        await page.evaluate(() => DAUB.init());
        await assertModalExample(page, page.locator('body'));
      } finally {
        await page.close();
      }
    });
  }
}

async function assertRevenueChart(card) {
  assert.equal(await card.locator('canvas').count(), 0);
  assert.equal(await card.getByRole('img', { name: 'Monthly revenue: January $40k, February $60k, March $80k', exact: true }).isVisible(), true);
  assert.deepEqual(await card.locator('.db-chart__labels span').allTextContents(), ['Jan', 'Feb', 'Mar']);
  const geometry = await card.evaluate(element => {
    const chart = element.querySelector('.db-chart').getBoundingClientRect();
    const bars = [...element.querySelectorAll('.db-chart__bar')].map(bar => ({
      rect: bar.getBoundingClientRect().toJSON(),
      background: getComputedStyle(bar).backgroundImage,
      title: bar.title,
    }));
    return { chart: chart.toJSON(), bars, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  assert.equal(geometry.bars.length, 3);
  assert.deepEqual(geometry.bars.map(bar => bar.title), ['January: $40k', 'February: $60k', 'March: $80k']);
  for (const { rect, background } of geometry.bars) {
    assert.ok(rect.width > 10 && rect.height > 40, JSON.stringify(geometry));
    assert.ok(rect.left >= geometry.chart.left && rect.right <= geometry.chart.right && rect.bottom <= geometry.chart.bottom, JSON.stringify(geometry));
    assert.notEqual(background, 'none');
  }
  assert.ok(geometry.bars[0].rect.height < geometry.bars[1].rect.height && geometry.bars[1].rect.height < geometry.bars[2].rect.height);
  assert.equal(geometry.overflow, false);
}

for (const width of [320, 1280]) {
  for (const theme of ['light', 'dark']) {

    test('AI Docs Chart Card renders without chart scripts at ' + width + 'px in ' + theme, async () => {
      const reference = await readFile(new URL('llms.txt', root), 'utf8');
      const html = reference.match(/### 55\. Chart Card[^]*?```html\n([^]*?)\n```/)[1];
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      try {
        await page.setContent('<html data-theme="' + theme + '"><body style="margin:0;padding:16px;">' + html + '</body></html>');
        await page.addStyleTag({ content: assets.get('/daub.css') });
        await assertRevenueChart(page.locator('.db-chart-card'));
        assert.equal(await page.locator('script').count(), 0);
      } finally {
        await page.close();
      }
    });
  }
}

test('Theme Switcher retains its floating placement outside documentation previews', async () => {
  await withComponentFixture(async page => {
    await page.evaluate(() => {
      const switcher = document.createElement('div');
      switcher.className = 'db-theme-switcher';
      document.body.appendChild(switcher);
      DAUB.init();
    });
    const floating = page.locator('body > .db-theme-switcher');
    assert.equal(await floating.evaluate(element => getComputedStyle(element).position), 'fixed');
    assert.equal(await floating.getByRole('button', { name: 'Open theme picker' }).isVisible(), true);
    await floating.getByRole('button', { name: 'Open theme picker' }).click();
    const picker = floating.locator('.db-theme-switcher__popover');
    assert.equal(await picker.isVisible(), true);
    assert.equal(await picker.evaluate(element => getComputedStyle(element).position), 'absolute');
  });
});

test('Bottom Navigation retains mobile-only visibility outside documentation previews', async () => {
  const html = JSON.parse(assets.get('/components.json')).components.find(component => component.name === 'Bottom Navigation').html;
  await withComponentFixture(async page => {
    await page.evaluate(html => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      const nav = wrapper.firstElementChild;
      nav.className = 'db-bottom-nav';
      document.body.appendChild(nav);
      lucide.createIcons();
    }, html);
    const nav = page.locator('body > .db-bottom-nav');
    assert.equal(await nav.isVisible(), false);
    await page.setViewportSize({ width: 320, height: 700 });
    assert.equal(await nav.isVisible(), true);
    assert.equal(await nav.evaluate(element => getComputedStyle(element).position), 'fixed');
    assert.equal((await nav.boundingBox()).y + (await nav.boundingBox()).height, 700);
    await page.setViewportSize({ width: 1280, height: 700 });
    await nav.evaluate(element => element.classList.add('db-bottom-nav--always'));
    assert.equal(await nav.isVisible(), true);
  });
});

const importedTheme = {
  domain: 'example.test',
  dom: {
    colors: { semantic: { bg: { value: '#112233' }, text: '#f5f5f5', accent: '#336699' }, status: { success: { raw: '#227744' } } },
    radii: { clustered: { sm: 2, default: '7px', lg: { value: '1rem' }, xl: 14, full: 9999 } },
    shadows: {
      levels: [{ value: '0 4px 9px rgba(0,0,0,.3)' }, { value: { x: 0, y: 3, blur: 8, spread: 0, color: '#102030' } }],
      inset: 'inset 0 1px 2px rgba(0,0,0,.2)'
    },
    components: {
      button: { styles: { backgroundColor: '#336699', borderRadius: 6, fontSize: 14 } },
      field: { styles: { backgroundColor: { raw: '#ebf5ff' }, borderRadius: 3 } },
      card: { styles: { borderRadius: '1.25rem', boxShadow: { value: '0 2px 6px rgba(10,20,30,.4)' } } }
    }
  }
};

async function importTheme(page, theme, mode) {
  await page.getByRole('button', { name: 'JSON', exact: true }).click();
  const json = JSON.stringify(theme);
  if (mode === 'paste') {
    await page.locator('#css-input').fill(json);
    await page.locator('#css-input').dispatchEvent('paste');
  } else if (mode === 'file') {
    await page.locator('#json-file').setInputFiles({ name: 'theme.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  } else {
    await page.locator('#json-dropzone').evaluate((element, json) => {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File([json], 'theme.json', { type: 'application/json' }));
      element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    }, json);
  }
  await page.waitForFunction(() => document.querySelector('#source-label').textContent === 'Theme applied.');
}

async function themeSnapshot(page) {
  return page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const button = getComputedStyle(document.querySelector('#preview .db-btn'));
    const field = getComputedStyle(document.querySelector('#preview .db-field__input'));
    const card = getComputedStyle(document.querySelector('#preview .db-card'));
    return {
      background: getComputedStyle(document.querySelector('#preview')).backgroundColor,
      backgroundToken: root.getPropertyValue('--db-color-bg').trim(),
      radius: root.getPropertyValue('--db-radius-2').trim(),
      largeRadius: root.getPropertyValue('--db-radius-3').trim(),
      success: root.getPropertyValue('--db-success').trim(),
      shadow: root.getPropertyValue('--db-shadow-1').trim(),
      secondShadow: root.getPropertyValue('--db-shadow-2').trim(),
      inset: root.getPropertyValue('--db-shadow-inset').trim(),
      buttonRadius: button.borderTopLeftRadius, buttonFont: button.fontSize, buttonBackground: button.backgroundColor,
      fieldRadius: field.borderTopLeftRadius, fieldBackground: field.backgroundColor,
      cardRadius: card.borderTopLeftRadius, cardShadow: card.boxShadow
    };
  });
}

test('theme JSON paste, file, and drop preserve typed colors, radii, and shadows in rendered components', async () => {
  await withPage('theme-preview.html', async page => {
    let first;
    for (const mode of ['paste', 'file', 'drop']) {
      await importTheme(page, importedTheme, mode);
      const snapshot = await themeSnapshot(page);
      assert.equal(snapshot.background, 'rgb(17, 34, 51)', JSON.stringify(snapshot));
      assert.equal(snapshot.radius, '7px');
      assert.equal(snapshot.largeRadius, '1rem');
      assert.equal(snapshot.success, '#227744');
      assert.equal(snapshot.shadow, '0 4px 9px rgba(0,0,0,.3)');
      assert.equal(snapshot.secondShadow, '0px 3px 8px 0px #102030');
      assert.equal(snapshot.inset, 'inset 0 1px 2px rgba(0,0,0,.2)');
      assert.equal(snapshot.buttonRadius, '6px');
      assert.equal(snapshot.buttonFont, '14px');
      assert.equal(snapshot.buttonBackground, 'rgb(51, 102, 153)');
      assert.equal(snapshot.fieldRadius, '3px');
      assert.equal(snapshot.fieldBackground, 'rgb(235, 245, 255)');
      assert.equal(snapshot.cardRadius, '20px');
      assert.match(snapshot.cardShadow, /rgba\(10, 20, 30, 0\.4\)/);
      assert.doesNotMatch(await page.locator('#css-input').inputValue(), /undefinedpx|\[object Object\]|pxpx/);
      if (first) assert.deepEqual(snapshot, first);
      first = snapshot;
      await page.getByRole('button', { name: 'Reset', exact: true }).click();
    }
  });
});

test('theme JSON honors exported CSS config for parity with the CSS export', async () => {
  await withPage('theme-preview.html', async page => {
    const theme = { ...importedTheme, config: ':root { --db-color-bg: #345678; --db-btn-radius: 11px; --db-card-shadow: 0 5px 10px #102030; }' };
    await importTheme(page, theme, 'file');
    const jsonSnapshot = await themeSnapshot(page);
    assert.equal(jsonSnapshot.background, 'rgb(52, 86, 120)', JSON.stringify(jsonSnapshot));
    assert.equal(jsonSnapshot.buttonRadius, '11px');
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.locator('#css-input').fill(theme.config);
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    assert.deepEqual(await themeSnapshot(page), jsonSnapshot);
  });
});

test('theme replacement, invalid JSON, and reset preserve the original page theme', async () => {
  await withPage('theme-preview.html', async page => {
    const baseline = await themeSnapshot(page);
    await importTheme(page, importedTheme, 'file');
    const imported = await themeSnapshot(page);
    await page.locator('#css-input').fill('{broken JSON');
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    assert.match(await page.locator('#source-label').textContent(), /^Invalid JSON:/);
    assert.deepEqual(await themeSnapshot(page), imported);
    await page.locator('#css-input').fill(':root { --db-color-bg: #ffffff; }');
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    const replaced = await themeSnapshot(page);
    assert.equal(replaced.background, 'rgb(255, 255, 255)');
    assert.equal(replaced.buttonRadius, baseline.buttonRadius);
    assert.equal(replaced.cardShadow, baseline.cardShadow);
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    assert.deepEqual(await themeSnapshot(page), baseline);
    assert.equal(await page.locator('#css-input').inputValue(), '');
    assert.equal(await page.locator('#json-file').inputValue(), '');
    assert.equal(await page.locator('#token-inspector').isVisible(), false);
  });
});

test('theme import discards invalid token types without emitting broken CSS', async () => {
  await withPage('theme-preview.html', async page => {
    const baseline = await themeSnapshot(page);
    await importTheme(page, { dom: {
      colors: { semantic: { bg: '#ffffff', text: { unexpected: 'red' }, accent: true }, status: { success: false } },
      radii: { clustered: { default: { unexpected: 9 }, lg: true, xl: -5 } },
      shadows: { levels: [false, { value: { x: 0, y: 2, blur: -3, color: '#000' } }], inset: { unexpected: 'none' } },
      components: { button: { styles: { borderRadius: [], fontSize: true } }, card: { styles: { boxShadow: { unexpected: 'none' } } } }
    } }, 'file');
    const result = await themeSnapshot(page);
    assert.equal(result.background, 'rgb(255, 255, 255)');
    for (const key of ['radius', 'largeRadius', 'success', 'shadow', 'secondShadow', 'inset', 'buttonRadius', 'buttonFont', 'cardShadow']) {
      assert.equal(result[key], baseline[key], key);
    }
    const css = await page.locator('#css-input').inputValue();
    assert.doesNotMatch(css, /undefined|\[object Object\]|true|false|NaN|pxpx/);
    assert.equal(await page.locator('#token-grid .tp-token').count(), 1);
  });
});

test('theme gallery default card retains its palette after applying dark mode', async () => {
  await withPage('themes.html', async page => {
    const card = page.locator('.tg-card[data-theme="light"]');
    const palette = () => card.evaluate(element => {
      const style = getComputedStyle(element);
      return ['--db-cream', '--db-ink', '--db-terracotta'].map(property => style.getPropertyValue(property).trim());
    });
    const before = await palette();
    await page.locator('.tg-card[data-theme="dark"] .tg-card__apply').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.deepEqual(await palette(), before);
  });
});
