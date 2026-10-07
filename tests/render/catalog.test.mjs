import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('components.json', root), 'utf8'));
const runtime = await readFile(new URL('daub.js', root), 'utf8');
const css = await readFile(new URL('daub.css', root), 'utf8');
let browser;
let page;
before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  page = await browser.newPage();
  page.setDefaultTimeout(3000);
  const image = await readFile(new URL('og-image.png', root));
  await page.route('http://daub.test/**', route => route.fulfill(route.request().url().endsWith('/og-image.png') ? { contentType: 'image/png', body: image } : { contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' }));
  await page.goto('http://daub.test/');
});
after(async () => { await browser?.close(); });

async function installExample(component) {
  await page.goto('http://daub.test/');
  await page.setContent(`<main id="example">${component.html}</main>`);
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: runtime });
  await page.evaluate(() => DAUB.init(document.getElementById('example')));
}

test('catalog contains 91 distinct components', () => {
  assert.equal(catalog.components.length, 91);
  assert.equal(new Set(catalog.components.map(c => c.name)).size, 91);
});

for (const component of catalog.components) {
  test(`catalog: ${component.name} has useful, named, valid HTML`, async () => {
    assert.match(component.html, /<\w+/);
    assert.doesNotMatch(component.html, /<svg>\.\.\.<\/svg>|>\.\.\.<|<!--\s*(?:long content|calendar markup|icon)\s*-->|<canvas[^>]*><\/canvas>|(?:photo|user\d)\.jpg/);
    assert.doesNotMatch(component.html, /<button\b[^>]*>(?:(?!<\/button>)[\s\S])*<button\b/);
    await installExample(component);
    for (const src of await page.locator('#example img').evaluateAll(images => images.map(image => image.getAttribute('src')))) {
      const url = new URL(src, 'http://daub.test/');
      if (url.origin === 'http://daub.test') {
        const asset = new URL(`.${decodeURIComponent(url.pathname)}`, root);
        assert.ok(asset.href.startsWith(root.href), `${component.name}: asset outside repository`);
        assert.ok((await stat(asset)).isFile(), `${component.name}: missing ${src}`);
      }
    }
    await page.waitForFunction(() => [...document.querySelectorAll('#example img')].every(image => image.complete));
    const issues = await page.evaluate(() => {
      const issues = [];
      const host = document.getElementById('example');
      const name = el => el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim() || [...(el.labels || [])].map(label => label.textContent).join(' ').trim() || (el.matches('input,select,textarea') ? '' : el.textContent.trim());
      host.querySelectorAll('button,a,input,select,textarea,[role="switch"],[role="progressbar"],[role="meter"]').forEach(el => {
        if (el.type !== 'hidden' && !name(el)) issues.push(`Unnamed ${el.outerHTML}`);
      });
      host.querySelectorAll('label[for]').forEach(el => {
        if (!document.getElementById(el.htmlFor)) issues.push(`Missing label target: ${el.htmlFor}`);
      });
      host.querySelectorAll('[data-db-modal-trigger],[data-db-trigger],[data-db-command-trigger]').forEach(el => {
        const attr = [...el.attributes].find(attr => attr.name.endsWith('-trigger'));
        if (!document.getElementById(attr.value)) issues.push(`Missing trigger target: ${attr.value}`);
      });
      host.querySelectorAll('.db-calendar').forEach(el => {
        if (el.querySelectorAll('.db-calendar__day-label').length !== 7 || el.querySelectorAll('.db-calendar__day').length < 28) issues.push('Incomplete calendar');
      });
      host.querySelectorAll('a').forEach(el => {
        if (!el.getAttribute('href') || el.getAttribute('href') === '#') issues.push(`Empty link: ${el.textContent}`);
      });
      host.querySelectorAll('img').forEach(image => {
        if (!image.naturalWidth) issues.push(`Broken image: ${image.getAttribute('src')}`);
      });
      return issues;
    });
    assert.deepEqual(issues, []);
  });
}

test('catalog modifiers match CSS selectors', () => {
  const selectors = new Set([...css.matchAll(/\.(db-[a-zA-Z0-9_-]+)/g)].map(match => match[1]));
  for (const component of catalog.components) {
    for (const modifier of component.modifiers) assert.ok(selectors.has(component.class + modifier), `${component.name}: ${modifier}`);
  }
});

for (const [name, selector, openClass] of [
  ['Modal', '.db-modal-overlay', 'db-modal--open'],
  ['Modal Overlay', '.db-modal-overlay', 'db-modal--open'],
  ['Alert Dialog', '.db-alert-dialog', 'db-alert-dialog--open'],
  ['Sheet', '.db-sheet', 'db-sheet--open'],
  ['Drawer', '.db-drawer', 'db-drawer--open'],
  ['Command Palette', '.db-command', 'db-command--open'],
]) {
  test(`catalog: ${name} trigger opens and Escape closes`, async () => {
    await installExample(catalog.components.find(component => component.name === name));
    await page.locator('#example > button').click();
    assert.ok(await page.locator(selector).evaluate((el, cls) => el.classList.contains(cls), openClass));
    await page.keyboard.press('Escape');
    await page.locator(selector).waitFor({ state: 'hidden' });
    assert.equal(await page.locator(selector).evaluate((el, cls) => el.classList.contains(cls), openClass), false);
  });
}

test('catalog: Number Field steps and respects its minimum', async () => {
  await installExample(catalog.components.find(component => component.name === 'Number Field'));
  const input = page.locator('input');
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  assert.equal(await input.inputValue(), '4');
  await input.fill('0');
  await page.getByRole('button', { name: 'Decrease quantity' }).click();
  assert.equal(await input.inputValue(), '0');
});

test('catalog: Date Picker has a usable calendar and selected value', async () => {
  await installExample(catalog.components.find(component => component.name === 'Date Picker'));
  await page.locator('.db-date-picker__trigger').click();
  await page.locator('.db-calendar__day:not(.db-calendar__day--outside)').filter({ hasText: /^15$/ }).click();
  assert.equal(await page.locator('.db-date-picker__trigger').textContent(), '2026-02-15');
  assert.equal(await page.locator('.db-date-picker').evaluate(el => el.classList.contains('db-date-picker--open')), false);
});

test('catalog: Data Table can select all and sort multiple rows', async () => {
  await installExample(catalog.components.find(component => component.name === 'Data Table'));
  await page.getByRole('checkbox', { name: 'Select all rows' }).check();
  assert.deepEqual(await page.locator('tbody input').evaluateAll(inputs => inputs.map(input => input.checked)), [true, true]);
  await page.locator('th[data-sortable]').click();
  await page.locator('th[data-sortable]').click();
  assert.deepEqual(await page.locator('tbody tr td:last-child').allTextContents(), ['Project Birch', 'Project Aurora']);
});

test('catalog: Toolbar uses pressable formatting controls', async () => {
  await installExample(catalog.components.find(component => component.name === 'Toolbar'));
  await page.getByRole('button', { name: 'Bold' }).click();
  assert.equal(await page.getByRole('button', { name: 'Bold' }).getAttribute('aria-pressed'), 'true');
});
