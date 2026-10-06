import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../../', import.meta.url);
const assets = new Map();
for (const file of ['docs.html', 'themes.html', 'theme-preview.html', 'site-nav.js', 'components.json', 'daub.js', 'daub.css', 'assets/lucide.min.js']) {
  assets.set('/' + file, await readFile(new URL(file, root), 'utf8'));
}
let browser;

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
    await page.locator(path === 'docs.html' ? '#alert-dialog .docs-component__copy' : path === 'themes.html' ? '#tg-grid .tg-card' : '#css-input').first().waitFor();
    await run(page);
    assert.deepEqual(errors, []);
  } finally {
    await page.close();
  }
}

async function withDocs(run, setup) { return withPage('docs.html', run, setup); }

test('docs alert dialog confirmation closes its namespaced overlay', async () => {
  await withDocs(async page => {
    await page.locator('#alert-dialog [data-db-trigger]').click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete this draft?' });
    await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Delete draft', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.match(await page.locator('#alert-dialog pre').textContent(), /DAUB\.closeAlertDialog\('example-alert-dialog-confirm-delete'\)/);
  });
});

test('docs command inline handler opens its namespaced command palette', async () => {
  await withDocs(async page => {
    const trigger = page.locator('#command-palette [data-db-command-trigger]');
    await trigger.evaluate(element => element.onclick());
    const dialog = page.getByRole('dialog', { name: 'Command palette', exact: true });
    await dialog.waitFor();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.match(await page.locator('#command-palette pre').textContent(), /DAUB\.openCommand\('example-command-palette-cmd'\)/);
  });
});

test('docs renders pinned local Lucide icons without third-party requests', async () => {
  await withDocs(async page => {
    await page.locator('#input-with-icon svg.lucide-search').waitFor();
    assert.equal(await page.locator('script[src="assets/lucide.min.js"]').count(), 1);
    assert.ok(await page.locator('svg.lucide').count() >= 7);
  });
});

test('docs search preserves entered values, selected controls, and sample DOM nodes', async () => {
  await withDocs(async page => {
    await page.locator('#text-field .docs-component__preview input').fill('owner@example.com');
    await page.locator('#checkbox .docs-component__preview label').click();
    await page.locator('#radio-group .docs-component__preview label').filter({ hasText: 'Team' }).click();
    await page.evaluate(() => { window.sampleInput = document.querySelector('#text-field .docs-component__preview input'); });
    await page.getByLabel('Search components', { exact: true }).fill('nonexistent-sample');
    await page.getByText('No components match your search.', { exact: true }).waitFor();
    await page.getByLabel('Search components', { exact: true }).fill('');
    assert.equal(await page.locator('#text-field .docs-component__preview input').inputValue(), 'owner@example.com');
    assert.equal(await page.locator('#checkbox .docs-component__preview input').isChecked(), true);
    assert.equal(await page.locator('#radio-group .docs-component__preview input[value="team"]').isChecked(), true);
    assert.equal(await page.evaluate(() => window.sampleInput === document.querySelector('#text-field .docs-component__preview input')), true);
    await page.locator('#switch [role="switch"]').click();
    assert.equal(await page.locator('#switch [role="switch"]').getAttribute('aria-checked'), 'true');
  });
});

for (const mode of ['missing', 'denied']) {
  test('docs clipboard ' + mode + ' selects the displayed sample without losing form state', async () => {
    await withDocs(async page => {
      const sample = page.locator('#text-field');
      await sample.locator('.docs-component__preview input').fill('owner@example.com');
      const source = await sample.locator('pre').textContent();
      await sample.getByRole('button', { name: 'Copy Text Field example' }).click();
      await page.getByRole('status').filter({ hasText: 'Clipboard unavailable.' }).waitFor();
      assert.equal(await page.evaluate(() => getSelection().toString()), source);
      assert.equal(await sample.locator('.docs-component__preview input').inputValue(), 'owner@example.com');
      assert.equal(await sample.locator('pre').textContent(), source);
    }, page => page.addInitScript(mode => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: mode === 'missing' ? undefined : { writeText: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')) }
      });
    }, mode));
  });
}

test('docs copy keeps source stable after editing and filtering a sample', async () => {
  await withDocs(async page => {
    const source = await page.locator('#text-field pre').textContent();
    await page.locator('#text-field .docs-component__preview input').fill('owner@example.com');
    await page.getByLabel('Search components', { exact: true }).fill('Text Field');
    await page.getByRole('button', { name: 'Copy Text Field example' }).click();
    await page.waitForFunction(() => window.copyCalls === 1);
    assert.equal(await page.evaluate(() => window.copiedExample), source);
    assert.equal(await page.locator('#text-field .docs-component__preview input').inputValue(), 'owner@example.com');
  }, page => page.addInitScript(() => {
    window.copyCalls = 0;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: value => { window.copiedExample = value; window.copyCalls++; return Promise.resolve(); }
    } });
  }));
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
